import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { getReports } from '../utils/api';
import '../styles/ReportsPage.css';

const MOOD_LABELS = { great: 'Great', okay: 'Okay', stressed: 'Stressed', low: 'Low', overwhelmed: 'Overwhelmed' };
const MOOD_COLORS = { great: '#2e7d32', okay: '#1565c0', stressed: '#b26a00', low: '#6a1515', overwhelmed: '#7b1fa2' };
const STRESS_COLORS = { low: '#2e7d32', moderate: '#b26a00', severe: '#c62828', crisis: '#7b1fa2' };

function ReportsPage() {
  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(weekAgo);
  const [endDate, setEndDate] = useState(today);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) setUser(JSON.parse(u));
  }, []);

  const generateReport = async () => {
    if (!startDate || !endDate) return;
    if (startDate > endDate) {
      setError('Start date cannot be after end date.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const data = await getReports(startDate, endDate);
      setReport(data);
    } catch (e) {
      setError('Failed to generate report. Please try again.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => window.print();

  const userName = user?.name ? user.name.toUpperCase() : 'MY';

  return (
    <>
      <Navbar />
      <div className="reports-container page-wrap">

        <div className="reports-header glass-card no-print">
          <button className="back-btn" onClick={() => navigate('/dashboard')}>← Back</button>
          <h1 className="title">Session Report</h1>
          <p className="small-muted">Generate a summary of your mental health activity for any date range.</p>
        </div>

        {/* Date picker */}
        <div className="reports-form glass-card no-print">
          <div className="date-row">
            <div className="date-field">
              <label>Start Date</label>
              <input
                type="date"
                value={startDate}
                max={today}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="date-field">
              <label>End Date</label>
              <input
                type="date"
                value={endDate}
                max={today}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <button className="generate-btn" onClick={generateReport} disabled={loading}>
              {loading ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
          {error && <p className="report-error">{error}</p>}
        </div>

        {/* Report output */}
        {report && (
          <div className="report-output">

            {/* Print-only header */}
            <div className="print-only report-print-header">
              <h2>{userName} — SESSION REPORT</h2>
              <p>MUT-Virtual Mental Health Assistant</p>
              <p>Period: {report.start_date} to {report.end_date}</p>
            </div>

            {/* Screen header */}
            <div className="report-actions glass-card no-print">
              <div>
                <h2 className="title">{userName} — SESSION REPORT</h2>
                <span className="report-period">{report.start_date} → {report.end_date}</span>
              </div>
              <button className="print-btn" onClick={handlePrint}>🖨 Print / Save PDF</button>
            </div>

            {/* Summary cards */}
            <div className="report-cards">
              <div className="report-card">
                <div className="report-card-number">{report.total_conversations}</div>
                <div className="report-card-label">Total Conversations</div>
              </div>
              <div className="report-card">
                <div className="report-card-number">{report.total_user_messages}</div>
                <div className="report-card-label">Messages Sent</div>
              </div>
              <div className="report-card">
                <div className="report-card-number">
                  {report.mood_average !== null ? `${report.mood_average}/5` : 'N/A'}
                </div>
                <div className="report-card-label">Avg Mood Score</div>
              </div>
              <div className="report-card">
                <div className="report-card-number">{report.mood_entries_count}</div>
                <div className="report-card-label">Mood Check-ins</div>
              </div>
            </div>

            {/* Stress distribution */}
            <div className="report-section">
              <h3>Stress Level Distribution</h3>
              {report.total_user_messages === 0 ? (
                <p className="muted">No messages in this period.</p>
              ) : (
                <div className="stress-bars">
                  {Object.entries(report.stress_percentages).map(([key, pct]) => (
                    <div key={key} className="stress-bar-row">
                      <span className="stress-bar-label">
                        {key.charAt(0).toUpperCase() + key.slice(1)}
                      </span>
                      <div className="stress-bar-track">
                        <div
                          className="stress-bar-fill"
                          style={{ width: `${pct}%`, background: STRESS_COLORS[key] }}
                        />
                      </div>
                      <span className="stress-bar-pct">
                        {pct}% ({report.stress_distribution[key]})
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <p className="report-dominant">
                Dominant stress level:{' '}
                <strong style={{ color: STRESS_COLORS[report.dominant_stress_level] }}>
                  {report.dominant_stress_level?.toUpperCase()}
                </strong>
              </p>
            </div>

            {/* Mood breakdown */}
            <div className="report-section">
              <h3>Mood Breakdown</h3>
              {report.mood_entries_count === 0 ? (
                <p className="muted">No mood entries in this period.</p>
              ) : (
                <div className="mood-breakdown">
                  {Object.entries(report.mood_breakdown).map(([key, count]) =>
                    count > 0 ? (
                      <div key={key} className="mood-chip" style={{ background: MOOD_COLORS[key] }}>
                        <span className="mood-chip-label">{MOOD_LABELS[key]}</span>
                        <span className="mood-chip-count">{count}x</span>
                      </div>
                    ) : null
                  )}
                </div>
              )}
            </div>

            {/* Top themes */}
            <div className="report-section">
              <h3>Top Stress Themes</h3>
              {report.top_themes.length === 0 ? (
                <p className="muted">No themes detected in this period.</p>
              ) : (
                <div className="themes-list">
                  {report.top_themes.map((t) => (
                    <div key={t.theme} className="theme-row">
                      <span className="theme-name">
                        {t.theme.charAt(0).toUpperCase() + t.theme.slice(1)}
                      </span>
                      <div className="theme-bar-track">
                        <div
                          className="theme-bar-fill"
                          style={{
                            width: `${Math.min(100, (t.count / report.total_user_messages) * 100)}%`
                          }}
                        />
                      </div>
                      <span className="theme-count">
                        {t.count} mention{t.count !== 1 ? 's' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Crisis note */}
            {report.crisis_count > 0 && (
              <div className="report-section crisis-note">
                ⚠️ <strong>{report.crisis_count} crisis signal{report.crisis_count !== 1 ? 's' : ''}</strong> detected
                in this period. Please consider reaching out to a counsellor.
              </div>
            )}

            <div className="report-footer">
              <p>Generated by Virtual Mental Health Assistant — MUT</p>
              <p>This report is for personal reflection only and does not constitute a clinical assessment.</p>
            </div>

          </div>
        )}
      </div>
    </>
  );
}

export default ReportsPage;