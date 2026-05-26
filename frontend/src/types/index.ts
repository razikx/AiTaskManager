export interface UserProfile {
  id: string;
  email: string;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
}

export type TaskStatus = 'todo' | 'in_progress' | 'completed';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority_score: number;
  status: TaskStatus;
  project_id: string | null;
  user_id: string;
  created_at: string;
  subtasks?: Subtask[]; // Hydrated inside frontend if needed or requested
}

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  is_completed: boolean;
  created_at: string;
}

// AI Parsing responses (matching backend ParsedTask format)
export interface ParsedTask {
  taskName: string;
  dueDate: string | null;
  inferredCategory: string;
  priority_score: number; // 0=low, 1=medium, 2=high, 3=urgent — normalized by backend
}
