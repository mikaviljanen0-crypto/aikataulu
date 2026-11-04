"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { initialTasks } from "@/data/sampleTasks";
import { DEFAULT_HIERARCHY_PALETTE, readHierarchyPalette, type HierarchyPalette } from "@/lib/hierarchyColors";
import { getCriticalTaskIds } from "@/lib/criticalPath";
import { scheduleDependencies } from "@/lib/dependencies";
import {
  getDescendantIndexes,
  isHiddenByCollapsedParent,
  normalizeSummaries,
} from "@/lib/wbs";
import type { Task } from "@/types/schedule";
import { addDays, maxIsoDate, minIsoDate } from "@/lib/date";
import { nextWorkday, workdayEnd } from "@/lib/calendar";
import { GanttChart } from "./GanttChart";
import type { TimelineZoom } from "./TimelineControls";
import { ViewPanel } from "./ViewPanel";
import { ProjectBar } from "./ProjectBar";
import { TaskTable } from "./TaskTable";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { PrintHeader } from "./PrintHeader";
import { PrintReport } from "./PrintReport";
import { QuickBar, type TaskFilter } from "./QuickBar";
import { ProjectsPanel } from "./ProjectsPanel";
import { HistoryPanel } from "./HistoryPanel";
import { CalendarPanel } from "./CalendarPanel";
import { getProjectPulse, isBehind, expectedProgress } from "@/lib/progress";
import { getWbs } from "@/lib/wbs";
import type { ProjectListing, StoredProject, TrackingSnapshot, ScheduleMilestone } from "@/types/workspace";
import { MilestonesPanel } from "./MilestonesPanel";
import { portalMode, remoteProjects, type RemoteContext } from "@/lib/remoteProjects";

const STORAGE_KEY = "snedo-aikataulu-project-v1";
const VIEW_STORAGE_KEY = "snedo-aikataulu-view-v1";
const PROJECT_INDEX_KEY = "snedo-aikataulu-project-list-v1";
const ACTIVE_PROJECT_KEY = "snedo-aikataulu-active-project-v1";
const PROJECT_DATA_PREFIX = "snedo-aikataulu-stored-";

function cloneTasks(tasks: Task[]): Task[] {
  return tasks.map((task) => ({ ...task }));
}

function csvEscape(value: unknown): string {
  const text = String(value ?? "");
  if (/[;"\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ";" && !quoted) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

export default function ScheduleApp() {
  const [projectNumber, setProjectNumber] = useState("2607");
  const [projectName, setProjectName] = useState("As Oy Kissankello");
  const [scheduleName, setScheduleName] = useState("Yleisaikataulu");
  const [statusDate, setStatusDate] = useState("2026-08-31");
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(
    new Set([initialTasks[0].id]),
  );
  const [selectionAnchorId, setSelectionAnchorId] = useState(initialTasks[0].id);
  const [undoStack, setUndoStack] = useState<Task[][]>([]);
  const [redoStack, setRedoStack] = useState<Task[][]>([]);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");
  const [tableWidth, setTableWidth] = useState(590);
  const [taskNameWidth, setTaskNameWidth] = useState(235);
  const [showPlanningColumns, setShowPlanningColumns] = useState(false);
  const [showTrackingColumns, setShowTrackingColumns] = useState(true);
  const [rangeStart, setRangeStart] = useState("2026-07-01");
  const [rangeEnd, setRangeEnd] = useState("2026-10-02");
  const [timelineZoom, setTimelineZoom] = useState<TimelineZoom>("week");
  const [viewPanelOpen, setViewPanelOpen] = useState(false);
  const [fitToWindow, setFitToWindow] = useState(true);
  const [showWeekends, setShowWeekends] = useState(true);
  const [showToday, setShowToday] = useState(true);
  const [showBaseline, setShowBaseline] = useState(true);
  const [showHierarchyColors, setShowHierarchyColors] = useState(true);
  const [hierarchyPalette, setHierarchyPalette] = useState<HierarchyPalette>(DEFAULT_HIERARCHY_PALETTE);
  const [activeNav, setActiveNav] = useState("general");
  const [taskQuery, setTaskQuery] = useState("");
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("all");
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState(portalMode ? "" : "main-project");
  const [catalog, setCatalog] = useState<ProjectListing[]>([]);
  const [snapshots, setSnapshots] = useState<TrackingSnapshot[]>([]);
  const [extraDaysOff, setExtraDaysOff] = useState<string[]>([]);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [milestonesOpen, setMilestonesOpen] = useState(false);
  const [milestones, setMilestones] = useState<ScheduleMilestone[]>([]);
  const [remoteContext, setRemoteContext] = useState<RemoteContext | null>(null);
  const [remoteReady, setRemoteReady] = useState(!portalMode);
  const [remoteEditable, setRemoteEditable] = useState(false);
  const [remoteSaveState, setRemoteSaveState] = useState("Tallennettu");
  const [remoteError, setRemoteError] = useState("");
  const remoteRevision = useRef(0);
  const remoteLastSaved = useRef("");
  const remoteSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteSaveQueue = useRef<Promise<void>>(Promise.resolve());
  const remoteSwitching = useRef(false);
  const remoteHasUnsaved = useRef(false);

  const jsonInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  /* LocalStorage hydration intentionally restores the persisted project once on mount. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (portalMode) {
      void (async () => {
        try {
          const [context, listing] = await Promise.all([remoteProjects.context(), remoteProjects.list()]);
          setRemoteContext(context);
          setCatalog(listing.projects);
          if (listing.projects.length) {
            const first = await remoteProjects.get(listing.projects[0].id);
            let editable = false;
            if (context.role !== "read") {
              try { await remoteProjects.lock(first.id); editable = true; } catch { /* Another editor. */ }
            }
            remoteRevision.current = first.revision;
            remoteLastSaved.current = JSON.stringify(first.data);
            applyProject(first.data, first.id);
            setRemoteEditable(editable);
          } else {
            setActiveProjectId("");
            setProjectsOpen(true);
          }
          setRemoteReady(true);
          setLoaded(true);
        } catch (error) {
          setRemoteError(error instanceof Error ? error.message : "Palvelimeen ei saada yhteyttä.");
          setRemoteReady(true);
        }
      })();
      return;
    }
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as StoredProject;
        if (Array.isArray(parsed.tasks) && parsed.tasks.length) {
          setProjectNumber(parsed.projectNumber ?? "2607");
          setProjectName(parsed.projectName ?? "As Oy Kissankello");
          setScheduleName(parsed.scheduleName ?? "Yleisaikataulu");
          setStatusDate(parsed.statusDate ?? new Date().toISOString().slice(0, 10));
          setTasks(parsed.tasks);
          setExtraDaysOff(Array.isArray(parsed.extraDaysOff) ? parsed.extraDaysOff : []);
          setMilestones(Array.isArray(parsed.milestones) ? parsed.milestones : []);
          setSelectedIds(new Set([parsed.tasks[0].id]));
          setSelectionAnchorId(parsed.tasks[0].id);
        }
      } catch {
        // Vanha tai vioittunut paikallistallennus ohitetaan.
      }
    }

    try {
      const rawCatalog = window.localStorage.getItem(PROJECT_INDEX_KEY);
      const existing = rawCatalog ? JSON.parse(rawCatalog) as ProjectListing[] : [];
      if (Array.isArray(existing) && existing.length) {
        setCatalog(existing);
        const requestedId = window.localStorage.getItem(ACTIVE_PROJECT_KEY);
        const entry = existing.find((item) => item.id === requestedId) ?? existing[0];
        const rawProject = window.localStorage.getItem(PROJECT_DATA_PREFIX + entry.id);
        if (rawProject) {
          const stored = JSON.parse(rawProject) as StoredProject;
          if (Array.isArray(stored.tasks) && stored.tasks.length) {
            setProjectNumber(stored.projectNumber || entry.projectNumber);
            setProjectName(stored.projectName || entry.projectName);
            setScheduleName(stored.scheduleName || "Yleisaikataulu");
            setStatusDate(stored.statusDate || "2026-08-31");
            setTasks(stored.tasks);
            setExtraDaysOff(Array.isArray(stored.extraDaysOff) ? stored.extraDaysOff : []);
            setMilestones(Array.isArray(stored.milestones) ? stored.milestones : []);
            setSnapshots(Array.isArray(stored.snapshots) ? stored.snapshots : []);
            setSelectedIds(new Set([stored.tasks[0].id]));
            setSelectionAnchorId(stored.tasks[0].id);
          }
        }
        setActiveProjectId(entry.id);
      } else {
        const first = {
          id: "main-project",
          projectNumber: "2607",
          projectName: "As Oy Kissankello",
          scheduleName: "Yleisaikataulu",
          updatedAt: new Date().toISOString(),
        };
        setCatalog([first]);
        window.localStorage.setItem(PROJECT_INDEX_KEY, JSON.stringify([first]));
        window.localStorage.setItem(ACTIVE_PROJECT_KEY, first.id);
      }
    } catch {
      // Jos projektihakemisto on viallinen, alkuperäinen tallennus säilytetään.
    }

    const savedView = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (savedView) {
      try {
        const view = JSON.parse(savedView);
        setTableWidth(view.tableWidth ?? 590);
        setTaskNameWidth(view.taskNameWidth ?? 235);
        setShowPlanningColumns(view.showPlanningColumns ?? false);
        setShowTrackingColumns(view.showTrackingColumns ?? true);
        setRangeStart(view.rangeStart ?? "2026-07-01");
        setRangeEnd(view.rangeEnd ?? "2026-10-02");
        setTimelineZoom(view.timelineZoom ?? "week");
        setFitToWindow(view.fitToWindow ?? true);
        setShowWeekends(view.showWeekends ?? true);
        setShowToday(view.showToday ?? true);
        setShowBaseline(view.showBaseline ?? true);
        setShowHierarchyColors(view.showHierarchyColors ?? true);
        setHierarchyPalette(readHierarchyPalette(view.hierarchyPalette) ?? DEFAULT_HIERARCHY_PALETTE);
        setTaskFilter(view.taskFilter ?? "all");
      } catch {
        // Näkymä palautuu oletukseen.
      }
    }
    setLoaded(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const normalizedTasks = useMemo(() => normalizeSummaries(tasks, extraDaysOff), [tasks, extraDaysOff]);
  const pulse = useMemo(() => getProjectPulse(normalizedTasks, statusDate, extraDaysOff), [normalizedTasks, statusDate, extraDaysOff]);
  const criticalTaskIds = useMemo(
    () => getCriticalTaskIds(normalizedTasks),
    [normalizedTasks],
  );
  const behindIds = useMemo(
    () => new Set(normalizedTasks.filter((task) => isBehind(task, statusDate, extraDaysOff)).map((task) => task.id)),
    [normalizedTasks, statusDate, extraDaysOff],
  );

  const lateTasks = useMemo(() => normalizedTasks
    .map((task, index) => ({ task, index }))
    .filter(({ task }) => behindIds.has(task.id))
    .map(({ task, index }) => ({
      id: task.id,
      wbs: getWbs(normalizedTasks, index),
      name: task.name,
      actual: task.progress ?? 0,
      expected: expectedProgress(task, statusDate, extraDaysOff),
    }))
    .sort((a, b) => (b.expected - b.actual) - (a.expected - a.actual)),
    [normalizedTasks, behindIds, statusDate, extraDaysOff],
  );

  const changedCount = useMemo(() => {
    const previous = snapshots.at(-1);
    if (!previous) return 0;
    const old = new Map(previous.tasks.map((task) => [task.id, task]));
    return tasks.filter((task) => {
      if (task.type === "summary") return false;
      const last = old.get(task.id);
      return !last || last.progress !== task.progress ||
        last.actualStart !== task.actualStart || last.actualEnd !== task.actualEnd;
    }).length;
  }, [snapshots, tasks]);

  const visibleTasks = useMemo(() => {
    const term = taskQuery.trim().toLocaleLowerCase("fi-FI");
    if (!term && taskFilter === "all") {
      return normalizedTasks.filter((_, index) => !isHiddenByCollapsedParent(normalizedTasks, index));
    }

    const includesTerm = (task: Task) =>
      [task.name, task.area ?? "", task.owner ?? ""]
        .some((value) => value.toLocaleLowerCase("fi-FI").includes(term));

    const matchesSearch = (task: Task, index: number) => {
      if (!term || includesTerm(task)) return true;
      let nearestLevel = task.level;
      for (let i = index - 1; i >= 0 && nearestLevel > 0; i -= 1) {
        const candidate = normalizedTasks[i];
        if (candidate.level >= nearestLevel) continue;
        if (includesTerm(candidate)) return true;
        nearestLevel = candidate.level;
      }
      return false;
    };

    const shown = new Set<number>();
    normalizedTasks.forEach((task, index) => {
      if (task.type === "summary" || !matchesSearch(task, index)) return;
      const matchesFilter = taskFilter === "all" ||
        (taskFilter === "unfinished" && (task.progress ?? 0) < 100) ||
        (taskFilter === "behind" && behindIds.has(task.id));
      if (!matchesFilter) return;

      shown.add(task.id);
      let parentLevel = task.level;
      for (let i = index - 1; i >= 0 && parentLevel > 0; i -= 1) {
        if (normalizedTasks[i].level < parentLevel) {
          shown.add(normalizedTasks[i].id);
          parentLevel = normalizedTasks[i].level;
        }
      }
    });
    // Haussa näytetään osumat myös aiemmin suljettujen summarivien alta.
    return normalizedTasks.filter((task) => shown.has(task.id));
  }, [normalizedTasks, taskQuery, taskFilter, behindIds]);
  useEffect(() => {
    if (!loaded) return;
    if (portalMode) return;
    const payload: StoredProject = {
      version: 1,
      projectNumber,
      projectName,
      scheduleName,
      statusDate,
      tasks,
      snapshots,
      extraDaysOff,
      milestones,
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      window.localStorage.setItem(PROJECT_DATA_PREFIX + activeProjectId, JSON.stringify(payload));
      window.localStorage.setItem(ACTIVE_PROJECT_KEY, activeProjectId);
      const existing = JSON.parse(window.localStorage.getItem(PROJECT_INDEX_KEY) || "[]") as ProjectListing[];
      const updated = Array.isArray(existing) ? [...existing] : [];
      const index = updated.findIndex((item) => item.id === activeProjectId);
      const row = { id: activeProjectId, projectName, projectNumber, scheduleName, updatedAt: new Date().toISOString() };
      if (index < 0) updated.push(row);
      else updated[index] = row;
      window.localStorage.setItem(PROJECT_INDEX_KEY, JSON.stringify(updated));
    } catch {
      // Selaintallennuksen rajoitus ei saa estää työskentelyä. JSON-vienti on varmuuskopio.
    }
  }, [loaded, activeProjectId, projectNumber, projectName, scheduleName, statusDate, tasks, snapshots, extraDaysOff, milestones]);

  // Portal mode never writes project data to localStorage. Save to the selected company's server database.
  useEffect(() => {
    if (!portalMode || !loaded || !remoteEditable || !activeProjectId || remoteSwitching.current) return;
    const payload = { version: 1 as const, projectNumber, projectName, scheduleName, statusDate, tasks, snapshots, extraDaysOff, milestones };
    if (JSON.stringify(payload) === remoteLastSaved.current) return;
    if (remoteSaveTimer.current) clearTimeout(remoteSaveTimer.current);
    remoteHasUnsaved.current = true;
    setRemoteSaveState("Tallennetaan…");
    remoteSaveTimer.current = setTimeout(() => { void saveRemote(payload, activeProjectId); }, 900);
    return () => { if (remoteSaveTimer.current) clearTimeout(remoteSaveTimer.current); };
  // saveRemote is intentionally invoked using this render's project snapshot; listing it would reschedule every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, remoteEditable, activeProjectId, projectNumber, projectName, scheduleName, statusDate, tasks, snapshots, extraDaysOff, milestones]);

  useEffect(() => {
    if (!portalMode || !loaded || !remoteEditable || !activeProjectId) return;
    const interval = setInterval(() => {
      void remoteProjects.lock(activeProjectId).catch((error) => {
        setRemoteEditable(false);
        setRemoteError(`Muokkausvaraus päättyi: ${error instanceof Error ? error.message : "Yhteys katkesi."}`);
      });
    }, 45_000);
    return () => clearInterval(interval);
  }, [loaded, remoteEditable, activeProjectId]);

  useEffect(() => {
    if (!portalMode || !loaded || !activeProjectId) return;
    const warnBeforeClose = (event: BeforeUnloadEvent) => {
      const current = JSON.stringify({ version: 1, projectNumber, projectName, scheduleName, statusDate, tasks, snapshots, extraDaysOff, milestones });
      if (remoteHasUnsaved.current && current !== remoteLastSaved.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warnBeforeClose);
    return () => window.removeEventListener("beforeunload", warnBeforeClose);
  }, [loaded, remoteEditable, activeProjectId, projectNumber, projectName, scheduleName, statusDate, tasks, snapshots, extraDaysOff, milestones]);

  useEffect(() => {
    if (!loaded) return;
    window.localStorage.setItem(
      VIEW_STORAGE_KEY,
      JSON.stringify({
        tableWidth,
        taskNameWidth,
        showPlanningColumns,
        showTrackingColumns,
        rangeStart,
        rangeEnd,
        timelineZoom,
        fitToWindow,
        showWeekends,
        showToday,
        showBaseline,
        showHierarchyColors,
        hierarchyPalette,
        taskFilter,
      }),
    );
  }, [
    loaded,
    tableWidth,
    taskNameWidth,
    showPlanningColumns,
    showTrackingColumns,
    rangeStart,
    rangeEnd,
    timelineZoom,
    fitToWindow,
    showWeekends,
    showToday,
    showBaseline,
    showHierarchyColors,
    hierarchyPalette,
    taskFilter,
  ]);

  function flash(text: string) {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 3200);
  }

  function commit(next: Task[] | ((current: Task[]) => Task[])) {
    if (portalMode && !remoteEditable) return;
    setTasks((current) => {
      const value = typeof next === "function" ? next(current) : next;
      if (JSON.stringify(value) === JSON.stringify(current)) return current;
      setUndoStack((stack) => [...stack.slice(-49), cloneTasks(current)]);
      setRedoStack([]);
      return value;
    });
  }

  function updateTask(id: number, patch: Partial<Task>) {
    commit((current) => {
      const normalizedPatch =
        "start" in patch && patch.start
          ? { ...patch, start: nextWorkday(patch.start, extraDaysOff) }
          : patch;

      const next = current.map((task) =>
        task.id === id ? { ...task, ...normalizedPatch } : task,
      );

      const affectsSchedule =
        "start" in patch ||
        "duration" in patch ||
        "predecessorId" in patch ||
        "lagDays" in patch;

      if (!affectsSchedule) return next;

      const result = scheduleDependencies(next, extraDaysOff);
      if (result.errors.length) {
        flash(result.errors.join(" "));
        return next;
      }
      return result.tasks;
    });
  }

  function selectTask(
    id: number,
    options: { additive: boolean; range: boolean },
  ) {
    if (options.range) {
      const anchorIndex = visibleTasks.findIndex((task) => task.id === selectionAnchorId);
      const targetIndex = visibleTasks.findIndex((task) => task.id === id);
      if (anchorIndex >= 0 && targetIndex >= 0) {
        const [start, end] =
          anchorIndex <= targetIndex
            ? [anchorIndex, targetIndex]
            : [targetIndex, anchorIndex];
        setSelectedIds(new Set(visibleTasks.slice(start, end + 1).map((task) => task.id)));
        return;
      }
    }

    if (options.additive) {
      setSelectedIds((current) => {
        const next = new Set(current);
        if (next.has(id) && next.size > 1) next.delete(id);
        else next.add(id);
        return next;
      });
      setSelectionAnchorId(id);
      return;
    }

    setSelectedIds(new Set([id]));
    setSelectionAnchorId(id);
  }

  function primaryIndex() {
    const selected = tasks.findIndex((task) => task.id === selectionAnchorId);
    return selected >= 0 ? selected : 0;
  }

  function addTask() {
    const index = primaryIndex();
    const selected = tasks[index];
    const id = Date.now();
    const task: Task = {
      id,
      name: "Uusi työvaihe",
      start: selected?.start ?? statusDate,
      duration: 5,
      level: selected?.level ?? 0,
      type: "task",
      progress: 0,
    };

    commit((current) => {
      const next = [...current];
      next.splice(Math.max(0, index + 1), 0, task);
      return next;
    });
    setSelectedIds(new Set([id]));
    setSelectionAnchorId(id);
  }

  function copyTasks() {
    const indexesToCopy = new Set<number>();
    tasks.forEach((task, index) => {
      if (!selectedIds.has(task.id)) return;
      indexesToCopy.add(index);
      getDescendantIndexes(tasks, index).forEach((child) => indexesToCopy.add(child));
    });
    const indexes = [...indexesToCopy].sort((a, b) => a - b);
    if (!indexes.length) return;

    const insertAt = indexes.at(-1)! + 1;
    const firstId = Math.max(Date.now(), ...tasks.map((task) => task.id + 1));
    const idMap = new Map(indexes.map((index, offset) => [tasks[index].id, firstId + offset]));
    const copies = indexes.map((index) => ({
      ...tasks[index],
      id: idMap.get(tasks[index].id)!,
      name: `${tasks[index].name} – kopio`,
      predecessorId: tasks[index].predecessorId
        ? idMap.get(tasks[index].predecessorId!) ?? tasks[index].predecessorId
        : undefined,
      baselineStart: undefined,
      baselineDuration: undefined,
    }));

    commit((current) => {
      const next = [...current];
      next.splice(insertAt, 0, ...copies);
      return next;
    });
    setSelectedIds(new Set(copies.map((task) => task.id)));
    setSelectionAnchorId(copies[0].id);
  }

  function removeTasks() {
    if (!selectedIds.size || tasks.length === 1) return;
    const removeIndexes = new Set<number>();
    tasks.forEach((task, index) => {
      if (!selectedIds.has(task.id)) return;
      removeIndexes.add(index);
      getDescendantIndexes(tasks, index).forEach((child) => removeIndexes.add(child));
    });

    const next = tasks.filter((_, index) => !removeIndexes.has(index));
    if (!next.length) return;
    commit(next);
    setSelectedIds(new Set([next[Math.min(primaryIndex(), next.length - 1)].id]));
    setSelectionAnchorId(next[Math.min(primaryIndex(), next.length - 1)].id);
  }

  function indentTasks() {
    const ids = selectedIds;
    commit((current) =>
      current.map((task, index) => {
        if (!ids.has(task.id) || index === 0) return task;
        return {
          ...task,
          level: Math.min(task.level + 1, current[index - 1].level + 1),
        };
      }),
    );
  }

  function outdentTasks() {
    const ids = selectedIds;
    commit((current) =>
      current.map((task) =>
        ids.has(task.id) ? { ...task, level: Math.max(0, task.level - 1) } : task,
      ),
    );
  }

  function moveSelected(direction: -1 | 1) {
    const index = primaryIndex();
    const root = tasks[index];
    if (!root) return;
    const rootIndexes = getDescendantIndexes(tasks, index);
    const end = rootIndexes.at(-1) ?? index;
    const selectedBlock = tasks.slice(index, end + 1);

    if (direction < 0) {
      let previous = index - 1;
      while (previous >= 0 && tasks[previous].level > root.level) previous -= 1;
      if (previous < 0 || tasks[previous].level !== root.level) return;
      const next = [
        ...tasks.slice(0, previous),
        ...selectedBlock,
        ...tasks.slice(previous, index),
        ...tasks.slice(end + 1),
      ];
      commit(next);
      return;
    }

    const nextStart = end + 1;
    if (nextStart >= tasks.length || tasks[nextStart].level !== root.level) return;
    const nextChildren = getDescendantIndexes(tasks, nextStart);
    const nextEnd = nextChildren.at(-1) ?? nextStart;
    const next = [
      ...tasks.slice(0, index),
      ...tasks.slice(nextStart, nextEnd + 1),
      ...selectedBlock,
      ...tasks.slice(nextEnd + 1),
    ];
    commit(next);
  }

  function toggleCollapse(id: number) {
    updateTask(id, {
      collapsed: !tasks.find((task) => task.id === id)?.collapsed,
    });
  }

  function undo() {
    if (portalMode && !remoteEditable) return;
    if (!undoStack.length) return;
    const previous = undoStack.at(-1)!;
    setRedoStack((stack) => [...stack, cloneTasks(tasks)]);
    setTasks(cloneTasks(previous));
    setUndoStack((stack) => stack.slice(0, -1));
  }

  function redo() {
    if (portalMode && !remoteEditable) return;
    if (!redoStack.length) return;
    const next = redoStack.at(-1)!;
    setUndoStack((stack) => [...stack, cloneTasks(tasks)]);
    setTasks(cloneTasks(next));
    setRedoStack((stack) => stack.slice(0, -1));
  }

  function calculateDependencies() {
    const result = scheduleDependencies(tasks, extraDaysOff);
    if (result.errors.length) {
      flash(result.errors.join(" "));
      return;
    }
    commit(result.tasks);
    flash(
      result.changedCount
        ? `${result.changedCount} työvaiheen aloitus päivitettiin.`
        : "Riippuvuudet ovat ajan tasalla.",
    );
  }

  function saveBaseline() {
    commit((current) =>
      current.map((task) => ({
        ...task,
        baselineStart: task.start,
        baselineDuration: task.duration,
      })),
    );
    setShowBaseline(true);
    flash("Tavoite tallennettu.");
  }

  function addMilestone(title: string, date: string) {
    if (portalMode && !remoteEditable) return;
    setMilestones(current => [...current, {
      id: `vt-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      title, date,
    }]);
    flash("Välitavoite lisätty.");
  }

  function updateMilestone(id: string, patch: Partial<Pick<ScheduleMilestone, "title" | "date">>) {
    if (portalMode && !remoteEditable) return;
    setMilestones(current => current.map(item => item.id === id ? {...item, ...patch} : item));
  }

  function removeMilestone(id: string) {
    if (portalMode && !remoteEditable) return;
    setMilestones(current => current.filter(item => item.id !== id));
    flash("Välitavoite poistettu.");
  }

  function showWeeks(weeks: number) {
    setRangeEnd(addDays(rangeStart, weeks * 7 - 1));
  }

  function fitProjectToView() {
    const normal = normalizedTasks.filter((task) => task.type !== "summary");
    if (!normal.length) return;
    const start = minIsoDate([...normal.map((task) => task.start), ...milestones.map(m => m.date)]);
    const end = maxIsoDate([...normal.map((task) => workdayEnd(task.start, task.duration, extraDaysOff)), ...milestones.map(m => m.date)]);
    setRangeStart(addDays(start, -7));
    setRangeEnd(addDays(end, 14));
  }

  function beginPaneResize(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = tableWidth;
    const onMove = (moveEvent: PointerEvent) => {
      setTableWidth(
        Math.min(
          window.innerWidth - 500,
          Math.max(440, startWidth + moveEvent.clientX - startX),
        ),
      );
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  }

  function download(name: string, content: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function exportJson() {
    const payload: StoredProject = {
      version: 1,
      projectNumber,
      projectName,
      scheduleName,
      statusDate,
      tasks,
      snapshots,
      extraDaysOff,
      milestones,
    };
    download(
      `${projectNumber}-${scheduleName.replaceAll(" ", "_")}.jana.json`,
      JSON.stringify(payload, null, 2),
      "application/json",
    );
  }

  async function importJsonFile(file: File) {
    if (portalMode && !remoteEditable) return;
    try {
      const parsed = JSON.parse(await file.text()) as StoredProject;
      if (!Array.isArray(parsed.tasks) || !parsed.tasks.length) throw new Error();
      if (!window.confirm("Korvataanko avoinna oleva aikataulu JSON-tiedoston tiedoilla?")) return;
      setUndoStack((stack) => [...stack, cloneTasks(tasks)]);
      setRedoStack([]);
      setProjectNumber(parsed.projectNumber ?? projectNumber);
      setProjectName(parsed.projectName ?? projectName);
      setScheduleName(parsed.scheduleName ?? scheduleName);
      setStatusDate(parsed.statusDate ?? statusDate);
      setSnapshots(Array.isArray(parsed.snapshots) ? parsed.snapshots : []);
      setExtraDaysOff(Array.isArray(parsed.extraDaysOff) ? parsed.extraDaysOff : []);
      setMilestones(Array.isArray(parsed.milestones) ? parsed.milestones : []);
      setTasks(parsed.tasks);
      setSelectedIds(new Set([parsed.tasks[0].id]));
      setSelectionAnchorId(parsed.tasks[0].id);
      flash("Aikataulu tuotu JSON-tiedostosta.");
    } catch {
      flash("JSON-tiedostoa ei voitu lukea.");
    }
  }

  function exportCsv() {
    const headers = [
      "WBS",
      "Työvaihe",
      "Kesto",
      "Alku",
      "Loppu",
      "Rakennus/alue",
      "Vastuu",
      "EdeltajaID",
      "Viive",
      "Valmis%",
      "TotAlku",
      "TotLoppu",
    ];
    const rows = normalizedTasks.map((task, index) => [
      index + 1,
      task.name,
      task.duration,
      task.start,
      workdayEnd(task.start, task.duration, extraDaysOff),
      task.area ?? "",
      task.owner ?? "",
      task.predecessorId ?? "",
      task.lagDays ?? 0,
      task.progress ?? 0,
      task.actualStart ?? "",
      task.actualEnd ?? "",
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map(csvEscape).join(";"))
      .join("\n");
    download(`${projectNumber}-aikataulu.csv`, "\ufeff" + csv, "text/csv;charset=utf-8");
  }

  async function importCsvFile(file: File) {
    if (portalMode && !remoteEditable) return;
    try {
      const text = (await file.text()).replace(/^\ufeff/, "");
      const lines = text.split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) throw new Error();
      const data = lines.slice(1).map(parseCsvLine);
      const stamp = Date.now();
      const imported: Task[] = data.map((row, index) => ({
        id: stamp + index,
        name: row[1] || "Työvaihe",
        duration: Math.max(1, Number(row[2]) || 1),
        start: row[3] || statusDate,
        level: 0,
        type: "task",
        area: row[5] || undefined,
        owner: row[6] || undefined,
        lagDays: Number(row[8]) || 0,
        progress: Math.min(100, Math.max(0, Number(row[9]) || 0)),
        actualStart: row[10] || undefined,
        actualEnd: row[11] || undefined,
      }));
      if (!imported.length) throw new Error();
      commit(imported);
      setSelectedIds(new Set([imported[0].id]));
      setSelectionAnchorId(imported[0].id);
      flash(`${imported.length} työvaihetta tuotu CSV:stä.`);
    } catch {
      flash("CSV-tiedostoa ei voitu lukea.");
    }
  }

  function currentPayload(): StoredProject {
    return { version: 1, projectNumber, projectName, scheduleName, statusDate, tasks: cloneTasks(tasks), snapshots, extraDaysOff, milestones };
  }

  async function saveRemote(data: StoredProject, id: string): Promise<boolean> {
    if (!remoteEditable || !id) return false;
    let success = true;
    const serialized = JSON.stringify(data);
    remoteSaveQueue.current = remoteSaveQueue.current.catch(() => {}).then(async () => {
      if (serialized === remoteLastSaved.current) return;
      const saved = await remoteProjects.save(id, remoteRevision.current, data);
      remoteRevision.current = saved.revision;
      remoteLastSaved.current = serialized;
      setRemoteSaveState("Tallennettu palvelimelle");
      setCatalog((entries) => entries.map((entry) => entry.id === id ? {
        ...entry, updatedAt: saved.updatedAt, projectName: data.projectName,
        projectNumber: data.projectNumber, scheduleName: data.scheduleName,
      } : entry));
    }).catch((error) => {
      success = false;
      setRemoteSaveState("Tallennus epäonnistui");
      setRemoteError(`Muutoksia ei tallennettu: ${error instanceof Error ? error.message : "Tuntematon virhe"}. Vie JSON-varmuuskopio ennen sivun sulkemista.`);
      setRemoteEditable(false);
    });
    await remoteSaveQueue.current;
    return success;
  }

  async function flushRemote(): Promise<boolean> {
    if (remoteSaveTimer.current) clearTimeout(remoteSaveTimer.current);
    if (!activeProjectId) return true;
    if (!remoteEditable) {
      if (remoteHasUnsaved.current && JSON.stringify(currentPayload()) !== remoteLastSaved.current) {
        setRemoteError("Avoimessa aikataulussa on tallentamattomia muutoksia. Vie JSON-varmuuskopio ennen poistumista tai varaa aikataulu uudelleen ja tallenna.");
        return false;
      }
      return true;
    }
    return saveRemote(currentPayload(), activeProjectId);
  }

  function saveCurrentDirectly() {
    if (portalMode) return;
    window.localStorage.setItem(PROJECT_DATA_PREFIX + activeProjectId, JSON.stringify(currentPayload()));
  }

  function refreshCatalog() {
    if (portalMode) {
      void remoteProjects.list().then(({ projects }) => setCatalog(projects)).catch((error) => setRemoteError(error.message));
      return;
    }
    try {
      const entries = JSON.parse(window.localStorage.getItem(PROJECT_INDEX_KEY) || "[]") as ProjectListing[];
      if (Array.isArray(entries)) setCatalog(entries);
    } catch {
      flash("Projektihakemistoa ei voitu avata.");
    }
  }

  function openProjects() {
    refreshCatalog();
    setProjectsOpen(true);
  }

  function applyProject(project: StoredProject, id: string) {
    remoteHasUnsaved.current = false;
    setActiveProjectId(id);
    setProjectNumber(project.projectNumber || "");
    setProjectName(project.projectName || "");
    setScheduleName(project.scheduleName || "Yleisaikataulu");
    setStatusDate(project.statusDate || new Date().toISOString().slice(0, 10));
    setTasks(cloneTasks(project.tasks));
    const datedTasks = project.tasks.filter((task) => task.type !== "summary");
    const source = datedTasks.length ? datedTasks : project.tasks;
    if (source.length) {
      const starts = source.map((task) => task.start).sort();
      const ends = source.map((task) => workdayEnd(task.start, task.duration, project.extraDaysOff ?? [])).sort();
      setRangeStart(addDays(starts[0], -7));
      setRangeEnd(addDays(ends.at(-1)!, 14));
      setFitToWindow(true);
    }
    setSnapshots(Array.isArray(project.snapshots) ? project.snapshots : []);
    setExtraDaysOff(Array.isArray(project.extraDaysOff) ? project.extraDaysOff : []);
    setMilestones(Array.isArray(project.milestones) ? project.milestones : []);
    setUndoStack([]);
    setRedoStack([]);
    setSelectedIds(new Set([project.tasks[0].id]));
    setSelectionAnchorId(project.tasks[0].id);
    setTaskQuery("");
    setTaskFilter("all");
    setProjectsOpen(false);
    setHistoryOpen(false);
    setActiveNav("general");
  }

  function openProject(id: string) {
    if (portalMode) {
      void (async () => {
        const previous = activeProjectId;
        if (!(await flushRemote())) return;
        try {
          const result = await remoteProjects.get(id);
          let editable = false;
          if (remoteContext?.role !== "read") {
            try { await remoteProjects.lock(id); editable = true; } catch { /* Open read-only. */ }
          }
          if (previous && previous !== id) await remoteProjects.unlock(previous).catch(() => {});
          remoteSwitching.current = true;
          remoteRevision.current = result.revision;
          remoteLastSaved.current = JSON.stringify(result.data);
          applyProject(result.data, id);
          setRemoteEditable(editable);
          setRemoteError("");
          setRemoteSaveState(editable ? "Tallennettu palvelimelle" : "Vain katselu");
          queueMicrotask(() => { remoteSwitching.current = false; });
        } catch (error) { setRemoteError(error instanceof Error ? error.message : "Avaaminen epäonnistui."); }
      })();
      return;
    }
    const raw = window.localStorage.getItem(PROJECT_DATA_PREFIX + id);
    if (!raw) {
      flash("Projektin tietoja ei löytynyt tästä selaimesta.");
      return;
    }
    try {
      const project = JSON.parse(raw) as StoredProject;
      if (!Array.isArray(project.tasks) || !project.tasks.length) throw new Error();
      saveCurrentDirectly();
      applyProject(project, id);
    } catch {
      flash("Projektin avaaminen epäonnistui. Nykyinen projekti säilyy.");
    }
  }

  function createProject(number: string, name: string) {
    if (portalMode) {
      if (remoteContext?.role === "read") return;
      void (async () => {
        if (!(await flushRemote())) return;
        const start = new Date().toISOString().slice(0, 10);
        const project: StoredProject = {
          version: 1, projectNumber: number, projectName: name, scheduleName: "Yleisaikataulu", statusDate: start,
          tasks: [{ id: Date.now(), name: "Työvaihe", start: nextWorkday(start), duration: 5, level: 0, type: "task", progress: 0 }],
          snapshots: [], extraDaysOff: [], milestones: [],
        };
        try {
          const created = await remoteProjects.create(project);
          if (activeProjectId) await remoteProjects.unlock(activeProjectId).catch(() => {});
          remoteRevision.current = created.revision;
          remoteLastSaved.current = JSON.stringify(created.data);
          applyProject(created.data, created.id);
          setRemoteEditable(true);
          const { projects } = await remoteProjects.list();
          setCatalog(projects);
          setRemoteError("");
          flash(`Projekti "${name}" tallennettu palvelimelle.`);
        } catch (error) { setRemoteError(error instanceof Error ? error.message : "Luonti epäonnistui."); }
      })();
      return;
    }
    saveCurrentDirectly();
    const id = `work-${Date.now()}`;
    const start = new Date().toISOString().slice(0, 10);
    const project: StoredProject = {
      version: 1,
      projectNumber: number,
      projectName: name,
      scheduleName: "Yleisaikataulu",
      statusDate: start,
      tasks: [{ id: Date.now(), name: "Työvaihe", start: nextWorkday(start), duration: 5, level: 0, type: "task", progress: 0 }],
      snapshots: [],
      extraDaysOff: [],
      milestones: [],
    };
    const entries: ProjectListing[] = [
      ...catalog,
      { id, projectNumber: number, projectName: name, scheduleName: project.scheduleName, updatedAt: new Date().toISOString() },
    ];
    window.localStorage.setItem(PROJECT_DATA_PREFIX + id, JSON.stringify(project));
    window.localStorage.setItem(PROJECT_INDEX_KEY, JSON.stringify(entries));
    setCatalog(entries);
    applyProject(project, id);
    flash(`Projekti "${name}" luotu tähän selaimeen.`);
  }

  function duplicateProject(id: string) {
    if (portalMode) {
      if (remoteContext?.role === "read") return;
      void (async () => {
        if (!(await flushRemote())) return;
        try {
          const original = await remoteProjects.get(id);
          const copy: StoredProject = {
            ...original.data, projectName: `${original.data.projectName} (kopio)`,
            tasks: cloneTasks(original.data.tasks), snapshots: [],
          };
          const created = await remoteProjects.create(copy);
          if (activeProjectId) await remoteProjects.unlock(activeProjectId).catch(() => {});
          remoteRevision.current = created.revision;
          remoteLastSaved.current = JSON.stringify(created.data);
          applyProject(created.data, created.id);
          setRemoteEditable(true);
          const { projects } = await remoteProjects.list();
          setCatalog(projects);
          flash("Kopio tallennettu yrityksen tietokantaan.");
        } catch (error) { setRemoteError(error instanceof Error ? error.message : "Kopiointi epäonnistui."); }
      })();
      return;
    }
    try {
      const original = id === activeProjectId ? currentPayload() : JSON.parse(window.localStorage.getItem(PROJECT_DATA_PREFIX + id) || "null") as StoredProject;
      if (!original || !Array.isArray(original.tasks)) throw new Error();
      saveCurrentDirectly();
      const copyId = `work-${Date.now()}`;
      const copy: StoredProject = { ...original, projectName: original.projectName + " (kopio)", tasks: cloneTasks(original.tasks), snapshots: [] };
      const entries: ProjectListing[] = [
        ...catalog,
        { id: copyId, projectNumber: copy.projectNumber, projectName: copy.projectName, scheduleName: copy.scheduleName, updatedAt: new Date().toISOString() },
      ];
      window.localStorage.setItem(PROJECT_DATA_PREFIX + copyId, JSON.stringify(copy));
      window.localStorage.setItem(PROJECT_INDEX_KEY, JSON.stringify(entries));
      setCatalog(entries);
      applyProject(copy, copyId);
      flash("Aikataulusta luotiin erillinen kopio.");
    } catch {
      flash("Projektin kopiointi epäonnistui.");
    }
  }

  function saveSnapshot(note: string) {
    if (portalMode && !remoteEditable) return;
    const snapshot: TrackingSnapshot = {
      id: `snapshot-${Date.now()}`,
      statusDate,
      createdAt: new Date().toISOString(),
      note,
      completion: pulse.totalProgress,
      tasks: cloneTasks(tasks),
    };
    setSnapshots((current) => [...current, snapshot]);
    flash(portalMode ? "Tilannekuva tallennetaan palvelimelle." : "Työmaakokouksen tilannekuva tallennettu selaimeen.");
  }

  function restoreSnapshot(id: string) {
    if (portalMode && !remoteEditable) return;
    const snapshot = snapshots.find((item) => item.id === id);
    if (!snapshot) return;
    if (!window.confirm("Palautetaanko tämän tilannekuvan aikataulu? Nykyiset työvaiheet korvataan. JSON-varmuuskopiota suositellaan.")) return;
    commit(cloneTasks(snapshot.tasks));
    setStatusDate(snapshot.statusDate);
    setHistoryOpen(false);
    flash("Tilannekuva palautettu.");
  }

  /* Näppäimistöoikotiet eivät korvaa tekstikentän normaalia editointia. */
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const control = event.ctrlKey || event.metaKey;
      const target = event.target as HTMLElement | null;
      const editing = Boolean(target?.closest("input, textarea, select, [contenteditable=true]"));
      if (control && key === "s") {
        event.preventDefault();
        exportJson();
        return;
      }
      if (editing || projectsOpen || historyOpen || viewPanelOpen || calendarOpen || milestonesOpen) return;
      if (control && key === "z" && event.shiftKey) { event.preventDefault(); redo(); }
      else if (control && key === "z") { event.preventDefault(); undo(); }
      else if (control && key === "y") { event.preventDefault(); redo(); }
      else if (control && key === "d") { event.preventDefault(); copyTasks(); }
      else if (!control && (key === "delete" || key === "backspace")) {
        if (window.confirm(`Poistetaanko ${selectedIds.size} valittua työvaihetta?`)) removeTasks();
      } else if (!control && key === "/") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>(".quickbar-search input")?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [tasks, snapshots, selectedIds, undoStack, redoStack, projectsOpen, historyOpen, viewPanelOpen, calendarOpen, milestonesOpen]);
  /* eslint-enable react-hooks/exhaustive-deps */

  function navigate(key: string) {
    setActiveNav(key);
    if (key === "general") return;
    if (key === "tracking") {
      setShowTrackingColumns(true);
      flash("Toteumaseuranta avattu samaan aikataulunäkymään.");
    } else if (key === "calendar") {
      setCalendarOpen(true);
    } else if (key === "versions") {
      setHistoryOpen(true);
    } else if (key === "week") {
      setRangeStart(addDays(statusDate, -7));
      setRangeEnd(addDays(statusDate, 21));
      setTimelineZoom("day");
      setFitToWindow(true);
      flash("Viikkoaikataulun 4 viikon työskentelyalue.");
    } else if (key === "import") {
      jsonInputRef.current?.click();
    } else if (key === "projects") {
      openProjects();
    }
  }

  if (portalMode && !remoteReady) return <main className="snedo-shell"><p role="status">Haetaan yrityksen aikatauluja…</p></main>;

  return (
    <main className="snedo-shell">
      <Sidebar active={activeNav} onNavigate={navigate} portalMode={portalMode} />

      <section className={portalMode && !remoteEditable ? "workspace portal-read-only" : "workspace"}>
        {portalMode && <div className="portal-company-bar">
          <button type="button" onClick={() => { void (async () => {
            if (!await flushRemote()) return;
            if (activeProjectId && remoteEditable) await remoteProjects.unlock(activeProjectId).catch(() => {});
            window.location.href = "/?company=" + encodeURIComponent(new URLSearchParams(window.location.search).get("company") || "");
          })(); }}>← TJT-pääsivulle</button>
          <strong>{remoteContext?.companyName || "TJT-Portaali"}</strong>
          <span>{remoteContext?.userName || "Kirjaudutaan…"}</span>
          <span>{remoteEditable ? remoteSaveState : "Vain katselu"}</span>
          <button type="button" onClick={openProjects}>Kaikki aikataulut</button>
          {remoteEditable && <button type="button" onClick={() => { void flushRemote(); }}>Tallenna nyt</button>}
          {!remoteEditable && activeProjectId && remoteContext?.role !== "read" &&
            <button type="button" onClick={() => { void remoteProjects.lock(activeProjectId).then(() => { setRemoteEditable(true); setRemoteError(""); }).catch((error) => setRemoteError(error.message)); }}>Varaa muokattavaksi</button>}
          {!remoteEditable && activeProjectId && remoteContext?.role === "admin" &&
            <button type="button" onClick={() => {
              if (!window.confirm("Otetaanko muokkausvaraus toiselta käyttäjältä? Hänen tallentamattomat muutoksensa voivat jäädä tallentumatta.")) return;
              void remoteProjects.lock(activeProjectId, true).then(() => { setRemoteEditable(true); setRemoteError(""); }).catch((error) => setRemoteError(error.message));
            }}>Ota muokkaus hallintaan</button>}
        </div>}
        {portalMode && remoteError && <div className="portal-schedule-error" role="alert">{remoteError} <button type="button" onClick={exportJson}>Vie avoin aikataulu JSON-tiedostoksi</button></div>}
        {portalMode && remoteReady && !activeProjectId && <div className="portal-schedule-empty">Yrityksellä ei ole vielä aikatauluja. <button type="button" onClick={openProjects}>Luo ensimmäinen aikataulu</button></div>}
        <div className="workspace-locked-header">
        <TopBar
          readOnly={portalMode && !remoteEditable}
          modeLabel={activeNav === "week" ? "VIIKKONÄKYMÄ" : activeNav === "tracking" ? "TOTEUMASEURANTA" : "YLEISAIKATAULU"}
          onAddTask={addTask}
          onRemoveTask={removeTasks}
          onCopyTask={copyTasks}
          onIndent={indentTasks}
          onOutdent={outdentTasks}
          onMoveUp={() => moveSelected(-1)}
          onMoveDown={() => moveSelected(1)}
          onUndo={undo}
          onRedo={redo}
          canUndo={undoStack.length > 0}
          canRedo={redoStack.length > 0}
          showPlanningColumns={showPlanningColumns}
          showTrackingColumns={showTrackingColumns}
          onCalculateDependencies={calculateDependencies}
          onTogglePlanningColumns={() => setShowPlanningColumns((value) => !value)}
          onToggleTrackingColumns={() => setShowTrackingColumns((value) => !value)}
          onSaveBaseline={saveBaseline}
          onOpenMilestones={() => setMilestonesOpen(true)}
          onOpenView={() => setViewPanelOpen(true)}
          onExportJson={exportJson}
          onImportJson={() => jsonInputRef.current?.click()}
          onExportCsv={exportCsv}
          onImportCsv={() => csvInputRef.current?.click()}
        />

        {message && <div className="schedule-message">{message}</div>}

        <ProjectBar
          readOnly={portalMode && !remoteEditable}
          saveMessage={portalMode ? remoteSaveState : undefined}
          projectNumber={projectNumber}
          projectName={projectName}
          scheduleName={scheduleName}
          statusDate={statusDate}
          onProjectNumberChange={setProjectNumber}
          onProjectNameChange={setProjectName}
          onScheduleNameChange={setScheduleName}
          onStatusDateChange={setStatusDate}
          onShiftStatusDate={(days) => setStatusDate(addDays(statusDate, days))}
        />

        <QuickBar
          search={taskQuery}
          filter={taskFilter}
          pulse={pulse}
          statusDate={statusDate}
          onSearch={setTaskQuery}
          onFilter={setTaskFilter}
          onFit={fitProjectToView}
          onProjects={openProjects}
          onHistory={() => setHistoryOpen(true)}
          onPrint={() => window.print()}
        />

        </div>

        <PrintHeader
          projectNumber={projectNumber}
          projectName={projectName}
          scheduleName={scheduleName}
          statusDate={statusDate}
          updatedDate={new Date().toISOString().slice(0, 10)}
        />

        <PrintReport
          tasks={visibleTasks}
          fullTasks={normalizedTasks}
          projectNumber={projectNumber}
          projectName={projectName}
          scheduleName={scheduleName}
          statusDate={statusDate}
          showBaseline={showBaseline}
          showHierarchyColors={showHierarchyColors}
          hierarchyPalette={hierarchyPalette}
          showTracking={showTrackingColumns}
          extraDaysOff={extraDaysOff}
          milestones={milestones}
        />

        <section
          className="schedule"
          style={{
            gridTemplateColumns: `${tableWidth}px 5px minmax(520px, 1fr)`,
          }}
        >
          <TaskTable
            tasks={normalizedTasks}
            visibleTasks={visibleTasks}
            selectedIds={selectedIds}
            criticalTaskIds={criticalTaskIds}
            behindIds={behindIds}
            showPlanningColumns={showPlanningColumns}
            showTrackingColumns={showTrackingColumns}
            statusDate={statusDate}
            extraDaysOff={extraDaysOff}
            taskNameWidth={taskNameWidth}
            onTaskNameWidthChange={setTaskNameWidth}
            onSelect={selectTask}
            onUpdate={updateTask}
            onToggleCollapse={toggleCollapse}
          />

          <button
            type="button"
            className="pane-resizer"
            aria-label="Muuta taulukon ja janan välistä jakoa"
            onPointerDown={beginPaneResize}
          />

          <GanttChart
            tasks={normalizedTasks}
            visibleTasks={visibleTasks}
            criticalTaskIds={criticalTaskIds}
            selectedIds={selectedIds}
            behindIds={behindIds}
            onSelect={(id) => selectTask(id, { additive: false, range: false })}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            zoom={timelineZoom}
            fitToWindow={fitToWindow}
            showWeekends={showWeekends}
            showToday={showToday}
            statusDate={statusDate}
            showBaseline={showBaseline}
            showHierarchyColors={showHierarchyColors}
            hierarchyPalette={hierarchyPalette}
            showTrackingLine={showTrackingColumns}
            extraDaysOff={extraDaysOff}
            milestones={milestones}
            onUpdate={updateTask}
          />
        </section>

        <ViewPanel
          open={viewPanelOpen}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          zoom={timelineZoom}
          fitToWindow={fitToWindow}
          showWeekends={showWeekends}
          showToday={showToday}
          showBaseline={showBaseline}
          showHierarchyColors={showHierarchyColors}
          hierarchyPalette={hierarchyPalette}
          onClose={() => setViewPanelOpen(false)}
          onRangeStartChange={setRangeStart}
          onRangeEndChange={setRangeEnd}
          onZoomChange={setTimelineZoom}
          onShowWeeks={showWeeks}
          onFitProject={fitProjectToView}
          onFitToWindowChange={setFitToWindow}
          onShowWeekendsChange={setShowWeekends}
          onShowTodayChange={setShowToday}
          onShowBaselineChange={setShowBaseline}
          onShowHierarchyColorsChange={setShowHierarchyColors}
          onHierarchyColorChange={(level, value) => setHierarchyPalette((current) => current.map((color, index) => index === level ? value : color) as HierarchyPalette)}
        />

        <ProjectsPanel
          portalMode={portalMode}
          companyName={remoteContext?.companyName}
          canCreate={!portalMode || remoteContext?.role !== "read"}
          open={projectsOpen}
          catalog={catalog}
          activeId={activeProjectId}
          onClose={() => setProjectsOpen(false)}
          onOpen={openProject}
          onCreate={createProject}
          onDuplicate={duplicateProject}
        />
        <HistoryPanel
          open={historyOpen}
          snapshots={snapshots}
          projectName={projectName}
          pulse={pulse}
          changedCount={changedCount}
          lateTasks={lateTasks}
          onShowLate={() => {
            setTaskFilter("behind");
            setTaskQuery("");
            setHistoryOpen(false);
          }}
          onClose={() => setHistoryOpen(false)}
          onSave={saveSnapshot}
          onRestore={restoreSnapshot}
        />

        {milestonesOpen && <MilestonesPanel
          milestones={milestones}
          initialDate={statusDate}
          onAdd={addMilestone}
          onUpdate={updateMilestone}
          onRemove={removeMilestone}
          onClose={() => setMilestonesOpen(false)}
        />}

        {calendarOpen && <CalendarPanel
          extraDaysOff={extraDaysOff}
          onAdd={(day) => {
            if (extraDaysOff.includes(day)) return;
            const nextDaysOff = [...extraDaysOff, day].sort();
            setExtraDaysOff(nextDaysOff);
            commit((current) => {
              const adjusted = current.map((task) =>
                task.type === "summary" ? task : { ...task, start: nextWorkday(task.start, nextDaysOff) },
              );
              return scheduleDependencies(adjusted, nextDaysOff).tasks;
            });
            flash("Työmaan vapaapäivä lisätty kalenteriin.");
          }}
          onRemove={(day) => {
            const nextDaysOff = extraDaysOff.filter((item) => item !== day);
            setExtraDaysOff(nextDaysOff);
            commit((current) => scheduleDependencies(current, nextDaysOff).tasks);
            flash("Vapaapäivä poistettu kalenterista.");
          }}
          onClose={() => setCalendarOpen(false)}
        />}

        <footer className="statusbar">
          <span>{projectNumber} · {projectName}</span>
          <span>{selectedIds.size} valittu · {visibleTasks.length}/{normalizedTasks.length} riviä · Snedo Aikataulu {portalMode ? "1.6" : "1.5"}</span>
        </footer>

        <input
          ref={jsonInputRef}
          className="hidden-file-input"
          type="file"
          accept=".json,.jana.json,application/json"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importJsonFile(file);
            event.currentTarget.value = "";
          }}
        />
        <input
          ref={csvInputRef}
          className="hidden-file-input"
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importCsvFile(file);
            event.currentTarget.value = "";
          }}
        />
      </section>
    </main>
  );
}

