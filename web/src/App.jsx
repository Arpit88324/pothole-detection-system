import { useState, useCallback, useEffect } from 'react';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import ScanView from './components/ScanView';
import ResultsView from './components/ResultsView';
import AnalyticsView from './components/AnalyticsView';
import HistoryView from './components/HistoryView';
import MapView from './components/MapView';
import RecordsView from './components/RecordsView';
import LoginView from './components/LoginView';
import SignupView from './components/SignupView';
import ForgotPasswordView from './components/ForgotPasswordView';
import SettingsModal from './components/SettingsModal';
import Toast from './components/Toast';
import ClickSpark from './components/ClickSpark';

function App() {
  const [currentView, setCurrentView] = useState('scan');
  const [results, setResults] = useState(null);
  const [analysisTime, setAnalysisTime] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('pothole_scan_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // API Backend URL state (stored in localStorage)
  const [apiUrl, setApiUrl] = useState(() => {
    return import.meta.env.VITE_API_URL || localStorage.getItem('pothole_api_url') || 'http://localhost:5000';
  });
  const [isApiOnline, setIsApiOnline] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Auth state
  const [user, setUser] = useState({
    name: 'Inspector Alex',
    email: 'officer@city.gov',
    role: 'Road Safety Officer',
  });

  // Toast state
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
  }, []);

  const handleCloseToast = useCallback(() => {
    setToast(null);
  }, []);

  // Periodic Backend Health Check
  useEffect(() => {
    let isMounted = true;
    async function checkHealth() {
      try {
        const baseUrl = import.meta.env.VITE_API_URL || apiUrl;
        const clean = baseUrl.replace(/\/+$/, '');
        const res = await fetch(`${clean}/api/health`, {
          method: 'GET',
          headers: { 'Bypass-Tunnel-Reminder': 'true' },
          signal: AbortSignal.timeout(4000),
        });
        
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setIsApiOnline(data.status === 'ok');
        } else {
          if (isMounted) setIsApiOnline(false);
        }
      } catch {
        if (isMounted) setIsApiOnline(false);
      }
    }

    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [apiUrl]);

  // Save history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('pothole_scan_history', JSON.stringify(history));
    } catch (err) {
      console.warn('Could not persist history to localStorage', err);
    }
  }, [history]);

  const handleLogin = useCallback((loggedInUser) => {
    setUser(loggedInUser);
    setCurrentView('scan');
  }, []);

  const handleSignup = useCallback((newUser) => {
    setUser(newUser);
    setCurrentView('scan');
  }, []);

  const handleLogout = useCallback(() => {
    setUser(null);
    showToast('Signed out successfully', 'info');
  }, [showToast]);

  const handleDetectionComplete = useCallback((data, elapsed) => {
    setResults(data);
    setAnalysisTime(elapsed);
    setIsLoading(false);
    setCurrentView('results');
  }, []);

  const handleBack = useCallback(() => {
    setResults(null);
    setCurrentView('scan');
  }, []);

  const handleSaveToHistory = useCallback((data, elapsed) => {
    const now = new Date();
    const timestamp =
      now.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }) +
      ', ' +
      now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });

    setHistory((prev) => [
      {
        ...data,
        analysisTime: elapsed,
        timestamp,
      },
      ...prev,
    ]);

    showToast('Saved to scan history!', 'success');
  }, [showToast]);

  const handleClearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem('pothole_scan_history');
  }, []);

  const handleNavigate = useCallback((view) => {
    if (view === 'scan') {
      setResults(null);
    }
    setCurrentView(view);
  }, []);

  return (
    <ClickSpark
      sparkColor="#f59e0b"
      sparkSize={10}
      sparkRadius={22}
      sparkCount={8}
      duration={400}
    >
      <div className="min-h-screen flex flex-col pb-[80px] md:pb-0 bg-[#0a0e17] text-slate-100 relative selection:bg-amber-500 selection:text-slate-950 font-body">
        <Toast toast={toast} onClose={handleCloseToast} />

        <Header
          user={user}
          onLogout={handleLogout}
          currentView={currentView === 'results' ? 'scan' : currentView}
          onNavigate={handleNavigate}
          onOpenSettings={() => setIsSettingsOpen(true)}
          isApiOnline={isApiOnline}
          apiUrl={apiUrl}
        />

        {currentView === 'scan' && (
          <ScanView
            onDetectionComplete={handleDetectionComplete}
            isLoading={isLoading}
            setIsLoading={setIsLoading}
            apiUrl={apiUrl}
            isApiOnline={isApiOnline}
            onOpenSettings={() => setIsSettingsOpen(true)}
            showToast={showToast}
          />
        )}

        {currentView === 'results' && (
          <ResultsView
            results={results}
            analysisTime={analysisTime}
            onBack={handleBack}
            onSaveToHistory={handleSaveToHistory}
            onNavigateToMap={() => handleNavigate('map')}
            showToast={showToast}
          />
        )}

        {currentView === 'analytics' && (
          <AnalyticsView
            history={history}
            showToast={showToast}
          />
        )}

        {currentView === 'history' && (
          <HistoryView
            history={history}
            onClearHistory={handleClearHistory}
            showToast={showToast}
          />
        )}

        {currentView === 'map' && (
          <MapView showToast={showToast} apiUrl={apiUrl} />
        )}

        {currentView === 'records' && (
          <RecordsView apiUrl={apiUrl} showToast={showToast} onNavigate={handleNavigate} />
        )}

        {currentView === 'login' && (
          <LoginView
            onLogin={handleLogin}
            onNavigate={handleNavigate}
            showToast={showToast}
          />
        )}

        {currentView === 'signup' && (
          <SignupView
            onSignup={handleSignup}
            onNavigate={handleNavigate}
            showToast={showToast}
          />
        )}

        {currentView === 'forgot-password' && (
          <ForgotPasswordView
            onNavigate={handleNavigate}
            showToast={showToast}
          />
        )}

        <BottomNav
          user={user}
          currentView={currentView === 'results' ? 'scan' : currentView}
          onNavigate={handleNavigate}
        />

        {/* Global System & Backend Endpoint Config Modal */}
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          apiUrl={apiUrl}
          setApiUrl={setApiUrl}
          showToast={showToast}
        />
      </div>
    </ClickSpark>
  );
}

export default App;
