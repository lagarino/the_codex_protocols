import { useState, useEffect, useCallback } from 'react';

// Simple singleton event bus for toasts
const listeners = new Set();
export function showToast(msg, type = '') {
  listeners.forEach(fn => fn({ msg, type }));
}

export default function Toast() {
  const [{ msg, type, visible }, setState] = useState({ msg: '', type: '', visible: false });

  useEffect(() => {
    let timer;
    const handler = ({ msg, type }) => {
      setState({ msg, type, visible: true });
      clearTimeout(timer);
      timer = setTimeout(() => setState(s => ({ ...s, visible: false })), 3000);
    };
    listeners.add(handler);
    return () => { listeners.delete(handler); clearTimeout(timer); };
  }, []);

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24,
      background: 'var(--card)', border: `1px solid var(--border-lit)`,
      borderLeft: type === 'success' ? '3px solid var(--success)'
                : type === 'error'   ? '3px solid var(--red)' : undefined,
      borderRadius: 6, padding: '12px 16px',
      fontSize: 13, color: 'var(--text)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      zIndex: 500, maxWidth: 320,
      transform: visible ? 'translateY(0)' : 'translateY(80px)',
      opacity: visible ? 1 : 0,
      transition: 'transform 0.25s, opacity 0.25s',
      pointerEvents: 'none',
    }}>
      {msg}
    </div>
  );
}
