import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/authGuard.js';
import { getUserSupabaseClient } from '../config/supabaseClientHelper.js';

/**
 * Fetch all projects belonging to the authenticated user.
 */
export async function getProjects(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const supabase = getUserSupabaseClient(req.headers.authorization);
    
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

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
 * Create a new project for the authenticated user.
 */
export async function createProject(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Project name is required and must be a string.' }
      });
    }

    const supabase = getUserSupabaseClient(req.headers.authorization);
    
    // Inject the verified user's ID to ensure RLS schema alignment
    const { data, error } = await supabase
      .from('projects')
      .insert({
        name,
        user_id: req.user!.id
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
 * Rename a project by ID.
 */
export async function renameProject(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Project ID parameter is required.' }
      });
    }

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Project name is required and must be a non-empty string.' }
      });
    }

    const supabase = getUserSupabaseClient(req.headers.authorization);

    const { data, error } = await supabase
      .from('projects')
      .update({ name: name.trim() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({
        success: false,
        error: { code: 'DATABASE_ERROR', message: error.message }
      });
    }

    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * Delete a project by ID.
 * Due to SQL constraints, tasks and subtasks will automatically cascade delete.
 */
export async function deleteProject(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Project ID parameter is required.' }
      });
    }

    const supabase = getUserSupabaseClient(req.headers.authorization);

    const { error } = await supabase
      .from('projects')
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
      data: { id, message: 'Project and all its associated tasks and subtasks successfully deleted.' }
    });
  } catch (err) {
    next(err);
  }
}
