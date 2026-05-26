import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskItem } from './TaskItem';
import { apiClient, handleApiRequest } from '../../services/apiClient';
import type { Task } from '../../types';

vi.mock('../../services/apiClient', () => ({
  apiClient: {
    patch: vi.fn()
  },
  handleApiRequest: vi.fn()
}));

const task: Task = {
  id: '10000000-0000-4000-8000-000000000001',
  title: 'Write tests',
  description: null,
  category: 'Work',
  due_date: null,
  priority_score: 1,
  status: 'todo',
  project_id: '20000000-0000-4000-8000-000000000001',
  user_id: '30000000-0000-4000-8000-000000000001',
  created_at: '2026-05-26T12:00:00.000Z',
  subtasks: [
    {
      id: '40000000-0000-4000-8000-000000000001',
      task_id: '10000000-0000-4000-8000-000000000001',
      title: 'Add backend tests',
      is_completed: true,
      created_at: '2026-05-26T12:00:00.000Z'
    },
    {
      id: '40000000-0000-4000-8000-000000000002',
      task_id: '10000000-0000-4000-8000-000000000001',
      title: 'Add frontend tests',
      is_completed: false,
      created_at: '2026-05-26T12:00:00.000Z'
    }
  ]
};

describe('TaskItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.patch).mockResolvedValue({ data: { success: true } } as never);
    vi.mocked(handleApiRequest).mockImplementation(async (requestPromise: Promise<unknown>) => {
      const data = await requestPromise;
      return [data, null];
    });
  });

  it('shows subtask completion ratio on the task card', () => {
    render(<TaskItem task={task} onDelete={vi.fn()} onUpdate={vi.fn()} />);

    expect(screen.getByText('1/2 done')).toBeInTheDocument();
  });

  it('optimistically updates task status and rolls back on API failure', async () => {
    const onUpdate = vi.fn();
    vi.mocked(handleApiRequest).mockResolvedValue([null, new Error('Network error')]);

    render(<TaskItem task={task} onDelete={vi.fn()} onUpdate={onUpdate} />);

    await userEvent.click(screen.getByTitle('Mark Complete'));

    await waitFor(() => {
      expect(onUpdate).toHaveBeenNthCalledWith(1, expect.objectContaining({
        id: task.id,
        status: 'completed'
      }));
    });
    expect(onUpdate).toHaveBeenNthCalledWith(2, task);
  });

  it('sends validated status changes through the API client', async () => {
    const onUpdate = vi.fn();

    render(<TaskItem task={task} onDelete={vi.fn()} onUpdate={onUpdate} />);

    await userEvent.click(screen.getByRole('button', { name: /active/i }));

    await waitFor(() => {
      expect(apiClient.patch).toHaveBeenCalledWith(`/tasks/${task.id}`, {
        status: 'in_progress'
      });
    });
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
      id: task.id,
      status: 'in_progress'
    }));
  });
});
