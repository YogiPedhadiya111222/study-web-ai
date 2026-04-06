'use client';

import { fetchJson } from '@/lib/api';
import { formatMinutes, formatPercent } from '@/lib/format';
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  BookOpenCheck,
  Clock3,
  Loader2,
  Search,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

type OpenMode = 'desktop' | 'mobile' | null;
type SearchResultType = 'page' | 'task' | 'session' | 'insight';

interface SearchTask {
  _id: string;
  title: string;
  subject: string;
  progress: number;
  priority: number;
  status: string;
  description?: string;
}

interface SessionTaskRef {
  _id?: string;
  title?: string;
  subject?: string;
}

interface SearchSession {
  _id: string;
  taskId?: string | SessionTaskRef;
  startTime: string;
  endTime?: string;
  durationMinutes: number;
}

interface DashboardInsightData {
  weakSubjects: Array<{ subject: string; weaknessScore: number }>;
  productivity?: {
    productivityScore?: number;
    productiveTime?: number;
    unproductiveTime?: number;
    suggestions?: string[];
  };
}

interface SearchDataset {
  tasks: SearchTask[];
  sessions: SearchSession[];
  dashboard: DashboardInsightData | null;
  loadedAt: number;
}

interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
  href: string;
  icon: LucideIcon;
  badge: string;
}

interface SearchSection {
  title: string;
  items: SearchResult[];
}

const SEARCH_REFRESH_MS = 30_000;
const EMPTY_TASKS: SearchTask[] = [];
const EMPTY_SESSIONS: SearchSession[] = [];
const EMPTY_WEAK_SUBJECTS: DashboardInsightData['weakSubjects'] = [];
const EMPTY_SUGGESTIONS: string[] = [];

const quickLinks: SearchResult[] = [
  {
    id: 'page-dashboard',
    type: 'page',
    title: 'Dashboard',
    subtitle: 'Open your study overview and productivity snapshot.',
    href: '/',
    icon: Sparkles,
    badge: 'Page',
  },
  {
    id: 'page-tasks',
    type: 'page',
    title: 'Tasks',
    subtitle: 'Manage active tasks and start focused work blocks.',
    href: '/tasks',
    icon: BookOpenCheck,
    badge: 'Page',
  },
  {
    id: 'page-analytics',
    type: 'page',
    title: 'Analytics',
    subtitle: 'Review study trends, subjects, and AI insights.',
    href: '/analytics',
    icon: BarChart3,
    badge: 'Page',
  },
  {
    id: 'page-sessions',
    type: 'page',
    title: 'Sessions',
    subtitle: 'Track recent sessions and launch a new timer.',
    href: '/sessions',
    icon: Clock3,
    badge: 'Page',
  },
  {
    id: 'page-settings',
    type: 'page',
    title: 'Settings',
    subtitle: 'Adjust reminders, weekly goals, and appearance.',
    href: '/settings',
    icon: Target,
    badge: 'Page',
  },
];

function matchesQuery(values: Array<string | undefined>, terms: string[]) {
  if (terms.length === 0) return true;

  const haystack = values
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return terms.every((term) => haystack.includes(term));
}

function getTaskRef(taskId?: string | SessionTaskRef) {
  if (!taskId || typeof taskId === 'string') {
    return { title: 'Task session', subject: 'Session history' };
  }

  return {
    title: taskId.title ?? 'Task session',
    subject: taskId.subject ?? 'Session history',
  };
}

function renderBadgeStyles(type: SearchResultType) {
  if (type === 'task') return 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100';
  if (type === 'session') return 'border-sky-400/20 bg-sky-500/10 text-sky-100';
  if (type === 'insight') return 'border-violet-400/20 bg-violet-500/10 text-violet-100';
  return 'border-white/10 bg-white/8 text-slate-200';
}

export default function GlobalSearch() {
  const [openMode, setOpenMode] = useState<OpenMode>(null);
  const [query, setQuery] = useState('');
  const [dataset, setDataset] = useState<SearchDataset | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const mobileInputRef = useRef<HTMLInputElement | null>(null);
  const datasetRef = useRef<SearchDataset | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().toLowerCase();
  const queryTerms = useMemo(() => normalizedQuery.split(/\s+/).filter(Boolean), [normalizedQuery]);
  const isOpen = openMode !== null;
  const isMobileOpen = openMode === 'mobile';
  const lastLoadedAt = dataset?.loadedAt ?? 0;
  const tasksData = dataset?.tasks ?? EMPTY_TASKS;
  const sessionsData = dataset?.sessions ?? EMPTY_SESSIONS;
  const dashboardInsights = dataset?.dashboard;
  const weakSubjects = dashboardInsights?.weakSubjects ?? EMPTY_WEAK_SUBJECTS;
  const productivitySuggestions = dashboardInsights?.productivity?.suggestions ?? EMPTY_SUGGESTIONS;

  const closeSearch = useCallback(() => {
    setOpenMode(null);
  }, []);

  const navigateTo = useCallback(
    (href: string) => {
      setOpenMode(null);
      setQuery('');
      router.push(href);
    },
    [router],
  );

  const handleDesktopQueryChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
    setOpenMode('desktop');
  }, []);

  const handleMobileQueryChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  }, []);

  const handleDesktopFocus = useCallback(() => {
    setOpenMode('desktop');
  }, []);

  const openMobileSearch = useCallback(() => {
    setOpenMode('mobile');
  }, []);

  useEffect(() => {
    datasetRef.current = dataset;
  }, [dataset]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setOpenMode(null);
      setQuery('');
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [pathname]);

  useEffect(() => {
    if (!isOpen) return;

    const shouldRefresh = !lastLoadedAt || Date.now() - lastLoadedAt > SEARCH_REFRESH_MS;
    if (!shouldRefresh || loading) return;

    let cancelled = false;

    const loadSearchData = async () => {
      setLoading(true);
      setError(null);

      const [tasksResult, sessionsResult, dashboardResult] = await Promise.allSettled([
        fetchJson<SearchTask[]>('/tasks'),
        fetchJson<SearchSession[]>('/sessions'),
        fetchJson<DashboardInsightData>('/dashboard'),
      ]);

      if (cancelled) return;

      const currentDataset = datasetRef.current;
      const failures = [tasksResult, sessionsResult, dashboardResult].filter((result) => result.status === 'rejected').length;
      const nextDataset: SearchDataset = {
        tasks: tasksResult.status === 'fulfilled' ? tasksResult.value : currentDataset?.tasks ?? EMPTY_TASKS,
        sessions: sessionsResult.status === 'fulfilled' ? sessionsResult.value : currentDataset?.sessions ?? EMPTY_SESSIONS,
        dashboard: dashboardResult.status === 'fulfilled' ? dashboardResult.value : currentDataset?.dashboard ?? null,
        loadedAt: Date.now(),
      };

      setDataset(nextDataset);
      setLoading(false);

      if (failures === 3) {
        setError('Search data could not be loaded right now.');
      } else if (failures > 0) {
        setError('Some search results may be incomplete right now.');
      }
    };

    void loadSearchData();

    return () => {
      cancelled = true;
    };
  }, [isOpen, lastLoadedAt, loading]);

  useEffect(() => {
    if (openMode !== 'desktop') return;

    const handlePointerDown = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        closeSearch();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeSearch();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [closeSearch, openMode]);

  useEffect(() => {
    if (!isMobileOpen) return;

    document.body.style.overflow = 'hidden';
    mobileInputRef.current?.focus();

    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileOpen]);

  const tasks = useMemo(
    () =>
      [...tasksData]
        .sort((left, right) => right.priority - left.priority)
        .filter((task) => matchesQuery([task.title, task.subject, task.status, task.description], queryTerms))
        .map<SearchResult>((task) => ({
          id: `task-${task._id}`,
          type: 'task',
          title: task.title,
          subtitle: `${task.subject} | ${task.status.replace('-', ' ')} | ${formatPercent(task.progress)} complete`,
          href: '/tasks',
          icon: BookOpenCheck,
          badge: task.status.replace('-', ' '),
        })),
    [queryTerms, tasksData],
  );

  const sessions = useMemo(
    () =>
      [...sessionsData]
        .sort((left, right) => new Date(right.startTime).getTime() - new Date(left.startTime).getTime())
        .filter((session) => {
          const taskRef = getTaskRef(session.taskId);
          return matchesQuery(
            [
              taskRef.title,
              taskRef.subject,
              session.endTime ? 'completed' : 'in progress',
              new Date(session.startTime).toLocaleDateString(),
            ],
            queryTerms,
          );
        })
        .map<SearchResult>((session) => {
          const taskRef = getTaskRef(session.taskId);
          return {
            id: `session-${session._id}`,
            type: 'session',
            title: taskRef.title,
            subtitle: `${taskRef.subject} | ${new Date(session.startTime).toLocaleDateString()} | ${
              session.endTime ? formatMinutes(session.durationMinutes) : 'In progress'
            }`,
            href: '/sessions',
            icon: Clock3,
            badge: session.endTime ? 'Completed' : 'Running',
          };
        }),
    [queryTerms, sessionsData],
  );

  const insightResults = useMemo(
    () =>
      [
        ...weakSubjects.map((subject) => ({
          id: `weak-subject-${subject.subject}`,
          type: 'insight' as const,
          title: `${subject.subject} needs attention`,
          subtitle: `Weakness signal ${formatPercent(subject.weaknessScore)}. Review this in analytics.`,
          href: '/analytics',
          icon: BarChart3,
          badge: 'Insight',
        })),
        ...productivitySuggestions.map((suggestion, index) => ({
          id: `productivity-suggestion-${index}`,
          type: 'insight' as const,
          title: suggestion,
          subtitle: 'Productivity recommendation generated from your recent activity.',
          href: '/analytics',
          icon: Sparkles,
          badge: 'AI',
        })),
      ].filter((insight) => matchesQuery([insight.title, insight.subtitle], queryTerms)),
    [productivitySuggestions, queryTerms, weakSubjects],
  );

  const pageResults = useMemo(
    () => quickLinks.filter((page) => matchesQuery([page.title, page.subtitle], queryTerms)),
    [queryTerms],
  );

  const sections = useMemo<SearchSection[]>(
    () =>
      queryTerms.length === 0
        ? [
            { title: 'Quick Access', items: pageResults.slice(0, 5) },
            { title: 'Priority Tasks', items: tasks.slice(0, 3) },
            { title: 'Recent Sessions', items: sessions.slice(0, 3) },
            { title: 'Insights', items: insightResults.slice(0, 3) },
          ].filter((section) => section.items.length > 0)
        : [
            { title: 'Pages', items: pageResults.slice(0, 4) },
            { title: 'Tasks', items: tasks.slice(0, 4) },
            { title: 'Sessions', items: sessions.slice(0, 4) },
            { title: 'Insights', items: insightResults.slice(0, 4) },
          ].filter((section) => section.items.length > 0),
    [insightResults, pageResults, queryTerms.length, sessions, tasks],
  );

  const topResult = useMemo(() => sections[0]?.items[0] ?? null, [sections]);

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (topResult) {
        navigateTo(topResult.href);
      }
    },
    [navigateTo, topResult],
  );

  const resultsPanel = (
    <div className="surface-card-strong overflow-hidden rounded-[28px]">
      <div className="border-b px-4 py-3 text-xs uppercase tracking-[0.22em] text-[var(--text-muted)]" style={{ borderColor: 'var(--border)' }}>
        {queryTerms.length === 0 ? 'Search your workspace' : `Results for "${query}"`}
      </div>

      {loading && !dataset ? (
        <div className="text-secondary flex items-center gap-3 px-4 py-8 text-sm">
          <Loader2 className="h-4 w-4 animate-spin text-sky-300" />
          Loading tasks, sessions, and insights...
        </div>
      ) : sections.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-primary text-sm font-medium">No matching results</p>
          <p className="text-tertiary mt-2 text-sm">Try a task title, subject, status, or session date.</p>
        </div>
      ) : (
        <div className="max-h-[26rem] overflow-y-auto px-2 py-2">
          {sections.map((section) => (
            <div key={section.title} className="mb-2 last:mb-0">
              <div className="text-muted px-2 py-2 text-[11px] font-medium uppercase tracking-[0.22em]">
                {section.title}
              </div>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => navigateTo(item.href)}
                      className="flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition-colors duration-200 hover:bg-[var(--surface-soft)]"
                    >
                      <div className="surface-card-soft text-secondary mt-0.5 rounded-2xl p-2">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-primary truncate text-sm font-medium">{item.title}</p>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] ${renderBadgeStyles(item.type)}`}
                          >
                            {item.badge}
                          </span>
                        </div>
                        <p className="text-tertiary mt-1 text-sm leading-5">{item.subtitle}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {(error || topResult) && (
        <div className="text-tertiary border-t px-4 py-3 text-xs" style={{ borderColor: 'var(--border)' }}>
          {error ? error : 'Press Enter to open the top match.'}
        </div>
      )}
    </div>
  );

  return (
    <>
      <div ref={wrapperRef} className="relative hidden lg:block lg:w-[20rem] xl:w-[24rem]">
        <form onSubmit={handleSubmit}>
          <label className="surface-card-soft text-tertiary flex items-center gap-3 rounded-2xl px-4 py-3 text-sm">
            <Search className="h-4 w-4 shrink-0" />
            <input
              type="search"
              value={query}
              onChange={handleDesktopQueryChange}
              onFocus={handleDesktopFocus}
              placeholder="Search tasks, sessions, insights"
              className="text-primary w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]"
              aria-label="Search tasks, sessions, and insights"
            />
          </label>
        </form>

        {openMode === 'desktop' ? <div className="absolute left-0 right-0 top-full z-[60] mt-3">{resultsPanel}</div> : null}
      </div>

      <button
        type="button"
        onClick={openMobileSearch}
        className="surface-card-soft text-secondary rounded-2xl p-2.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-sky-400/25 sm:p-3 lg:hidden"
        aria-label="Open search"
      >
        <Search className="h-5 w-5" />
      </button>

      {isMobileOpen ? (
        <div
          className="surface-overlay fixed inset-0 z-[70] px-3 py-4 backdrop-blur-xl sm:px-6"
          onClick={closeSearch}
        >
          <div className="mx-auto flex max-w-2xl flex-col gap-3" onClick={(event) => event.stopPropagation()}>
            <form onSubmit={handleSubmit} className="surface-card-strong rounded-[28px] p-3">
              <div className="surface-card-soft text-tertiary flex items-center gap-3 rounded-2xl px-4 py-3 text-sm">
                <Search className="h-4 w-4 shrink-0" />
                <input
                  ref={mobileInputRef}
                  type="search"
                  value={query}
                  onChange={handleMobileQueryChange}
                  placeholder="Search tasks, sessions, insights"
                  className="text-primary w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]"
                  aria-label="Search tasks, sessions, and insights"
                />
                <button
                  type="button"
                  onClick={closeSearch}
                  className="text-tertiary rounded-full p-1 transition-colors hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
                  aria-label="Close search"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </form>

            {resultsPanel}
          </div>
        </div>
      ) : null}
    </>
  );
}
