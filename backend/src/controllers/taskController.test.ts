import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTask, deleteTask, getTaskAnalytics, getTasks, updateTask } from './taskController.js';
import { getUserSupabaseClient } from '../config/supabaseClientHelper.js';
import { createMockNext, createMockRequest, createMockResponse, createSupabaseQueryMock } from '../test/controllerTestUtils.js';

vi.mock('../config/supabaseClientHelper.js', () => ({
  getUserSupabaseClient: vi.fn()
}));

const taskId = '10000000-0000-4000-8000-000000000001';
const projectId = '20000000-0000-4000-8000-000000000001';

function mockTable(result: unknown) {
  const query = createSupabaseQueryMock(result);
  const from = vi.fn().mockReturnValue(query);
  vi.mocked(getUserSupabaseClient).mockReturnValue({ from } as never);
  return { query, from };
}

describe('taskController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects invalid task query params before Supabase access', async () => {
    const req = createMockRequest({ query: { projectId: 'not-a-uuid' } });
    const res = createMockResponse();

    await getTasks(req, res, createMockNext());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: expect.objectContaining({ code: 'INVALID_INPUT' })
    }));
    expect(getUserSupabaseClient).not.toHaveBeenCalled();
  });

  it('filters task reads by validated project id using the request-scoped Supabase client', async () => {
    const { query, from } = mockTable({ data: [], error: null });
    const req = createMockRequest({ query: { projectId } });
    const res = createMockResponse();

    await getTasks(req, res, createMockNext());

    expect(getUserSupabaseClient).toHaveBeenCalledWith('Bearer test-token');
    expect(from).toHaveBeenCalledWith('tasks');
    expect(query.select).toHaveBeenCalledWith('*, subtasks(*)');
    expect(query.eq).toHaveBeenCalledWith('project_id', projectId);
    expect(query.limit).toHaveBeenCalledWith(26);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns cursor-paginated task reads with a next cursor', async () => {
    const tasks = Array.from({ length: 26 }, (_, index) => ({
      id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      created_at: `2026-05-26T12:${String(59 - index).padStart(2, '0')}:00.000Z`
    }));
    const { query } = mockTable({ data: tasks, error: null });
    const req = createMockRequest({ query: { projectId, limit: '25' } });
    const res = createMockResponse();

    await getTasks(req, res, createMockNext());

    expect(query.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(query.order).toHaveBeenCalledWith('id', { ascending: false });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        tasks: tasks.slice(0, 25),
        nextCursor: expect.any(String)
      }
    });
  });

  it('rejects invalid task cursors before Supabase access', async () => {
    const req = createMockRequest({ query: { projectId, cursor: 'not-a-cursor' } });
    const res = createMockResponse();

    await getTasks(req, res, createMockNext());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(getUserSupabaseClient).not.toHaveBeenCalled();
  });

  it('returns aggregated task analytics without selecting subtask rows', async () => {
    const filteredQuery = createSupabaseQueryMock({
      data: [
        {
          id: taskId,
          title: 'Write tests',
          category: 'Work',
          due_date: '2026-05-25T12:00:00.000Z',
          priority_score: 3,
          status: 'todo',
          project_id: projectId
        },
        {
          id: '10000000-0000-4000-8000-000000000002',
          title: 'Ship feature',
          category: null,
          due_date: null,
          priority_score: 1,
          status: 'completed',
          project_id: projectId
        }
      ],
      error: null
    });
    const allQuery = createSupabaseQueryMock({
      data: [
        { project_id: projectId, status: 'todo' },
        { project_id: projectId, status: 'completed' }
      ],
      error: null
    });
    const from = vi.fn()
      .mockReturnValueOnce(filteredQuery)
      .mockReturnValueOnce(allQuery);
    vi.mocked(getUserSupabaseClient).mockReturnValue({ from } as never);
    const req = createMockRequest({ query: { projectId } });
    const res = createMockResponse();

    await getTaskAnalytics(req, res, createMockNext());

    expect(filteredQuery.select).toHaveBeenCalledWith('id,title,category,due_date,priority_score,status,project_id');
    expect(filteredQuery.eq).toHaveBeenCalledWith('project_id', projectId);
    expect(allQuery.select).toHaveBeenCalledWith('project_id,status');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({
        totalTasksCount: 2,
        completedTasksCount: 1,
        priorityCounts: {
          urgent: 1,
          high: 0,
          medium: 1,
          low: 0
        },
        projectMetrics: [{
          id: projectId,
          total: 2,
          completed: 1,
          rate: 50
        }]
      })
    });
  });

  it('rejects invalid create body values before Supabase access', async () => {
    const req = createMockRequest({
      body: {
        title: ' ',
        due_date: 'tomorrow',
        priority_score: 9,
        status: 'blocked',
        project_id: 'bad-id'
      }
    });
    const res = createMockResponse();

    await createTask(req, res, createMockNext());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(getUserSupabaseClient).not.toHaveBeenCalled();
  });

  it('creates tasks with trimmed input and verified user id', async () => {
    const createdTask = { id: taskId, title: 'Write tests' };
    const { query } = mockTable({ data: createdTask, error: null });
    const req = createMockRequest({
      body: {
        title: '  Write tests  ',
        description: '  Add coverage  ',
        category: '  Work  ',
        due_date: '2026-05-26T12:00:00.000Z',
        priority_score: 2,
        status: 'todo',
        project_id: projectId
      }
    });
    const res = createMockResponse();

    await createTask(req, res, createMockNext());

    expect(query.insert).toHaveBeenCalledWith({
      title: 'Write tests',
      description: 'Add coverage',
      category: 'Work',
      due_date: '2026-05-26T12:00:00.000Z',
      priority_score: 2,
      status: 'todo',
      project_id: projectId,
      user_id: '00000000-0000-4000-8000-000000000001'
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: createdTask });
  });

  it('rejects task updates with no valid fields', async () => {
    const req = createMockRequest({ params: { id: taskId }, body: {} });
    const res = createMockResponse();

    await updateTask(req, res, createMockNext());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(getUserSupabaseClient).not.toHaveBeenCalled();
  });

  it('updates only validated task fields', async () => {
    const updatedTask = { id: taskId, status: 'completed' };
    const { query } = mockTable({ data: updatedTask, error: null });
    const req = createMockRequest({
      params: { id: taskId },
      body: {
        status: 'completed',
        priority_score: 3
      }
    });
    const res = createMockResponse();

    await updateTask(req, res, createMockNext());

    expect(query.update).toHaveBeenCalledWith({
      priority_score: 3,
      status: 'completed'
    });
    expect(query.eq).toHaveBeenCalledWith('id', taskId);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('rejects delete requests with invalid task id params', async () => {
    const req = createMockRequest({ params: { id: 'bad-id' } });
    const res = createMockResponse();

    await deleteTask(req, res, createMockNext());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(getUserSupabaseClient).not.toHaveBeenCalled();
  });
});
