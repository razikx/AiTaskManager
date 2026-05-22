import React, { useActionState, useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { LogIn, UserPlus, Mail, ShieldAlert, Sparkles, ArrowLeft, MailOpen } from 'lucide-react';
import { PasswordField } from '../../components/PasswordField';

interface AuthState {
  error: string | null;
  success: boolean;
}

type AuthView = 'signin' | 'signup' | 'forgot';

export function AuthScreen(): React.JSX.Element {
  const [view, setView] = useState<AuthView>('signin');
  const [errorCleared, setErrorCleared] = useState(false);
  const [actionView, setActionView] = useState<AuthView>('signin');

  // Parse URL hash parameters on initial load to capture and display recovery errors (e.g. link expired)
  const [hashError] = useState<string | null>(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const errorDescription = hashParams.get('error_description');
      if (errorDescription) {
        return decodeURIComponent(errorDescription).replace(/\+/g, ' ');
      }
    }
    return null;
  });

  // Clear hash from URL on mount so reload doesn't keep showing the error banner
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash.includes('error_description')) {
      window.history.replaceState(
        {},
        document.title,
        window.location.pathname + window.location.search
      );
    }
  }, []);

  // Form action handler using React 19's useActionState
  const [formState, formAction, isPending] = useActionState<AuthState, FormData>(
    async (_prevState: AuthState, formData: FormData) => {
      const email = formData.get('email') as string;

      if (!email) {
        return { error: 'Please enter your email address.', success: false };
      }

      // Handle Forgot Password flow
      if (view === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin, // Redirects back to homepage (handled by App/AuthContext)
        });

        if (error) {
          return { error: error.message, success: false };
        }
        return {
          error: null,
          success: true,
        };
      }

      const password = formData.get('password') as string;
      if (!password) {
        return { error: 'Please enter your password.', success: false };
      }

      // Handle Sign Up flow
      if (view === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          return { error: error.message, success: false };
        }
        return {
          error: null,
          success: true,
        };
      } 
      
      // Handle Sign In flow
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error: error.message, success: false };
      }
      return { error: null, success: true };
    },
    { error: null, success: false }
  );

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-radial from-slate-900 to-brand-dark-bg">
      {/* Background Decorative Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-primary/10 rounded-full blur-3xl -z-10 pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand-secondary/10 rounded-full blur-3xl -z-10 pointer-events-none"></div>

      <div className="max-w-md w-full space-y-6 text-center mb-4">
        <div className="flex justify-center items-center gap-2">
          <Sparkles className="w-8 h-8 text-brand-secondary animate-pulse" />
          <span className="font-display font-bold text-3xl tracking-tight text-white">
            AiTaskManager
          </span>
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-white animate-fade-in">
          Manage Tasks with <span className="text-gradient">AI Intelligence</span>
        </h1>
        <p className="text-slate-400 text-sm max-w-sm mx-auto">
          Scaffold projects, organize priorities, and parse natural language commands using AI.
        </p>
      </div>

      <div className="glass-panel glass-panel-hover max-w-md w-full rounded-2xl shadow-2xl p-8 border border-white/10 animate-fade-in">
        
        {/* View Titles */}
        <h2 className="font-display text-2xl font-bold text-white mb-6 text-center">
          {view === 'forgot'
            ? 'Reset Password'
            : view === 'signup'
            ? 'Create your Account'
            : 'Welcome Back'}
        </h2>

        {/* Error Banners */}
        {!errorCleared && actionView === view && formState.error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm mb-4 animate-fade-in">
            <ShieldAlert className="w-5 h-5 flex-shrink-0" />
            <span>{formState.error}</span>
          </div>
        )}

        {hashError && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm mb-4 animate-fade-in">
            <ShieldAlert className="w-5 h-5 flex-shrink-0" />
            <span>{hashError}</span>
          </div>
        )}

        {/* Success Banners */}
        {!errorCleared && actionView === view && formState.success && view === 'signup' && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-lg text-sm mb-4 animate-fade-in">
            Registration successful! Please check your email inbox to verify your account or proceed to log in.
          </div>
        )}

        {!errorCleared && actionView === view && formState.success && view === 'forgot' && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-lg text-sm mb-4 flex flex-col items-center gap-2.5 text-center animate-fade-in">
            <MailOpen className="w-8 h-8 text-brand-accent animate-bounce" />
            <p className="font-medium text-white">Check your Inbox</p>
            <p className="text-xs text-slate-300">
              We have sent a password recovery link to your email address. Please open the link to update your credentials.
            </p>
          </div>
        )}

        <form
          onSubmit={() => {
            setErrorCleared(false);
            setActionView(view);
          }}
          action={formAction}
          className="space-y-4"
        >
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1.5" htmlFor="email">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                <Mail className="w-5 h-5" />
              </span>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                disabled={isPending}
                placeholder="you@example.com"
                className="w-full bg-slate-950/50 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all duration-200"
              />
            </div>
          </div>

          {/* Render password field only for signin/signup */}
          {view !== 'forgot' && (
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-slate-300 text-sm font-medium" htmlFor="password">
                  Password
                </label>
                {view === 'signin' && (
                  <button
                    type="button"
                    onClick={() => setView('forgot')}
                    className="text-xs text-brand-secondary hover:text-white transition-colors"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <PasswordField
                id="password"
                name="password"
                autoComplete="current-password"
                required
                disabled={isPending}
                placeholder="••••••••"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full mt-2 bg-gradient-to-r from-brand-primary to-brand-secondary hover:from-brand-primary-hover hover:to-brand-secondary text-white py-2.5 px-4 rounded-lg font-medium shadow-lg shadow-brand-primary/20 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none"
          >
            {isPending ? (
              <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
            ) : view === 'forgot' ? (
              <>
                <Mail className="w-5 h-5" />
                <span>Send Recovery Link</span>
              </>
            ) : view === 'signup' ? (
              <>
                <UserPlus className="w-5 h-5" />
                <span>Create Account</span>
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                <span>Sign In</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-white/5 text-center">
          {view === 'forgot' ? (
            <button
              type="button"
              onClick={() => {
                setView('signin');
                setErrorCleared(true);
              }}
              className="text-slate-400 hover:text-white text-sm transition-colors duration-200 flex items-center justify-center gap-1.5 mx-auto"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Sign In</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setView(view === 'signin' ? 'signup' : 'signin');
                setErrorCleared(true);
              }}
              className="text-slate-400 hover:text-white text-sm transition-colors duration-200"
            >
              {view === 'signin'
                ? "Don't have an account? Sign Up"
                : 'Already have an account? Sign In'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
