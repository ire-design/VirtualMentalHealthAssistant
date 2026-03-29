from flask import Flask, request, jsonify
from flask_cors import CORS
from pinecone import Pinecone
import requests
import os
from dotenv import load_dotenv
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from datetime import timedelta, datetime, timezone
from flask_migrate import Migrate
from models import db_sql
import db

load_dotenv()
migrate = Migrate()
app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db_sql.init_app(app)
migrate.init_app(app, db_sql)
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

# lazy load embedding model to avoid memory crash
def get_model():
    global model
    if model is None:
        from sentence_transformers import SentenceTransformer
        model = SentenceTransformer("all-MiniLM-L6-v2")
    return model

# initialize pinecone without loading model
if PINECONE_API_KEY:
    try:
        pc = Pinecone(api_key=PINECONE_API_KEY)
        index = pc.Index("mental-health-assistant")
    except Exception as e:
        print("Pinecone initialization error:", e)
else:
    print("PINECONE_API_KEY missing. Context retrieval will be skipped.")

MIN_QUERY_CHARS_FOR_RETRIEVAL = 12
PINECONE_SCORE_THRESHOLD = 0.78
MAX_CONTEXT_MATCHES = 3
SKIP_RETRIEVAL_EXACT = {"hi", "hey", "hello", "yoh", "niaje", "sasa", "mambo", "lol", "ok", "okay", "no", "noo", "yes", "yeah", "yep", "sure", "thanks", "thank you"}


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
        return "Hey. I’m here with you. If school has been heavy lately, you can share what’s been hardest."
    if msg in {"ok", "okay", "sure"}:
        return "Alright. I’m here—whenever you’re ready, you can share what’s weighing on you."
    if msg in {"thanks", "thank you"}:
        return "You’re welcome. I’m here with you."
    return "I’m here. If you want, tell me what’s going on with school or your stress right now."


def retrieve_context(question: str) -> str:
    if not index:
        return ""
    q = (question or "").strip()
    q_lower = q.lower()
    if len(q) < MIN_QUERY_CHARS_FOR_RETRIEVAL or q_lower in SKIP_RETRIEVAL_EXACT:
        return ""
    try:
        query_vector = get_model().encode(q).tolist()
        results = index.query(vector=query_vector, top_k=MAX_CONTEXT_MATCHES, include_metadata=True)
        matches = getattr(results, "matches", None) or []
        if not matches:
            return ""
        top = matches[0]
        top_score = getattr(top, "score", None)
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
        print("Pinecone Error:", e)
        return ""


def ask_llm(question: str, context: str, history=None) -> str:
    if not OPENROUTER_API_KEY:
        return "AI service unavailable."
    headers = {"Authorization": f"Bearer {OPENROUTER_API_KEY}", "Content-Type": "application/json"}
    system_prompt = """
You are a warm, emotionally intelligent mental health support assistant for Kenyan university students experiencing academic stress.
""".strip()
    messages = [{"role": "system", "content": system_prompt}]
    if history and isinstance(history, list):
        messages.extend(history)
    if context and isinstance(context, str) and context.strip():
        messages.append({"role": "system", "content": context.strip()})
    messages.append({"role": "user", "content": question})
    payload = {"model": "openai/gpt-3.5-turbo", "messages": messages, "temperature": 0.4}
    try:
        response = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        data = response.json()
        if "choices" in data and data["choices"]:
            return data["choices"][0]["message"]["content"]
        return "Sorry, I'm having trouble responding right now."
    except Exception as e:
        print("LLM Error:", e)
        return "AI service unavailable."


@app.route("/")
def home():
    return "Backend running"


@app.route("/chat", methods=["POST"])
@jwt_required(optional=True)
def chat():
    try:
        data = request.get_json(silent=True) or {}
        question = (data.get("message") or "").strip()
        history = sanitize_history(data.get("history", []))
        if not question:
            return jsonify({"reply": "Please enter a message."}), 400
        if is_short_greeting(question):
            return jsonify({"reply": local_smalltalk_reply(question)})
        context = retrieve_context(question)
        answer = ask_llm(question, context, history)
        return jsonify({"reply": answer})
    except Exception as e:
        print("Chat Error:", e)
        return jsonify({"reply": "Server error occurred."}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)  # bind to render port