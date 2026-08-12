import { useEffect, useState } from 'react';
import { AlertTriangle, XCircle } from 'lucide-react';

export default function AlertsToast({ alerts, onDismiss }) {
  const [visible, setVisible] = useState([]);

  useEffect(() => {
    if (alerts.length > 0) {
      const newest = alerts[0];
      // Only show if not already visible
      setVisible((prev) => {
        if (prev.find((v) => v.id === newest.id)) return prev;
        const next = [newest, ...prev].slice(0, 4);
        return next;
      });
    }
  }, [alerts]);

  // Auto-dismiss after 5s
  useEffect(() => {
    if (visible.length === 0) return;
    const timer = setTimeout(() => {
      setVisible((prev) => prev.slice(0, -1));
    }, 5000);
    return () => clearTimeout(timer);
  }, [visible]);

  if (visible.length === 0) return null;

  return (
    <div className="toast-stack">
      {visible.map((alert) => (
        <div
          key={alert.id}
          className={`toast toast-${alert.type}`}
        >
          <AlertTriangle
            size={18}
            className="toast-icon"
            style={{ color: alert.type === 'danger' ? 'var(--danger)' : 'var(--accent-orange)' }}
          />
          <div className="toast-content">
            <div className="toast-title">{alert.type === 'danger' ? 'CRITICAL' : 'WARNING'}</div>
            <div className="toast-message">{alert.message}</div>
          </div>
          <span className="toast-time">
            {new Date(alert.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
      ))}
    </div>
  );
}
