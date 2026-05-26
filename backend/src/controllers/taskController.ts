import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/authGuard.js';
import { getUserSupabaseClient } from '../config/supabaseClientHelper.js';

/**
 * Fetch tasks belonging to the user.
 * Optional query parameter: ?projectId=xxxx-xxxx-xxxx-xxxx to filter by project.
 */
export async function getTasks(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { projectId } = req.query;
    const supabase = getUserSupabaseClient(req.headers.authorization);

    let query = supabase
      .from('tasks')
      .select('*, subtasks(*)')
      .order('created_at', { ascending: false });

    if (projectId && typeof projectId === 'string') {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query;

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
 * Create a new task.
 */
export async function createTask(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { title, description, due_date, priority_score, status, project_id } = req.body;

    if (!title || typeof title !== 'string') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Task title is required and must be a string.' }
      });
    }

    const supabase = getUserSupabaseClient(req.headers.authorization);

    const taskPayload = {
      title,
      description: description || null,
      due_date: due_date || null,
      priority_score: typeof priority_score === 'number' ? priority_score : 0,
      status: status || 'todo',
      project_id: project_id || null,
      user_id: req.user!.id
    };

    const { data, error } = await supabase
      .from('tasks')
      .insert(taskPayload)
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
 * Update an existing task (e.g., mark complete, reschedule, set priority score).
 */
export async function updateTask(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;
    // Use an explicit allowlist of mutable fields to prevent mass-assignment attacks
    const { title, description, due_date, priority_score, status } = req.body;
    const allowedUpdates: Record<string, unknown> = {};
    if (title !== undefined) allowedUpdates.title = title;
    if (description !== undefined) allowedUpdates.description = description;
    if (due_date !== undefined) allowedUpdates.due_date = due_date;
    if (priority_score !== undefined) allowedUpdates.priority_score = priority_score;
    if (status !== undefined) allowedUpdates.status = status;

    if (Object.keys(allowedUpdates).length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'No valid fields provided for update.' }
      });
    }

    const supabase = getUserSupabaseClient(req.headers.authorization);

    const { data, error } = await supabase
      .from('tasks')
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
 * Delete a task.
 * Associated subtasks will be cascade deleted automatically by the database.
 */
export async function deleteTask(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Task ID parameter is required.' }
      });
    }

    const supabase = getUserSupabaseClient(req.headers.authorization);

    const { error } = await supabase
      .from('tasks')
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
      data: { id, message: 'Task and all associated subtasks successfully deleted.' }
    });
  } catch (err) {
    next(err);
  }
}
