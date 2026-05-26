import React, { useState, useEffect, useRef, useTransition } from 'react';
import type { Subtask } from '../../types';
import { apiClient, handleApiRequest } from '../../services/apiClient';
import { Plus, Trash2, CheckCircle2, Circle, Sparkles } from 'lucide-react';

interface SubtaskManagerProps {
  taskId: string;
  onSubtasksChange?: (subtasks: Subtask[]) => void;
}

export function SubtaskManager({ taskId, onSubtasksChange }: SubtaskManagerProps): React.JSX.Element {
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isGenerating, setIsGenerating] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const onSubtasksChangeRef = useRef(onSubtasksChange);

  useEffect(() => {
    onSubtasksChangeRef.current = onSubtasksChange;
  }, [onSubtasksChange]);

  const updateSubtasks = (updater: React.SetStateAction<Subtask[]>) => {
    setSubtasks((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      onSubtasksChangeRef.current?.(next);
      return next;
    });
  };

  const handleGenerateChecklist = async () => {
    setIsGenerating(true);
    const [res, err] = await handleApiRequest(
      apiClient.post(`/tasks/${taskId}/ai-subtasks`)
    );
    setIsGenerating(false);

    if (!err && res?.data?.success) {
      const newSubtasks = res.data.data;
      if (Array.isArray(newSubtasks)) {
        updateSubtasks((prev) => [...prev, ...newSubtasks]);
      }
    }
  };

  useEffect(() => {
    let ignore = false;
    const fetchSubtasks = async () => {
      setLoading(true);
      const [res, err] = await handleApiRequest(
        apiClient.get(`/tasks/${taskId}/subtasks`)
      );
      if (!ignore) {
        if (!err && res?.data?.success) {
          updateSubtasks(res.data.data);
        } else if (err) {
          setFetchError('Could not load checklist.');
        }
        setLoading(false);
      }
    };

    fetchSubtasks();
    return () => {
      ignore = true;
    };
  }, [taskId]);

  // Toggle subtask status using React 19 useTransition
  const toggleSubtask = (subtask: Subtask) => {
    startTransition(async () => {
      const updatedStatus = !subtask.is_completed;
      // Optimistic UI update
      updateSubtasks((prev) =>
        prev.map((s) => (s.id === subtask.id ? { ...s, is_completed: updatedStatus } : s))
      );

      const [res, err] = await handleApiRequest(
        apiClient.patch(`/subtasks/${subtask.id}`, { is_completed: updatedStatus })
      );

      if (err || !res?.data?.success) {
        // Rollback on error
        updateSubtasks((prev) =>
          prev.map((s) => (s.id === subtask.id ? { ...s, is_completed: !updatedStatus } : s))
        );
      }
    });
  };

  // Add new subtask
  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const titleToSubmit = newTitle.trim();
    setNewTitle('');

    const tempId = `temp-${Date.now()}`;
    const optimisticSubtask: Subtask = {
      id: tempId,
      task_id: taskId,
      title: titleToSubmit,
      is_completed: false,
      created_at: new Date().toISOString(),
    };
    updateSubtasks((prev) => [...prev, optimisticSubtask]);

    const [res, err] = await handleApiRequest(
      apiClient.post(`/tasks/${taskId}/subtasks`, { title: titleToSubmit })
    );

    if (!err && res?.data?.success) {
      const realSubtask: Subtask = res.data.data;
      updateSubtasks((prev) => prev.map((s) => (s.id === tempId ? realSubtask : s)));
    } else {
      updateSubtasks((prev) => prev.filter((s) => s.id !== tempId));
    }
  };

  // Delete subtask
  const handleDeleteSubtask = async (id: string) => {
    // Optimistic UI update
    const previousSubtasks = [...subtasks];
    updateSubtasks((prev) => prev.filter((s) => s.id !== id));

    const [res, err] = await handleApiRequest(apiClient.delete(`/subtasks/${id}`));
    if (err || !res?.data?.success) {
      // Rollback on error
      updateSubtasks(previousSubtasks);
    }
  };

  return (
    <div className="mt-3 pl-4 border-l-2 border-slate-700/50 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Checklist</h4>
        <button
          onClick={handleGenerateChecklist}
          disabled={isGenerating || loading}
          className="flex items-center gap-1 text-[10px] font-bold text-brand-secondary hover:text-brand-secondary/80 transition-all hover:scale-[1.03] active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none"
          title="Generate subtasks using AI"
        >
          {isGenerating ? (
            <>
              <span className="w-2.5 h-2.5 border-2 border-brand-secondary border-t-transparent rounded-full animate-spin"></span>
              <span>Generating...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-brand-secondary animate-pulse" />
              <span>AI Checklist</span>
            </>
          )}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-slate-500 py-1">
          <span className="w-3.5 h-3.5 border-2 border-slate-600 border-t-slate-400 rounded-full animate-spin"></span>
          <span>Loading checklist...</span>
        </div>
      ) : (
        <div className="space-y-2">
          {fetchError ? (
            <p className="text-xs text-red-400/80 italic">{fetchError}</p>
          ) : subtasks.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No subtasks created yet.</p>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
              {subtasks.map((subtask) => (
                <div
                  key={subtask.id}
                  className="flex items-center justify-between group py-1 px-2 rounded hover:bg-slate-800/40 transition-colors"
                >
                  <button
                    onClick={() => toggleSubtask(subtask)}
                    disabled={isPending}
                    className="flex items-center gap-2.5 text-left text-xs text-slate-300 hover:text-white transition-colors"
                  >
                    {subtask.is_completed ? (
                      <CheckCircle2 className="w-4.5 h-4.5 text-brand-accent flex-shrink-0" />
                    ) : (
                      <Circle className="w-4.5 h-4.5 text-slate-500 hover:text-brand-primary flex-shrink-0" />
                    )}
                    <span className={subtask.is_completed ? 'line-through text-slate-500' : ''}>
                      {subtask.title}
                    </span>
                  </button>

                  {confirmDeleteId === subtask.id ? (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => { handleDeleteSubtask(subtask.id); setConfirmDeleteId(null); }}
                        className="text-2xs px-1.5 py-0.5 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded font-semibold transition-colors"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-2xs px-1.5 py-0.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded font-semibold transition-colors"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(subtask.id)}
                      className="text-slate-500 hover:text-red-400 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all p-0.5 flex-shrink-0"
                      title="Delete subtask"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleAddSubtask} className="flex items-center gap-2 mt-2">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Add subtask item..."
              className="flex-1 bg-slate-950/40 border border-white/5 rounded px-2 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-primary/50"
            />
            <button
              type="submit"
              className="bg-slate-800 hover:bg-slate-700 text-white p-1 rounded transition-colors"
              title="Add subtask"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
