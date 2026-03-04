from flask import Flask, request, jsonify
from flask_cors import CORS
from pinecone import Pinecone
from sentence_transformers import SentenceTransformer
import requests
import os 
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")


# Initialize Pinecone and embedding model
pc = Pinecone(api_key=PINECONE_API_KEY)
index = pc.Index("mental-health-assistant")
model = SentenceTransformer('all-MiniLM-L6-v2')


def retrieve_context(question):
    # Get relevant context from Pinecone
    try:
        query_vector = model.encode(question).tolist()
        results = index.query(
            vector=query_vector, 
            top_k=3, 
            include_metadata=True)

        if results.matches and len(results.matches) > 0:
            context = [
                match.metadata['text'] 
                for match in results.matches
                if match.metadata and "text" in match.metadata
            ]
            return "\n\n---\n\n".join(context)

        return "No relevant context found."

    except Exception as e:
        print("Pinecone Error:", e)
        return "Context retrieval failed."

def ask_llm(question, context, history=None):
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json"
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

        If the user asks you to stop asking questions, STOP immediately and never ask another question unless they explicitly invite it. Adapt your style based on direct feedback and never revert back.

        Internally assess stress as low, moderate, or severe and adjust your tone accordingly.

        You are not a therapist. You are a supportive, emotionally aware assistant.
        """

    # Build full conversation
    messages = [{"role": "system", "content": system_prompt}]

    # Add previous conversation history
    if history:
        messages.extend(history)

    # Add new message with retrieved context
    messages.append({
        "role": "user",
        "content": f"Relevant context:\n{context}\n\n{question}"
    })

    payload = {

        "model": "openai/gpt-3.5-turbo",
        "messages": messages,
        "temperature": 0.4
    }

    try:
        response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            json=payload
        )
        

        data = response.json()
        print("LLM Response:", data)

        if "choices" in data:
            return data["choices"][0]["message"]["content"]
        else:
            return "Sorry, I'm having trouble responding right now."

    except Exception as e:
        print("LLM Error:", e)
        return "AI service unavailable."

CRISIS_KEYWORDS = [
    "suicide", "suicidal", "kill myself", "end my life",
    "want to die", "self harm", "hurt myself", "can't go on",
    "dropping out", "quit school", "no way out", "can't continue university",
    "hopelessness", "giving up on life"
]

def is_crisis(message):
    return any(keyword in message.lower() for keyword in CRISIS_KEYWORDS)

@app.route("/")
def home():
    return "Virtual Mental Health Assistant Backend is running"

@app.route('/chat', methods=['POST'])
def chat():
    #Main chat endpoint
    try:
        data = request.json
        question = data['message']
        history = data.get('history', [])

        if not question:
            return jsonify({"reply": "Please enter a message."}), 400
            
        if is_crisis(question):
            return jsonify({"reply": "I'm really concerned. Please reach out immediately — Befrienders Kenya: 0800 723 253 (free, 24/7). You don't have to face this alone."})
        
        context = retrieve_context(question)
        answer = ask_llm(question, context, history)
        
        return jsonify({"reply": answer})

        

    except Exception as e:
        print("Chat Endpoint Error:", e)
        return jsonify({"reply": "Server error occurred."}), 500

@app.route('/pineconeCheck', methods=['GET'])
def pineconeCheck():
    try:
        # simple Pinecone check
        index.describe_index_stats()
        pinecone_status = "connected"
    except:
        pinecone_status = "error"

    return jsonify({
        "status": "running",
        "pinecone": pinecone_status
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
