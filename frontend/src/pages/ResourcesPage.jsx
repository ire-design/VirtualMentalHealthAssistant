import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboardInsights } from '../utils/api';
import '../styles/ResourcePage.css';

function ResourcesPage() {
  const navigate = useNavigate();
  const [insights, setInsights] = useState(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  const preferredTheme = useMemo(() => {
    const t = (insights?.top_themes || [])[0]?.theme;
    return t ? String(t).toLowerCase() : '';
  }, [insights]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    (async () => {
      try {
        setLoadingInsights(true);
        const ins = await getDashboardInsights(7);
        setInsights(ins);
      } catch (e) {
        console.error('Failed to load insights for resources:', e);
      } finally {
        setLoadingInsights(false);
      }
    })();
  }, []);

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

  const RESOURCE_LINKS = [
    {
      title: 'Exam Anxiety (short grounding + calming tips)',
      type: 'Video',
      minutes: 8,
      url: 'https://www.youtube.com/results?search_query=exam+anxiety+grounding+techniques'
    },
    {
      title: 'Box Breathing (4-4-4-4) explained',
      type: 'Video',
      minutes: 5,
      url: 'https://www.youtube.com/results?search_query=box+breathing+4-4-4-4'
    },
    {
      title: 'Pomodoro Technique (study focus)',
      type: 'Article',
      minutes: 6,
      url: 'https://en.wikipedia.org/wiki/Pomodoro_Technique'
    },
    {
      title: 'Spaced repetition (study smarter)',
      type: 'Article',
      minutes: 7,
      url: 'https://en.wikipedia.org/wiki/Spaced_repetition'
    }
  ];

  const quickToolsOrder = useMemo(() => {
    const base = [
      { key: 'breathing', title: 'Box breathing', subtitle: 'A quick reset when stress spikes.' },
      { key: 'grounding', title: '5-4-3-2-1 grounding', subtitle: 'A fast way to feel present again.' },
      { key: 'study', title: '10-minute “start studying” sprint', subtitle: 'Break procrastination with one tiny start.' }
    ];

    if (!preferredTheme) return base;

    if (preferredTheme === 'sleep') {
      return [
        { key: 'breathing', title: 'Box breathing', subtitle: 'Lower your body’s stress signal before bed.' },
        { key: 'grounding', title: '5-4-3-2-1 grounding', subtitle: 'Get out of spiraling thoughts.' },
        { key: 'study', title: '10-minute “start studying” sprint', subtitle: 'Start small, then decide what’s next.' }
      ];
    }

    return base;
  }, [preferredTheme]);

  return (
    <div className="resources-container">
      <div className="resources-header">
        <button className="back-btn" onClick={() => navigate('/dashboard')}>
          ← Back
        </button>
        <h1>Mental Health Resources</h1>
        <p>Helpful information and coping strategies for academic stress</p>
      </div>

      <div className="resources-content">
        <section className="resource-section">
          <h2>Quick Tools</h2>

          {loadingInsights ? (
            <p className="muted">Loading your suggestions...</p>
          ) : preferredTheme ? (
            <p className="muted">
              Suggested based on your recent chats: <strong>{preferredTheme}</strong>
            </p>
          ) : (
            <p className="muted">Try one quick tool—small steps can calm your mind fast.</p>
          )}

          <div className="cards">
            {quickToolsOrder.map((t) => (
              <div className="card" key={t.key}>
                <h3>{t.title}</h3>
                <p className="muted">{t.subtitle}</p>

                {t.key === 'breathing' && (
                  <>
                    <div className="breath-status">
                      {breathPhase} {breathRunning ? `• ${breathSecondsLeft}s` : ''}
                    </div>

                    <div className="actions">
                      {!breathRunning ? (
                        <>
                          <button className="btn" type="button" onClick={() => startBreathing(60)}>
                            Start 1 min
                          </button>
                          <button className="btn" type="button" onClick={() => startBreathing(180)}>
                            Start 3 min
                          </button>
                          <button className="btn" type="button" onClick={() => startBreathing(300)}>
                            Start 5 min
                          </button>
                        </>
                      ) : (
                        <button className="btn" type="button" onClick={stopBreathing}>
                          Stop
                        </button>
                      )}

                      <button className="btn" type="button" onClick={() => navigate('/chat')}>
                        Talk to the Assistant
                      </button>
                    </div>
                  </>
                )}

                {t.key === 'grounding' && (
                  <ul className="simple-list">
                    <li>
                      <strong>5</strong> things you can see
                    </li>
                    <li>
                      <strong>4</strong> things you can hear
                    </li>
                    <li>
                      <strong>3</strong> things you can touch
                    </li>
                    <li>
                      <strong>2</strong> things you can smell
                    </li>
                    <li>
                      <strong>1</strong> thing you can taste
                    </li>
                  </ul>
                )}

                {t.key === 'study' && (
                  <ul className="simple-list">
                    <li>
                      <strong>2 minutes:</strong> open notes + pick one tiny task
                    </li>
                    <li>
                      <strong>8 minutes:</strong> focus only on that task (timer)
                    </li>
                    <li>If you want, ask the assistant to help you plan the next 30 minutes.</li>
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="resource-section">
          <h2>Emergency Contacts</h2>
          <div className="cards">
            <div className="card">
              <h3>Befrienders Kenya</h3>
              <p className="number">+254 793 594 849 / +254 754 580 252</p>
              <p className="muted">Email: info@befrienderskenya.org</p>
              <p className="muted">Suicide prevention and emotional crisis support</p>
            </div>
            <div className="card">
              <h3>MHFA Kenya</h3>
              <p className="number">+254 114 794 109</p>
              <p className="muted">Email: info@mhfakenya.org</p>
              <p className="muted">Mental health first aid support and referrals</p>
            </div>
            <div className="card">
              <h3>Emergency Services</h3>
              <p className="number">999 / 112</p>
              <p className="muted">Medical Emergencies</p>
            </div>
          </div>
        </section>

        <section className="resource-section">
          <h2>Watch / Read</h2>
          <div className="cards">
            {RESOURCE_LINKS.map((r) => (
              <div className="card" key={r.title}>
                <h3>{r.title}</h3>
                <p className="muted">
                  {r.type} • {r.minutes} min
                </p>
                <div className="actions">
                  <a className="btn" href={r.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                    Open
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="resource-section">
          <h2>Coping with Exam Stress</h2>
          <ul className="simple-list">
            <li>Create a realistic study schedule and stick to it</li>
            <li>Take regular 10-minute breaks every hour</li>
            <li>Practice deep breathing: 4 seconds in, 4 seconds hold, 4 seconds out</li>
            <li>Get 7-8 hours of sleep, especially before exams</li>
            <li>Break large topics into smaller, manageable chunks</li>
            <li>Form study groups with classmates for support</li>
          </ul>
        </section>

        <section className="resource-section">
          <h2>Stress Management Techniques</h2>
          <ul className="simple-list">
            <li>
              <strong>5-4-3-2-1 Grounding:</strong> Name 5 things you see, 4 you hear, 3 you touch, 2 you smell, 1 you
              taste
            </li>
            <li>
              <strong>Progressive Muscle Relaxation:</strong> Tense and relax each muscle group
            </li>
            <li>
              <strong>Journaling:</strong> Write down worries for 10 minutes daily
            </li>
            <li>
              <strong>Physical Activity:</strong> 20-30 minutes of walking or exercise
            </li>
            <li>
              <strong>Mindfulness:</strong> Focus on the present moment without judgment
            </li>
          </ul>
        </section>

        <section className="resource-section">
          <h2>When to Seek Professional Help</h2>
          <ul className="simple-list">
            <li>Feeling hopeless or worthless for more than 2 weeks</li>
            <li>Difficulty sleeping or eating for extended periods</li>
            <li>Persistent thoughts of self-harm or suicide</li>
            <li>Unable to focus on studies despite trying</li>
            <li>Avoiding friends, family, and social activities</li>
            <li>Physical symptoms (headaches, stomach issues) with no medical cause</li>
          </ul>
        </section>

        <section className="resource-section">
          <h2>MUT Campus Support</h2>
          <p className="muted">
            Murang'a University of Technology offers counseling services. Contact the Student Guidance and Counselling
            Office for appointments.
          </p>
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