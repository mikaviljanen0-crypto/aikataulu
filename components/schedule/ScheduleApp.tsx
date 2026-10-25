"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { initialTasks } from "@/data/sampleTasks";
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
import type { ProjectListing, StoredProject, TrackingSnapshot } from "@/types/workspace";

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
  const [activeNav, setActiveNav] = useState("general");
  const [taskQuery, setTaskQuery] = useState("");
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("all");
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState("main-project");
  const [catalog, setCatalog] = useState<ProjectListing[]>([]);
  const [snapshots, setSnapshots] = useState<TrackingSnapshot[]>([]);
  const [extraDaysOff, setExtraDaysOff] = useState<string[]>([]);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const jsonInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  /* LocalStorage hydration intentionally restores the persisted project once on mount. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
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
    const payload: StoredProject = {
      version: 1,
      projectNumber,
      projectName,
      scheduleName,
      statusDate,
      tasks,
      snapshots,
      extraDaysOff,
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
  }, [loaded, activeProjectId, projectNumber, projectName, scheduleName, statusDate, tasks, snapshots, extraDaysOff]);

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
    taskFilter,
  ]);

  function flash(text: string) {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 3200);
  }

  function commit(next: Task[] | ((current: Task[]) => Task[])) {
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
    const indexes = tasks
      .map((task, index) => (selectedIds.has(task.id) ? index : -1))
      .filter((index) => index >= 0);
    if (!indexes.length) return;

    const insertAt = Math.max(...indexes) + 1;
    const stamp = Date.now();
    const copies = indexes.map((index, offset) => ({
      ...tasks[index],
      id: stamp + offset,
      name: `${tasks[index].name} – kopio`,
      predecessorId: undefined,
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
    if (index < 0) return;
    const blockIndexes = [index, ...getDescendantIndexes(tasks, index)];
    const block = blockIndexes.map((i) => tasks[i]);
    const blockSet = new Set(blockIndexes);
    const remaining = tasks.filter((_, i) => !blockSet.has(i));
    const insertIndex =
      direction > 0
        ? Math.min(remaining.length, index + 1)
        : Math.max(0, index - 1);
    remaining.splice(insertIndex, 0, ...block);
    commit(remaining);
  }

  function toggleCollapse(id: number) {
    updateTask(id, {
      collapsed: !tasks.find((task) => task.id === id)?.collapsed,
    });
  }

  function undo() {
    if (!undoStack.length) return;
    const previous = undoStack.at(-1)!;
    setRedoStack((stack) => [...stack, cloneTasks(tasks)]);
    setTasks(cloneTasks(previous));
    setUndoStack((stack) => stack.slice(0, -1));
  }

  function redo() {
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

  function showWeeks(weeks: number) {
    setRangeEnd(addDays(rangeStart, weeks * 7 - 1));
  }

  function fitProjectToView() {
    const normal = normalizedTasks.filter((task) => task.type !== "summary");
    if (!normal.length) return;
    const start = minIsoDate(normal.map((task) => task.start));
    const end = maxIsoDate(normal.map((task) => workdayEnd(task.start, task.duration, extraDaysOff)));
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
    };
    download(
      `${projectNumber}-${scheduleName.replaceAll(" ", "_")}.jana.json`,
      JSON.stringify(payload, null, 2),
      "application/json",
    );
  }

  async function importJsonFile(file: File) {
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
    return { version: 1, projectNumber, projectName, scheduleName, statusDate, tasks: cloneTasks(tasks), snapshots, extraDaysOff };
  }

  function saveCurrentDirectly() {
    window.localStorage.setItem(PROJECT_DATA_PREFIX + activeProjectId, JSON.stringify(currentPayload()));
  }

  function refreshCatalog() {
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
    setActiveProjectId(id);
    setProjectNumber(project.projectNumber || "");
    setProjectName(project.projectName || "");
    setScheduleName(project.scheduleName || "Yleisaikataulu");
    setStatusDate(project.statusDate || new Date().toISOString().slice(0, 10));
    setTasks(cloneTasks(project.tasks));
    setSnapshots(Array.isArray(project.snapshots) ? project.snapshots : []);
    setExtraDaysOff(Array.isArray(project.extraDaysOff) ? project.extraDaysOff : []);
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
    const snapshot: TrackingSnapshot = {
      id: `snapshot-${Date.now()}`,
      statusDate,
      createdAt: new Date().toISOString(),
      note,
      completion: pulse.totalProgress,
      tasks: cloneTasks(tasks),
    };
    setSnapshots((current) => [...current, snapshot]);
    flash("Työmaakokouksen tilannekuva tallennettu selaimeen.");
  }

  function restoreSnapshot(id: string) {
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
      if (editing || projectsOpen || historyOpen || viewPanelOpen || calendarOpen) return;
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
  }, [tasks, snapshots, selectedIds, undoStack, redoStack, projectsOpen, historyOpen, viewPanelOpen, calendarOpen]);
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

  return (
    <main className="snedo-shell">
      <Sidebar active={activeNav} onNavigate={navigate} />

      <section className="workspace">
        <TopBar
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
          onOpenView={() => setViewPanelOpen(true)}
          onExportJson={exportJson}
          onImportJson={() => jsonInputRef.current?.click()}
          onExportCsv={exportCsv}
          onImportCsv={() => csvInputRef.current?.click()}
        />

        {message && <div className="schedule-message">{message}</div>}

        <ProjectBar
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
          showTracking={showTrackingColumns}
          extraDaysOff={extraDaysOff}
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
            showTrackingLine={showTrackingColumns}
            extraDaysOff={extraDaysOff}
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
        />

        <ProjectsPanel
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

        <CalendarPanel
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
        />

        <footer className="statusbar">
          <span>{projectNumber} · {projectName}</span>
          <span>{selectedIds.size} valittu · {visibleTasks.length}/{normalizedTasks.length} riviä · Snedo Aikataulu 1.1 (testi)</span>
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
