import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bulkCreateSubtasks, createSubtask, deleteSubtask, getSubtasksForTask, updateSubtask } from './subtaskController.js';
import { getUserSupabaseClient } from '../config/supabaseClientHelper.js';
import { createMockNext, createMockRequest, createMockResponse, createSupabaseQueryMock } from '../test/controllerTestUtils.js';

vi.mock('../config/supabaseClientHelper.js', () => ({
  getUserSupabaseClient: vi.fn()
}));

const taskId = '10000000-0000-4000-8000-000000000001';
const subtaskId = '20000000-0000-4000-8000-000000000001';

function mockTable(result: unknown) {
  const query = createSupabaseQueryMock(result);
  const from = vi.fn().mockReturnValue(query);
  vi.mocked(getUserSupabaseClient).mockReturnValue({ from } as never);
  return { query, from };
}

describe('subtaskController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects invalid task id params before loading subtasks', async () => {
    const req = createMockRequest({ params: { taskId: 'bad-id' } });
    const res = createMockResponse();

    await getSubtasksForTask(req, res, createMockNext());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(getUserSupabaseClient).not.toHaveBeenCalled();
  });

  it('loads subtasks for a validated parent task id', async () => {
    const { query, from } = mockTable({ data: [], error: null });
    const req = createMockRequest({ params: { taskId } });
    const res = createMockResponse();

    await getSubtasksForTask(req, res, createMockNext());

    expect(getUserSupabaseClient).toHaveBeenCalledWith('Bearer test-token');
    expect(from).toHaveBeenCalledWith('subtasks');
    expect(query.eq).toHaveBeenCalledWith('task_id', taskId);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('rejects empty subtask titles', async () => {
    const req = createMockRequest({ params: { taskId }, body: { title: '   ' } });
    const res = createMockResponse();

    await createSubtask(req, res, createMockNext());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(getUserSupabaseClient).not.toHaveBeenCalled();
  });

  it('creates a subtask with trimmed title', async () => {
    const createdSubtask = { id: subtaskId, task_id: taskId, title: 'Draft outline', is_completed: false };
    const { query } = mockTable({ data: createdSubtask, error: null });
    const req = createMockRequest({
      params: { taskId },
      body: { title: '  Draft outline  ' }
    });
    const res = createMockResponse();

    await createSubtask(req, res, createMockNext());

    expect(query.insert).toHaveBeenCalledWith({
      task_id: taskId,
      title: 'Draft outline',
      is_completed: false
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('rejects subtask updates with invalid boolean values', async () => {
    const req = createMockRequest({
      params: { id: subtaskId },
      body: { is_completed: 'yes' }
    });
    const res = createMockResponse();

    await updateSubtask(req, res, createMockNext());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(getUserSupabaseClient).not.toHaveBeenCalled();
  });

  it('updates validated subtask fields', async () => {
    const { query } = mockTable({ data: { id: subtaskId, is_completed: true }, error: null });
    const req = createMockRequest({
      params: { id: subtaskId },
      body: { title: '  Send recap  ', is_completed: true }
    });
    const res = createMockResponse();

    await updateSubtask(req, res, createMockNext());

    expect(query.update).toHaveBeenCalledWith({
      title: 'Send recap',
      is_completed: true
    });
    expect(query.eq).toHaveBeenCalledWith('id', subtaskId);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('bulk creates validated subtask titles', async () => {
    const { query } = mockTable({ data: [], error: null });
    const req = createMockRequest({
      params: { taskId },
      body: { titles: ['  First  ', 'Second'] }
    });
    const res = createMockResponse();

    await bulkCreateSubtasks(req, res, createMockNext());

    expect(query.insert).toHaveBeenCalledWith([
      { task_id: taskId, title: 'First', is_completed: false },
      { task_id: taskId, title: 'Second', is_completed: false }
    ]);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('rejects delete requests with invalid subtask id params', async () => {
    const req = createMockRequest({ params: { id: 'bad-id' } });
    const res = createMockResponse();

    await deleteSubtask(req, res, createMockNext());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(getUserSupabaseClient).not.toHaveBeenCalled();
  });
});
