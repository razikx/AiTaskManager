import React, { useState } from 'react';
import type { Task } from '../../types';
import { TaskItem } from './TaskItem';
import { Kanban, List, AlertCircle, ArrowUpDown } from 'lucide-react';

interface TaskBoardProps {
  tasks: Task[];
  hasMoreTasks: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  onDelete: (id: string) => void;
  onUpdate: (task: Task) => void;
  onMutateStart: (id: string) => void;
  onMutateEnd: (id: string) => void;
}

export function TaskBoard({
  tasks,
  hasMoreTasks,
  isLoadingMore,
  onLoadMore,
  onDelete,
  onUpdate,
  onMutateStart,
  onMutateEnd
}: TaskBoardProps): React.JSX.Element {
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [sortByPriority, setSortByPriority] = useState(true);

  // Group tasks by their current status
  const todoTasks = tasks.filter((t) => t.status === 'todo');
  const activeTasks = tasks.filter((t) => t.status === 'in_progress');
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  // Helper function to sort tasks
  const getSortedTasks = (taskList: Task[]) => {
    if (sortByPriority) {
      return [...taskList].sort((a, b) => b.priority_score - a.priority_score);
    }
    return taskList;
  };

  return (
    <div className="space-y-6">
      {/* Filters and View Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400 font-medium">Layout:</span>
          <div className="flex bg-slate-950/40 border border-white/5 rounded-lg p-1">
            <button
              onClick={() => setViewMode('board')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                viewMode === 'board' ? 'bg-brand-primary text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Board</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                viewMode === 'list' ? 'bg-brand-primary text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
          </div>
        </div>

        <button
          onClick={() => setSortByPriority(!sortByPriority)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
            sortByPriority
              ? 'bg-brand-secondary/15 border-brand-secondary/35 text-brand-secondary'
              : 'bg-slate-950/40 border-white/5 text-slate-400 hover:text-white'
          }`}
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
          <span>Sort by Priority</span>
        </button>
      </div>

      {tasks.length === 0 ? (
        <div className="glass-panel text-center py-12 px-4 rounded-xl border border-white/5">
          <AlertCircle className="w-8 h-8 text-slate-500 mx-auto mb-3" />
          <h3 className="text-slate-300 font-semibold mb-1">No tasks in this project</h3>
          <p className="text-slate-500 text-xs max-w-xs mx-auto">
            Use the smart AI task input bar above to create a task by writing sentences naturally.
          </p>
        </div>
      ) : viewMode === 'board' ? (
        /* Kanban Board View */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {/* Todo Column */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-brand-primary/20 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-brand-primary rounded-full"></span>
                <h3 className="font-display font-bold text-sm text-white">Todo</h3>
              </div>
              <span className="bg-slate-900/80 border border-white/5 text-slate-400 text-2xs font-semibold px-2 py-0.5 rounded-full">
                {todoTasks.length}
              </span>
            </div>
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              {getSortedTasks(todoTasks).map((task) => (
                <TaskItem key={task.id} task={task} onDelete={onDelete} onUpdate={onUpdate} onMutateStart={onMutateStart} onMutateEnd={onMutateEnd} />
              ))}
              {todoTasks.length === 0 && (
                <div className="text-center py-8 border border-dashed border-white/5 rounded-xl text-xs text-slate-600">
                  No pending tasks.
                </div>
              )}
            </div>
          </div>

          {/* In Progress Column */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-brand-secondary/20 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-brand-secondary rounded-full animate-pulse"></span>
                <h3 className="font-display font-bold text-sm text-white">Active</h3>
              </div>
              <span className="bg-slate-900/80 border border-white/5 text-slate-400 text-2xs font-semibold px-2 py-0.5 rounded-full">
                {activeTasks.length}
              </span>
            </div>
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              {getSortedTasks(activeTasks).map((task) => (
                <TaskItem key={task.id} task={task} onDelete={onDelete} onUpdate={onUpdate} onMutateStart={onMutateStart} onMutateEnd={onMutateEnd} />
              ))}
              {activeTasks.length === 0 && (
                <div className="text-center py-8 border border-dashed border-white/5 rounded-xl text-xs text-slate-600">
                  No active tasks.
                </div>
              )}
            </div>
          </div>

          {/* Completed Column */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-brand-accent/20 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-brand-accent rounded-full"></span>
                <h3 className="font-display font-bold text-sm text-white">Done</h3>
              </div>
              <span className="bg-slate-900/80 border border-white/5 text-slate-400 text-2xs font-semibold px-2 py-0.5 rounded-full">
                {completedTasks.length}
              </span>
            </div>
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              {getSortedTasks(completedTasks).map((task) => (
                <TaskItem key={task.id} task={task} onDelete={onDelete} onUpdate={onUpdate} onMutateStart={onMutateStart} onMutateEnd={onMutateEnd} />
              ))}
              {completedTasks.length === 0 && (
                <div className="text-center py-8 border border-dashed border-white/5 rounded-xl text-xs text-slate-600">
                  No completed tasks yet.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Flat List View sorted by status/priority */
        <div className="space-y-3 max-w-4xl mx-auto">
          {getSortedTasks(tasks).map((task) => (
            <TaskItem key={task.id} task={task} onDelete={onDelete} onUpdate={onUpdate} onMutateStart={onMutateStart} onMutateEnd={onMutateEnd} />
          ))}
        </div>
      )}

      {hasMoreTasks && (
        <div className="flex justify-center pt-2">
          <button
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="px-4 py-2 bg-slate-950/40 border border-white/10 hover:border-brand-primary/40 text-slate-300 hover:text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {isLoadingMore ? 'Loading...' : 'Load more tasks'}
          </button>
        </div>
      )}
    </div>
  );
}
