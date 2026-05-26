import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/authGuard.js';
import { getUserSupabaseClient } from '../config/supabaseClientHelper.js';
import { sendValidationError } from '../utils/validation.js';

const taskIdParamsSchema = z.object({
  id: z.string().uuid('Task ID must be a valid UUID.')
});

const getTasksQuerySchema = z.object({
  projectId: z.string().uuid('Project ID must be a valid UUID.').optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().min(1).optional()
});

const getTaskAnalyticsQuerySchema = z.object({
  projectId: z.string().uuid('Project ID must be a valid UUID.').optional()
});

const taskCursorSchema = z.object({
  created_at: z.string().datetime({ offset: true }),
  id: z.string().uuid()
});

const isoDateSchema = z.string().datetime({
  offset: true,
  message: 'Due date must be a valid ISO-8601 datetime with timezone.'
});

const createTaskBodySchema = z.object({
  title: z.string().trim().min(1, 'Task title is required.').max(200, 'Task title must not exceed 200 characters.'),
  description: z.string().trim().min(1, 'Description cannot be empty.').max(2000, 'Description must not exceed 2000 characters.').nullable().optional(),
  category: z.string().trim().min(1, 'Category cannot be empty.').max(50, 'Category must not exceed 50 characters.').nullable().optional(),
  due_date: isoDateSchema.nullable().optional(),
  priority_score: z.number().int().min(0).max(3).optional(),
  status: z.enum(['todo', 'in_progress', 'completed']).optional(),
  project_id: z.string().uuid('Project ID must be a valid UUID.').nullable().optional()
}).strict();

const updateTaskBodySchema = createTaskBodySchema
  .pick({
    title: true,
    description: true,
    category: true,
    due_date: true,
    priority_score: true,
    status: true
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'No valid fields provided for update.'
  });

interface TaskCursor {
  created_at: string;
  id: string;
}

interface AnalyticsTaskRow {
  id: string;
  title: string;
  category: string | null;
  due_date: string | null;
  priority_score: number;
  status: 'todo' | 'in_progress' | 'completed';
  project_id: string | null;
}

function encodeTaskCursor(task: TaskCursor): string {
  return Buffer.from(JSON.stringify(task), 'utf8').toString('base64url');
}

function decodeTaskCursor(cursor: string): TaskCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown;
    const result = taskCursorSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

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

    const { projectId, limit, cursor } = queryResult.data;
    const decodedCursor = cursor ? decodeTaskCursor(cursor) : null;
    if (cursor && !decodedCursor) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Invalid task cursor.' }
      });
    }

    const supabase = getUserSupabaseClient(req.headers.authorization);

    let query = supabase
      .from('tasks')
      .select('*, subtasks(*)')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1);

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    if (decodedCursor) {
      query = query.or(
        `created_at.lt.${decodedCursor.created_at},and(created_at.eq.${decodedCursor.created_at},id.lt.${decodedCursor.id})`
      );
    }

    const { data, error } = await query;

    if (error) {
      return res.status(400).json({
        success: false,
        error: { code: 'DATABASE_ERROR', message: error.message }
      });
    }

    const tasks = data ?? [];
    const page = tasks.slice(0, limit);
    const nextTask = tasks.length > limit ? page[page.length - 1] : null;

    return res.status(200).json({
      success: true,
      data: {
        tasks: page,
        nextCursor: nextTask ? encodeTaskCursor({ created_at: nextTask.created_at, id: nextTask.id }) : null
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Fetch aggregated task analytics for the user without returning full task rows.
 * Optional query parameter: ?projectId=xxxx-xxxx-xxxx-xxxx to filter summary metrics.
 */
export async function getTaskAnalytics(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const queryResult = getTaskAnalyticsQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      return sendValidationError(res, queryResult.error);
    }

    const { projectId } = queryResult.data;
    const supabase = getUserSupabaseClient(req.headers.authorization);
    const selectedColumns = 'id,title,category,due_date,priority_score,status,project_id';

    let filteredQuery = supabase
      .from('tasks')
      .select(selectedColumns);

    if (projectId) {
      filteredQuery = filteredQuery.eq('project_id', projectId);
    }

    const [{ data: filteredData, error: filteredError }, { data: allData, error: allError }] = await Promise.all([
      filteredQuery,
      supabase.from('tasks').select('project_id,status')
    ]);

    if (filteredError || allError) {
      return res.status(400).json({
        success: false,
        error: { code: 'DATABASE_ERROR', message: filteredError?.message ?? allError?.message ?? 'Failed to load task analytics.' }
      });
    }

    const tasks = (filteredData ?? []) as AnalyticsTaskRow[];
    const allTasks = (allData ?? []) as Pick<AnalyticsTaskRow, 'project_id' | 'status'>[];
    const now = new Date();
    const dueSoonCutoff = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const totalTasksCount = tasks.length;
    const completedTasksCount = tasks.filter((task) => task.status === 'completed').length;
    const activeTasksCount = tasks.filter((task) => task.status === 'in_progress').length;
    const todoTasksCount = tasks.filter((task) => task.status === 'todo').length;
    const completionRate = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;
    const categories = Object.entries(
      tasks.reduce<Record<string, number>>((acc, task) => {
        const category = task.category ?? 'Personal';
        acc[category] = (acc[category] ?? 0) + 1;
        return acc;
      }, {})
    )
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const priorityCounts = {
      urgent: tasks.filter((task) => task.priority_score === 3).length,
      high: tasks.filter((task) => task.priority_score === 2).length,
      medium: tasks.filter((task) => task.priority_score === 1).length,
      low: tasks.filter((task) => task.priority_score === 0).length
    };

    const scheduleTask = (task: AnalyticsTaskRow) => ({
      id: task.id,
      title: task.title,
      due_date: task.due_date
    });
    const overdueTasks = tasks
      .filter((task) => task.status !== 'completed' && task.due_date && new Date(task.due_date) < now)
      .sort((a, b) => new Date(a.due_date ?? '').getTime() - new Date(b.due_date ?? '').getTime())
      .slice(0, 10)
      .map(scheduleTask);
    const dueSoonTasks = tasks
      .filter((task) => {
        if (task.status === 'completed' || !task.due_date) return false;
        const dueDate = new Date(task.due_date);
        return dueDate >= now && dueDate <= dueSoonCutoff;
      })
      .sort((a, b) => new Date(a.due_date ?? '').getTime() - new Date(b.due_date ?? '').getTime())
      .slice(0, 10)
      .map(scheduleTask);

    const projectMetrics = Object.entries(
      allTasks.reduce<Record<string, { total: number; completed: number }>>((acc, task) => {
        if (!task.project_id) return acc;
        const metric = acc[task.project_id] ?? { total: 0, completed: 0 };
        metric.total += 1;
        if (task.status === 'completed') metric.completed += 1;
        acc[task.project_id] = metric;
        return acc;
      }, {})
    ).map(([id, metric]) => ({
      id,
      total: metric.total,
      completed: metric.completed,
      rate: metric.total > 0 ? Math.round((metric.completed / metric.total) * 100) : 0
    })).sort((a, b) => b.rate - a.rate);

    return res.status(200).json({
      success: true,
      data: {
        totalTasksCount,
        completedTasksCount,
        activeTasksCount,
        todoTasksCount,
        completionRate,
        categories,
        priorityCounts,
        overdueTasks,
        dueSoonTasks,
        projectMetrics
      }
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

    const { title, description, category, due_date, priority_score, status, project_id } = bodyResult.data;
    const supabase = getUserSupabaseClient(req.headers.authorization);

    const taskPayload = {
      title,
      description: description ?? null,
      category: category ?? null,
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
    const { title, description, category, due_date, priority_score, status } = bodyResult.data;
    const allowedUpdates: Record<string, unknown> = {};
    if (title !== undefined) allowedUpdates.title = title;
    if (description !== undefined) allowedUpdates.description = description;
    if (category !== undefined) allowedUpdates.category = category;
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
