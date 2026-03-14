import json
import os
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timezone

USERS_FILE = "users.json"
CONVOS_FILE = "conversations.json"

# How long we keep deleted conversations available for undo
UNDO_TTL_SECONDS = 30


def init_db():
    if not os.path.exists(USERS_FILE):
        with open(USERS_FILE, "w") as f:
            json.dump({}, f)
    if not os.path.exists(CONVOS_FILE):
        with open(CONVOS_FILE, "w") as f:
            json.dump({}, f)


def _read_json(path, default):
    init_db()
    try:
        with open(path, "r") as f:
            return json.load(f)
    except Exception:
        return default


def _write_json(path, data):
    with open(path, "w") as f:
        json.dump(data, f)


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def _parse_iso(s):
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


def _ensure_user_bucket(convos_root, email):
    """
    Supports legacy format where convos_root[email] is a list.
    Migrates to {"active": [...], "deleted": [...]}.
    """
    if email not in convos_root:
        convos_root[email] = {"active": [], "deleted": []}
        return convos_root[email]

    if isinstance(convos_root[email], list):
        convos_root[email] = {"active": convos_root[email], "deleted": []}
        return convos_root[email]

    # expected dict
    if "active" not in convos_root[email]:
        convos_root[email]["active"] = []
    if "deleted" not in convos_root[email]:
        convos_root[email]["deleted"] = []

    return convos_root[email]


def _prune_deleted(bucket):
    """
    Remove deleted convos older than UNDO_TTL_SECONDS.
    """
    keep = []
    now = datetime.now(timezone.utc)

    for item in bucket.get("deleted", []):
        deleted_at = _parse_iso(item.get("deleted_at", ""))
        if not deleted_at:
            continue
        age = (now - deleted_at).total_seconds()
        if age <= UNDO_TTL_SECONDS:
            keep.append(item)

    bucket["deleted"] = keep


# -------------------------
# Users
# -------------------------
def create_user(email, password, name):
    users = _read_json(USERS_FILE, {})
    if email in users:
        return None

    users[email] = {"password": generate_password_hash(password), "name": name}
    _write_json(USERS_FILE, users)
    return {"email": email, "name": name}


def verify_user(email, password):
    users = _read_json(USERS_FILE, {})
    if email not in users:
        return None

    if check_password_hash(users[email]["password"], password):
        return {"email": email, "name": users[email]["name"]}
    return None


# -------------------------
# Conversations
# -------------------------
def _load_convos_root():
    return _read_json(CONVOS_FILE, {})


def _save_convos_root(root):
    _write_json(CONVOS_FILE, root)


def create_conversation(email):
    root = _load_convos_root()
    bucket = _ensure_user_bucket(root, email)
    _prune_deleted(bucket)

    existing_ids = {str(c.get("id")) for c in bucket["active"]}
    next_id = 0
    while str(next_id) in existing_ids:
        next_id += 1

    convo_id = str(next_id)
    new_convo = {"id": convo_id, "created_at": _now_iso(), "messages": []}

    bucket["active"].append(new_convo)
    _save_convos_root(root)
    return convo_id


def save_message(email, convo_id, role, content):
    root = _load_convos_root()
    bucket = _ensure_user_bucket(root, email)
    _prune_deleted(bucket)

    convo_id = str(convo_id)
    convo = next((c for c in bucket["active"] if str(c.get("id")) == convo_id), None)

    # If convo missing, create one (fallback)
    if convo is None:
        convo_id = create_conversation(email)
        root = _load_convos_root()
        bucket = _ensure_user_bucket(root, email)
        convo = next((c for c in bucket["active"] if str(c.get("id")) == str(convo_id)), None)

    if convo is not None:
        convo["messages"].append(
            {
                "role": role,
                "content": content,
                "timestamp": _now_iso(),
            }
        )
        _save_convos_root(root)


def get_conversations(email):
    root = _load_convos_root()
    bucket = _ensure_user_bucket(root, email)
    _prune_deleted(bucket)
    _save_convos_root(root)
    return bucket["active"]


def get_conversation(email, convo_id):
    convo_id = str(convo_id)
    for convo in get_conversations(email):
        if str(convo.get("id")) == convo_id:
            return convo
    return None


def soft_delete_conversation(email, convo_id):
    """
    Move convo from active -> deleted bucket.
    Returns the deleted convo object (wrapped) or None if not found.
    """
    root = _load_convos_root()
    bucket = _ensure_user_bucket(root, email)
    _prune_deleted(bucket)

    convo_id = str(convo_id)
    idx = next((i for i, c in enumerate(bucket["active"]) if str(c.get("id")) == convo_id), None)
    if idx is None:
        return None

    convo = bucket["active"].pop(idx)

    deleted_item = {
        "id": convo_id,
        "deleted_at": _now_iso(),
        "conversation": convo,
    }
    bucket["deleted"].append(deleted_item)

    _save_convos_root(root)
    return deleted_item


def undo_delete_conversation(email, convo_id):
    """
    Restore a deleted convo if still within TTL.
    Returns restored conversation or None.
    """
    root = _load_convos_root()
    bucket = _ensure_user_bucket(root, email)
    _prune_deleted(bucket)

    convo_id = str(convo_id)

    idx = next((i for i, d in enumerate(bucket["deleted"]) if str(d.get("id")) == convo_id), None)
    if idx is None:
        _save_convos_root(root)
        return None

    item = bucket["deleted"].pop(idx)
    convo = item.get("conversation")

    # Restore to active
    if convo:
        bucket["active"].append(convo)
        _save_convos_root(root)
        return convo

    _save_convos_root(root)
    return None