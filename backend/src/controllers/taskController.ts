import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/authGuard.js';
import { getUserSupabaseClient } from '../config/supabaseClientHelper.js';
import { sendValidationError } from '../utils/validation.js';

const taskIdParamsSchema = z.object({
  id: z.string().uuid('Task ID must be a valid UUID.')
});

const getTasksQuerySchema = z.object({
  projectId: z.string().uuid('Project ID must be a valid UUID.').optional()
});

const isoDateSchema = z.string().datetime({
  offset: true,
  message: 'Due date must be a valid ISO-8601 datetime with timezone.'
});

const createTaskBodySchema = z.object({
  title: z.string().trim().min(1, 'Task title is required.').max(200, 'Task title must not exceed 200 characters.'),
  description: z.string().trim().min(1, 'Description cannot be empty.').max(2000, 'Description must not exceed 2000 characters.').nullable().optional(),
  due_date: isoDateSchema.nullable().optional(),
  priority_score: z.number().int().min(0).max(3).optional(),
  status: z.enum(['todo', 'in_progress', 'completed']).optional(),
  project_id: z.string().uuid('Project ID must be a valid UUID.').nullable().optional()
}).strict();

const updateTaskBodySchema = createTaskBodySchema
  .pick({
    title: true,
    description: true,
    due_date: true,
    priority_score: true,
    status: true
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'No valid fields provided for update.'
  });

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
    const queryResult = getTasksQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      return sendValidationError(res, queryResult.error);
    }

    const { projectId } = queryResult.data;
    const supabase = getUserSupabaseClient(req.headers.authorization);

    let query = supabase
      .from('tasks')
      .select('*, subtasks(*)')
      .order('created_at', { ascending: false });

    if (projectId) {
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
    const bodyResult = createTaskBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      return sendValidationError(res, bodyResult.error);
    }

    const { title, description, due_date, priority_score, status, project_id } = bodyResult.data;
    const supabase = getUserSupabaseClient(req.headers.authorization);

    const taskPayload = {
      title,
      description: description ?? null,
      due_date: due_date ?? null,
      priority_score: priority_score ?? 0,
      status: status || 'todo',
      project_id: project_id ?? null,
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
    const paramsResult = taskIdParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      return sendValidationError(res, paramsResult.error);
    }

    const bodyResult = updateTaskBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      return sendValidationError(res, bodyResult.error);
    }

    const { id } = paramsResult.data;
    const { title, description, due_date, priority_score, status } = bodyResult.data;
    const allowedUpdates: Record<string, unknown> = {};
    if (title !== undefined) allowedUpdates.title = title;
    if (description !== undefined) allowedUpdates.description = description;
    if (due_date !== undefined) allowedUpdates.due_date = due_date;
    if (priority_score !== undefined) allowedUpdates.priority_score = priority_score;
    if (status !== undefined) allowedUpdates.status = status;
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
    const paramsResult = taskIdParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      return sendValidationError(res, paramsResult.error);
    }

    const { id } = paramsResult.data;
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
