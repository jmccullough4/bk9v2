import { useEffect, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';

export default function LogPanel({ logs }) {
  const logEndRef = useRef(null);
  const [autoScroll, setAutoScroll] = React.useState(true);

  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const getLogColor = (level) => {
    switch (level) {
      case 'error':
        return 'text-red-400';
      case 'alert':
        return 'text-red-500 font-bold';
      case 'success':
        return 'text-green-400';
      case 'info':
        return 'text-blue-400';
      default:
        return 'text-gray-400';
    }
  };

  const getLogIcon = (level) => {
    switch (level) {
      case 'error':
        return '❌';
      case 'alert':
        return '🚨';
      case 'success':
        return '✅';
      case 'info':
        return 'ℹ️';
      default:
        return '•';
    }
  };

  return (
    <div className="h-full flex flex-col bg-bluek9-dark">
      {/* Header */}
      <div className="px-4 py-2 border-b border-bluek9-cyan/30 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-bluek9-cyan">Live System Log</h2>
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className={`px-2 py-1 text-xs rounded ${
            autoScroll ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'
          }`}
        >
          {autoScroll ? '🔽 Auto-scroll ON' : '🔽 Auto-scroll OFF'}
        </button>
      </div>

      {/* Logs */}
      <div className="flex-1 overflow-auto px-4 py-2 font-mono text-xs space-y-1">
        {logs.map((log) => (
          <div key={log.id} className="flex items-start space-x-2">
            <span className="text-gray-600 shrink-0">
              [{new Date(log.timestamp).toLocaleTimeString()}]
            </span>
            <span className="shrink-0">{getLogIcon(log.level)}</span>
            <span className={getLogColor(log.level)}>{log.message}</span>
          </div>
        ))}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}
