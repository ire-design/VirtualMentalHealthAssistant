import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Navbar from '../components/Navbar';
import '../styles/Dashboard.css';

function DashboardPage() {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ total: 0, low: 0, moderate: 0, severe: 0 });
  const [recentChats, setRecentChats] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (!token) {
      navigate('/login');
      return;
    }

    setUser(JSON.parse(userData));
    fetchHistory(token);
  }, [navigate]);

  const fetchHistory = async (token) => {
    try {
      const response = await axios.get('http://localhost:5000/history', {
        headers: { Authorization: `Bearer ${token}` }
      });

      const chats = response.data.chats;
      setRecentChats(chats.slice(-6).reverse()); // Last 6 messages

      // Calculate stress stats (you can improve this logic)
      const total = chats.filter(c => c.role === 'user').length;
      setStats({ total, low: 0, moderate: 0, severe: 0 }); // Placeholder

    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  };

  if (!user) return <div>Loading...</div>;

  return (
    <>
      <Navbar />
      <div className="dashboard-container">
        <div className="dashboard-content">
          
          <div className="welcome-section">
            <h1>Welcome back, {user.name}! 👋</h1>
            <p>How are you feeling today?</p>
            <button className="btn-start-chat" onClick={() => navigate('/chat')}>
              Start New Conversation
            </button>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-number">{stats.total}</div>
              <div className="stat-label">Total Conversations</div>
            </div>
            <div className="stat-card low">
              <div className="stat-number">{stats.low}</div>
              <div className="stat-label">Low Stress</div>
            </div>
            <div className="stat-card moderate">
              <div className="stat-number">{stats.moderate}</div>
              <div className="stat-label">Moderate Stress</div>
            </div>
            <div className="stat-card severe">
              <div className="stat-number">{stats.severe}</div>
              <div className="stat-label">Severe Stress</div>
            </div>
          </div>

          <div className="recent-section">
            <h2>Recent Conversations</h2>
            {recentChats.length === 0 ? (
              <p className="no-chats">No conversations yet. Start chatting to see your history!</p>
            ) : (
              <div className="chat-history">
                {recentChats.map((chat, idx) => (
                  <div key={idx} className={`history-item ${chat.role}`}>
                    <span className="role-badge">{chat.role === 'user' ? 'You' : 'Assistant'}</span>
                    <p>{chat.content.substring(0, 100)}...</p>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}

export default DashboardPage;