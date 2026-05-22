import React, { useActionState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { Key, ShieldAlert, Sparkles, CheckCircle2 } from 'lucide-react';
import { PasswordField } from '../../components/PasswordField';

interface UpdateState {
  error: string | null;
  success: boolean;
}

export function UpdatePasswordScreen(): React.JSX.Element {
  const { setIsRecoveryMode } = useAuth();

  // Form action handler using React 19's useActionState
  const [formState, formAction, isPending] = useActionState<UpdateState, FormData>(
    async (_prevState: UpdateState, formData: FormData) => {
      const password = formData.get('password') as string;
      const confirmPassword = formData.get('confirmPassword') as string;

      if (!password || !confirmPassword) {
        return { error: 'Please enter both password fields.', success: false };
      }

      if (password !== confirmPassword) {
        return { error: 'Passwords do not match.', success: false };
      }

      if (password.length < 8) {
        return { error: 'Password must be at least 8 characters long.', success: false };
      }

      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        return { error: error.message, success: false };
      }

      // Success branch:
      // 1. Clear the URL parameters/hash (like access_token, type=recovery, etc.)
      window.history.replaceState(
        {},
        document.title,
        window.location.pathname + window.location.search
      );

      // 2. Delay clearing recovery mode state briefly to show success animation
      setTimeout(() => {
        setIsRecoveryMode(false);
      }, 1500);

      return { error: null, success: true };
    },
    { error: null, success: false }
  );

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-radial from-slate-900 to-brand-dark-bg">
      {/* Background Decorative Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-primary/10 rounded-full blur-3xl -z-10 pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand-secondary/10 rounded-full blur-3xl -z-10 pointer-events-none"></div>

      <div className="max-w-md w-full space-y-6 text-center mb-4 animate-fade-in">
        <div className="flex justify-center items-center gap-2">
          <Sparkles className="w-8 h-8 text-brand-secondary animate-pulse" />
          <span className="font-display font-bold text-3xl tracking-tight text-white">
            AiTaskManager
          </span>
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
          Reset Your <span className="text-gradient">Password</span>
        </h1>
        <p className="text-slate-400 text-sm max-w-sm mx-auto">
          Choose a secure password to regain access to your workspace projects and boards.
        </p>
      </div>

      <div className="glass-panel glass-panel-hover max-w-md w-full rounded-2xl shadow-2xl p-8 border border-white/10 animate-fade-in">
        <h2 className="font-display text-2xl font-bold text-white mb-6 text-center">
          Update Credentials
        </h2>

        {/* Error State */}
        {formState.error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm mb-4 animate-fade-in">
            <ShieldAlert className="w-5 h-5 flex-shrink-0" />
            <span>{formState.error}</span>
          </div>
        )}

        {/* Success State */}
        {formState.success && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-lg text-sm mb-4 flex flex-col items-center gap-2 text-center animate-fade-in">
            <CheckCircle2 className="w-8 h-8 text-brand-accent animate-scale-in" />
            <p className="font-medium text-white">Password Updated!</p>
            <p className="text-xs text-slate-300">
              Your password has been updated successfully. Redirecting you to your dashboard...
            </p>
          </div>
        )}

        <form action={formAction} className="space-y-4">
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1.5" htmlFor="password">
              New Password
            </label>
              <PasswordField
                id="password"
                name="password"
                required
                disabled={isPending || formState.success}
                placeholder="Min. 8 characters"
              />
          </div>

          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1.5" htmlFor="confirmPassword">
              Confirm New Password
            </label>
              <PasswordField
                id="confirmPassword"
                name="confirmPassword"
                required
                disabled={isPending || formState.success}
                placeholder="••••••••"
              />
          </div>

          <button
            type="submit"
            disabled={isPending || formState.success}
            className="w-full mt-2 bg-gradient-to-r from-brand-primary to-brand-secondary hover:from-brand-primary-hover hover:to-brand-secondary text-white py-2.5 px-4 rounded-lg font-medium shadow-lg shadow-brand-primary/20 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none"
          >
            {isPending ? (
              <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
            ) : (
              <>
                <Key className="w-5 h-5" />
                <span>Save New Password</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
