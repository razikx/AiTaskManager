import React, { useState, useTransition } from 'react';
import type { Task, TaskStatus } from '../../types';
import { SubtaskManager } from './SubtaskManager';
import { apiClient, handleApiRequest } from '../../services/apiClient';
import { Calendar, CheckCircle2, Play, Circle, Trash2, ChevronDown, ChevronUp, Pencil, Check, X } from 'lucide-react';

interface TaskItemProps {
  task: Task;
  onDelete: (id: string) => void;
  onUpdate: (task: Task) => void;
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TaskItem({ task, onDelete, onUpdate }: TaskItemProps): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Map priority_score to badge styling and labels
  const getPriorityBadge = (score: number) => {
    switch (score) {
      case 3:
        return { label: 'Urgent', classes: 'bg-red-500/10 border-red-500/20 text-red-400' };
      case 2:
        return { label: 'High', classes: 'bg-orange-500/10 border-orange-500/20 text-orange-400' };
      case 1:
        return { label: 'Medium', classes: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' };
      case 0:
      default:
        return { label: 'Low', classes: 'bg-slate-500/10 border-slate-500/20 text-slate-400' };
    }
  };

  const badge = getPriorityBadge(task.priority_score);

  // Format date cleanly
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  // Toggle status transition
  const handleStatusChange = (newStatus: TaskStatus) => {
    startTransition(async () => {
      // Create copy of task to update
      const updatedTask = { ...task, status: newStatus };
      onUpdate(updatedTask); // Optimistic UI trigger

      const [res, err] = await handleApiRequest(
        apiClient.patch(`/tasks/${task.id}`, { status: newStatus })
      );

      if (err || !res?.data?.success) {
        // Rollback on error
        onUpdate(task);
      }
    });
  };

  // Quick toggle task completion
  const handleQuickToggleComplete = () => {
    const nextStatus: TaskStatus = task.status === 'completed' ? 'todo' : 'completed';
    handleStatusChange(nextStatus);
  };

  const openEdit = () => {
    setEditTitle(task.title);
    setEditDueDate(toDatetimeLocal(task.due_date));
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    startTransition(async () => {
      const updatedTask: Task = {
        ...task,
        title: editTitle.trim() || task.title,
        due_date: editDueDate ? new Date(editDueDate).toISOString() : null,
      };
      onUpdate(updatedTask);
      setIsEditing(false);

      const [res, err] = await handleApiRequest(
        apiClient.patch(`/tasks/${task.id}`, {
          title: updatedTask.title,
          due_date: updatedTask.due_date,
        })
      );

      if (err || !res?.data?.success) {
        onUpdate(task); // rollback
        setIsEditing(true);
      }
    });
  };

  return (
    <div className="bg-brand-dark-card/40 border border-white/5 hover:border-brand-primary/20 rounded-xl p-4 transition-all duration-200 group relative">
      <div className="flex items-start justify-between gap-4">
        {/* Checkbox status indicator */}
        <button
          onClick={handleQuickToggleComplete}
          disabled={isPending}
          className="mt-1 flex-shrink-0 text-slate-500 hover:text-brand-primary transition-colors duration-200"
          title={task.status === 'completed' ? 'Mark Incomplete' : 'Mark Complete'}
        >
          {task.status === 'completed' ? (
            <CheckCircle2 className="w-5.5 h-5.5 text-brand-accent animate-scale-in" />
          ) : (
            <Circle className="w-5.5 h-5.5 text-slate-600 hover:text-brand-primary" />
          )}
        </button>

        {/* Core Task Info */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="space-y-2">
              <input
                autoFocus
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') setIsEditing(false); }}
                className="w-full bg-slate-950/60 border border-brand-primary/40 rounded-lg px-3 py-1.5 text-sm font-semibold text-white focus:outline-none focus:border-brand-primary"
                placeholder="Task title"
              />
              <input
                type="datetime-local"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
                className="bg-slate-950/60 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-brand-primary"
              />
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleSaveEdit}
                  disabled={isPending || !editTitle.trim()}
                  className="flex items-center gap-1.5 px-3 py-1 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  Save
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${badge.classes}`}>
                  {badge.label}
                </span>

                {task.due_date && (
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{formatDate(task.due_date)}</span>
                  </span>
                )}
              </div>

              <h3 className={`font-display text-base font-semibold leading-tight text-white mb-1 ${task.status === 'completed' ? 'line-through text-slate-500' : ''}`}>
                {task.title}
              </h3>

              {task.description && (
                <p className="text-slate-400 text-xs line-clamp-2 leading-relaxed">
                  {task.description}
                </p>
              )}

              {/* Inline Action Triggers */}
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center bg-slate-950/40 border border-white/5 rounded-md p-0.5">
                  <button
                    onClick={() => handleStatusChange('todo')}
                    className={`text-2xs px-2 py-0.5 rounded font-medium transition-colors ${
                      task.status === 'todo' ? 'bg-brand-primary text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Todo
                  </button>
                  <button
                    onClick={() => handleStatusChange('in_progress')}
                    className={`text-2xs px-2 py-0.5 rounded font-medium transition-colors flex items-center gap-1 ${
                      task.status === 'in_progress' ? 'bg-brand-secondary text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Play className="w-2.5 h-2.5 fill-current" />
                    Active
                  </button>
                  <button
                    onClick={() => handleStatusChange('completed')}
                    className={`text-2xs px-2 py-0.5 rounded font-medium transition-colors ${
                      task.status === 'completed' ? 'bg-brand-accent text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Done
                  </button>
                </div>

                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                >
                  <span>Checklist</span>
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Edit & Delete triggers */}
        <div className="flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all flex-shrink-0">
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <span className="text-2xs text-slate-400 whitespace-nowrap">Delete?</span>
              <button
                onClick={() => onDelete(task.id)}
                className="text-2xs px-1.5 py-0.5 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded font-semibold transition-colors"
              >
                Yes
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-2xs px-1.5 py-0.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded font-semibold transition-colors"
              >
                No
              </button>
            </div>
          ) : (
            <>
              {!isEditing && (
                <button
                  onClick={openEdit}
                  className="text-slate-500 hover:text-brand-primary p-1"
                  title="Edit task"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-slate-500 hover:text-red-400 p-1"
                title="Delete task"
              >
                <Trash2 className="w-4.5 h-4.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Subtask checklist manager drawer */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-white/5 animate-fade-in">
          <SubtaskManager taskId={task.id} />
        </div>
      )}
    </div>
  );
}
