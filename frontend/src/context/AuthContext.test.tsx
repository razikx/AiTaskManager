import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import { supabase } from '../services/supabaseClient';

vi.mock('../services/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signOut: vi.fn()
    }
  }
}));

function AuthProbe(): React.JSX.Element {
  const { user, loading, isRecoveryMode, signOut } = useAuth();

  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="email">{user?.email ?? 'none'}</span>
      <span data-testid="recovery">{String(isRecoveryMode)}</span>
      <button onClick={() => void signOut()}>Sign out</button>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.hash = '';
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null
    } as never);
    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
      data: {
        subscription: {
          unsubscribe: vi.fn()
        }
      }
    } as never);
    vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null } as never);
  });

  it('loads the active Supabase session into context', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          user: {
            email: 'person@example.com'
          }
        }
      },
      error: null
    } as never);

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('email')).toHaveTextContent('person@example.com');
  });

  it('clears auth state on sign out', async () => {
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    await userEvent.click(screen.getByRole('button', { name: /sign out/i }));

    expect(supabase.auth.signOut).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId('email')).toHaveTextContent('none'));
  });

  it('starts in recovery mode when the URL hash contains a recovery token', async () => {
    window.location.hash = '#type=recovery';

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('recovery')).toHaveTextContent('true');
  });
});
