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
    """Get relevant context from Pinecone"""
    query_vector = model.encode(question).tolist()
    results = index.query(vector=query_vector, top_k=3, include_metadata=True)
    context = [match['metadata']['text'] for match in results['matches']]
    return "\n\n---\n\n".join(context)

def ask_llm(question, context):
    """Generate response using OpenRouter"""
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "arcee-ai/trinity-large-preview:free",
        "messages": [
            {"role": "system", "content": "You are an empathetic mental health assistant for university students experiencing academic stress."},
            {"role": "user", "content": f"Context:\n{context}\n\nStudent question: {question}"}
        ]
    }
    
    response = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload)
    return response.json()["choices"][0]["message"]["content"]

@app.route("/")
def home():
    return "Virtual Mental Health Assistant Backend is running"

@app.route('/chat', methods=['POST'])
def chat():
    """Main chat endpoint"""
    data = request.json
    question = data['message']
    
    context = retrieve_context(question)
    answer = ask_llm(question, context)
    
    return jsonify({"reply": answer})

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
