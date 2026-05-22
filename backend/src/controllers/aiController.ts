import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/authGuard.js';
import { parseTaskText, generateSubtasksForTask } from '../services/claudeService.js';
import { getUserSupabaseClient } from '../config/supabaseClientHelper.js';

/**
 * Controller to parse raw natural language task text.
 * Expects a body JSON layout of: { "rawText": string }
 */
export async function parseTask(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { rawText } = req.body;

    if (!rawText || typeof rawText !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Parameter "rawText" is required and must be a string.'
        }
      });
    }

    const trimmedText = rawText.trim();
    if (trimmedText.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Parameter "rawText" cannot be empty.' }
      });
    }

    if (trimmedText.length > 2000) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Parameter "rawText" must not exceed 2000 characters.' }
      });
    }

    // Call the Claude AI / regex parser service
    const parsedData = await parseTaskText(trimmedText);

    return res.status(200).json({
      success: true,
      data: parsedData
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Controller to generate subtasks for a task using AI/fallback checklist heuristics.
 * Expects params: { taskId: string }
 */
export async function generateSubtasks(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { taskId } = req.params;

    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Parameter "taskId" is required.'
        }
      });
    }

    const supabase = getUserSupabaseClient(req.headers.authorization);

    // 1. Fetch parent task to get context
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('title, description')
      .eq('id', taskId)
      .single();

    if (taskError || !task) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Task not found or inaccessible.' }
      });
    }

    // 2. Call AI/Fallback subtask service
    const subtaskTitles = await generateSubtasksForTask(task.title, task.description || undefined);

    if (subtaskTitles.length === 0) {
      return res.status(200).json({
        success: true,
        data: []
      });
    }

    // 3. Bulk insert the generated subtasks
    const subtaskPayloads = subtaskTitles.map(title => ({
      task_id: taskId,
      title,
      is_completed: false
    }));

    const { data: createdSubtasks, error: insertError } = await supabase
      .from('subtasks')
      .insert(subtaskPayloads)
      .select();

    if (insertError) {
      return res.status(400).json({
        success: false,
        error: { code: 'DATABASE_ERROR', message: insertError.message }
      });
    }

    return res.status(201).json({
      success: true,
      data: createdSubtasks
    });
  } catch (err) {
    next(err);
  }
}
