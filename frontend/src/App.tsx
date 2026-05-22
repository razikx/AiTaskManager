import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthScreen } from './features/auth/AuthScreen';
import { Dashboard } from './features/dashboard/Dashboard';
import { UpdatePasswordScreen } from './features/auth/UpdatePasswordScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Sparkles } from 'lucide-react';

function AppContent(): React.JSX.Element {
  const { session, loading, isRecoveryMode } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-dark-bg flex flex-col justify-center items-center gap-4 text-slate-100">
        <div className="relative">
          <div className="w-12 h-12 border-4 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin"></div>
          <Sparkles className="w-5 h-5 text-brand-secondary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        </div>
        <p className="text-sm text-slate-400 font-medium">Connecting to workspace...</p>
      </div>
    );
  }

  if (isRecoveryMode) {
    return <UpdatePasswordScreen />;
  }

  return session ? <Dashboard /> : <AuthScreen />;
}

export default function App(): React.JSX.Element {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}
