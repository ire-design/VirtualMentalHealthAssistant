import React, { useEffect } from 'react';

export default function UndoToast({ visible, message, secondsLeft, onUndo, onClose }) {
  useEffect(() => {
    if (!visible) return;
    if (secondsLeft <= 0) onClose?.();
  }, [visible, secondsLeft, onClose]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 20,
        transform: 'translateX(-50%)',
        background: 'rgba(20, 20, 20, 0.92)',
        color: 'white',
        padding: '12px 14px',
        borderRadius: 12,
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        zIndex: 9999,
        boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
        maxWidth: 560,
        width: 'calc(100% - 24px)'
      }}
    >
      <div style={{ flex: 1, fontSize: 14 }}>
        {message}{' '}
        <span style={{ opacity: 0.8, fontSize: 12 }}>
          (Undo {secondsLeft}s)
        </span>
      </div>

      <button
        onClick={onUndo}
        style={{
          background: 'white',
          color: '#111',
          border: 'none',
          borderRadius: 10,
          padding: '8px 12px',
          cursor: 'pointer',
          fontWeight: 700
        }}
      >
        Undo
      </button>

      <button
        onClick={onClose}
        title="Dismiss"
        style={{
          background: 'transparent',
          color: 'white',
          border: '1px solid rgba(255,255,255,0.25)',
          borderRadius: 10,
          padding: '8px 10px',
          cursor: 'pointer'
        }}
      >
        ×
      </button>
    </div>
  );
}