from models import db_sql, User, Conversation, Message, Mood
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timezone
import json

UNDO_TTL_SECONDS = 30

def _now():
    return datetime.now(timezone.utc)

def _now_iso():
    return _now().isoformat()

def _parse_iso(s):
    try:
        return datetime.fromisoformat((s or "").replace("Z", "+00:00"))
    except Exception:
        return None

def init_db():
    return

def create_user(email, password, name):
    email = (email or "").strip().lower()
    name = (name or "").strip()
    if not email or not password or not name:
        return None
    existing = User.query.get(email)
    if existing:
        return None
    u = User(email=email, name=name, password_hash=generate_password_hash(password))
    db_sql.session.add(u)
    db_sql.session.commit()
    return {"email": u.email, "name": u.name}

def verify_user(email, password):
    email = (email or "").strip().lower()
    if not email or not password:
        return None
    u = User.query.get(email)
    if not u:
        return None
    if not check_password_hash(u.password_hash, password):
        return None
    return {"email": u.email, "name": u.name}

def create_conversation(email):
    email = (email or "").strip().lower()
    if not email:
        return None
    convo = Conversation(user_email=email, created_at=_now())
    db_sql.session.add(convo)
    db_sql.session.commit()
    return str(convo.id)

def save_message(email, convo_id, role, content):
    email = (email or "").strip().lower()
    if not email:
        return
    if convo_id is None:
        convo_id = create_conversation(email)
    try:
        convo_id_int = int(str(convo_id))
    except Exception:
        convo_id_int = None
    convo = None
    if convo_id_int is not None:
        convo = Conversation.query.filter_by(id=convo_id_int, user_email=email).first()
    if convo is None:
        convo_id = create_conversation(email)
        try:
            convo_id_int = int(str(convo_id))
        except Exception:
            return
        convo = Conversation.query.filter_by(id=convo_id_int, user_email=email).first()
    msg = Message(conversation_id=convo.id, role=str(role), content=str(content), timestamp=_now())
    db_sql.session.add(msg)
    db_sql.session.commit()

def _conversation_to_dict(convo):
    msgs = Message.query.filter_by(conversation_id=convo.id).order_by(Message.timestamp.asc()).all()
    return {
        "id": str(convo.id),
        "created_at": convo.created_at.isoformat() if convo.created_at else None,
        "messages": [{"role": m.role, "content": m.content, "timestamp": m.timestamp.isoformat() if m.timestamp else None} for m in msgs],
    }

def get_conversations(email):
    email = (email or "").strip().lower()
    if not email:
        return []
    convos = Conversation.query.filter_by(user_email=email, deleted_at=None).order_by(Conversation.created_at.desc()).all()
    return [_conversation_to_dict(c) for c in convos]

def get_conversation(email, convo_id):
    email = (email or "").strip().lower()
    if not email:
        return None
    try:
        convo_id_int = int(str(convo_id))
    except Exception:
        return None
    convo = Conversation.query.filter_by(id=convo_id_int, user_email=email, deleted_at=None).first()
    if not convo:
        return None
    return _conversation_to_dict(convo)

def soft_delete_conversation(email, convo_id):
    email = (email or "").strip().lower()
    if not email:
        return None
    try:
        convo_id_int = int(str(convo_id))
    except Exception:
        return None
    convo = Conversation.query.filter_by(id=convo_id_int, user_email=email, deleted_at=None).first()
    if not convo:
        return None
    convo.deleted_at = _now()
    db_sql.session.commit()
    return {"id": str(convo.id), "deleted_at": convo.deleted_at.isoformat()}

def undo_delete_conversation(email, convo_id):
    email = (email or "").strip().lower()
    if not email:
        return None
    try:
        convo_id_int = int(str(convo_id))
    except Exception:
        return None
    convo = Conversation.query.filter_by(id=convo_id_int, user_email=email).first()
    if not convo or not convo.deleted_at:
        return None
    age = (_now() - convo.deleted_at).total_seconds()
    if age > UNDO_TTL_SECONDS:
        return None
    convo.deleted_at = None
    db_sql.session.commit()
    return _conversation_to_dict(convo)

def upsert_mood(email, date, mood, tags=None, note=""):
    email = (email or "").strip().lower()
    if not email:
        return None
    date = str(date)
    tags_list = tags if isinstance(tags, list) else []
    tags_json = json.dumps(tags_list)
    entry = Mood.query.filter_by(user_email=email, date=date).first()
    now = _now()
    if entry:
        entry.mood = mood
        entry.tags_json = tags_json
        entry.note = note or ""
        entry.updated_at = now
    else:
        entry = Mood(user_email=email, date=date, mood=mood, tags_json=tags_json, note=note or "", created_at=now, updated_at=now)
        db_sql.session.add(entry)
    db_sql.session.commit()
    return {"date": entry.date, "mood": entry.mood, "tags": json.loads(entry.tags_json or "[]"), "note": entry.note, "timestamp": entry.updated_at.isoformat() if entry.updated_at else _now_iso()}

def get_moods(email):
    email = (email or "").strip().lower()
    if not email:
        return []
    rows = Mood.query.filter_by(user_email=email).order_by(Mood.date.asc()).all()
    result = []
    for r in rows:
        result.append({
            "date": r.date,
            "mood": r.mood,
            "tags": json.loads(r.tags_json or "[]"),
            "note": r.note,
            "timestamp": (r.updated_at or r.created_at).isoformat() if (r.updated_at or r.created_at) else _now_iso(),
        })
    return result