import React, { useEffect, useRef, useState } from 'react';
import { sendMessage } from '../utils/api';
import axios from 'axios';
import '../styles/chatInterface.css';

function ChatInterface() {
  const [conversations, setConversations] = useState([]);
  const [currentConvo, setCurrentConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [stressLevel, setStressLevel] = useState(null);
  const [showCrisisAlert, setShowCrisisAlert] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await axios.get('http://localhost:5000/conversations', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setConversations(response.data.conversations);
    } catch (error) {
      console.error('Failed to load conversations');
    }
  };

  const startNewChat = async () => {
  const token = localStorage.getItem('token');
  if (!token) {
    // Anonymous mode
    setCurrentConvo(null);
    setMessages([]);
    setStressLevel(null);
    setShowCrisisAlert(false);
    return;
  }

  try {
    const response = await axios.post('http://localhost:5000/conversation/new', {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const newConvo = {
      id: response.data.convo_id,
      preview: 'New conversation',
      messages: []
    };
    
    setCurrentConvo(newConvo);
    setMessages([]);
    setStressLevel(null);
    setShowCrisisAlert(false);
    loadConversations();
  } catch (error) {
    console.error('Failed to create conversation');
  }
};

  const loadConversation = async (convo) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await axios.get(`http://localhost:5000/conversation/${convo.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setCurrentConvo(convo);
      setMessages(response.data.messages);
    } catch (error) {
      console.error('Failed to load conversation');
    }
  };

  const handleSend = async () => {
  const trimmedInput = input.trim();
  if (!trimmedInput || loading) return;

  const userMessage = { role: 'user', content: trimmedInput };
  const updatedMessages = [...messages, userMessage];

  setMessages(updatedMessages);
  setInput('');
  setLoading(true);

  try {
    // Pass currentConvo?.id (will be null if no convo created yet)
    const data = await sendMessage(trimmedInput, updatedMessages, currentConvo?.id);
    
    if (data.stress_level) {
      setStressLevel(data.stress_level);
    }

    if (data.is_crisis) {
      setShowCrisisAlert(true);
    }

    const aiMessage = { role: 'assistant', content: data.reply };
    setMessages([...updatedMessages, aiMessage]);

    loadConversations(); // Refresh sidebar

  } catch (error) {
    console.error('Send error:', error);
    const errorMessage = { 
      role: 'assistant', 
      content: 'Sorry, something went wrong. Please try again.' 
    };
    setMessages([...updatedMessages, errorMessage]);
  }
  
  setLoading(false);
};

  return (
    <div className="chat-layout">
      
      {/* Sidebar */}
      <div className="chat-sidebar">
        <button className="new-chat-btn" onClick={startNewChat}>
          + New Chat
        </button>
        
        <div className="conversation-list">
          {conversations.map(convo => (
            <div 
              key={convo.id} 
              className={`convo-item ${currentConvo?.id === convo.id ? 'active' : ''}`}
              onClick={() => loadConversation(convo)}
            >
              {convo.preview}
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat */}
      <div className="chat-main">
        <div className="chat-container">
          {showCrisisAlert && (
            <div className="crisis-banner">
              <strong>⚠️ Crisis Support Needed</strong>
              <p>Emergency helplines are available 24/7</p>
              <button onClick={() => setShowCrisisAlert(false)}>×</button>
            </div>
          )}

          <div className="chat-header">
            <h2>Virtual Mental Health Assistant</h2>
            <p>Academic Stress Support - Murang'a University</p>
            {stressLevel && (
              <div className="stress-indicator">
                <span>Stress Level: </span>
                <span className={`stress-badge ${stressLevel}`}>
                  {stressLevel.toUpperCase()}
                </span>
              </div>
            )}
          </div>

          <div className="messages">
            {messages.length === 0 && (
              <div className="welcome-message">
                <h3>👋 Welcome!</h3>
                <p>I'm here to support you through academic stress. Share what's on your mind.</p>
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
  );
}

export default ChatInterface;