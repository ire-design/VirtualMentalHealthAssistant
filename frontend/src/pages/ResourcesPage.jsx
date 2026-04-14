import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboardInsights, getResources } from '../utils/api';
import '../styles/ResourcePage.css';

function ResourcesPage() {
  const navigate = useNavigate();
  const [insights, setInsights] = useState(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [resources, setResources] = useState([]);
  const [loadingResources, setLoadingResources] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const preferredTheme = useMemo(() => {
    const t = (insights?.top_themes || [])[0]?.theme;
    return t ? String(t).toLowerCase() : '';
  }, [insights]);

  useEffect(() => {
    (async () => {
      try {
        setLoadingResources(true);
        const data = await getResources();
        setResources(data.resources || []);
      } catch (e) {
        console.error('Failed to load resources:', e);
      } finally {
        setLoadingResources(false);
      }
    })();

    const token = localStorage.getItem('token');
    if (!token) return;
    (async () => {
      try {
        setLoadingInsights(true);
        const ins = await getDashboardInsights(7);
        setInsights(ins);
      } catch (e) {
        console.error('Failed to load insights:', e);
      } finally {
        setLoadingInsights(false);
      }
    })();
  }, []);

  // Breathing tool state
  const [breathRunning, setBreathRunning] = useState(false);
  const [breathPhase, setBreathPhase] = useState('Ready');
  const [breathSecondsLeft, setBreathSecondsLeft] = useState(0);
  const [breathTotalSeconds, setBreathTotalSeconds] = useState(60);

  useEffect(() => {
    if (!breathRunning) return;
    if (breathSecondsLeft <= 0) return;
    const t = setInterval(() => setBreathSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [breathRunning, breathSecondsLeft]);

  useEffect(() => {
    if (!breathRunning) return;
    const total = breathTotalSeconds;
    const elapsed = total - breathSecondsLeft;
    const phaseLen = 4;
    const cycleLen = 16;
    if (breathSecondsLeft <= 0) {
      setBreathRunning(false);
      setBreathPhase('Done');
      return;
    }
    const pos = elapsed % cycleLen;
    if (pos < phaseLen) setBreathPhase('Breathe in');
    else if (pos < phaseLen * 2) setBreathPhase('Hold');
    else if (pos < phaseLen * 3) setBreathPhase('Breathe out');
    else setBreathPhase('Hold');
  }, [breathRunning, breathSecondsLeft, breathTotalSeconds]);

  const startBreathing = (seconds) => {
    const s = Number(seconds) || 60;
    setBreathTotalSeconds(s);
    setBreathRunning(true);
    setBreathSecondsLeft(s);
    setBreathPhase('Breathe in');
  };

  const stopBreathing = () => {
    setBreathRunning(false);
    setBreathSecondsLeft(0);
    setBreathPhase('Ready');
  };

  // Filter resources from DB
  const categories = ['all', ...Array.from(new Set(resources.map((r) => r.category)))];

  const filteredResources = resources.filter((r) => {
    const matchCat = activeCategory === 'all' || r.category === activeCategory;
    const q = searchQuery.trim().toLowerCase();
    const matchSearch = !q ||
      (r.title || '').toLowerCase().includes(q) ||
      (r.description || '').toLowerCase().includes(q) ||
      (r.category || '').toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  const grouped = filteredResources.reduce((acc, r) => {
    const cat = r.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(r);
    return acc;
  }, {});

  const CAT_LABELS = {
    video: 'Watch',
    article: 'Read',
    emergency: 'Emergency Contacts',
    technique: 'Coping Techniques',
    campus: 'Campus Support',
    other: 'Other'
  };

  return (
    <div className="resources-container">
      <div className="resources-header">
        <button className="back-btn" onClick={() => navigate('/dashboard')}>← Back</button>
        <h1>Mental Health Resources</h1>
        <p>Helpful information and coping strategies for academic stress</p>
      </div>

      <div className="resources-content">

        {/* Quick Tools — always static, no DB needed */}
        <section className="resource-section">
          <h2>Quick Tools</h2>
          {loadingInsights ? (
            <p className="muted">Loading your suggestions...</p>
          ) : preferredTheme ? (
            <p className="muted">Suggested based on your recent chats: <strong>{preferredTheme}</strong></p>
          ) : (
            <p className="muted">Try one quick tool. Small steps can calm your mind fast.</p>
          )}

          <div className="cards">
            <div className="card">
              <h3>Box Breathing</h3>
              <p className="muted">A quick reset when stress spikes.</p>
              <div className="breath-status">
                {breathPhase} {breathRunning ? `• ${breathSecondsLeft}s` : ''}
              </div>
              <div className="actions">
                {!breathRunning ? (
                  <>
                    <button className="btn" onClick={() => startBreathing(60)}>1 min</button>
                    <button className="btn" onClick={() => startBreathing(180)}>3 min</button>
                    <button className="btn" onClick={() => startBreathing(300)}>5 min</button>
                  </>
                ) : (
                  <button className="btn" onClick={stopBreathing}>Stop</button>
                )}
                <button className="btn" onClick={() => navigate('/chat')}>Talk to Assistant</button>
              </div>
            </div>

            <div className="card">
              <h3>5-4-3-2-1 Grounding</h3>
              <p className="muted">A fast way to feel present again.</p>
              <ul className="simple-list">
                <li><strong>5</strong> things you can see</li>
                <li><strong>4</strong> things you can hear</li>
                <li><strong>3</strong> things you can touch</li>
                <li><strong>2</strong> things you can smell</li>
                <li><strong>1</strong> thing you can taste</li>
              </ul>
            </div>

            <div className="card">
              <h3>10-min Study Sprint</h3>
              <p className="muted">Break procrastination with one tiny start.</p>
              <ul className="simple-list">
                <li><strong>2 min:</strong> open notes, pick one tiny task</li>
                <li><strong>8 min:</strong> focus only on that task</li>
                <li>Ask the assistant to help plan the next 30 minutes.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* DB-driven resources */}
        <section className="resource-section">
          <h2>Resources Library</h2>

          {/* Search + category filter */}
          <div className="resource-controls">
            <input
              className="resource-search"
              type="text"
              placeholder="Search resources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="category-tabs">
              {categories.map((cat) => (
                <button
                  key={cat}
                  className={`cat-tab ${activeCategory === cat ? 'active' : ''}`}
                  onClick={() => setActiveCategory(cat)}
                >
                  {CAT_LABELS[cat] || cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {loadingResources ? (
            <p className="muted">Loading resources...</p>
          ) : filteredResources.length === 0 ? (
            <p className="muted">No resources found.</p>
          ) : (
            Object.entries(grouped).map(([cat, items]) => (
              <div key={cat} style={{ marginBottom: 24 }}>
                <h3 style={{ marginBottom: 10, fontSize: 15, fontWeight: 900 }}>
                  {CAT_LABELS[cat] || cat}
                </h3>
                <div className="cards">
                  {items.map((r) => (
                    <div className="card" key={r.id}>
                      <h3>{r.title}</h3>
                      {r.description && <p className="muted">{r.description}</p>}
                      {r.link && r.link.startsWith('http') && (
                        <div className="actions">
                          <a className="btn" href={r.link} target="_blank" rel="noreferrer"
                            style={{ textDecoration: 'none' }}>
                            Open
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </section>

        <div className="cta">
          <button className="btn primary" onClick={() => navigate('/chat')}>
            Talk to the Assistant
          </button>
        </div>
      </div>
    </div>
  );
}

export default ResourcesPage;