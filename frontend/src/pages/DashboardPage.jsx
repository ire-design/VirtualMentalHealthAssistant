import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { getDashboardSummary, getDashboardInsights, saveMood } from '../utils/api';
import '../styles/Dashboard.css';

function DashboardPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [summary, setSummary] = useState(null);
  const [insights, setInsights] = useState(null);
  const [error, setError] = useState('');

  const [moodOpen, setMoodOpen] = useState(false);
  const [moodValue, setMoodValue] = useState('');
  const [moodSaved, setMoodSaved] = useState(false);

  const refresh = async () => {
    const data = await getDashboardSummary();
    setSummary(data);
    const ins = await getDashboardInsights(7);
    setInsights(ins);
    setMoodSaved(Boolean(ins?.mood_today));
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (!token) {
      navigate('/chat');
      return;
    }

    setUser(userData ? JSON.parse(userData) : null);

    (async () => {
      try {
        await refresh();
      } catch (e) {
        console.error(e);
        setError('Failed to load dashboard.');
      }
    })();
  }, [navigate]);

  if (!user) return <div>Loading...</div>;

  const dominantStress = insights?.dominant_stress_level || null;
  const dominantLabel = dominantStress ? String(dominantStress).toLowerCase() : null;
  const topTheme = (insights?.top_themes || [])[0]?.theme || null;

  const stressLabelText = () => {
    if (!insights) return 'Stress Insights (next)';
    if (dominantLabel === 'crisis') return 'Urgent support recommended';
    if (dominantLabel === 'severe') return 'High stress signals (7 days)';
    if (dominantLabel === 'moderate') return 'Moderate stress signals (7 days)';
    return 'Low stress signals (7 days)';
  };

  const moodTileLabel = () => {
    const m = insights?.mood_today?.mood;
    if (!m) return 'Mood Tracking (tap to check-in)';
    return `Today: ${String(m).charAt(0).toUpperCase()}${String(m).slice(1)}`;
  };

  const saveMoodNow = async () => {
    if (!moodValue) return;
    try {
      await saveMood({ mood: moodValue });
      setMoodSaved(true);
      setMoodOpen(false);
      setMoodValue('');
      await refresh();
    } catch (e) {
      console.error(e);
      alert('Failed to save mood.');
    }
  };

  return (
    <>
      <Navbar />
      <div className="dashboard-container">
        <div className="dashboard-content">
          <div className="welcome-section">
            <h1>Welcome back, {user.name}!</h1>
            <p>Your saved conversations are available below.</p>
            <div className="welcome-actions">
              <button className="btn-start-chat" onClick={() => navigate('/chat')}>
                Start New Conversation
              </button>
              <button className="btn-resources" onClick={() => navigate('/resources')}>
                Resources
              </button>
            </div>
          </div>

          {error && <div style={{ color: '#C62828', marginBottom: 16 }}>{error}</div>}

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-number">{summary?.total_conversations ?? 0}</div>
              <div className="stat-label">Total Conversations</div>
            </div>

            <div
              className={`stat-card low ${insights ? 'clickable' : ''}`}
              onClick={() => navigate('/resources')}
              title="View tools and support"
            >
              <div className="stat-number">{insights ? (topTheme ? topTheme : 'Insights') : '—'}</div>
              <div className="stat-label">{stressLabelText()}</div>
            </div>

            <div className="stat-card moderate clickable" onClick={() => setMoodOpen(true)} title="Mood check-in">
              <div className="stat-number">{moodSaved ? '✓' : '—'}</div>
              <div className="stat-label">{moodTileLabel()}</div>
            </div>

            <div
              className="stat-card severe clickable"
              onClick={() => navigate('/resources')}
              title="Open Wellness Tools resources"
            >
              <div className="stat-number">Resources</div>
              <div className="stat-label">Wellness Tools</div>
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

      {/* Mood check-in modal */}
      {moodOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 9999
          }}
          onClick={() => setMoodOpen(false)}
        >
          <div
            style={{
              width: 'min(92vw, 520px)',
              background: 'rgba(255,243,232,.96)',
              border: '1px solid rgba(43,22,15,.18)',
              borderRadius: 18,
              boxShadow: 'var(--shadow-2)',
              padding: 16
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div style={{ fontWeight: 900, color: 'var(--brand-800)', fontFamily: 'var(--font-display)', fontSize: 18 }}>
                Mood Check-in
              </div>
              <button
                onClick={() => setMoodOpen(false)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 12,
                  border: '1px solid rgba(43,22,15,.14)',
                  background: 'rgba(43,22,15,.08)',
                  cursor: 'pointer',
                  fontWeight: 900
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div style={{ marginTop: 10, color: 'var(--muted)', fontSize: 13 }}>
              Pick the closest match for how you’re feeling today.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginTop: 12 }}>
              {[
                { k: 'great', label: 'Great' },
                { k: 'okay', label: 'Okay' },
                { k: 'stressed', label: 'Stressed' },
                { k: 'low', label: 'Low' },
                { k: 'overwhelmed', label: 'Overwhelmed' }
              ].map((opt) => (
                <button
                  key={opt.k}
                  onClick={() => setMoodValue(opt.k)}
                  style={{
                    padding: '12px 12px',
                    borderRadius: 14,
                    border: moodValue === opt.k ? '2px solid rgba(154,84,32,.75)' : '1px solid rgba(43,22,15,.14)',
                    background: 'rgba(246,226,210,.70)',
                    cursor: 'pointer',
                    fontWeight: 900,
                    color: 'var(--brand-800)'
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
              <button
                onClick={() => setMoodOpen(false)}
                style={{
                  padding: '10px 14px',
                  borderRadius: 999,
                  border: '1px solid rgba(43,22,15,.18)',
                  background: 'rgba(255,255,255,.82)',
                  cursor: 'pointer',
                  fontWeight: 900,
                  color: 'var(--brand-800)'
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveMoodNow}
                disabled={!moodValue}
                style={{
                  padding: '10px 14px',
                  borderRadius: 999,
                  border: 0,
                  background: 'linear-gradient(135deg,var(--brand-700),var(--brand-500))',
                  cursor: moodValue ? 'pointer' : 'not-allowed',
                  fontWeight: 900,
                  color: '#fff',
                  opacity: moodValue ? 1 : 0.65
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default DashboardPage;