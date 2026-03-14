import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { getDashboardSummary } from '../utils/api';
import '../styles/Dashboard.css';

function DashboardPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (!token) {
      // Guests shouldn’t be on dashboard; let them chat instead.
      navigate('/chat');
      return;
    }

    setUser(userData ? JSON.parse(userData) : null);

    (async () => {
      try {
        const data = await getDashboardSummary();
        setSummary(data);
      } catch (e) {
        console.error(e);
        setError('Failed to load dashboard.');
      }
    })();
  }, [navigate]);

  if (!user) return <div>Loading...</div>;

  return (
    <>
      <Navbar />
      <div className="dashboard-container">
        <div className="dashboard-content">
          <div className="welcome-section">
            <h1>Welcome back, {user.name}!</h1>
            <p>Your saved conversations are available below.</p>
            <button className="btn-start-chat" onClick={() => navigate('/chat')}>
              Start New Conversation
            </button>
          </div>

          {error && <div style={{ color: '#C62828', marginBottom: 16 }}>{error}</div>}

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-number">{summary?.total_conversations ?? 0}</div>
              <div className="stat-label">Total Conversations</div>
            </div>
            <div className="stat-card low">
              <div className="stat-number">—</div>
              <div className="stat-label">Stress Insights (next)</div>
            </div>
            <div className="stat-card moderate">
              <div className="stat-number">—</div>
              <div className="stat-label">Mood Tracking (next)</div>
            </div>
            <div className="stat-card severe">
              <div className="stat-number">—</div>
              <div className="stat-label">Wellness Tools (next)</div>
            </div>
          </div>

          <div className="recent-section">
            <h2>Recent Conversations</h2>

            {(summary?.recent_conversations || []).length === 0 ? (
              <p className="no-chats">No saved conversations yet. Start chatting!</p>
            ) : (
              <div className="chat-history">
                {summary.recent_conversations.map((c) => (
                  <div
                    key={c.id}
                    className="history-item user"
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/chat?c=${encodeURIComponent(c.id)}`)}
                    title="Open conversation"
                  >
                    <span className="role-badge">Conversation #{c.id}</span>
                    <p>{c.preview}</p>
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