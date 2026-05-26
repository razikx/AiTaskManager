import React, { useState, useEffect } from 'react';
import type { Project, Task } from '../../types';
import { apiClient, handleApiRequest } from '../../services/apiClient';
import {
  TrendingUp,
  Award,
  Clock,
  AlertTriangle,
  AlertCircle,
  Calendar,
  ListTodo,
  ShieldCheck,
  Filter
} from 'lucide-react';

interface AnalyticsDashboardProps {
  projects: Project[];
}

export function AnalyticsDashboard({ projects }: AnalyticsDashboardProps): React.JSX.Element {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [filterProjectId, setFilterProjectId] = useState<string>('all');

  // Fetch all tasks for all projects
  useEffect(() => {
    const fetchAllTasks = async () => {
      setLoading(true);
      const [res, err] = await handleApiRequest(apiClient.get('/tasks'));
      if (!err && res?.data?.success) {
        setTasks(res.data.data);
      } else if (err) {
        setFetchError('Failed to load analytics data. Please refresh.');
      }
      setLoading(false);
    };

    fetchAllTasks();
  }, []);

  // Filter tasks based on selected project
  const filteredTasks = tasks.filter((t) => {
    if (filterProjectId === 'all') return true;
    return t.project_id === filterProjectId;
  });

  // Calculate metrics
  const totalTasksCount = filteredTasks.length;
  const completedTasksCount = filteredTasks.filter((t) => t.status === 'completed').length;
  const activeTasksCount = filteredTasks.filter((t) => t.status === 'in_progress').length;
  const todoTasksCount = filteredTasks.filter((t) => t.status === 'todo').length;
  const completionRate = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  const getCategoryFromTask = (task: Task): string => task.category ?? 'Personal';

  const categoriesMap: { [key: string]: number } = {};
  filteredTasks.forEach((task) => {
    const cat = getCategoryFromTask(task);
    categoriesMap[cat] = (categoriesMap[cat] || 0) + 1;
  });

  // Sort categories by count
  const sortedCategories = Object.entries(categoriesMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Group tasks by priority
  const priorityCount = {
    Urgent: filteredTasks.filter((t) => t.priority_score === 3).length,
    High: filteredTasks.filter((t) => t.priority_score === 2).length,
    Medium: filteredTasks.filter((t) => t.priority_score === 1).length,
    Low: filteredTasks.filter((t) => t.priority_score === 0).length
  };

  // Calculate overdue & upcoming tasks
  const now = new Date();
  const overdueTasks = filteredTasks.filter((t) => {
    if (t.status === 'completed' || !t.due_date) return false;
    return new Date(t.due_date) < now;
  });

  const dueSoonTasks = filteredTasks.filter((t) => {
    if (t.status === 'completed' || !t.due_date) return false;
    const dueDate = new Date(t.due_date);
    const diffTime = dueDate.getTime() - now.getTime();
    const diffHours = diffTime / (1000 * 60 * 60);
    return diffHours >= 0 && diffHours <= 48;
  });

  // Calculate project-by-project progress
  const projectMetrics = projects.map((proj) => {
    const projTasks = tasks.filter((t) => t.project_id === proj.id);
    const projCompleted = projTasks.filter((t) => t.status === 'completed').length;
    const rate = projTasks.length > 0 ? Math.round((projCompleted / projTasks.length) * 100) : 0;
    return {
      id: proj.id,
      name: proj.name,
      total: projTasks.length,
      completed: projCompleted,
      rate
    };
  }).sort((a, b) => b.rate - a.rate);

  // Format date cleanly
  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center py-20 gap-4 text-slate-400">
        <div className="w-10 h-10 border-4 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin"></div>
        <p className="text-sm font-medium">Analyzing productivity data...</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-xl">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        <span>{fetchError}</span>
      </div>
    );
  }

  // Circular progress ring calculations
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (completionRate / 100) * circumference;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header and Project Filter Dropdown */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div className="space-y-1">
          <span className="text-2xs text-slate-500 uppercase tracking-widest font-semibold">Workspace Metrics</span>
          <h2 className="font-display font-extrabold text-2xl md:text-3xl text-white flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-brand-secondary" />
            <span>Productivity Analytics</span>
          </h2>
        </div>

        {/* Project Selector */}
        <div className="flex items-center gap-2 bg-slate-950/40 border border-white/5 rounded-xl px-3 py-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={filterProjectId}
            onChange={(e) => setFilterProjectId(e.target.value)}
            className="bg-transparent text-xs text-white font-medium focus:outline-none pr-6 cursor-pointer"
          >
            <option value="all" className="bg-brand-dark-bg text-white">All Projects</option>
            {projects.map((proj) => (
              <option key={proj.id} value={proj.id} className="bg-brand-dark-bg text-white">
                {proj.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {totalTasksCount === 0 ? (
        <div className="glass-panel text-center py-16 px-4 rounded-2xl border border-white/5">
          <Award className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-slate-300 font-bold text-lg mb-1">No productivity data found</h3>
          <p className="text-slate-500 text-xs max-w-sm mx-auto">
            Create tasks under your projects and complete them to view completions, categories, and priority trends.
          </p>
        </div>
      ) : (
        <>
          {/* Main Stats Grid & Overall Circular Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 1. Summary Cards (2 Columns on large screens) */}
            <div className="lg:col-span-2 grid grid-cols-2 gap-4">
              <div className="glass-panel rounded-2xl p-5 border border-white/5 flex flex-col justify-between">
                <span className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">Total Ingested</span>
                <div>
                  <h3 className="text-3xl md:text-4xl font-extrabold text-white mt-2">{totalTasksCount}</h3>
                  <div className="flex items-center gap-1 text-slate-400 text-xs mt-1.5">
                    <ListTodo className="w-3.5 h-3.5 text-brand-primary" />
                    <span>Tasks registered</span>
                  </div>
                </div>
              </div>

              <div className="glass-panel rounded-2xl p-5 border border-white/5 flex flex-col justify-between">
                <span className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">Completed Tasks</span>
                <div>
                  <h3 className="text-3xl md:text-4xl font-extrabold text-brand-accent mt-2">{completedTasksCount}</h3>
                  <div className="flex items-center gap-1 text-slate-400 text-xs mt-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-brand-accent" />
                    <span>Fully resolved</span>
                  </div>
                </div>
              </div>

              <div className="glass-panel rounded-2xl p-5 border border-white/5 flex flex-col justify-between">
                <span className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">Active Progress</span>
                <div>
                  <h3 className="text-3xl md:text-4xl font-extrabold text-brand-secondary mt-2">{activeTasksCount}</h3>
                  <div className="flex items-center gap-1 text-slate-400 text-xs mt-1.5">
                    <Clock className="w-3.5 h-3.5 text-brand-secondary" />
                    <span>Currently active</span>
                  </div>
                </div>
              </div>

              <div className="glass-panel rounded-2xl p-5 border border-white/5 flex flex-col justify-between">
                <span className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">Pending Todo</span>
                <div>
                  <h3 className="text-3xl md:text-4xl font-extrabold text-slate-300 mt-2">{todoTasksCount}</h3>
                  <div className="flex items-center gap-1 text-slate-400 text-xs mt-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Waiting in queue</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Circular Progress Completion Ring */}
            <div className="glass-panel rounded-2xl p-6 border border-white/5 flex flex-col items-center justify-center text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 rounded-full blur-3xl pointer-events-none"></div>
              <span className="text-2xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Total Completion Rate</span>
              
              <div className="relative flex items-center justify-center w-40 h-40">
                <svg className="w-full h-full -rotate-90">
                  {/* Background Track */}
                  <circle
                    cx="80"
                    cy="80"
                    r={radius}
                    className="stroke-slate-800"
                    strokeWidth="10"
                    fill="transparent"
                  />
                  {/* Active Segment */}
                  <circle
                    cx="80"
                    cy="80"
                    r={radius}
                    className="stroke-brand-primary transition-all duration-1000 ease-out"
                    strokeWidth="10"
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-3xl font-extrabold text-white">{completionRate}%</span>
                  <span className="text-3xs text-slate-400 uppercase font-semibold mt-0.5">Finished</span>
                </div>
              </div>
            </div>
          </div>

          {/* Category & Priority Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Category Chart Card */}
            <div className="glass-panel rounded-2xl p-6 border border-white/5 space-y-4">
              <h3 className="font-display font-bold text-sm text-white">Task Distribution by Category</h3>
              
              {sortedCategories.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No categories tracked.</p>
              ) : (
                <div className="space-y-3.5">
                  {sortedCategories.map((cat) => {
                    const pct = Math.round((cat.count / totalTasksCount) * 100);
                    return (
                      <div key={cat.name} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-300">{cat.name}</span>
                          <span className="text-slate-400">{cat.count} {cat.count === 1 ? 'task' : 'tasks'} ({pct}%)</span>
                        </div>
                        {/* Horizontal Bar */}
                        <div className="w-full h-2 bg-slate-950/40 rounded-full overflow-hidden border border-white/5">
                          <div
                            style={{ width: `${pct}%` }}
                            className="h-full bg-gradient-to-r from-brand-primary to-brand-secondary rounded-full transition-all duration-1000 ease-out"
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Priority Distribution Card */}
            <div className="glass-panel rounded-2xl p-6 border border-white/5 space-y-4">
              <h3 className="font-display font-bold text-sm text-white">Task Urgency & Priority</h3>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex flex-col justify-between">
                  <span className="text-xs font-bold text-red-400">Urgent</span>
                  <h4 className="text-2xl font-extrabold text-white mt-1">{priorityCount.Urgent}</h4>
                </div>

                <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 flex flex-col justify-between">
                  <span className="text-xs font-bold text-orange-400">High</span>
                  <h4 className="text-2xl font-extrabold text-white mt-1">{priorityCount.High}</h4>
                </div>

                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 flex flex-col justify-between">
                  <span className="text-xs font-bold text-indigo-400">Medium</span>
                  <h4 className="text-2xl font-extrabold text-white mt-1">{priorityCount.Medium}</h4>
                </div>

                <div className="bg-slate-500/10 border border-slate-500/20 rounded-xl p-4 flex flex-col justify-between">
                  <span className="text-xs font-bold text-slate-400">Low</span>
                  <h4 className="text-2xl font-extrabold text-white mt-1">{priorityCount.Low}</h4>
                </div>
              </div>
            </div>
          </div>

          {/* Overdue / Due Soon Panel & Project Progression */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Project Progress List */}
            <div className="glass-panel rounded-2xl p-6 border border-white/5 space-y-4 lg:col-span-1">
              <h3 className="font-display font-bold text-sm text-white">Project Progress Summary</h3>

              {projectMetrics.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No projects created yet.</p>
              ) : (
                <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
                  {projectMetrics.map((pm) => (
                    <div key={pm.id} className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs font-medium">
                        <span className="text-slate-300 truncate max-w-[140px]" title={pm.name}>
                          {pm.name}
                        </span>
                        <span className="text-slate-400 font-semibold">{pm.rate}% ({pm.completed}/{pm.total})</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-950/40 rounded-full overflow-hidden border border-white/5">
                        <div
                          style={{ width: `${pm.rate}%` }}
                          className="h-full bg-brand-primary rounded-full transition-all duration-1000 ease-out"
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Overdue & Upcoming Tasks Drawer Panel */}
            <div className="glass-panel rounded-2xl p-6 border border-white/5 space-y-5 lg:col-span-2">
              <h3 className="font-display font-bold text-sm text-white">Schedule Alerts</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Overdue Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-red-400 uppercase tracking-wider">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>Overdue ({overdueTasks.length})</span>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {overdueTasks.map((t) => (
                      <div
                        key={t.id}
                        className="bg-red-500/5 border border-red-500/10 rounded-xl p-3 space-y-1"
                      >
                        <h4 className="text-xs font-bold text-white truncate" title={t.title}>
                          {t.title}
                        </h4>
                        {t.due_date && (
                          <p className="text-3xs text-red-400/90 font-medium">
                            Was due: {formatDate(t.due_date)}
                          </p>
                        )}
                      </div>
                    ))}
                    {overdueTasks.length === 0 && (
                      <p className="text-xs text-slate-500 italic py-2">No overdue tasks. Nice work!</p>
                    )}
                  </div>
                </div>

                {/* Due Soon Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-brand-secondary uppercase tracking-wider">
                    <Clock className="w-4 h-4 flex-shrink-0" />
                    <span>Due Soon ({dueSoonTasks.length})</span>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {dueSoonTasks.map((t) => (
                      <div
                        key={t.id}
                        className="bg-brand-secondary/5 border border-brand-secondary/10 rounded-xl p-3 space-y-1"
                      >
                        <h4 className="text-xs font-bold text-white truncate" title={t.title}>
                          {t.title}
                        </h4>
                        {t.due_date && (
                          <p className="text-3xs text-brand-secondary font-medium">
                            Due: {formatDate(t.due_date)}
                          </p>
                        )}
                      </div>
                    ))}
                    {dueSoonTasks.length === 0 && (
                      <p className="text-xs text-slate-500 italic py-2">No tasks due in the next 48 hours.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
