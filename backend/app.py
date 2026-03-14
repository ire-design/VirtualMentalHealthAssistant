from flask import Flask, request, jsonify
from flask_cors import CORS
from pinecone import Pinecone
from sentence_transformers import SentenceTransformer
import requests
import os
from dotenv import load_dotenv
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    jwt_required,
    get_jwt_identity,
)
from datetime import timedelta
import db

load_dotenv()

app = Flask(__name__)
CORS(app)

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "dev-secret-change-me")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(days=7)
jwt = JWTManager(app)

db.init_db()

pc = None
index = None
model = None

if PINECONE_API_KEY:
    try:
        pc = Pinecone(api_key=PINECONE_API_KEY)
        index = pc.Index("mental-health-assistant")
        model = SentenceTransformer("all-MiniLM-L6-v2")
    except Exception as e:
        print("Pinecone/Embedding initialization error:", e)
else:
    print("PINECONE_API_KEY missing. Context retrieval will be skipped.")


def retrieve_context(question: str) -> str:
    if not index or not model:
        return "No relevant context found."
    try:
        query_vector = model.encode(question).tolist()
        results = index.query(vector=query_vector, top_k=3, include_metadata=True)

        if results.matches and len(results.matches) > 0:
            context = [
                match.metadata["text"]
                for match in results.matches
                if match.metadata and "text" in match.metadata
            ]
            return "\n\n---\n\n".join(context)

        return "No relevant context found."
    except Exception as e:
        print("Pinecone Error:", e)
        return "Context retrieval failed."


def ask_llm(question: str, context: str, history=None) -> str:
    if not OPENROUTER_API_KEY:
        return "AI service unavailable."

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }

    system_prompt = """
You are a warm, emotionally intelligent mental health support assistant
for Kenyan university students experiencing academic stress.

Your personality:
- Calm, human, natural (not robotic)
- Supportive but not overly clinical
- Remember personal details shared in the conversation
- Avoid repeating generic questions
- Follow formatting requests (brief, detailed, etc.)
- If the user gets frustrated, adjust tone immediately
- Respond in flowing, conversational prose. No bullet points or numbered lists unless explicitly asked.
Do NOT ask questions unless the user explicitly invites them.

Never reference "context", "documents", or any internal data sources in your responses.
Integrate knowledge naturally as if it's your own understanding.

If the user asks you to stop asking questions, STOP immediately and never ask another question unless they explicitly invite it.
Adapt your style based on direct feedback and never revert back.

Internally assess stress as low, moderate, or severe and adjust your tone accordingly.

You are not a therapist. You are a supportive, emotionally aware assistant.
""".strip()

    messages = [{"role": "system", "content": system_prompt}]

    if history and isinstance(history, list):
        messages.extend(history)

    messages.append({"role": "user", "content": f"Relevant context:\n{context}\n\n{question}"})

    payload = {"model": "openai/gpt-3.5-turbo", "messages": messages, "temperature": 0.4}

    try:
        response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()

        if "choices" in data and data["choices"]:
            return data["choices"][0]["message"]["content"]
        return "Sorry, I'm having trouble responding right now."
    except Exception as e:
        print("LLM Error:", e)
        return "AI service unavailable."


CRISIS_KEYWORDS = [
    "suicide",
    "suicidal",
    "kill myself",
    "end my life",
    "want to die",
    "self harm",
    "hurt myself",
    "can't go on",
    "dropping out",
    "quit school",
    "no way out",
    "can't continue university",
    "hopelessness",
    "giving up on life",
]


def is_crisis(message: str) -> bool:
    return any(keyword in (message or "").lower() for keyword in CRISIS_KEYWORDS)


def assess_stress_level(message: str) -> str:
    message_lower = (message or "").lower()

    severe_keywords = [
        "can't cope",
        "overwhelming",
        "breaking down",
        "mental breakdown",
        "can't sleep",
        "panic attack",
        "anxiety attack",
        "severe stress",
        "extremely stressed",
        "too much pressure",
        "can't handle",
    ]
    moderate_keywords = [
        "stressed",
        "anxious",
        "worried",
        "nervous",
        "pressure",
        "difficult",
        "struggling",
        "exhausted",
        "tired",
        "overwhelmed",
    ]

    if any(k in message_lower for k in severe_keywords):
        return "severe"
    if any(k in message_lower for k in moderate_keywords):
        return "moderate"
    return "low"


@app.route("/")
def home():
    return "Virtual Mental Health Assistant Backend is running"


@app.route("/chat", methods=["POST"])
@jwt_required(optional=True)
def chat():
    try:
        email = get_jwt_identity()  # None if anonymous
        data = request.get_json(silent=True) or {}

        question = (data.get("message") or "").strip()
        history = data.get("history", [])
        convo_id = data.get("convo_id")

        if not isinstance(history, list):
            history = []

        if not question:
            return jsonify({"reply": "Please enter a message."}), 400

        if email and convo_id is not None:
            db.save_message(email, str(convo_id), "user", question)

        if is_crisis(question):
            reply = (
                "I'm really concerned about what you're sharing. Please reach out immediately:\n\n"
                "🆘 Befrienders Kenya: 0800 723 253 (free, 24/7)\n"
                "📞 MHFA Kenya: 0800 720 710\n\n"
                "You don't have to face this alone. Help is available right now."
            )

            if email and convo_id is not None:
                db.save_message(email, str(convo_id), "assistant", reply)

            return jsonify({"reply": reply, "stress_level": "crisis", "is_crisis": True})

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

    token = create_access_token(identity=email)
    return jsonify({"token": token, "user": user}), 201


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = data.get("email")
    password = data.get("password")

    user = db.verify_user(email, password)
    if not user:
        return jsonify({"error": "Invalid credentials"}), 401

    token = create_access_token(identity=email)
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

        result.append({"id": convo["id"], "preview": preview, "created_at": convo.get("created_at")})

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
    # return TTL so frontend can show countdown if it wants
    return jsonify({"deleted": True, "convo_id": str(convo_id), "undo_ttl_seconds": db.UNDO_TTL_SECONDS}), 200


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

        recent.append(
            {
                "id": c.get("id"),
                "created_at": c.get("created_at"),
                "preview": preview,
                "message_count": len(c.get("messages") or []),
            }
        )

    return jsonify({"total_conversations": len(convos), "recent_conversations": recent}), 200


if __name__ == "__main__":
    app.run(debug=True, port=5000)