import { useState, useEffect } from 'react';

export default function SettingsModal({ isOpen, onClose, apiUrl, setApiUrl, showToast }) {
  const [tempUrl, setTempUrl] = useState(apiUrl);
  const [isTesting, setIsTesting] = useState(false);
  const [healthStatus, setHealthStatus] = useState(null);

  useEffect(() => {
    setTempUrl(apiUrl);
  }, [apiUrl]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setIsTesting(true);
    setHealthStatus(null);
    try {
      const cleanUrl = tempUrl.replace(/\/+$/, '');
      const res = await fetch(`${cleanUrl}/api/health`, {
        method: 'GET',
        headers: { 'Bypass-Tunnel-Reminder': 'true' },
        signal: AbortSignal.timeout(5000)
      });
      if (res.ok) {
        const data = await res.json();
        setHealthStatus({ ok: true, message: `Connected! Model: ${data.model || 'YOLOv8'}` });
        showToast?.('Backend connected successfully!', 'success');
      } else {
        setHealthStatus({ ok: false, message: `Server returned HTTP ${res.status}` });
        showToast?.(`Backend check failed: HTTP ${res.status}`, 'error');
      }
    } catch (err) {
      setHealthStatus({ ok: false, message: err.message || 'Failed to connect to backend server' });
      showToast?.('Could not reach backend server', 'error');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    const cleanUrl = tempUrl.trim().replace(/\/+$/, '');
    setApiUrl(cleanUrl);
    localStorage.setItem('pothole_api_url', cleanUrl);
    showToast?.('API URL updated!', 'success');
    onClose();
  };

  const handleReset = () => {
    const defaultUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    setTempUrl(defaultUrl);
    setApiUrl(defaultUrl);
    localStorage.setItem('pothole_api_url', defaultUrl);
    showToast?.(`Reset API URL to default ${defaultUrl}`, 'info');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-[#111827] border border-amber-500/30 rounded-2xl p-6 shadow-[0_0_50px_rgba(245,158,11,0.15)] flex flex-col gap-5 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <span className="material-symbols-outlined text-xl">tune</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100 font-heading">System & API Settings</h3>
              <p className="text-xs text-slate-400">Configure YOLO backend endpoints and telemetry</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* API Endpoint Input */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-amber-400 text-sm">lan</span>
            Flask Backend URL
          </label>
          <div className="flex gap-2">
            <input 
              type="text" 
              value={tempUrl} 
              onChange={(e) => setTempUrl(e.target.value)} 
              placeholder="http://localhost:5000 or tunnel URL"
              className="flex-1 bg-slate-900/90 border border-slate-700 focus:border-amber-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none font-mono transition-colors"
            />
            <button
              onClick={handleTestConnection}
              disabled={isTesting}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {isTesting ? (
                <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-sm text-amber-400">network_ping</span>
              )}
              Test
            </button>
          </div>
          <p className="text-[11px] text-slate-400">
            Default: <span className="font-mono text-amber-400">{import.meta.env.VITE_API_URL || 'http://localhost:5000'}</span>. For remote devices or mobile testing, use your tunnel URL.
          </p>
        </div>

        {/* Health status readout */}
        {healthStatus && (
          <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${healthStatus.ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
            <span className="material-symbols-outlined text-base">
              {healthStatus.ok ? 'check_circle' : 'error'}
            </span>
            <span className="font-mono flex-1">{healthStatus.message}</span>
          </div>
        )}

        {/* Preset Quick Switches */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Presets</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setTempUrl('http://localhost:5000')}
              className={`p-2.5 rounded-xl border text-left text-xs transition-all flex flex-col gap-1 ${tempUrl === 'http://localhost:5000' ? 'bg-amber-500/15 border-amber-500 text-amber-400' : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300'}`}
            >
              <span className="font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">computer</span>
                Local Machine
              </span>
              <span className="font-mono text-[10px] text-slate-400 truncate">http://localhost:5000</span>
            </button>
            <button
              onClick={() => setTempUrl('https://8ba7e67c6c1ab7.lhr.life')}
              className={`p-2.5 rounded-xl border text-left text-xs transition-all flex flex-col gap-1 ${tempUrl === 'https://8ba7e67c6c1ab7.lhr.life' ? 'bg-amber-500/15 border-amber-500 text-amber-400' : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300'}`}
            >
              <span className="font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">cloud</span>
                Cloud / Tunnel
              </span>
              <span className="font-mono text-[10px] text-slate-400 truncate">Pinggy / Localtunnel</span>
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-4 mt-2">
          <button
            onClick={handleReset}
            className="text-xs text-slate-400 hover:text-slate-200 underline transition-colors"
          >
            Reset to Default
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-xl text-xs font-bold shadow-[0_0_15px_rgba(245,158,11,0.3)] transition-all"
            >
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
