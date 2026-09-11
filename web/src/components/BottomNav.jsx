export default function BottomNav({ user, currentView, onNavigate }) {
  const navItems = [
    { id: 'scan', icon: 'radar', label: 'Scan' },
    { id: 'map', icon: 'map', label: 'Map' },
    { id: 'analytics', icon: 'insights', label: 'Analytics' },
    { id: 'history', icon: 'history', label: 'History' },
    { id: 'records', icon: 'dataset', label: 'Records' },
  ];

  return (
    <nav className="md:hidden bg-[#0a0e17]/95 backdrop-blur-xl fixed bottom-0 left-0 right-0 z-50 border-t border-slate-800/80 flex justify-around items-center px-2 py-2 shadow-[0_-5px_25px_rgba(0,0,0,0.5)]">
      {navItems.map((item) => {
        const isActive = currentView === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-2 rounded-xl transition-all ${
              isActive
                ? 'text-amber-400 bg-amber-500/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="material-symbols-outlined text-xl mb-0.5" style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}>
              {item.icon}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
