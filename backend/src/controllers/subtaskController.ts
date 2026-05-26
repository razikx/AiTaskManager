import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/authGuard.js';
import { getUserSupabaseClient } from '../config/supabaseClientHelper.js';
import { sendValidationError } from '../utils/validation.js';

const taskIdParamsSchema = z.object({
  taskId: z.string().uuid('Task ID must be a valid UUID.')
});

const subtaskIdParamsSchema = z.object({
  id: z.string().uuid('Subtask ID must be a valid UUID.')
});

const createSubtaskBodySchema = z.object({
  title: z.string().trim().min(1, 'Subtask title is required.').max(200, 'Subtask title must not exceed 200 characters.')
}).strict();

const updateSubtaskBodySchema = z.object({
  title: z.string().trim().min(1, 'Subtask title cannot be empty.').max(200, 'Subtask title must not exceed 200 characters.').optional(),
  is_completed: z.boolean().optional()
})
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'No valid fields provided for update.'
  });

const bulkCreateSubtasksBodySchema = z.object({
  titles: z.array(
    z.string().trim().min(1, 'Subtask title cannot be empty.').max(200, 'Subtask title must not exceed 200 characters.')
  ).min(1, 'Parameter "titles" must contain at least one subtask.').max(20, 'Cannot create more than 20 subtasks at once.')
}).strict();

/**
 * Fetch all subtasks belonging to a specific parent task.
 */
export async function getSubtasksForTask(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const paramsResult = taskIdParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      return sendValidationError(res, paramsResult.error);
    }

    const { taskId } = paramsResult.data;
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
    const paramsResult = taskIdParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      return sendValidationError(res, paramsResult.error);
    }

    const bodyResult = createSubtaskBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      return sendValidationError(res, bodyResult.error);
    }

    const { taskId } = paramsResult.data;
    const { title } = bodyResult.data;
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
    const paramsResult = subtaskIdParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      return sendValidationError(res, paramsResult.error);
    }

    const bodyResult = updateSubtaskBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      return sendValidationError(res, bodyResult.error);
    }

    const { id } = paramsResult.data;
    const { title, is_completed } = bodyResult.data;
    const allowedUpdates: Record<string, unknown> = {};
    if (title !== undefined) allowedUpdates.title = title;
    if (is_completed !== undefined) allowedUpdates.is_completed = is_completed;

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
    const paramsResult = subtaskIdParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      return sendValidationError(res, paramsResult.error);
    }

    const { id } = paramsResult.data;
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
    const paramsResult = taskIdParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      return sendValidationError(res, paramsResult.error);
    }

    const bodyResult = bulkCreateSubtasksBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      return sendValidationError(res, bodyResult.error);
    }

    const { taskId } = paramsResult.data;
    const { titles } = bodyResult.data;
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
