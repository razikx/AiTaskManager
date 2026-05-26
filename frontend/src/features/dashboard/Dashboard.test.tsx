import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from './Dashboard';
import { apiClient, handleApiRequest } from '../../services/apiClient';

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'person@example.com' },
    signOut: vi.fn()
  })
}));

vi.mock('../../services/supabaseClient', () => ({
  supabase: {
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis()
    })),
    removeChannel: vi.fn()
  }
}));

vi.mock('../../services/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn()
  },
  handleApiRequest: vi.fn()
}));

const projectId = '10000000-0000-4000-8000-000000000001';

describe('Dashboard task creation flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handleApiRequest).mockImplementation(async (requestPromise: Promise<unknown>) => {
      const data = await requestPromise;
      return [data, null];
    });
    vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
      if (url === '/projects') {
        return {
          data: {
            success: true,
            data: [{ id: projectId, name: 'Launch', user_id: 'user-1', created_at: '2026-05-26T12:00:00.000Z' }]
          }
        };
      }

      return {
        data: {
          success: true,
          data: {
            tasks: [],
            nextCursor: null
          }
        }
      };
    });
    vi.mocked(apiClient.post).mockImplementation(async (url: string) => {
      if (url === '/ai/parse-task') {
        return {
          data: {
            success: true,
            data: {
              taskName: 'Draft launch brief',
              dueDate: null,
              inferredCategory: 'Work',
              suggestedPriority: 'high',
              priority_score: 2
            }
          }
        };
      }

      return {
        data: {
          success: true,
          data: {
            id: '20000000-0000-4000-8000-000000000001',
            title: 'Draft launch brief'
          }
        }
      };
    });
  });

  it('parses natural language input and creates a task in the selected project', async () => {
    render(<Dashboard />);

    await screen.findByRole('heading', { name: 'Launch' });
    const input = screen.getByPlaceholderText(/try writing/i);
    await userEvent.type(input, 'draft launch brief urgent');
    await userEvent.click(screen.getByRole('button', { name: /parse/i }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/ai/parse-task', expect.objectContaining({
        rawText: 'draft launch brief urgent',
        timezone: expect.any(String)
      }));
    });
    expect(apiClient.post).toHaveBeenCalledWith('/tasks', expect.objectContaining({
      title: 'Draft launch brief',
      category: 'Work',
      priority_score: 2,
      project_id: projectId
    }));
  });
});
