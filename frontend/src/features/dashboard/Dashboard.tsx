import React, { Suspense, useState, useEffect, useTransition, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { PaginatedTasks, Project, Task, ParsedTask } from '../../types';
import { supabase } from '../../services/supabaseClient';
import { apiClient, handleApiRequest } from '../../services/apiClient';
import { TaskBoard } from '../tasks/TaskBoard';
import {
  LogOut,
  Plus,
  Sparkles,
  Folder,
  AlertCircle,
  Menu,
  X,
  ClipboardList,
  TrendingUp,
  Pencil,
  Check
} from 'lucide-react';

const AnalyticsDashboard = React.lazy(() =>
  import('../analytics/AnalyticsDashboard').then((module) => ({ default: module.AnalyticsDashboard }))
);

export function Dashboard(): React.JSX.Element {
  const { user, signOut } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskNextCursor, setTaskNextCursor] = useState<string | null>(null);
  const [isTasksLoading, setIsTasksLoading] = useState(false);

  // Navigation states
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'board' | 'analytics'>('board');

  // Creation forms
  const [newProjectName, setNewProjectName] = useState('');
  const [nlpText, setNlpText] = useState('');

  // Project rename
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState('');

  // Async task/AI states
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Selected project reference
  const activeProject = projects.find((p) => p.id === selectedProjectId) || null;

  // Keep selectedProjectId in a ref to prevent real-time resubscription storm on project selection change
  const selectedProjectIdRef = useRef(selectedProjectId);
  useEffect(() => {
    selectedProjectIdRef.current = selectedProjectId;
  }, [selectedProjectId]);

  // Track task IDs with in-flight PATCH mutations to prevent realtime echoes from overwriting them
  const pendingTaskMutations = useRef<Set<string>>(new Set());

  // 1. Fetch initial data
  const fetchData = async () => {
    setFetchError(null);
    const [projRes, projErr] = await handleApiRequest(apiClient.get('/projects'));
    if (!projErr && projRes?.data?.success) {
      const projData: Project[] = projRes.data.data;
      setProjects(projData);
      if (projData.length > 0) {
        setSelectedProjectId(projData[0].id);
      }
    } else if (projErr) {
      setFetchError('Failed to load projects. Check your connection and refresh.');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const loadTasksPage = async (projectId: string, cursor: string | null, append: boolean) => {
    setIsTasksLoading(true);
    const params = new URLSearchParams({ projectId, limit: '25' });
    if (cursor) {
      params.set('cursor', cursor);
    }

    const [taskRes, taskErr] = await handleApiRequest(
      apiClient.get(`/tasks?${params.toString()}`)
    );
    if (!taskErr && taskRes?.data?.success) {
      const pageData: PaginatedTasks = taskRes.data.data;
      setTasks((prev) => {
        if (!append) return pageData.tasks;
        const existingIds = new Set(prev.map((task) => task.id));
        return [...prev, ...pageData.tasks.filter((task) => !existingIds.has(task.id))];
      });
      setTaskNextCursor(pageData.nextCursor);
    } else if (taskErr) {
      setFetchError('Failed to load tasks for this project.');
    }
    setIsTasksLoading(false);
  };

  // 2. Fetch tasks when project selection changes
  useEffect(() => {
    if (!selectedProjectId) {
      setTasks([]);
      setTaskNextCursor(null);
      return;
    }

    let ignore = false;
    const fetchTasks = async () => {
      setIsTasksLoading(true);
      const params = new URLSearchParams({ projectId: selectedProjectId, limit: '25' });
      const [taskRes, taskErr] = await handleApiRequest(apiClient.get(`/tasks?${params.toString()}`));
      if (ignore) return;
      if (!taskErr && taskRes?.data?.success) {
        const pageData: PaginatedTasks = taskRes.data.data;
        setTasks(pageData.tasks);
        setTaskNextCursor(pageData.nextCursor);
      } else if (taskErr) {
        setFetchError('Failed to load tasks for this project.');
      }
      setIsTasksLoading(false);
    };

    fetchTasks();
    return () => {
      ignore = true;
    };
  }, [selectedProjectId]);

  // 3. Bind Supabase Realtime listeners for real-time syncing
  useEffect(() => {
    if (!user) return;

    // Listen for postgres database modifications for current tenant
    const channel = supabase
      .channel(`realtime-sync-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projects' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newProj = payload.new as Project;
            setProjects((prev) => [...prev, newProj]);
          } else if (payload.eventType === 'UPDATE') {
            const updatedProj = payload.new as Project;
            setProjects((prev) =>
              prev.map((p) => (p.id === updatedProj.id ? updatedProj : p))
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedProj = payload.old as { id: string };
            setProjects((prev) => prev.filter((p) => p.id !== deletedProj.id));
            if (selectedProjectIdRef.current === deletedProj.id) {
              setSelectedProjectId(null);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newTask = payload.new as Task;
            if (newTask.project_id === selectedProjectIdRef.current) {
              setTasks((prev) => {
                if (prev.some((t) => t.id === newTask.id)) return prev;
                // Replace optimistic temp placeholder if one matches
                const tempIdx = prev.findIndex(
                  (t) =>
                    t.id.startsWith('temp-') &&
                    t.title === newTask.title &&
                    t.project_id === newTask.project_id
                );
                if (tempIdx !== -1) {
                  const next = [...prev];
                  next[tempIdx] = newTask;
                  return next;
                }
                return [newTask, ...prev];
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedTask = payload.new as Task;
            if (updatedTask.project_id === selectedProjectIdRef.current) {
              // Skip if a local mutation is in-flight for this task — the PATCH response
              // will confirm state directly, preventing the echo from reverting a second
              // optimistic update that arrived before the first server event.
              if (!pendingTaskMutations.current.has(updatedTask.id)) {
                setTasks((prev) =>
                  prev.map((t) =>
                    t.id === updatedTask.id
                      ? { ...updatedTask, subtasks: t.subtasks }
                      : t
                  )
                );
              }
            } else {
              // If it moved projects, remove it from current list
              setTasks((prev) => prev.filter((t) => t.id !== updatedTask.id));
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedTask = payload.old as { id: string };
            setTasks((prev) => prev.filter((t) => t.id !== deletedTask.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // 4. Create standard project
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    const nameToSubmit = newProjectName.trim();
    setNewProjectName('');

    const [res, err] = await handleApiRequest(
      apiClient.post('/projects', { name: nameToSubmit })
    );

    if (!err && res?.data?.success) {
      const createdProj = res.data.data;
      setSelectedProjectId(createdProj.id);
    }
  };

  // 5. Rename project
  const handleRenameProject = async (projectId: string) => {
    const name = editingProjectName.trim();
    if (!name) return;

    const previousProjects = [...projects];
    setProjects((prev) => prev.map((p) => p.id === projectId ? { ...p, name } : p));
    setEditingProjectId(null);

    const [res, err] = await handleApiRequest(apiClient.patch(`/projects/${projectId}`, { name }));
    if (err || !res?.data?.success) {
      setProjects(previousProjects);
    }
  };

  // 6. Delete project
  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('Are you sure you want to delete this project? All associated tasks will be removed.')) {
      return;
    }

    const previousProjects = [...projects];
    setProjects((prev) => prev.filter((p) => p.id !== projectId));

    const [res, err] = await handleApiRequest(apiClient.delete(`/projects/${projectId}`));
    if (err || !res?.data?.success) {
      setProjects(previousProjects);
    } else if (selectedProjectId === projectId) {
      setSelectedProjectId(projects.length > 1 ? projects[0].id : null);
    }
  };

  // 6. Delete task from board
  const handleDeleteTask = async (id: string) => {
    const previousTasks = [...tasks];
    setTasks((prev) => prev.filter((t) => t.id !== id));

    const [res, err] = await handleApiRequest(apiClient.delete(`/tasks/${id}`));
    if (err || !res?.data?.success) {
      setTasks(previousTasks);
    }
  };

  // 7. Update task properties (e.g. status) optimistically
  // Preserves subtasks: callers (TaskItem PATCH responses) don't include joined subtask data,
  // so fall back to the existing entry's subtasks rather than wiping them.
  const handleUpdateTask = (updatedTask: Task) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === updatedTask.id
          ? { ...updatedTask, subtasks: updatedTask.subtasks ?? t.subtasks }
          : t
      )
    );
  };

  const handleMutateStart = (id: string) => {
    pendingTaskMutations.current.add(id);
  };

  const handleMutateEnd = (id: string) => {
    pendingTaskMutations.current.delete(id);
  };

  // 8. Smart AI Input Handler (queries Claude proxy API)
  const handleNlpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nlpText.trim() || !selectedProjectId) return;

    const rawInput = nlpText.trim();
    setNlpText('');
    setIsAiLoading(true);
    setAiError(null);

    // Call the parser endpoint
    const [res, err] = await handleApiRequest(
      apiClient.post('/ai/parse-task', {
        rawText: rawInput,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      })
    );

    if (err || !res?.data?.success) {
      setIsAiLoading(false);
      setAiError(err?.message || 'Failed to analyze task using AI.');
      return;
    }

    const aiData: ParsedTask = res.data.data;

    // Optimistically add the task before the DB round-trip
    const tempId = `temp-${Date.now()}`;
    const optimisticTask: Task = {
      id: tempId,
      title: aiData.taskName,
      description: null,
      category: aiData.inferredCategory,
      due_date: aiData.dueDate ?? null,
      priority_score: aiData.priority_score,
      status: 'todo',
      project_id: selectedProjectId,
      user_id: user!.id,
      created_at: new Date().toISOString(),
    };
    setTasks((prev) => [optimisticTask, ...prev]);
    setIsAiLoading(false);

    const [taskRes, taskErr] = await handleApiRequest(
      apiClient.post('/tasks', {
        title: aiData.taskName,
        category: aiData.inferredCategory,
        due_date: aiData.dueDate,
        priority_score: aiData.priority_score,
        project_id: selectedProjectId
      })
    );

    if (taskErr || !taskRes?.data?.success) {
      setTasks((prev) => prev.filter((t) => t.id !== tempId));
      setAiError(taskErr?.message || 'Failed to create task in database.');
    } else {
      const realTask: Task = taskRes.data.data;
      setTasks((prev) => {
        // Realtime may have already swapped the temp; if so just remove it
        if (prev.some((t) => t.id === realTask.id)) {
          return prev.filter((t) => t.id !== tempId);
        }
        return prev.map((t) => (t.id === tempId ? realTask : t));
      });
    }
  };

  return (
    <div className="min-h-screen flex text-slate-100">
      {/* Mobile Navbar Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900 border-b border-white/5 flex items-center justify-between px-4 z-30">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-brand-secondary" />
          <span className="font-display font-bold text-lg text-white">AiTaskManager</span>
        </div>
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="text-slate-400 hover:text-white p-1"
        >
          {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {/* Sidebar Panel */}
      <aside
        className={`fixed md:sticky top-0 left-0 h-screen w-72 bg-brand-dark-bg/95 md:bg-brand-dark-bg border-r border-white/5 flex flex-col z-20 transition-transform duration-300 md:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Workspace Title */}
        <div className="h-16 px-6 border-b border-white/5 flex items-center gap-2.5 flex-shrink-0">
          <Sparkles className="w-5 h-5 text-brand-secondary" />
          <span className="font-display font-bold text-lg text-white">AiTaskManager</span>
        </div>

        {/* Navigation & Projects Section */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
          {/* Main View Navigation */}
          <div className="space-y-1">
            <button
              onClick={() => {
                setCurrentView('board');
                setIsSidebarOpen(false); // Close sidebar on mobile
              }}
              className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
                currentView === 'board'
                  ? 'bg-brand-primary/10 text-white border-l-2 border-brand-primary font-bold'
                  : 'text-slate-400 hover:bg-slate-900/60 hover:text-white'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              <span>Task Board</span>
            </button>
            <button
              onClick={() => {
                setCurrentView('analytics');
                setIsSidebarOpen(false); // Close sidebar on mobile
              }}
              className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
                currentView === 'analytics'
                  ? 'bg-brand-primary/10 text-white border-l-2 border-brand-primary font-bold'
                  : 'text-slate-400 hover:bg-slate-900/60 hover:text-white'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Productivity Analytics</span>
            </button>
          </div>

          <div className="border-t border-white/5 pt-5 space-y-2">
            <div className="flex items-center justify-between text-slate-400 px-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Projects</span>
              <Folder className="w-4 h-4" />
            </div>

            {/* Project List */}
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {projects.map((proj) => (
                <div
                  key={proj.id}
                  className={`flex items-center justify-between group rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    selectedProjectId === proj.id
                      ? 'bg-brand-primary/10 text-white border-l-2 border-brand-primary'
                      : 'text-slate-400 hover:bg-slate-900/60 hover:text-white'
                  }`}
                >
                  {editingProjectId === proj.id ? (
                    <>
                      <input
                        autoFocus
                        type="text"
                        value={editingProjectName}
                        onChange={(e) => setEditingProjectName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Escape') setEditingProjectId(null); }}
                        className="flex-1 min-w-0 bg-slate-800 text-white text-sm rounded px-2 py-0.5 border border-brand-primary/50 outline-none mr-1"
                      />
                      <button
                        onClick={() => handleRenameProject(proj.id)}
                        className="text-green-400 hover:text-green-300 p-0.5 shrink-0"
                        title="Save"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingProjectId(null)}
                        className="text-slate-500 hover:text-slate-300 p-0.5 shrink-0"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setSelectedProjectId(proj.id);
                          setIsSidebarOpen(false);
                        }}
                        className="flex-1 text-left truncate mr-1"
                      >
                        {proj.name}
                      </button>
                      <button
                        onClick={() => { setEditingProjectId(proj.id); setEditingProjectName(proj.name); }}
                        className="text-slate-500 hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 shrink-0"
                        title="Edit project name"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteProject(proj.id)}
                        className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 shrink-0"
                        title="Delete project"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              ))}

              {projects.length === 0 && (
                <p className="text-xs text-slate-500 italic px-2">No projects created. Add one below!</p>
              )}
            </div>

            {/* Create Project Inline Form */}
            <form onSubmit={handleCreateProject} className="flex gap-2 pt-2">
              <input
                type="text"
                placeholder="New project name..."
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                className="flex-1 bg-slate-950/40 border border-white/5 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-primary"
              />
              <button
                type="submit"
                className="bg-brand-primary hover:bg-brand-primary-hover text-white p-1.5 rounded-lg transition-colors"
                title="Create Project"
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Profile Card & Log Out */}
        <div className="p-4 border-t border-white/5 bg-brand-dark-card/25">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-2xs text-slate-500">Logged in as</p>
              <p className="text-xs font-semibold text-slate-300 truncate" title={user?.email}>
                {user?.email}
              </p>
            </div>
            <button
              onClick={() => startTransition(signOut)}
              disabled={isPending}
              className="text-slate-400 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-colors flex-shrink-0"
              title="Sign Out"
            >
              {isPending ? (
                <span className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <LogOut className="w-4.5 h-4.5" />
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Panel Content */}
      <main className="flex-1 min-w-0 min-h-screen pt-20 md:pt-6 pb-12 px-4 md:px-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {fetchError && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-xl">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{fetchError}</span>
            </div>
          )}

          {currentView === 'analytics' ? (
            <Suspense
              fallback={
                <div className="flex flex-col justify-center items-center py-20 gap-4 text-slate-400">
                  <div className="w-10 h-10 border-4 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin"></div>
                  <p className="text-sm font-medium">Loading analytics...</p>
                </div>
              }
            >
              <AnalyticsDashboard projects={projects} />
            </Suspense>
          ) : (
            <>
              {/* Smart AI Prompt Area */}
              {selectedProjectId && (
                <div className="glass-panel rounded-2xl p-5 border border-white/5 space-y-3.5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-brand-secondary/5 rounded-full blur-2xl pointer-events-none"></div>

                  <div className="flex items-center gap-2 text-slate-300">
                    <Sparkles className="w-4.5 h-4.5 text-brand-secondary animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-wider font-display">AI Task Ingestion</span>
                  </div>

                  <form onSubmit={handleNlpSubmit} className="flex gap-2">
                    <input
                      type="text"
                      value={nlpText}
                      onChange={(e) => setNlpText(e.target.value)}
                      placeholder='Try writing: "Schedule client sync next Monday at 10am #urgent" or "Draft mockups tomorrow"'
                      disabled={isAiLoading}
                      className="flex-1 bg-slate-950/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-secondary focus:ring-1 focus:ring-brand-secondary transition-all"
                    />
                    <button
                      type="submit"
                      disabled={isAiLoading || !nlpText.trim()}
                      className="bg-gradient-to-r from-brand-secondary to-brand-primary hover:from-brand-secondary hover:to-brand-primary-hover text-white px-5 rounded-xl text-sm font-semibold flex items-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:pointer-events-none"
                    >
                      {isAiLoading ? (
                        <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>Parse</span>
                        </>
                      )}
                    </button>
                  </form>

                  {aiError && (
                    <div className="flex items-center gap-1.5 text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg animate-fade-in">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{aiError}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Active View Container */}
              {selectedProjectId ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <span className="text-2xs text-slate-500 uppercase tracking-widest font-semibold">Active Project</span>
                      <h2 className="font-display font-extrabold text-2xl md:text-3xl text-white">
                        {activeProject?.name}
                      </h2>
                    </div>
                  </div>

                  {/* Task Board Component */}
                  <TaskBoard
                    tasks={tasks}
                    hasMoreTasks={Boolean(taskNextCursor)}
                    isLoadingMore={isTasksLoading}
                    onLoadMore={() => {
                      if (selectedProjectId && taskNextCursor) {
                        void loadTasksPage(selectedProjectId, taskNextCursor, true);
                      }
                    }}
                    onDelete={handleDeleteTask}
                    onUpdate={handleUpdateTask}
                    onMutateStart={handleMutateStart}
                    onMutateEnd={handleMutateEnd}
                  />
                </div>
              ) : (
                <div className="glass-panel text-center py-20 rounded-2xl border border-white/5 flex flex-col justify-center items-center">
                  <ClipboardList className="w-12 h-12 text-slate-600 mb-4" />
                  <h3 className="font-display text-xl font-bold text-slate-300 mb-2">No Active Project Selected</h3>
                  <p className="text-slate-500 text-xs max-w-sm">
                    Create a new project using the sidebar input, or select an existing project from the sidebar to view and manage tasks.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
