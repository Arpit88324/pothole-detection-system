import { useState } from 'react';

export default function Header({ user, onLogout, currentView, onNavigate, onOpenSettings, isApiOnline, apiUrl }) {
  const [showMenu, setShowMenu] = useState(false);

  const navItems = [
    { id: 'scan', icon: 'radar', label: 'AI Scanner' },
    { id: 'map', icon: 'map', label: 'Hazard Map' },
    { id: 'analytics', icon: 'insights', label: 'Analytics' },
    { id: 'history', icon: 'history', label: 'Audit History' },
    { id: 'records', icon: 'dataset', label: 'Records' },
  ];

  return (
    <header className="bg-[#0a0e17]/95 backdrop-blur-xl w-full sticky top-0 z-40 border-b border-slate-800/80 px-4 md:px-8 h-16 flex items-center justify-between transition-all">
      {/* Brand & Logo */}
      <div 
        onClick={() => onNavigate('scan')} 
        className="flex items-center gap-3 cursor-pointer group select-none"
      >
        <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform shadow-[0_0_15px_rgba(245,158,11,0.25)]">
          <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            crisis_alert
          </span>
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-heading font-extrabold text-base tracking-tight text-slate-100 group-hover:text-amber-400 transition-colors">
              Pothole<span className="text-amber-400">Detect</span>
            </span>
            <span className="px-1.5 py-0.2 rounded bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[9px] font-mono font-bold uppercase">
              YOLOv8
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono hidden sm:inline leading-none">
            Civil Road Vision System
          </span>
        </div>
      </div>

      {/* Center Navigation Links (Desktop) */}
      <nav className="hidden md:flex items-center gap-1 bg-slate-900/80 border border-slate-800 p-1 rounded-xl">
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-amber-500 text-slate-950 shadow-md font-bold shadow-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span className="material-symbols-outlined text-base">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Right Controls: API Status Pill, Settings, User Profile */}
      <div className="flex items-center gap-3">
        {/* Live Backend Connection Status Pill */}
        <button
          onClick={onOpenSettings}
          title="Click to configure API URL & connection"
          className="hidden sm:flex items-center gap-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 rounded-xl px-3 py-1.5 transition-all text-left"
        >
          <span className={`w-2 h-2 rounded-full ${isApiOnline ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
          <div className="flex flex-col">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 leading-none">
              API {isApiOnline ? 'ONLINE' : 'CHECK'}
            </span>
            <span className="text-[11px] font-mono text-slate-200 font-bold leading-none truncate max-w-[100px]">
              {apiUrl ? apiUrl.replace(/^https?:\/\//, '') : 'localhost:5000'}
            </span>
          </div>
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          title="Settings & Config"
          className="w-9 h-9 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 text-slate-300 flex items-center justify-center transition-colors"
        >
          <span className="material-symbols-outlined text-lg">tune</span>
        </button>

        {/* User Profile / Auth */}
        {user ? (
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center gap-2 bg-slate-900 border border-slate-700/80 hover:border-amber-500/40 rounded-xl px-3 py-1.5 text-xs text-slate-200 font-semibold transition-all"
            >
              <div className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-bold text-[11px] flex items-center justify-center uppercase">
                {user.name ? user.name[0] : 'U'}
              </div>
              <span className="max-w-[100px] truncate hidden sm:inline">{user.name}</span>
              <span className="material-symbols-outlined text-sm text-slate-400">expand_more</span>
            </button>

            {/* Dropdown Menu */}
            {showMenu && (
              <div 
                className="absolute right-0 mt-2 w-48 bg-[#111827] border border-slate-700 rounded-xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2"
                onMouseLeave={() => setShowMenu(false)}
              >
                <div className="px-3 py-2 border-b border-slate-800 mb-1">
                  <p className="text-xs font-bold text-slate-200 truncate">{user.name}</p>
                  <p className="text-[10px] text-slate-400 truncate">{user.email || 'Inspector'}</p>
                </div>

                <button
                  onClick={() => {
                    setShowMenu(false);
                    onNavigate('scan');
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-amber-400 flex items-center gap-2 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">radar</span>
                  Scanner Dashboard
                </button>

                <button
                  onClick={() => {
                    setShowMenu(false);
                    onNavigate('analytics');
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-amber-400 flex items-center gap-2 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">insights</span>
                  Analytics & Reports
                </button>

                <button
                  onClick={() => {
                    setShowMenu(false);
                    onNavigate('history');
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-amber-400 flex items-center gap-2 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">history</span>
                  Audit History
                </button>

                <div className="border-t border-slate-800 my-1" />

                <button
                  onClick={() => {
                    setShowMenu(false);
                    onLogout();
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">logout</span>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => onNavigate('login')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
          >
            <span className="material-symbols-outlined text-sm">login</span>
            Sign In
          </button>
        )}
      </div>
    </header>
  );
}
