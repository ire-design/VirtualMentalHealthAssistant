import json
import os
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

USERS_FILE = "users.json"
CONVOS_FILE = "conversations.json"

def init_db():
    if not os.path.exists(USERS_FILE):
        with open(USERS_FILE, 'w') as f:
            json.dump({}, f)
    if not os.path.exists(CONVOS_FILE):
        with open(CONVOS_FILE, 'w') as f:
            json.dump({}, f)

# User functions
def create_user(email, password, name):
    init_db()
    with open(USERS_FILE, 'r') as f:
        users = json.load(f)
    
    if email in users:
        return None
    
    users[email] = {
        "password": generate_password_hash(password),
        "name": name
    }
    
    with open(USERS_FILE, 'w') as f:
        json.dump(users, f)
    
    return {"email": email, "name": name}

def verify_user(email, password):
    init_db()
    with open(USERS_FILE, 'r') as f:
        users = json.load(f)
    
    if email not in users:
        return None
    
    if check_password_hash(users[email]["password"], password):
        return {"email": email, "name": users[email]["name"]}
    
    return None

# Conversation functions
def create_conversation(email):
    """Create new conversation and return its ID"""
    init_db()
    with open(CONVOS_FILE, 'r') as f:
        convos = json.load(f)
    
    if email not in convos:
        convos[email] = []
    
    convo_id = str(len(convos[email]))
    new_convo = {
        "id": convo_id,
        "created_at": datetime.now().isoformat(),
        "messages": []
    }
    
    convos[email].append(new_convo)
    
    with open(CONVOS_FILE, 'w') as f:
        json.dump(convos, f)
    
    return convo_id

def save_message(email, convo_id, role, content):
    """Save message to specific conversation"""
    init_db()
    with open(CONVOS_FILE, 'r') as f:
        convos = json.load(f)
    
    if email not in convos:
        convos[email] = []
    
    # Find conversation
    for convo in convos[email]:
        if convo["id"] == convo_id:
            convo["messages"].append({
                "role": role,
                "content": content,
                "timestamp": datetime.now().isoformat()
            })
            break
    
    with open(CONVOS_FILE, 'w') as f:
        json.dump(convos, f)

def get_conversations(email):
    """Get all conversations for user"""
    init_db()
    with open(CONVOS_FILE, 'r') as f:
        convos = json.load(f)
    
    return convos.get(email, [])

def get_conversation(email, convo_id):
    """Get specific conversation"""
    convos = get_conversations(email)
    for convo in convos:
        if convo["id"] == convo_id:
            return convo
    return None