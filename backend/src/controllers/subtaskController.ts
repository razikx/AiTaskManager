import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/authGuard.js';
import { getUserSupabaseClient } from '../config/supabaseClientHelper.js';

/**
 * Fetch all subtasks belonging to a specific parent task.
 */
export async function getSubtasksForTask(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { taskId } = req.params;
    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Task ID parameter is required.' }
      });
    }

    const supabase = getUserSupabaseClient(req.headers.authorization);

    const { data, error } = await supabase
      .from('subtasks')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(400).json({
        success: false,
        error: { code: 'DATABASE_ERROR', message: error.message }
      });
    }

    return res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Create a new subtask under a parent task.
 */
export async function createSubtask(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { taskId } = req.params;
    const { title } = req.body;

    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Task ID parameter is required.' }
      });
    }

    if (!title || typeof title !== 'string') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Subtask title is required and must be a string.' }
      });
    }

    const supabase = getUserSupabaseClient(req.headers.authorization);

    // Write to DB. Supabase RLS checks that task_id belongs to the requesting auth.uid()
    const { data, error } = await supabase
      .from('subtasks')
      .insert({
        task_id: taskId,
        title,
        is_completed: false
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({
        success: false,
        error: { code: 'DATABASE_ERROR', message: error.message }
      });
    }

    return res.status(201).json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Update an existing subtask (e.g. toggle is_completed, update title).
 */
export async function updateSubtask(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;
    // Use an explicit allowlist of mutable fields to prevent mass-assignment attacks
    const { title, is_completed } = req.body;
    const allowedUpdates: Record<string, unknown> = {};
    if (title !== undefined) allowedUpdates.title = title;
    if (is_completed !== undefined) allowedUpdates.is_completed = is_completed;

    if (Object.keys(allowedUpdates).length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'No valid fields provided for update.' }
      });
    }

    const supabase = getUserSupabaseClient(req.headers.authorization);

    const { data, error } = await supabase
      .from('subtasks')
      .update(allowedUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({
        success: false,
        error: { code: 'DATABASE_ERROR', message: error.message }
      });
    }

    return res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Delete a subtask.
 */
export async function deleteSubtask(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Subtask ID parameter is required.' }
      });
    }

    const supabase = getUserSupabaseClient(req.headers.authorization);

    const { error } = await supabase
      .from('subtasks')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(400).json({
        success: false,
        error: { code: 'DATABASE_ERROR', message: error.message }
      });
    }

    return res.status(200).json({
      success: true,
      data: { id, message: 'Subtask successfully deleted.' }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Bulk create subtasks under a task.
 * Expects params: { taskId: string }
 * Expects body: { titles: string[] }
 */
export async function bulkCreateSubtasks(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { taskId } = req.params;
    const { titles } = req.body;

    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Task ID parameter is required.' }
      });
    }

    if (!titles || !Array.isArray(titles) || titles.length === 0 || !titles.every(t => typeof t === 'string')) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Parameter "titles" must be a non-empty array of strings.' }
      });
    }

    const supabase = getUserSupabaseClient(req.headers.authorization);

    const subtaskPayloads = titles.map(title => ({
      task_id: taskId,
      title,
      is_completed: false
    }));

    const { data, error } = await supabase
      .from('subtasks')
      .insert(subtaskPayloads)
      .select();

    if (error) {
      return res.status(400).json({
        success: false,
        error: { code: 'DATABASE_ERROR', message: error.message }
      });
    }

    return res.status(201).json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
}
