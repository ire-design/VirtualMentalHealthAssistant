from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timezone

db_sql = SQLAlchemy()


def utcnow():
    return datetime.now(timezone.utc)


class User(db_sql.Model):
    __tablename__ = "users"

    email = db_sql.Column(db_sql.String(255), primary_key=True)
    name = db_sql.Column(db_sql.String(255), nullable=False)
    password_hash = db_sql.Column(db_sql.String(255), nullable=False)
    created_at = db_sql.Column(db_sql.DateTime(timezone=True), default=utcnow, nullable=False)


class Conversation(db_sql.Model):
    __tablename__ = "conversations"

    id = db_sql.Column(db_sql.Integer, primary_key=True)
    user_email = db_sql.Column(db_sql.String(255), db_sql.ForeignKey("users.email"), nullable=False)
    created_at = db_sql.Column(db_sql.DateTime(timezone=True), default=utcnow, nullable=False)
    deleted_at = db_sql.Column(db_sql.DateTime(timezone=True), nullable=True)


class Message(db_sql.Model):
    __tablename__ = "messages"

    id = db_sql.Column(db_sql.Integer, primary_key=True)
    conversation_id = db_sql.Column(db_sql.Integer, db_sql.ForeignKey("conversations.id"), nullable=False)
    role = db_sql.Column(db_sql.String(30), nullable=False)  # "user" or "assistant"
    content = db_sql.Column(db_sql.Text, nullable=False)
    timestamp = db_sql.Column(db_sql.DateTime(timezone=True), default=utcnow, nullable=False)


class Mood(db_sql.Model):
    __tablename__ = "moods"

    id = db_sql.Column(db_sql.Integer, primary_key=True)
    user_email = db_sql.Column(db_sql.String(255), db_sql.ForeignKey("users.email"), nullable=False)
    date = db_sql.Column(db_sql.String(10), nullable=False)  # YYYY-MM-DD
    mood = db_sql.Column(db_sql.String(40), nullable=False)
    tags_json = db_sql.Column(db_sql.Text, nullable=False, default="[]")
    note = db_sql.Column(db_sql.Text, nullable=False, default="")
    created_at = db_sql.Column(db_sql.DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = db_sql.Column(db_sql.DateTime(timezone=True), default=utcnow, nullable=False)