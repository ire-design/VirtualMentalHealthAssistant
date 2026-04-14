from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os
from dotenv import load_dotenv
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from datetime import timedelta, datetime, timezone
from flask_migrate import Migrate
from models import db_sql, Resource
import db

load_dotenv()
migrate = Migrate()

app = Flask(__name__)

app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db_sql.init_app(app)
migrate.init_app(app, db_sql)
CORS(
    app,
    resources={r"/*": {"origins": [
        "https://virtual-mental-health-assistant.vercel.app",
        "http://localhost:5173"
    ]}},
    allow_headers=["Content-Type", "Authorization"],
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    supports_credentials=True,
    max_age=86400
)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "dev-secret-change-me")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(days=7)
jwt = JWTManager(app)
db.init_db()

#  Pinecone lazy loading (no sentence-transformers, no torch) 
_pc = None
_index = None

def get_pinecone_client():
    global _pc
    if _pc is None:
        PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
        if PINECONE_API_KEY:
            try:
                from pinecone import Pinecone
                _pc = Pinecone(api_key=PINECONE_API_KEY)
            except Exception as e:
                print("Pinecone client error:", e)
    return _pc

def get_pinecone_index():
    global _index
    if _index is None:
        pc = get_pinecone_client()
        if pc:
            try:
                _index = pc.Index("mental-health-assistant")
            except Exception as e:
                print("Pinecone index error:", e)
    return _index

# Constants 
MIN_QUERY_CHARS_FOR_RETRIEVAL = 12
PINECONE_SCORE_THRESHOLD = 0.78
MAX_CONTEXT_MATCHES = 3
SKIP_RETRIEVAL_EXACT = {
    "hi", "hey", "hello", "yoh", "niaje", "sasa", "mambo", "lol",
    "ok", "okay", "no", "noo", "yes", "yeah", "yep", "sure",
    "thanks", "thank you"
}

#  Helpers 
def sanitize_history(history):
    if not isinstance(history, list):
        return []
    cleaned = []
    for msg in history:
        if not isinstance(msg, dict):
            continue
        role = (msg.get("role") or "").strip()
        content = msg.get("content")
        if role not in ("user", "assistant"):
            continue
        if not isinstance(content, str):
            continue
        content = content.strip()
        if not content:
            continue
        cleaned.append({"role": role, "content": content})
    return cleaned[-20:]

def is_short_greeting(message: str) -> bool:
    msg = (message or "").strip().lower()
    if not msg:
        return True
    if msg in SKIP_RETRIEVAL_EXACT:
        return True
    if len(msg) <= 5 and msg in {"hi", "hey", "yo", "yoh"}:
        return True
    return False

def local_smalltalk_reply(message: str) -> str:
    msg = (message or "").strip().lower()
    if msg in {"hi", "hey", "hello", "hello there", "niaje", "sasa", "mambo", "yoh"}:
        return "Hey. I'm here with you. If school has been heavy lately, you can share what's been hardest."
    if msg in {"ok", "okay", "sure"}:
        return "Alright. I'm here—whenever you're ready, you can share what's weighing on you."
    if msg in {"thanks", "thank you"}:
        return "You're welcome. I'm here with you."
    return "I'm here. If you want, tell me what's going on with school or your stress right now."

def retrieve_context(question: str) -> str:
    """
    Embed the user question using Pinecone's hosted multilingual-e5-large model
    and retrieve relevant mental health context chunks.
    No local model — embedding runs on Pinecone's servers.
    """
    pc = get_pinecone_client()
    index = get_pinecone_index()

    if not pc or not index:
        return ""

    q = (question or "").strip()
    q_lower = q.lower()
    if len(q) < MIN_QUERY_CHARS_FOR_RETRIEVAL or q_lower in SKIP_RETRIEVAL_EXACT:
        return ""

    try:
        # "query" input_type is for user questions (vs "passage" for stored docs)
        embedding_response = pc.inference.embed(
            model="multilingual-e5-large",
            inputs=[q],
            parameters={"input_type": "query"}
        )
        query_vector = embedding_response[0].values

        results = index.query(
            vector=query_vector,
            top_k=MAX_CONTEXT_MATCHES,
            include_metadata=True
        )
        matches = getattr(results, "matches", None) or []
        if not matches:
            return ""

        top_score = getattr(matches[0], "score", None)
        if top_score is not None and top_score < PINECONE_SCORE_THRESHOLD:
            return ""

        context_chunks = []
        for m in matches:
            md = getattr(m, "metadata", None) or {}
            txt = md.get("text")
            if txt:
                context_chunks.append(txt)
        return "\n\n---\n\n".join(context_chunks).strip()

    except Exception as e:
        print("Pinecone retrieval error:", e)
        return ""

def ask_llm(question: str, context: str, history=None) -> str:
    if not OPENROUTER_API_KEY:
        return "AI service unavailable."
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json"
    }
    system_prompt = """
You are a warm, emotionally intelligent mental health support assistant
for Kenyan university students experiencing academic stress.

CORE ROLE:
- You exist ONLY to support mental health and academic stress.
- You may casually engage, but must gently steer conversations back to academic stress and mental wellbeing.

STYLE:
- Calm, human, natural (not robotic)
- Supportive but not overly clinical
- Remember personal details shared in the conversation
- Avoid repeating generic questions
- Follow formatting requests (brief, detailed, etc.)
- If the user gets frustrated, adjust tone immediately
- Respond in flowing, conversational prose. No bullet points or numbered lists unless explicitly asked.
- Do NOT ask questions unless the user explicitly invites them.

IMPORTANT:
- Always respond primarily to the user's last message.
- You may receive optional background text. Use it ONLY if it is clearly relevant.
- Never mention or refer to any background/context/documents.

You are not a therapist. You are a supportive, emotionally aware assistant.

CRISIS HANDLING RULES:
- If user expresses suicidal thoughts, do not abandon them.
- Respond with empathy, then suggest external help (helplines).
- Stay calm, human, supportive; do not be repetitive.
""".strip()

    messages = [{"role": "system", "content": system_prompt}]
    if history and isinstance(history, list):
        messages.extend(history)
    if context and isinstance(context, str) and context.strip():
        messages.append({
            "role": "system",
            "content": "Optional background text for the assistant. Use only if clearly relevant to the user's last message. Do not mention or quote it.\n\n" + context.strip()
        })
    messages.append({"role": "user", "content": question})

    payload = {
        "model": "openai/gpt-3.5-turbo",
        "messages": messages,
        "temperature": 0.4
    }

    try:
        last_err = None
        for attempt in range(3):
            try:
                response = requests.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=30
                )
                if response.status_code >= 400:
                    print("OpenRouter HTTP", response.status_code, response.text[:500])
                response.raise_for_status()
                data = response.json()
                if "choices" in data and data["choices"]:
                    return data["choices"][0]["message"]["content"]
                return "Sorry, I'm having trouble responding right now."
            except Exception as e:
                last_err = e
                import time
                time.sleep(0.8 * (attempt + 1))
        print("LLM Error (after retries):", last_err)
        return "AI service unavailable."
    except Exception as e:
        print("LLM Error:", e)
        return "AI service unavailable."


#  Crisis & stress detection 
CRISIS_KEYWORDS = [
    "suicide", "suicidal", "kill myself","kill my self","overdose", "over dose" "end my life", "want to die",
    "self harm", "hurt myself", "can't go on", "dropping out", "quit school",
    "no way out", "can't continue university", "hopelessness", "giving up on life"
]

def is_crisis(message: str) -> bool:
    return any(keyword in (message or "").lower() for keyword in CRISIS_KEYWORDS)

def assess_stress_level(message: str) -> str:
    message_lower = (message or "").lower()
    severe_keywords = [
        "can't cope", "overwhelming", "breaking down", "mental breakdown",
        "can't sleep", "panic attack", "anxiety attack", "severe stress",
        "extremely stressed", "too much pressure", "can't handle"
    ]
    moderate_keywords = [
        "stressed", "anxious", "worried", "nervous", "pressure", "difficult",
        "struggling", "exhausted", "tired", "overwhelmed", "hectic",
        "might quit", "want to quit", "quit school", "drop out"
    ]
    if any(k in message_lower for k in severe_keywords):
        return "severe"
    if any(k in message_lower for k in moderate_keywords):
        return "moderate"
    return "low"

def _parse_iso(s):
    try:
        return datetime.fromisoformat((s or "").replace("Z", "+00:00"))
    except Exception:
        return None

def _within_days(ts_iso, days):
    dt = _parse_iso(ts_iso)
    if not dt:
        return False
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    return (now - dt).total_seconds() <= days * 24 * 3600

THEME_KEYWORDS = {
    "academics": [
        "exam", "exams", "midterm", "finals", "quiz", "cat", "assignment",
        "deadline", "coursework", "thesis", "dissertation", "submission",
        "project", "presentation", "grades", "gpa", "fail", "failing",
        "marks", "study", "studying", "revision", "lecture", "semester",
        "unit", "units", "syllabus", "timetable"
    ],
    "sleep": ["sleep", "insomnia", "can't sleep", "tired", "exhausted", "sleep deprived"],
    "money": ["fees", "helb", "bursary", "upkeep", "rent", "money", "financial"],
    "relationships": ["boyfriend", "girlfriend", "breakup", "relationship", "heartbreak"],
    "motivation": ["procrastination", "motivation", "focus", "concentration", "distracted"],
}

def _themes_for_text(txt):
    t = (txt or "").lower()
    hits = []
    for theme, words in THEME_KEYWORDS.items():
        if any(w in t for w in words):
            hits.append(theme)
    return hits


#── Routes ───
@app.route("/")
def home():
    return "Virtual Mental Health Assistant Backend is running"

@app.route("/chat", methods=["POST"])
@jwt_required(optional=True)
def chat():
    try:
        email = get_jwt_identity()
        data = request.get_json(silent=True) or {}
        question = (data.get("message") or "").strip()
        history = sanitize_history(data.get("history", []))
        convo_id = data.get("convo_id")

        if not question:
            return jsonify({"reply": "Please enter a message."}), 400

        if email and convo_id is not None:
            db.save_message(email, str(convo_id), "user", question)

        if is_crisis(question):
            reply = (
                "I'm really concerned about what you're sharing. Please reach out immediately:\n\n"
                "Befrienders Kenya: +254 793 594 849 / +254 754 580 252\n"
                "Befrienders Email: info@befrienderskenya.org\n"
                "MHFA Kenya: +254 114 794 109\n"
                "MHFA Email: info@mhfakenya.org\n"
                "Emergency: 999 / 112\n\n"
                "You don't have to face this alone. Help is available right now."
            )
            if email and convo_id is not None:
                db.save_message(email, str(convo_id), "assistant", reply)
            return jsonify({"reply": reply, "stress_level": "crisis", "is_crisis": True})

        if is_short_greeting(question):
            reply = local_smalltalk_reply(question)
            if email and convo_id is not None:
                db.save_message(email, str(convo_id), "assistant", reply)
            return jsonify({"reply": reply, "stress_level": "low", "is_crisis": False}), 200

        stress_level = assess_stress_level(question)
        context = retrieve_context(question)
        answer = ask_llm(question, context, history)

        if email and convo_id is not None:
            db.save_message(email, str(convo_id), "assistant", answer)

        return jsonify({"reply": answer, "stress_level": stress_level, "is_crisis": False})

    except Exception as e:
        print("Chat Endpoint Error:", e)
        return jsonify({"reply": "Server error occurred."}), 500

@app.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    email = data.get("email")
    password = data.get("password")
    name = data.get("name")
    if not email or not password or not name:
        return jsonify({"error": "Missing fields"}), 400
    user = db.create_user(email, password, name)
    if not user:
        return jsonify({"error": "User already exists"}), 400
    token = create_access_token(identity=user["email"])
    return jsonify({"token": token, "user": user}), 201

@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = data.get("email")
    password = data.get("password")
    user = db.verify_user(email, password)
    if not user:
        return jsonify({"error": "Invalid credentials"}), 401
    token = create_access_token(identity=user["email"])
    return jsonify({"token": token, "user": user}), 200

@app.route("/conversations", methods=["GET"])
@jwt_required()
def get_user_conversations():
    email = get_jwt_identity()
    convos = db.get_conversations(email)
    convos_sorted = sorted(convos, key=lambda c: c.get("created_at") or "", reverse=True)
    result = []
    for convo in convos_sorted:
        preview = "New conversation"
        if convo.get("messages"):
            first_user = next((m for m in convo["messages"] if m.get("role") == "user"), None)
            txt = ""
            if first_user and first_user.get("content"):
                txt = first_user["content"]
            else:
                txt = (convo["messages"][0].get("content") or "").strip()
            if txt:
                preview = txt[:60] + ("..." if len(txt) > 60 else "")
        result.append({
            "id": convo["id"],
            "preview": preview,
            "created_at": convo.get("created_at")
        })
    return jsonify({"conversations": result}), 200

@app.route("/conversation/<convo_id>", methods=["GET"])
@jwt_required()
def get_conversation(convo_id):
    email = get_jwt_identity()
    convo = db.get_conversation(email, str(convo_id))
    if not convo:
        return jsonify({"error": "Conversation not found"}), 404
    return jsonify(convo), 200

@app.route("/conversation/new", methods=["POST"])
@jwt_required()
def new_conversation():
    email = get_jwt_identity()
    convo_id = db.create_conversation(email)
    return jsonify({"convo_id": convo_id}), 201

@app.route("/conversation/<convo_id>", methods=["DELETE"])
@jwt_required()
def soft_delete_conversation(convo_id):
    email = get_jwt_identity()
    deleted = db.soft_delete_conversation(email, str(convo_id))
    if not deleted:
        return jsonify({"error": "Conversation not found"}), 404
    return jsonify({
        "deleted": True,
        "convo_id": str(convo_id),
        "undo_ttl_seconds": db.UNDO_TTL_SECONDS
    }), 200

@app.route("/conversation/<convo_id>/undo-delete", methods=["POST"])
@jwt_required()
def undo_delete_conversation(convo_id):
    email = get_jwt_identity()
    convo = db.undo_delete_conversation(email, str(convo_id))
    if not convo:
        return jsonify({"error": "Undo window expired or conversation not found"}), 404
    return jsonify({"restored": True, "conversation": convo}), 200

@app.route("/dashboard/summary", methods=["GET"])
@jwt_required()
def dashboard_summary():
    email = get_jwt_identity()
    convos = db.get_conversations(email)
    convos_sorted = sorted(convos, key=lambda c: c.get("created_at") or "", reverse=True)
    recent = []
    for c in convos_sorted[:10]:
        preview = "New conversation"
        if c.get("messages"):
            last = c["messages"][-1]
            txt = (last.get("content") or "").strip()
            if txt:
                preview = txt[:80] + ("..." if len(txt) > 80 else "")
        recent.append({
            "id": c.get("id"),
            "created_at": c.get("created_at"),
            "preview": preview,
            "message_count": len(c.get("messages") or [])
        })
    return jsonify({
        "total_conversations": len(convos),
        "recent_conversations": recent
    }), 200

@app.route("/dashboard/insights", methods=["GET"])
@jwt_required()
def dashboard_insights():
    email = get_jwt_identity()
    convos = db.get_conversations(email)
    days = request.args.get("days", "7")
    try:
        days_int = max(1, min(60, int(days)))
    except Exception:
        days_int = 7

    stress_counts = {"low": 0, "moderate": 0, "severe": 0, "crisis": 0}
    theme_counts = {k: 0 for k in THEME_KEYWORDS.keys()}
    crisis_recent = False
    total_user_msgs = 0

    for convo in convos:
        for m in convo.get("messages") or []:
            if (m.get("role") or "") != "user":
                continue
            if not _within_days(m.get("timestamp"), days_int):
                continue
            txt = (m.get("content") or "").strip()
            if not txt:
                continue
            total_user_msgs += 1
            if is_crisis(txt):
                stress_counts["crisis"] += 1
                crisis_recent = True
            else:
                lvl = assess_stress_level(txt)
                stress_counts[lvl] = stress_counts.get(lvl, 0) + 1
            for th in _themes_for_text(txt):
                theme_counts[th] += 1

    top_themes = sorted(
        [{"theme": k, "count": v} for k, v in theme_counts.items() if v > 0],
        key=lambda x: x["count"],
        reverse=True
    )[:3]

    dominant = "low"
    if stress_counts["crisis"] > 0:
        dominant = "crisis"
    elif stress_counts["severe"] > 0 and stress_counts["severe"] >= stress_counts["moderate"]:
        dominant = "severe"
    elif stress_counts["moderate"] > 0:
        dominant = "moderate"

    moods = db.get_moods(email)
    today = datetime.now(timezone.utc).date().isoformat()
    mood_today = next((m for m in moods if str(m.get("date")) == today), None)
    # Mood average score
    MOOD_SCORES = {"great": 5, "okay": 4, "stressed": 3, "low": 2, "overwhelmed": 1}
    recent_moods = [
        m for m in db.get_moods(email)
        if _within_days(str(m.get("date")), days_int)
    ]
    mood_scores = [MOOD_SCORES.get(str(m.get("mood", "")).lower(), 0) for m in recent_moods if m.get("mood")]
    mood_average = round(sum(mood_scores) / len(mood_scores), 1) if mood_scores else None

    # Stress percentages
    stress_pct = {}
    if total_user_msgs > 0:
        for k, v in stress_counts.items():
            stress_pct[k] = round((v / total_user_msgs) * 100, 1)
    else:
        stress_pct = {k: 0 for k in stress_counts}

    return jsonify({
        "window_days": days_int,
        "total_user_messages": total_user_msgs,
        "stress_distribution": stress_counts,
        "stress_percentages": stress_pct,
        "dominant_stress_level": dominant,
        "top_themes": top_themes,
        "crisis_recent": crisis_recent,
        "mood_today": mood_today,
        "mood_average": mood_average,
        "mood_entries_count": len(mood_scores)
    }), 200

@app.route("/mood", methods=["GET"])
@jwt_required()
def get_mood():
    email = get_jwt_identity()
    days = request.args.get("days", "30")
    try:
        days_int = max(1, min(365, int(days)))
    except Exception:
        days_int = 30

    moods = db.get_moods(email)
    cutoff = datetime.now(timezone.utc).date().toordinal() - days_int + 1
    filtered = []
    for m in moods:
        d = str(m.get("date") or "")
        try:
            ord_d = datetime.fromisoformat(d).date().toordinal()
        except Exception:
            continue
        if ord_d >= cutoff:
            filtered.append(m)
    return jsonify({"moods": filtered}), 200

@app.route("/mood", methods=["POST"])
@jwt_required()
def upsert_mood():
    email = get_jwt_identity()
    data = request.get_json(silent=True) or {}
    mood = (data.get("mood") or "").strip().lower()
    tags = data.get("tags") or []
    note = data.get("note") or ""
    date = (data.get("date") or "").strip()

    allowed = {"great", "okay", "stressed", "low", "overwhelmed"}
    if mood not in allowed:
        return jsonify({"error": "Invalid mood"}), 400

    if date:
        try:
            datetime.fromisoformat(date).date()
        except Exception:
            return jsonify({"error": "Invalid date"}), 400
    else:
        date = datetime.now(timezone.utc).date().isoformat()

    if not isinstance(tags, list):
        tags = []
    tags = [str(t).strip().lower() for t in tags if str(t).strip()]

    entry = db.upsert_mood(email, date, mood, tags=tags, note=note)
    return jsonify({"saved": True, "mood": entry}), 201

@app.route("/resources", methods=["GET"])
def get_resources():
    category = request.args.get("category", "").strip().lower()
    query = Resource.query
    if category:
        query = query.filter(Resource.category.ilike(f"%{category}%"))
    resources = query.order_by(Resource.category, Resource.title).all()
    return jsonify({"resources": [
        {"id": r.id, "title": r.title, "category": r.category,
         "description": r.description, "link": r.link}
        for r in resources
    ]}), 200

@app.route("/resources", methods=["POST"])
@jwt_required()
def add_resource():
    data = request.get_json(silent=True) or {}
    title    = (data.get("title") or "").strip()
    category = (data.get("category") or "").strip()
    if not title or not category:
        return jsonify({"error": "Title and category are required"}), 400
    r = Resource(
        title=title,
        category=category,
        description=(data.get("description") or "").strip(),
        link=(data.get("link") or "").strip()
    )
    db_sql.session.add(r)
    db_sql.session.commit()
    return jsonify({"created": True, "id": r.id}), 201

@app.route("/resources/<int:resource_id>", methods=["DELETE"])
@jwt_required()
def delete_resource(resource_id):
    r = Resource.query.get(resource_id)
    if not r:
        return jsonify({"error": "Not found"}), 404
    db_sql.session.delete(r)
    db_sql.session.commit()
    return jsonify({"deleted": True}), 200

@app.route("/resources/seed", methods=["POST"])
def seed_resources():
    if Resource.query.count() > 0:
        return jsonify({"message": "Already seeded"}), 200
    seeds = [
        {"title": "Exam Anxiety Grounding Techniques", "category": "video",
         "description": "Short grounding and calming tips for exam anxiety", "link": "https://www.youtube.com/results?search_query=exam+anxiety+grounding+techniques"},
        {"title": "Box Breathing (4-4-4-4) Explained", "category": "video",
         "description": "Visual guide to box breathing for stress relief", "link": "https://www.youtube.com/results?search_query=box+breathing+4-4-4-4"},
        {"title": "Pomodoro Technique", "category": "article",
         "description": "Study focus technique using timed intervals", "link": "https://en.wikipedia.org/wiki/Pomodoro_Technique"},
        {"title": "Spaced Repetition", "category": "article",
         "description": "Study smarter using spaced repetition memory technique", "link": "https://en.wikipedia.org/wiki/Spaced_repetition"},
        {"title": "Befrienders Kenya", "category": "emergency",
         "description": "Suicide prevention and emotional crisis support. Call: +254 793 594 849", "link": "mailto:info@befrienderskenya.org"},
        {"title": "MHFA Kenya", "category": "emergency",
         "description": "Mental health first aid support and referrals. Call: +254 114 794 109", "link": "mailto:info@mhfakenya.org"},
        {"title": "Progressive Muscle Relaxation", "category": "technique",
         "description": "Tense and relax each muscle group to reduce physical stress", "link": ""},
        {"title": "5-4-3-2-1 Grounding", "category": "technique",
         "description": "Name 5 things you see, 4 hear, 3 touch, 2 smell, 1 taste", "link": ""},
        {"title": "MUT Counselling Office", "category": "campus",
         "description": "Murang'a University Student Guidance and Counselling Office", "link": ""},
    ]
    for s in seeds:
        db_sql.session.add(Resource(**s))
    db_sql.session.commit()
    return jsonify({"seeded": len(seeds)}), 201

@app.route("/reports", methods=["GET", "OPTIONS"])
@jwt_required()
def get_reports():
    if request.method == "OPTIONS":
        return jsonify({}), 200
    email = get_jwt_identity()
    if not email:
        return jsonify({"error": "Authentication required"}), 401
    start_date = request.args.get("start_date", "").strip()
    end_date = request.args.get("end_date", "").strip()

    if not start_date or not end_date:
        return jsonify({"error": "start_date and end_date are required"}), 400

    try:
        start_dt = datetime.fromisoformat(start_date).replace(tzinfo=timezone.utc)
        end_dt = datetime.fromisoformat(end_date).replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
    except Exception:
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400

    convos = db.get_conversations(email)

    stress_counts = {"low": 0, "moderate": 0, "severe": 0, "crisis": 0}
    theme_counts = {k: 0 for k in THEME_KEYWORDS.keys()}
    total_user_msgs = 0
    total_ai_msgs = 0
    crisis_count = 0

    for convo in convos:
        for m in convo.get("messages") or []:
            ts = _parse_iso(m.get("timestamp"))
            if not ts:
                continue
            if not (start_dt <= ts <= end_dt):
                continue
            role = (m.get("role") or "")
            if role == "assistant":
                total_ai_msgs += 1
                continue
            if role != "user":
                continue
            txt = (m.get("content") or "").strip()
            if not txt:
                continue
            total_user_msgs += 1
            if is_crisis(txt):
                stress_counts["crisis"] += 1
                crisis_count += 1
            else:
                lvl = assess_stress_level(txt)
                stress_counts[lvl] += 1
            for th in _themes_for_text(txt):
                theme_counts[th] += 1

    total_msgs = total_user_msgs + total_ai_msgs

    stress_pct = {}
    for k, v in stress_counts.items():
        stress_pct[k] = round((v / total_user_msgs) * 100, 1) if total_user_msgs > 0 else 0

    top_themes = sorted(
        [{"theme": k, "count": v} for k, v in theme_counts.items() if v > 0],
        key=lambda x: x["count"], reverse=True
    )

    # Mood data in range
    MOOD_SCORES = {"great": 5, "okay": 4, "stressed": 3, "low": 2, "overwhelmed": 1}
    moods = db.get_moods(email)
    mood_in_range = []
    mood_breakdown = {"great": 0, "okay": 0, "stressed": 0, "low": 0, "overwhelmed": 0}

    for m in moods:
        try:
            d = datetime.fromisoformat(str(m.get("date"))).replace(tzinfo=timezone.utc)
        except Exception:
            continue
        if start_dt <= d <= end_dt:
            mood_in_range.append(m)
            key = str(m.get("mood", "")).lower()
            if key in mood_breakdown:
                mood_breakdown[key] += 1

    mood_scores = [MOOD_SCORES.get(str(m.get("mood", "")).lower(), 0) for m in mood_in_range]
    mood_average = round(sum(mood_scores) / len(mood_scores), 1) if mood_scores else None

    dominant = "low"
    if stress_counts["crisis"] > 0:
        dominant = "crisis"
    elif stress_counts["severe"] >= stress_counts["moderate"] and stress_counts["severe"] > 0:
        dominant = "severe"
    elif stress_counts["moderate"] > 0:
        dominant = "moderate"

    return jsonify({
        "start_date": start_date,
        "end_date": end_date,
        "total_conversations": len(convos),
        "total_messages": total_msgs,
        "total_user_messages": total_user_msgs,
        "total_ai_messages": total_ai_msgs,
        "stress_distribution": stress_counts,
        "stress_percentages": stress_pct,
        "dominant_stress_level": dominant,
        "crisis_count": crisis_count,
        "top_themes": top_themes,
        "mood_average": mood_average,
        "mood_breakdown": mood_breakdown,
        "mood_entries_count": len(mood_in_range)
    }), 200

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)