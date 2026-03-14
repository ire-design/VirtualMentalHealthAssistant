import React, { useEffect, useRef, useState } from 'react';
import {
  sendMessage,
  getConversations,
  createConversation,
  getConversation,
  deleteConversation,
  undoDeleteConversation
} from '../utils/api';
import UndoToast from './UndoToast.jsx';
import '../styles/chatInterface.css';

function ChatInterface() {
  const token = localStorage.getItem('token');

  const [conversations, setConversations] = useState([]);
  const [currentConvoId, setCurrentConvoId] = useState(null);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');

  const [loading, setLoading] = useState(false);
  const [stressLevel, setStressLevel] = useState(null);
  const [showCrisisAlert, setShowCrisisAlert] = useState(false);

  // Undo toast state
  const [toastVisible, setToastVisible] = useState(false);
  const [toastSecondsLeft, setToastSecondsLeft] = useState(0);
  const [lastDeletedConvoId, setLastDeletedConvoId] = useState(null);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const refreshConversations = async () => {
    if (!token) return [];
    const data = await getConversations();
    const list = data.conversations || [];
    setConversations(list);
    return list;
  };

  const openConversation = async (convoId) => {
    if (!token) return;
    const convo = await getConversation(convoId);
    setCurrentConvoId(convo.id);
    setMessages(convo.messages || []);
    setStressLevel(null);
    setShowCrisisAlert(false);
    window.history.replaceState({}, '', `/chat?c=${encodeURIComponent(convo.id)}`);
  };

  const startNewChat = async () => {
    if (!token) {
      setCurrentConvoId(null);
      setMessages([]);
      setStressLevel(null);
      setShowCrisisAlert(false);
      window.history.replaceState({}, '', '/chat');
      return;
    }

    const data = await createConversation();
    const convoId = data.convo_id;

    setCurrentConvoId(convoId);
    setMessages([]);
    setStressLevel(null);
    setShowCrisisAlert(false);

    await refreshConversations();
    window.history.replaceState({}, '', `/chat?c=${encodeURIComponent(convoId)}`);
  };

  const getConvoIdFromQuery = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('c');
    } catch {
      return null;
    }
  };

  useEffect(() => {
    (async () => {
      try {
        if (!token) return;

        await refreshConversations();

        const fromQuery = getConvoIdFromQuery();
        if (fromQuery) {
          await openConversation(fromQuery);
        } else {
          setCurrentConvoId(null);
          setMessages([]);
        }
      } catch (e) {
        console.error('Failed to initialize chat:', e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Toast countdown timer
  useEffect(() => {
    if (!toastVisible) return;

    const t = setInterval(() => {
      setToastSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);

    return () => clearInterval(t);
  }, [toastVisible]);

  useEffect(() => {
    if (toastVisible && toastSecondsLeft <= 0) {
      setToastVisible(false);
      setLastDeletedConvoId(null);
    }
  }, [toastVisible, toastSecondsLeft]);

  const handleDeleteConvo = async (e, convoId) => {
    e.stopPropagation();
    if (!token) return;

    try {
      const resp = await deleteConversation(convoId);

      await refreshConversations();

      if (String(currentConvoId) === String(convoId)) {
        setCurrentConvoId(null);
        setMessages([]);
        setStressLevel(null);
        setShowCrisisAlert(false);
        window.history.replaceState({}, '', '/chat');
      }

      setLastDeletedConvoId(String(convoId));
      setToastSecondsLeft(resp.undo_ttl_seconds ?? 30);
      setToastVisible(true);
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Failed to delete conversation.');
    }
  };

  const handleUndoDelete = async () => {
    if (!token || !lastDeletedConvoId) return;

    try {
      await undoDeleteConversation(lastDeletedConvoId);
      setToastVisible(false);
      setToastSecondsLeft(0);

      await refreshConversations();
      setLastDeletedConvoId(null);
    } catch (e) {
      console.error('Undo failed:', e);
      setToastVisible(false);
      setLastDeletedConvoId(null);
    }
  };

  const handleSend = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || loading) return;

    // If logged in and no conversation yet, create one silently on first send.
    let convoId = currentConvoId;
    if (token && (convoId === null || convoId === undefined)) {
      try {
        const created = await createConversation();
        convoId = created.convo_id;
        setCurrentConvoId(convoId);
        await refreshConversations();
        window.history.replaceState({}, '', `/chat?c=${encodeURIComponent(convoId)}`);
      } catch (e) {
        console.error('Failed to create conversation:', e);
        alert('Could not start a new chat. Please try again.');
        return;
      }
    }

    const userMessage = { role: 'user', content: trimmedInput };
    const updatedMessages = [...messages, userMessage];

    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    try {
      const data = await sendMessage(trimmedInput, updatedMessages, convoId);

      if (data.stress_level) setStressLevel(data.stress_level);
      if (data.is_crisis) setShowCrisisAlert(true);

      const aiMessage = { role: 'assistant', content: data.reply };
      setMessages([...updatedMessages, aiMessage]);

      if (token) await refreshConversations();
    } catch (error) {
      console.error('Send error:', error);
      const errorMessage = {
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.'
      };
      setMessages([...updatedMessages, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const showWelcome = messages.length === 0 && !loading;

  return (
    <>
      <div className="chat-layout">
        <div className="chat-sidebar">
          <button className="new-chat-btn" onClick={startNewChat}>
            + New Chat
          </button>

          {!token && (
            <div style={{ padding: '0 16px 16px', opacity: 0.9, fontSize: 13 }}>
              You’re chatting anonymously. Log in to save and manage conversations.
            </div>
          )}

          {token && (
            <div className="conversation-list">
              {conversations.map((convo) => (
                <div
                  key={convo.id}
                  className={`convo-item convo-row ${
                    String(currentConvoId) === String(convo.id) ? 'active' : ''
                  }`}
                  onClick={() => openConversation(convo.id)}
                  title={convo.preview}
                >
                  <span className="convo-title">{convo.preview}</span>

                  <button
                    className="convo-delete-btn"
                    onClick={(e) => handleDeleteConvo(e, convo.id)}
                    title="Delete conversation"
                    aria-label="Delete conversation"
                  >
                    {/* inline SVG trash icon */}
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <path
                        d="M9 3h6m-8 4h10m-9 0v14a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V7"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M10 11v7M14 11v7"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="chat-main">
          <div className="chat-container">
            {showCrisisAlert && (
              <div className="crisis-banner">
                <div>
                  <strong>⚠️ Crisis Support Needed</strong>
                  <p>Emergency helplines are available 24/7</p>
                </div>
                <button onClick={() => setShowCrisisAlert(false)}>×</button>
              </div>
            )}

            <div className="chat-header">
              <h2>Virtual Mental Health Assistant</h2>
              <p>Academic Stress Support</p>
              {stressLevel && (
                <div className="stress-indicator">
                  <span>Stress Level: </span>
                  <span className={`stress-badge ${stressLevel}`}>
                    {String(stressLevel).toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            <div className="messages">
              {showWelcome && (
                <div className="welcome-message">
                  <h3>Welcome</h3>
                  <p>
                    Start a new chat to talk about academic stress, deadlines, burnout, exams,
                    motivation—anything.
                  </p>
                  <div style={{ marginTop: 16 }}>
                    <button
                      onClick={startNewChat}
                      style={{
                        padding: '12px 18px',
                        borderRadius: 12,
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 700,
                        background: 'linear-gradient(135deg, #66BB6A 0%, #4CAF50 100%)',
                        color: 'white'
                      }}
                    >
                      Start New Chat
                    </button>
                  </div>
                </div>
              )}

              {messages.map((msg, idx) => (
                <div key={idx} className={`message ${msg.role}`}>
                  <p>{msg.content}</p>
                </div>
              ))}

              {loading && <div className="message assistant typing">Typing...</div>}
              <div ref={messagesEndRef} />
            </div>

            <div className="input-area">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Share what's on your mind..."
                disabled={loading}
              />
              <button onClick={handleSend} disabled={loading}>
                {loading ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <UndoToast
        visible={toastVisible}
        message="Conversation deleted."
        secondsLeft={toastSecondsLeft}
        onUndo={handleUndoDelete}
        onClose={() => {
          setToastVisible(false);
          setLastDeletedConvoId(null);
        }}
      />
    </>
  );
}

export default ChatInterface;