import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle, faTrash } from '@fortawesome/free-solid-svg-icons';
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
  const navigate = useNavigate();

  const handleBackNavigation = () => {
    if (token) {
      navigate('/dashboard');
      return;
    }
    navigate('/');
  };

  const [conversations, setConversations] = useState([]);
  const [currentConvoId, setCurrentConvoId] = useState(null);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');

  const [loading, setLoading] = useState(false);
  const [stressLevel, setStressLevel] = useState(null);
  const [showCrisisAlert, setShowCrisisAlert] = useState(false);

  const [toastVisible, setToastVisible] = useState(false);
  const [toastSecondsLeft, setToastSecondsLeft] = useState(0);
  const [lastDeletedConvoId, setLastDeletedConvoId] = useState(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');

  const messagesEndRef = useRef(null);


  useEffect(() => {
    fetch('https://virtualmentalhealthassistant.onrender.com/')
      .catch(() => {}); 
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Safe refresh,never crashes the UI if the server is busy 
  const refreshConversations = async () => {
    if (!token) return [];
    try {
      const data = await getConversations();
      const list = data.conversations || [];
      setConversations(list);
      return list;
    } catch (e) {
      console.warn('Could not refresh conversations:', e);
      return [];
    }
  };

  const openConversation = async (convoId) => {
    if (!token) return;
    const convo = await getConversation(convoId);
    setCurrentConvoId(convo.id);
    setMessages(convo.messages || []);
    setStressLevel(null);
    setShowCrisisAlert(false);
    setSidebarOpen(false);
    window.history.replaceState({}, '', `/chat?c=${encodeURIComponent(convo.id)}`);
  };

  const startNewChat = async () => {
    if (!token) {
      setCurrentConvoId(null);
      setMessages([]);
      setStressLevel(null);
      setShowCrisisAlert(false);
      setSidebarOpen(false);
      window.history.replaceState({}, '', '/chat');
      return;
    }

    const data = await createConversation();
    const convoId = data.convo_id;

    setCurrentConvoId(convoId);
    setMessages([]);
    setStressLevel(null);
    setShowCrisisAlert(false);
    setSidebarOpen(false);

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
        if (fromQuery) await openConversation(fromQuery);
        else {
          setCurrentConvoId(null);
          setMessages([]);
        }
      } catch (e) {
        console.error('Failed to initialize chat:', e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!toastVisible) return;
    const t = setInterval(() => setToastSecondsLeft((s) => Math.max(0, s - 1)), 1000);
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

    let convoId = currentConvoId;
    if (token && (convoId === null || convoId === undefined)) {
      try {
        const created = await createConversation();
        convoId = created.convo_id;
        setCurrentConvoId(convoId);
        // ── Delay refresh after creating conversation so Render isn't overwhelmed
        setTimeout(() => refreshConversations(), 1500);
        window.history.replaceState({}, '', `/chat?c=${encodeURIComponent(convoId)}`);
      } catch (e) {
        console.error('Failed to create conversation:', e);
        alert('Could not start a new chat. Please try again.');
        return;
      }
    }

    const userMessage = { role: 'user', content: trimmedInput };
    const updatedMessages = [...messages, userMessage];
    const historyWithoutLatest = messages;

    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    try {
      const data = await sendMessage(trimmedInput, historyWithoutLatest, convoId);

      const isCrisis =
        Boolean(data.is_crisis) || String(data.stress_level || '').toLowerCase() === 'crisis';

      if (isCrisis) {
        setStressLevel('crisis');
        setShowCrisisAlert(true);
      } else {
        if (data.stress_level) setStressLevel(String(data.stress_level).toLowerCase());
        setShowCrisisAlert(false);
      }

      const aiMessage = { role: 'assistant', content: data.reply };
      setMessages([...updatedMessages, aiMessage]);

      //Delay sidebar refresh so Render has time to recover after /chat 
      // prevents the false CORS error caused by hitting /conversations
      // immediately after /chat on Render's free tier.
      if (token) setTimeout(() => refreshConversations(), 1500);

    } catch (error) {
      console.error('Send error:', error);
      setMessages([
        ...updatedMessages,
        { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const showWelcome = messages.length === 0 && !loading;
  const stressLevelLabels = {
    low: 'Low stress signals',
    moderate: 'Moderate stress signals',
    severe: 'High stress signals',
    crisis: 'Urgent support recommended'
  };

  return (
    <>
      <div className="chat-shell">
        <div className="chat-topbar">
          <button className="menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Open history">
            ☰
          </button>
          <div className="topbar-title">
            <div className="t1">Virtual Mental Health Assistant</div>
            <div className="t2">Academic Stress Support</div>
          </div>
          <button className="back-btn" onClick={handleBackNavigation} aria-label="Go back">← Dashboard
          </button>

          {stressLevel && (
            <div className="stress-summary">
              <span className="stress-caption">Current check-in:</span>
              <span className={`stress-pill ${stressLevel}`}>
                {stressLevelLabels[String(stressLevel).toLowerCase()] || String(stressLevel)}
              </span>
            </div>
          )}
        </div>

        {sidebarOpen && <div className="overlay" onClick={() => setSidebarOpen(false)} />}

        <div className="chat-layout">
          <aside className={`chat-sidebar ${sidebarOpen ? 'open' : ''}`}>
            <button className="close-btn" onClick={() => setSidebarOpen(false)} aria-label="Close">
              ×
            </button>

            <button className="new-chat-btn" onClick={startNewChat}>
              + New Chat
            </button>

            {!token && (
              <div className="anon-hint">
                You're chatting anonymously. Log in to save and manage conversations.
              </div>
            )}

            {token && (
              <div className="conversation-list">
                <input
                  type="text"
                  className="convo-search"
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {conversations
                  .filter((convo) =>
                    searchQuery.trim() === '' ||
                    (convo.preview || '').toLowerCase().includes(searchQuery.trim().toLowerCase())
                  )
                  .map((convo) => (
                    <div
                      key={convo.id}
                      className={`convo-item ${String(currentConvoId) === String(convo.id) ? 'active' : ''}`}
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
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </aside>

          <main className="chat-main">
            <div className="chat-panel">
              {showCrisisAlert && (
                <div className="crisis-banner">
                  <div>
                    <FontAwesomeIcon icon={faExclamationTriangle} /> <strong>Crisis Support Needed</strong>
                    <p>Emergency helplines are available 24/7</p>
                  </div>
                  <button onClick={() => setShowCrisisAlert(false)} aria-label="Close crisis notice">
                    ×
                  </button>
                </div>
              )}

              <div className="messages">
                {showWelcome && (
                  <div className="welcome-message">
                    <h3>Welcome</h3>
                    <p>Talk about deadlines, burnout, exams, motivation...anything academic-stress related</p>
                    <button className="welcome-start-btn" onClick={startNewChat}>
                      Start New Chat
                    </button>
                  </div>
                )}

                {messages.map((msg, idx) => (
                  <div key={idx} className={`row ${msg.role}`}>
                    <div className={`bubble ${msg.role}`}>
                      <p>{msg.content}</p>
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="row assistant">
                    <div className="bubble assistant typing">
                      <span className="dots">
                        <i />
                        <i />
                        <i />
                      </span>
                    </div>
                  </div>
                )}

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
          </main>
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