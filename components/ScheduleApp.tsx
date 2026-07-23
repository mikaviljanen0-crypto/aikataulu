"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addCalendarDays, addWorkdays, daysBetween, formatDate, isoWeek, mondayOfWeek, monthName, parseDate, workdayEnd } from "../lib/calendar";
import { initialWorkspace } from "../lib/sample";
import type { ProjectState, Task, TaskKind, WeeklyPlan, WeeklyPlanItem, WeeklyPlanStatus, WorkspaceState } from "../lib/types";
import { inspectPlr, type PlrReport } from "../lib/plrInspector";
import { comparePlrFiles, rangeLabel, type PlrComparison } from "../lib/plrCompare";

const STORAGE_KEY = "aikataulu-v0.4";
const PX_PER_DAY = 11;
const ROW_HEIGHT = 38;
const DEFAULT_WEEKS_VISIBLE = 22;

function buildWbs(tasks: Task[], index: number): string {
  const counters: number[] = [];
  for (let i = 0; i <= index; i += 1) {
    const level = tasks[i].level;
    counters[level] = (counters[level] ?? 0) + 1;
    counters.length = level + 1;
  }
  return counters.join(".");
}
function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }
function descendants(tasks: Task[], index: number): Task[] {
  const parentLevel = tasks[index].level;
  const result: Task[] = [];
  for (let i = index + 1; i < tasks.length; i += 1) {
    if (tasks[i].level <= parentLevel) break;
    result.push(tasks[i]);
  }
  return result;
}
function normalizedTasks(project: ProjectState): Task[] {
  const { workdays, holidays } = project.calendar;
  const printSettings = workspace.printSettings ?? {
    showWbs: true, showDuration: true, showStart: true, showEnd: true,
    showProgress: true, showLegend: true, fitToOnePage: true,
    pageMode: "one-page" as const,
    rangeStart: mondayOfWeek(project.tasks[0]?.start ?? project.statusDate),
    rangeEnd: addCalendarDays(project.statusDate, 154),
    repeatHeader: true
  };
  const updatePrintSettings = (patch: Partial<typeof printSettings>) =>
    commitWorkspace({ ...workspace, printSettings: { ...printSettings, ...patch } });

  const applyPrintRange = () => {
    const start = mondayOfWeek(printSettings.rangeStart || project.statusDate);
    setCalendarStart(start);
  };

  const useProjectRange = () => {
    const starts = tasks.map((task) => task.start).sort();
    const ends = tasks.map((task) => workdayEnd(task.start, task.duration, workdays, holidays)).sort();
    const rangeStart = mondayOfWeek(starts[0] ?? project.statusDate);
    const rangeEnd = ends[ends.length - 1] ?? project.statusDate;
    updatePrintSettings({ rangeStart, rangeEnd });
    setCalendarStart(rangeStart);
  };
  return project.tasks.map((task, index, tasks) => {
    const children = descendants(tasks, index).filter((child) => child.level === task.level + 1);
    if (children.length === 0) return { ...task, kind: task.kind === "summary" ? "task" : task.kind };
    const earliest = children.reduce((value, child) => child.start < value ? child.start : value, children[0].start);
    const latest = children.reduce((value, child) => {
      const end = workdayEnd(child.start, child.duration, workdays, holidays);
      return end > value ? end : value;
    }, workdayEnd(children[0].start, children[0].duration, workdays, holidays));
    const weighted = children.reduce((sum, child) => sum + child.progress * child.duration, 0);
    const total = children.reduce((sum, child) => sum + child.duration, 0);
    return { ...task, kind: "summary", start: earliest, duration: Math.max(1, daysBetween(earliest, latest) + 1), progress: total ? Math.round(weighted / total) : 0 };
  });
}
function emptyProject(): ProjectState {
  const today = formatDate(new Date());
  return {
    id: crypto.randomUUID(), projectName: "Uusi projekti", scheduleName: "Yleisaikataulu",
    projectNumber: "", client: "", updatedDate: today, statusDate: today, paperSize: "A4",
    calendar: { workdays: [1,2,3,4,5], holidays: [], shutdownPeriods: [] },
    baseline: null, snapshots: [], weeklyPlans: [],
    tasks: [{ id: crypto.randomUUID(), name: "Ensimmäinen työvaihe", level: 0, start: today, duration: 5, progress: 0, kind: "task" }]
  };
}

export function ScheduleApp() {
  const [workspace, setWorkspace] = useState<WorkspaceState>(initialWorkspace);
  const [selectedId, setSelectedId] = useState<string>(initialWorkspace.projects[0].tasks[0].id);
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [snapshotsOpen, setSnapshotsOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [plrOpen, setPlrOpen] = useState(false);
  const [plrReport, setPlrReport] = useState<PlrReport | null>(null);
  const [plrComparison, setPlrComparison] = useState<PlrComparison | null>(null);
  const [plrBusy, setPlrBusy] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [undoStack, setUndoStack] = useState<WorkspaceState[]>([]);
  const [redoStack, setRedoStack] = useState<WorkspaceState[]>([]);
  const [viewMode, setViewMode] = useState<"general" | "weekly">("general");
  const [weeklyStart, setWeeklyStart] = useState(mondayOfWeek(initialWorkspace.projects[0].statusDate));
  const [searchText, setSearchText] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");
  const [collapsedIds, setCollapsedIds] = useState<string[]>([]);
  const [dependencyMessage, setDependencyMessage] = useState("");
  const [savedAt, setSavedAt] = useState("");
  const [calendarStart, setCalendarStart] = useState(mondayOfWeek("2026-07-06"));
  const importRef = useRef<HTMLInputElement>(null);
  const plrRef = useRef<HTMLInputElement>(null);
  const plrCompareRef = useRef<HTMLInputElement>(null);

  const project = workspace.projects.find((item) => item.id === workspace.activeProjectId) ?? workspace.projects[0];

  const commitWorkspace = (next: WorkspaceState | ((current: WorkspaceState) => WorkspaceState)) => {
    setWorkspace((current) => {
      const resolved = typeof next === "function" ? next(current) : next;
      setUndoStack((items) => [...items.slice(-39), current]);
      setRedoStack([]);
      return resolved;
    });
  };

  const undo = () => {
    const previous = undoStack[undoStack.length - 1];
    if (!previous) return;
    setRedoStack((items) => [...items, workspace]);
    setUndoStack((items) => items.slice(0, -1));
    setWorkspace(previous);
  };

  const redo = () => {
    const next = redoStack[redoStack.length - 1];
    if (!next) return;
    setUndoStack((items) => [...items, workspace]);
    setRedoStack((items) => items.slice(0, -1));
    setWorkspace(next);
  };

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as WorkspaceState;
        setWorkspace({
          ...parsed,
          projects: parsed.projects.map((item) => ({ ...item, weeklyPlans: item.weeklyPlans ?? [] }))
        });
      } catch {}
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
    setSavedAt(new Date().toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit" }));
    document.body.dataset.paper = project.paperSize.toLowerCase();
  }, [workspace, project.paperSize]);

  const updateProject = (patch: Partial<ProjectState>) => {
    commitWorkspace((current) => ({ ...current, projects: current.projects.map((item) => item.id === current.activeProjectId ? { ...item, ...patch } : item) }));
  };
  const tasks = useMemo(() => normalizedTasks(project), [project]);
  const selectedIndex = tasks.findIndex((task) => task.id === selectedId);
  const selectedTask = tasks[selectedIndex];
  const { workdays, holidays } = project.calendar;

  const locations = useMemo(
    () => [...new Set(tasks.map((task) => task.location).filter((value): value is string => Boolean(value)))].sort(),
    [tasks]
  );

  const hiddenByCollapse = (index: number): boolean => {
    for (let parentIndex = index - 1; parentIndex >= 0; parentIndex -= 1) {
      if (tasks[parentIndex].level < tasks[index].level) {
        if (collapsedIds.includes(tasks[parentIndex].id)) return true;
        if (tasks[parentIndex].level === 0) break;
      }
    }
    return false;
  };

  const visibleTasks = useMemo(() => tasks.filter((task, index) => {
    if (hiddenByCollapse(index)) return false;
    if (locationFilter !== "all" && task.location !== locationFilter) return false;
    const query = searchText.trim().toLocaleLowerCase("fi-FI");
    if (!query) return true;
    return [task.name, task.location ?? "", task.responsible ?? ""]
      .some((value) => value.toLocaleLowerCase("fi-FI").includes(query));
  }), [tasks, collapsedIds, locationFilter, searchText]);
  const printSettings = workspace.printSettings ?? {
    showWbs: true, showDuration: true, showStart: true, showEnd: true,
    showProgress: true, showLegend: true, fitToOnePage: true,
    pageMode: "one-page" as const,
    rangeStart: mondayOfWeek(project.tasks[0]?.start ?? project.statusDate),
    rangeEnd: addCalendarDays(project.statusDate, 154),
    repeatHeader: true
  };
  const updatePrintSettings = (patch: Partial<typeof printSettings>) =>
    commitWorkspace({ ...workspace, printSettings: { ...printSettings, ...patch } });

  const applyPrintRange = () => {
    const start = mondayOfWeek(printSettings.rangeStart || project.statusDate);
    setCalendarStart(start);
  };

  const useProjectRange = () => {
    const starts = tasks.map((task) => task.start).sort();
    const ends = tasks.map((task) => workdayEnd(task.start, task.duration, workdays, holidays)).sort();
    const rangeStart = mondayOfWeek(starts[0] ?? project.statusDate);
    const rangeEnd = ends[ends.length - 1] ?? project.statusDate;
    updatePrintSettings({ rangeStart, rangeEnd });
    setCalendarStart(rangeStart);
  };

  const visibleWeeks = useMemo(() => {
    if (!printSettings.rangeStart || !printSettings.rangeEnd) return DEFAULT_WEEKS_VISIBLE;
    return Math.max(4, Math.ceil((daysBetween(printSettings.rangeStart, printSettings.rangeEnd) + 1) / 7));
  }, [printSettings.rangeStart, printSettings.rangeEnd]);

  const calendarWeeks = useMemo(() => {
    const start = parseDate(calendarStart);
    return Array.from({ length: visibleWeeks }, (_, index) => {
      const date = new Date(start);
      date.setDate(date.getDate() + index * 7);
      return { date, week: isoWeek(date), month: monthName(date) };
    });
  }, [calendarStart, visibleWeeks]);

  const updateTask = (id: string, patch: Partial<Task>) => updateProject({ tasks: project.tasks.map((task) => task.id === id ? { ...task, ...patch } : task) });

  const addTask = (kind: TaskKind = "task") => {
    const index = Math.max(0, project.tasks.findIndex((task) => task.id === selectedId));
    const previous = project.tasks[index];
    const id = crypto.randomUUID();
    const task: Task = { id, name: kind === "milestone" ? "Uusi välitavoite" : "Uusi työvaihe", level: previous?.level ?? 0, start: previous?.start ?? project.updatedDate, duration: kind === "milestone" ? 1 : 5, progress: 0, kind, location: previous?.location ?? "" };
    const next = [...project.tasks];
    next.splice(index + 1, 0, task);
    setSelectedId(id);
    updateProject({ tasks: next });
  };

  const duplicateTask = () => {
    if (!selectedTask) return;
    const index = project.tasks.findIndex((task) => task.id === selectedId);
    const copy = { ...project.tasks[index], id: crypto.randomUUID(), name: `${project.tasks[index].name} (kopio)` };
    const next = [...project.tasks]; next.splice(index + 1, 0, copy);
    setSelectedId(copy.id); updateProject({ tasks: next });
  };
  const deleteTask = () => {
    if (!selectedTask || tasks.length === 1) return;
    const childIds = new Set(descendants(tasks, selectedIndex).map((task) => task.id));
    if (!window.confirm("Poistetaanko valittu tehtävä ja sen mahdolliset alatehtävät?")) return;
    const nextId = tasks[Math.max(0, selectedIndex - 1)]?.id;
    updateProject({ tasks: project.tasks.filter((task) => task.id !== selectedId && !childIds.has(task.id)) });
    if (nextId) setSelectedId(nextId);
  };
  const moveRow = (direction: -1 | 1) => {
    if (selectedIndex < 0) return;
    const block = [tasks[selectedIndex], ...descendants(tasks, selectedIndex)];
    const ids = new Set(block.map((task) => task.id));
    const remaining = project.tasks.filter((task) => !ids.has(task.id));
    const currentPosition = project.tasks.findIndex((task) => task.id === selectedId);
    const targetPosition = direction < 0 ? Math.max(0, currentPosition - 1) : Math.min(remaining.length, currentPosition + 1);
    remaining.splice(targetPosition, 0, ...block); updateProject({ tasks: remaining });
  };
  const changeIndent = (delta: -1 | 1) => {
    if (!selectedTask) return;
    const maximum = delta > 0 && selectedIndex > 0 ? tasks[selectedIndex - 1].level + 1 : selectedTask.level;
    updateTask(selectedTask.id, { level: clamp(selectedTask.level + delta, 0, maximum) });
  };
  const saveBaseline = () => updateProject({ baseline: Object.fromEntries(tasks.map((task) => [task.id, { start: task.start, duration: task.duration }])) });
  const saveSnapshot = () => {
    const snapshot = { id: crypto.randomUUID(), date: project.statusDate, createdAt: new Date().toISOString(), tasks: tasks.map(({ id, progress, actualStart, actualEnd, forecastEnd, note }) => ({ id, progress, actualStart, actualEnd, forecastEnd, note })) };
    updateProject({ snapshots: [...project.snapshots, snapshot], updatedDate: project.statusDate });
  };
  const restoreSnapshot = (snapshotId: string) => {
    const snapshot = project.snapshots.find((item) => item.id === snapshotId);
    if (!snapshot || !window.confirm(`Palautetaanko seurantatilanne ${snapshot.date}?`)) return;
    const values = new Map(snapshot.tasks.map((task) => [task.id, task]));
    updateProject({ statusDate: snapshot.date, tasks: project.tasks.map((task) => ({ ...task, ...(values.get(task.id) ?? {}) })) });
    setSnapshotsOpen(false);
  };

  const createProject = () => {
    const next = emptyProject();
    commitWorkspace((current) => ({ ...current, activeProjectId: next.id, projects: [...current.projects, next] }));
    setSelectedId(next.tasks[0].id); setProjectsOpen(false); setCalendarStart(mondayOfWeek(next.statusDate));
  };
  const duplicateProject = () => {
    const copy = { ...project, id: crypto.randomUUID(), projectName: `${project.projectName} (kopio)`, tasks: project.tasks.map((task) => ({ ...task, id: crypto.randomUUID() })), snapshots: [] };
    commitWorkspace((current) => ({ ...current, activeProjectId: copy.id, projects: [...current.projects, copy] }));
    setSelectedId(copy.tasks[0].id); setProjectsOpen(false);
  };
  const deleteProject = () => {
    if (workspace.projects.length === 1 || !window.confirm(`Poistetaanko projekti ${project.projectName}?`)) return;
    const remaining = workspace.projects.filter((item) => item.id !== project.id);
    commitWorkspace({ ...workspace, activeProjectId: remaining[0].id, projects: remaining }); setSelectedId(remaining[0].tasks[0]?.id ?? "");
  };

  const exportWorkspace = () => {
    const blob = new Blob([JSON.stringify(workspace, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "aikataulu-tyotila.json"; anchor.click(); URL.revokeObjectURL(url);
  };
  const importWorkspace = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as WorkspaceState;
      if (!Array.isArray(data.projects)) throw new Error();
      setWorkspace(data); setSelectedId(data.projects[0]?.tasks[0]?.id ?? "");
    } catch { window.alert("Työtilatiedostoa ei voitu avata."); }
  };

  const scheduleDependencies = () => {
    const taskMap = new Map(project.tasks.map((task) => [task.id, { ...task }]));
    const visiting = new Set<string>();
    const visited = new Set<string>();
    let changed = 0;
    const errors: string[] = [];

    const resolve = (taskId: string): void => {
      if (visited.has(taskId)) return;
      if (visiting.has(taskId)) {
        errors.push("Riippuvuuksissa on kehä.");
        return;
      }
      const task = taskMap.get(taskId);
      if (!task || !task.predecessorId) {
        visited.add(taskId);
        return;
      }

      visiting.add(taskId);
      resolve(task.predecessorId);
      const predecessor = taskMap.get(task.predecessorId);
      if (!predecessor) {
        errors.push(`Edeltävää tehtävää ei löytynyt: ${task.name}`);
      } else {
        const predecessorEnd = workdayEnd(predecessor.start, predecessor.duration, workdays, holidays);
        const requiredStart = addWorkdays(predecessorEnd, 1 + (task.lagDays ?? 0), workdays, holidays);
        if (task.start !== requiredStart) {
          task.start = requiredStart;
          changed += 1;
        }
      }
      visiting.delete(taskId);
      visited.add(taskId);
    };

    project.tasks.forEach((task) => resolve(task.id));
    updateProject({ tasks: project.tasks.map((task) => taskMap.get(task.id) ?? task) });
    setDependencyMessage(errors.length ? errors.join(" ") : `${changed} tehtävän aloitus päivitettiin.`);
    window.setTimeout(() => setDependencyMessage(""), 5000);
  };

  const weeklyPlans = project.weeklyPlans ?? [];
  const activeWeeklyPlan = weeklyPlans.find((plan) => plan.weekStart === weeklyStart);

  const weekDays = useMemo(
    () => Array.from({ length: 5 }, (_, index) => addCalendarDays(weeklyStart, index)),
    [weeklyStart]
  );

  const taskIntersectsWeek = (task: Task) => {
    const taskEnd = workdayEnd(task.start, task.duration, workdays, holidays);
    const weekEnd = addCalendarDays(weeklyStart, 6);
    return task.start <= weekEnd && taskEnd >= weeklyStart;
  };

  const createWeeklyPlan = () => {
    const sourceTasks = tasks.filter((task) => task.kind !== "summary" && taskIntersectsWeek(task));
    const items: WeeklyPlanItem[] = sourceTasks.map((task) => ({
      id: crypto.randomUUID(),
      sourceTaskId: task.id,
      day: task.start < weeklyStart ? weeklyStart : task.start,
      taskName: task.name,
      location: task.location,
      responsible: task.responsible,
      target: task.progress > 0 ? `Jatka, nykyinen valmius ${task.progress} %` : "Aloita suunnitelman mukaisesti",
      status: task.progress >= 100 ? "done" : task.progress > 0 ? "in-progress" : "planned",
      note: task.note
    }));

    const plan: WeeklyPlan = {
      id: crypto.randomUUID(),
      weekStart: weeklyStart,
      title: `Viikkoaikataulu vko ${isoWeek(parseDate(weeklyStart))}`,
      createdAt: new Date().toISOString(),
      items
    };

    updateProject({ weeklyPlans: [...weeklyPlans.filter((item) => item.weekStart !== weeklyStart), plan] });
  };

  const updateWeeklyPlan = (patch: Partial<WeeklyPlan>) => {
    if (!activeWeeklyPlan) return;
    updateProject({
      weeklyPlans: weeklyPlans.map((plan) => plan.id === activeWeeklyPlan.id ? { ...plan, ...patch } : plan)
    });
  };

  const updateWeeklyItem = (itemId: string, patch: Partial<WeeklyPlanItem>) => {
    if (!activeWeeklyPlan) return;
    updateWeeklyPlan({
      items: activeWeeklyPlan.items.map((item) => item.id === itemId ? { ...item, ...patch } : item)
    });
  };

  const addWeeklyItem = () => {
    if (!activeWeeklyPlan) return;
    updateWeeklyPlan({
      items: [...activeWeeklyPlan.items, {
        id: crypto.randomUUID(),
        day: weeklyStart,
        taskName: "Uusi viikon työtehtävä",
        location: "",
        responsible: "",
        target: "",
        status: "planned"
      }]
    });
  };

  const deleteWeeklyItem = (itemId: string) => {
    if (!activeWeeklyPlan) return;
    updateWeeklyPlan({ items: activeWeeklyPlan.items.filter((item) => item.id !== itemId) });
  };

  const copyWeeklyPlanToNextWeek = (unfinishedOnly: boolean) => {
    if (!activeWeeklyPlan) return;
    const nextStart = addCalendarDays(activeWeeklyPlan.weekStart, 7);
    const existing = weeklyPlans.find((plan) => plan.weekStart === nextStart);
    if (existing && !window.confirm("Seuraavalle viikolle on jo aikataulu. Korvataanko se?")) return;

    const sourceItems = unfinishedOnly
      ? activeWeeklyPlan.items.filter((item) => item.status !== "done")
      : activeWeeklyPlan.items;

    const copiedItems = sourceItems.map((item) => ({
      ...item,
      id: crypto.randomUUID(),
      day: nextStart,
      status: item.status === "blocked" ? "blocked" as const : "planned" as const,
      note: unfinishedOnly
        ? [item.note, "Siirretty edelliseltä viikolta"].filter(Boolean).join(" – ")
        : item.note
    }));

    const nextPlan: WeeklyPlan = {
      id: crypto.randomUUID(),
      weekStart: nextStart,
      title: `Viikkoaikataulu vko ${isoWeek(parseDate(nextStart))}`,
      createdAt: new Date().toISOString(),
      items: copiedItems
    };

    updateProject({
      weeklyPlans: [...weeklyPlans.filter((plan) => plan.weekStart !== nextStart), nextPlan]
    });
    setWeeklyStart(nextStart);
  };

  const updateGeneralFromWeekly = () => {
    if (!activeWeeklyPlan) return;
    const statuses = new Map<string, WeeklyPlanStatus[]>();
    activeWeeklyPlan.items.forEach((item) => {
      if (!item.sourceTaskId) return;
      const list = statuses.get(item.sourceTaskId) ?? [];
      list.push(item.status);
      statuses.set(item.sourceTaskId, list);
    });

    const nextTasks = project.tasks.map((task) => {
      const taskStatuses = statuses.get(task.id);
      if (!taskStatuses?.length) return task;
      if (taskStatuses.every((status) => status === "done")) return { ...task, progress: 100 };
      if (taskStatuses.some((status) => status === "in-progress" || status === "done")) {
        return { ...task, progress: Math.max(task.progress, 25) };
      }
      return task;
    });
    updateProject({ tasks: nextTasks });
  };

  const statusLabel = (status: WeeklyPlanStatus) => ({
    planned: "Suunniteltu",
    "in-progress": "Käynnissä",
    done: "Valmis",
    blocked: "Estynyt"
  }[status]);

  const startOffset = (start: string) => daysBetween(calendarStart, start) * PX_PER_DAY;
  const durationWidth = (task: Pick<Task, "start" | "duration">) => Math.max(PX_PER_DAY, (daysBetween(task.start, workdayEnd(task.start, task.duration, workdays, holidays)) + 1) * PX_PER_DAY);
  const actualWidth = (task: Task) => {
    if (!task.actualStart) return 0;
    if (task.actualEnd) return Math.max(PX_PER_DAY, (daysBetween(task.actualStart, task.actualEnd) + 1) * PX_PER_DAY);
    return Math.max(PX_PER_DAY, durationWidth(task) * task.progress / 100);
  };

  return (
    <div className="app-shell">
      <header className="topbar no-print">
        <div className="brand-block"><strong>Aikataulu</strong><span>{project.projectNumber ? `${project.projectNumber} · ` : ""}{project.projectName}</span></div>
        <div className="toolbar">
          <button onClick={() => setProjectsOpen(true)}>Projektit</button>
          <button className={viewMode === "general" ? "active-view" : ""} onClick={() => setViewMode("general")}>Yleisaikataulu</button>
          <button className={viewMode === "weekly" ? "active-view" : ""} onClick={() => setViewMode("weekly")}>Viikkoaikataulu</button>
          <button onClick={undo} disabled={!undoStack.length}>Kumoa</button>
          <button onClick={redo} disabled={!redoStack.length}>Tee uudelleen</button>
          {viewMode === "general" && (<button onClick={() => addTask()}>+ Tehtävä</button>)}
          {viewMode === "general" && (<button onClick={() => addTask("milestone")}>◇ Välitavoite</button>)}
          {viewMode === "general" && (<button onClick={duplicateTask}>Kopioi</button>)}{viewMode === "general" && (<button onClick={deleteTask}>Poista</button>)}
          {viewMode === "general" && (<button onClick={() => changeIndent(1)}>Sisennä</button>)}{viewMode === "general" && (<button onClick={() => changeIndent(-1)}>Ulonna</button>)}
          {viewMode === "general" && (<button onClick={() => moveRow(-1)}>↑</button>)}{viewMode === "general" && (<button onClick={() => moveRow(1)}>↓</button>)}
          {viewMode === "general" && (<button onClick={saveBaseline}>Tallenna tavoite</button>)}
          {viewMode === "general" && (<button onClick={scheduleDependencies}>Laske riippuvuudet</button>)}
          {viewMode === "general" && (<button className="primary" onClick={() => setTrackingOpen(true)}>Toteumaseuranta</button>)}
          {viewMode === "general" && (<button onClick={() => setSnapshotsOpen(true)}>Historia</button>)}
          {viewMode === "general" && (<button onClick={() => setCalendarOpen(true)}>Kalenteri</button>)}
          {viewMode === "general" && (<button onClick={() => setPlrOpen(true)}>Tocoman-tuonti</button>)}
          <button onClick={() => setPrintOpen(true)}>Tulostusasetukset</button>
          <button onClick={() => window.print()}>Tulosta / PDF</button>
        </div>
      </header>

      <section className="projectbar no-print">
        <label>Projektinumero<input value={project.projectNumber ?? ""} onChange={(e) => updateProject({ projectNumber: e.target.value })} /></label>
        <label>Projekti<input value={project.projectName} onChange={(e) => updateProject({ projectName: e.target.value })} /></label>
        <label>Aikataulu<input value={project.scheduleName} onChange={(e) => updateProject({ scheduleName: e.target.value })} /></label>
        <label>Seurantahetki<input type="date" value={project.statusDate} onChange={(e) => updateProject({ statusDate: e.target.value })} /></label>
        <label>Paperi<select value={project.paperSize} onChange={(e) => updateProject({ paperSize: e.target.value as ProjectState["paperSize"] })}><option value="A4">A4 vaaka</option><option value="A3">A3 vaaka</option></select></label>
        <div className="calendar-controls"><button onClick={() => setCalendarStart(addCalendarDays(calendarStart, -35))}>← 5 vko</button><button onClick={() => setCalendarStart(mondayOfWeek(project.statusDate))}>Seurantahetkeen</button><button onClick={() => setCalendarStart(addCalendarDays(calendarStart, 35))}>5 vko →</button></div>
        <div className="project-actions"><button onClick={exportWorkspace}>Varmuuskopio</button><button onClick={() => importRef.current?.click()}>Palauta</button><input ref={importRef} hidden type="file" accept="application/json" onChange={(e) => e.target.files?.[0] && importWorkspace(e.target.files[0])} /></div>
        <span className="save-state">Tallennettu {savedAt}</span>
      </section>

      {dependencyMessage && <div className="dependency-message no-print">{dependencyMessage}</div>}

      {viewMode === "weekly" && <section className="weekly-toolbar no-print">
        <button onClick={() => setWeeklyStart(addCalendarDays(weeklyStart, -7))}>← Edellinen viikko</button>
        <label>Viikon maanantai<input type="date" value={weeklyStart} onChange={(e) => setWeeklyStart(mondayOfWeek(e.target.value))} /></label>
        <button onClick={() => setWeeklyStart(mondayOfWeek(project.statusDate))}>Seurantahetken viikko</button>
        <button onClick={() => setWeeklyStart(addCalendarDays(weeklyStart, 7))}>Seuraava viikko →</button>
        {!activeWeeklyPlan && <button className="primary" onClick={createWeeklyPlan}>Luo viikkoaikataulu yleisaikataulusta</button>}
        {activeWeeklyPlan && <button onClick={addWeeklyItem}>+ Lisää viikon tehtävä</button>}
        {activeWeeklyPlan && <button onClick={() => copyWeeklyPlanToNextWeek(false)}>Kopioi seuraavalle viikolle</button>}
        {activeWeeklyPlan && <button onClick={() => copyWeeklyPlanToNextWeek(true)}>Siirrä keskeneräiset</button>}
        {activeWeeklyPlan && <button onClick={updateGeneralFromWeekly}>Päivitä yleisaikataulun toteuma</button>}
        <span>vko {isoWeek(parseDate(weeklyStart))}</span>
      </section>}

      {viewMode === "general" && <section className="filterbar no-print">
        <label>Haku<input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Työvaihe, rakennus tai vastuuhenkilö" /></label>
        <label>Rakennus / alue<select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
          <option value="all">Kaikki</option>
          {locations.map((location) => <option key={location} value={location}>{location}</option>)}
        </select></label>
        <button onClick={() => { setSearchText(""); setLocationFilter("all"); }}>Tyhjennä rajaus</button>
        <span>{visibleTasks.length} / {tasks.length} riviä näkyvissä</span>
      </section>}

      <section className={`print-heading ${viewMode === "weekly" ? "weekly-print-heading" : ""}`}><div>{project.projectName}</div><div>{viewMode === "weekly" ? `Viikkoaikataulu vko ${isoWeek(parseDate(weeklyStart))}` : project.scheduleName}</div></section>
      {viewMode === "general" && printSettings.showLegend && <section className="schedule-legend">
        <span><i className="legend-baseline" />Tavoite</span>
        <span><i className="legend-plan" />Suunnitelma / jäljellä</span>
        <span><i className="legend-actual" />Toteutuma</span>
        <span><i className="legend-status" />Seurantahetki</span>
      </section>}

{viewMode === "general" &&       <main className={`schedule-grid ${printSettings.fitToOnePage ? "fit-one-page" : ""} ${printSettings.pageMode === "multi-page" ? "multi-page-print" : ""} ${printSettings.repeatHeader ? "repeat-print-header" : ""}`}>
        <div className="table-pane">
          <table><thead><tr><th className="select-column"></th>{printSettings.showWbs && <th className="wbs-column">Hier</th>}<th>Työvaihe</th><th className="location-column">Rakennus / alue</th><th className="responsible-column">Vastuu</th><th className="predecessor-column">Edeltävä</th><th className="lag-column">Viive</th>{printSettings.showDuration && <th className="duration-column">Kesto</th>}{printSettings.showStart && <th className="date-column">Alku</th>}{printSettings.showEnd && <th className="date-column">Loppu</th>}{printSettings.showProgress && <th className="progress-column">Valmis %</th>}</tr></thead>
            <tbody>{visibleTasks.map((task) => {
              const index = tasks.findIndex((item) => item.id === task.id);
              return (
              <tr key={task.id} className={`${task.kind === "summary" ? "summary-row" : ""} ${task.kind === "milestone" ? "milestone-row" : ""} ${task.id === selectedId ? "selected-row" : ""}`} onClick={() => setSelectedId(task.id)}>
                <td><input type="radio" readOnly checked={task.id === selectedId} /></td>{printSettings.showWbs && <td>{buildWbs(tasks, index)}</td>}
                <td className="task-name-cell">
                  {task.kind === "summary" && <button className="collapse-button" onClick={(event) => { event.stopPropagation(); setCollapsedIds((items) => items.includes(task.id) ? items.filter((id) => id !== task.id) : [...items, task.id]); }}>{collapsedIds.includes(task.id) ? "▸" : "▾"}</button>}
                  <input className="task-name-input" style={{ paddingLeft: 8 + task.level * 18 }} value={task.name} onChange={(e) => updateTask(task.id, { name: e.target.value })} />
                </td>
                <td><input value={task.location ?? ""} onChange={(e) => updateTask(task.id, { location: e.target.value })} /></td>
                <td><input value={task.responsible ?? ""} onChange={(e) => updateTask(task.id, { responsible: e.target.value })} /></td>
                <td><select value={task.predecessorId ?? ""} disabled={task.kind === "summary"} onChange={(e) => updateTask(task.id, { predecessorId: e.target.value || undefined })}>
                  <option value="">–</option>
                  {tasks.filter((candidate) => candidate.id !== task.id && candidate.kind !== "summary").map((candidate, candidateIndex) => <option key={candidate.id} value={candidate.id}>{buildWbs(tasks, candidateIndex)} {candidate.name}</option>)}
                </select></td>
                <td><input type="number" disabled={!task.predecessorId || task.kind === "summary"} value={task.lagDays ?? 0} onChange={(e) => updateTask(task.id, { lagDays: Number(e.target.value) })} /></td>
                {printSettings.showDuration && <td><input type="number" min={1} disabled={task.kind === "summary"} value={task.duration} onChange={(e) => updateTask(task.id, { duration: Math.max(1, Number(e.target.value)) })} /></td>}
                {printSettings.showStart && <td><input type="date" disabled={task.kind === "summary"} value={task.start} onChange={(e) => updateTask(task.id, { start: e.target.value })} /></td>}
                {printSettings.showEnd && <td><input type="date" readOnly value={workdayEnd(task.start, task.duration, workdays, holidays)} /></td>}
                {printSettings.showProgress && <td><input type="number" min={0} max={100} disabled={task.kind === "summary"} value={task.progress} onChange={(e) => updateTask(task.id, { progress: clamp(Number(e.target.value), 0, 100) })} /></td>}
              </tr>
              );
            })}</tbody>
          </table>
        </div>
        <div className="gantt-pane">
          <div className="calendar-header">{calendarWeeks.map(({ week, month }, index) => <div className="calendar-week" key={`${week}-${index}`}><span>{month}</span><strong>vko {week}</strong></div>)}</div>
          <div className="gantt-body" style={{ height: visibleTasks.length * ROW_HEIGHT }}>
            <div className="status-line" style={{ left: startOffset(project.statusDate) }}><span>{project.statusDate}</span></div>
            {calendarWeeks.map(({ date }, index) => date.getDate() <= 7 ? <div className="month-separator" key={`month-${index}`} style={{ left: index * 7 * PX_PER_DAY }} /> : null)}
            {visibleTasks.map((task, visibleIndex) => {
              const index = tasks.findIndex((item) => item.id === task.id);
              const left = startOffset(task.start), width = durationWidth(task), baseline = project.baseline?.[task.id];
              return <div className="gantt-row" style={{ top: visibleIndex * ROW_HEIGHT }} key={task.id}>
                {baseline && <div className="baseline-bar" style={{ left: startOffset(baseline.start), width: durationWidth({ start: baseline.start, duration: baseline.duration }) }} />}
                {task.kind === "milestone" ? <div className="milestone" style={{ left }}>◆</div> :
                  <div
                    className={`task-bar ${task.kind === "summary" ? "summary-bar" : ""}`}
                    style={{ left, width }}
                    onPointerDown={(event) => {
                      if (task.kind === "summary") return;
                      const element = event.currentTarget;
                      const startX = event.clientX;
                      const resize = (event.target as HTMLElement).classList.contains("resize-handle");
                      const originalLeft = left;
                      const originalWidth = width;
                      element.setPointerCapture(event.pointerId);
                      const move = (moveEvent: PointerEvent) => {
                        const delta = Math.round((moveEvent.clientX - startX) / PX_PER_DAY);
                        if (resize) element.style.width = `${Math.max(PX_PER_DAY, originalWidth + delta * PX_PER_DAY)}px`;
                        else element.style.left = `${originalLeft + delta * PX_PER_DAY}px`;
                      };
                      const up = (upEvent: PointerEvent) => {
                        const delta = Math.round((upEvent.clientX - startX) / PX_PER_DAY);
                        element.removeEventListener("pointermove", move);
                        element.removeEventListener("pointerup", up);
                        if (resize) updateTask(task.id, { duration: Math.max(1, task.duration + delta) });
                        else updateTask(task.id, { start: addWorkdays(task.start, delta, workdays, holidays) });
                      };
                      element.addEventListener("pointermove", move);
                      element.addEventListener("pointerup", up);
                    }}
                  >
                    <span>{buildWbs(tasks, index)}</span>
                    <div className="planned-fill" />
                    {task.kind !== "summary" && <button className="resize-handle" aria-label="Muuta kestoa" />}
                  </div>}
                {task.actualStart && task.kind !== "summary" && (
                  <div className="actual-bar" style={{ left: startOffset(task.actualStart), width: actualWidth(task) }} title={`Toteutuma ${task.progress}%`} />
                )}
              </div>;
            })}
          </div>
        </div>
      </main>}

      {viewMode === "weekly" && <main className="weekly-plan-view">
        {!activeWeeklyPlan ? (
          <section className="weekly-empty">
            <h2>Viikkoaikataulua ei ole vielä luotu</h2>
            <p>Luo viikkoaikataulu yleisaikataulun niistä työvaiheista, jotka osuvat valitulle viikolle. Rivejä voidaan sen jälkeen tarkentaa vapaasti.</p>
            <button className="primary" onClick={createWeeklyPlan}>Luo viikkoaikataulu vko {isoWeek(parseDate(weeklyStart))}</button>
          </section>
        ) : (
          <>
            <section className="weekly-plan-header">
              <input value={activeWeeklyPlan.title} onChange={(e) => updateWeeklyPlan({ title: e.target.value })} />
              <span>{weeklyStart} – {addCalendarDays(weeklyStart, 6)}</span>
            </section>
            <table className="weekly-table">
              <thead><tr><th>Päivä</th><th>Työtehtävä</th><th>Rakennus / alue</th><th>Vastuu</th><th>Viikon tavoite</th><th>Tila</th><th>Huomautus</th><th className="no-print"></th></tr></thead>
              <tbody>
                {activeWeeklyPlan.items.map((item) => <tr key={item.id} className={`weekly-status-${item.status}`}>
                  <td><select value={item.day} onChange={(e) => updateWeeklyItem(item.id, { day: e.target.value })}>
                    {weekDays.map((day) => <option key={day} value={day}>{parseDate(day).toLocaleDateString("fi-FI", { weekday: "short", day: "numeric", month: "numeric" })}</option>)}
                  </select></td>
                  <td><textarea value={item.taskName} onChange={(e) => updateWeeklyItem(item.id, { taskName: e.target.value })} />{item.sourceTaskId && <small className="source-task-note">Yhdistetty yleisaikatauluun</small>}</td>
                  <td><input value={item.location ?? ""} onChange={(e) => updateWeeklyItem(item.id, { location: e.target.value })} /></td>
                  <td><input value={item.responsible ?? ""} onChange={(e) => updateWeeklyItem(item.id, { responsible: e.target.value })} /></td>
                  <td><textarea value={item.target ?? ""} onChange={(e) => updateWeeklyItem(item.id, { target: e.target.value })} /></td>
                  <td><select value={item.status} onChange={(e) => updateWeeklyItem(item.id, { status: e.target.value as WeeklyPlanStatus })}>
                    {(["planned","in-progress","done","blocked"] as WeeklyPlanStatus[]).map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
                  </select></td>
                  <td><textarea value={item.note ?? ""} onChange={(e) => updateWeeklyItem(item.id, { note: e.target.value })} /></td>
                  <td className="no-print"><button className="danger compact-button" onClick={() => deleteWeeklyItem(item.id)}>Poista</button></td>
                </tr>)}
              </tbody>
            </table>
            <section className="weekly-summary">
              <span>Tehtäviä {activeWeeklyPlan.items.length}</span>
              <span>Valmiita {activeWeeklyPlan.items.filter((item) => item.status === "done").length}</span>
              <span>Estyneitä {activeWeeklyPlan.items.filter((item) => item.status === "blocked").length}</span>
            </section>
          </>
        )}
      </main>}

      <footer className="print-footer"><span>Päivitetty: {project.updatedDate}</span><span>{viewMode === "weekly" ? `Viikko ${isoWeek(parseDate(weeklyStart))}` : `Seurantahetki: ${project.statusDate}`}</span></footer>

      {trackingOpen && <div className="drawer-backdrop no-print"><aside className="tracking-drawer"><header><div><strong>Toteumaseuranta</strong><span>Seurantahetki {project.statusDate}</span></div><button onClick={() => setTrackingOpen(false)}>×</button></header>
        <div className="tracking-actions"><button className="primary" onClick={saveSnapshot}>Tallenna seurantatilanne</button><span>Tilanteita {project.snapshots.length}</span></div>
        <div className="tracking-list">{visibleTasks.filter((task) => task.kind !== "summary").map((task) => <article key={task.id}><strong>{task.name}</strong>
          <label>Valmiusaste<input type="range" min={0} max={100} value={task.progress} onChange={(e) => updateTask(task.id, { progress: Number(e.target.value) })} /><output>{task.progress}%</output></label>
          <label>Toteutunut alku<input type="date" value={task.actualStart ?? ""} onChange={(e) => updateTask(task.id, { actualStart: e.target.value })} /></label>
          <label>Toteutunut loppu<input type="date" value={task.actualEnd ?? ""} onChange={(e) => updateTask(task.id, { actualEnd: e.target.value, progress: e.target.value ? 100 : task.progress })} /></label>
          <label>Ennustettu loppu<input type="date" value={task.forecastEnd ?? ""} onChange={(e) => updateTask(task.id, { forecastEnd: e.target.value })} /></label>
          <label>Huomautus<textarea value={task.note ?? ""} onChange={(e) => updateTask(task.id, { note: e.target.value })} /></label>
        </article>)}</div></aside></div>}

      {snapshotsOpen && <div className="drawer-backdrop no-print"><aside className="tracking-drawer compact-drawer"><header><div><strong>Seurantahistoria</strong><span>Työmaakokousten tilanteet</span></div><button onClick={() => setSnapshotsOpen(false)}>×</button></header><div className="snapshot-list">
        {project.snapshots.length === 0 && <p>Seurantatilanteita ei ole vielä tallennettu.</p>}
        {[...project.snapshots].reverse().map((snapshot) => <article key={snapshot.id}><div><strong>{snapshot.date}</strong><span>{new Date(snapshot.createdAt).toLocaleString("fi-FI")}</span></div><button onClick={() => restoreSnapshot(snapshot.id)}>Palauta</button></article>)}
      </div></aside></div>}

      {projectsOpen && <div className="drawer-backdrop no-print"><aside className="tracking-drawer project-drawer"><header><div><strong>Projektit</strong><span>{workspace.projects.length} projektia</span></div><button onClick={() => setProjectsOpen(false)}>×</button></header>
        <div className="project-list">{workspace.projects.map((item) => <button key={item.id} className={item.id === project.id ? "active-project" : ""} onClick={() => { setWorkspace({ ...workspace, activeProjectId: item.id }); setSelectedId(item.tasks[0]?.id ?? ""); setProjectsOpen(false); setCalendarStart(mondayOfWeek(item.statusDate)); }}><strong>{item.projectName}</strong><span>{item.projectNumber || "Ei projektinumeroa"} · {item.scheduleName}</span></button>)}</div>
        <div className="drawer-footer"><button className="primary" onClick={createProject}>+ Uusi tyhjä projekti</button><button onClick={duplicateProject}>Kopioi projekti</button><button className="danger" onClick={deleteProject}>Poista projekti</button></div>
      </aside></div>}

      {calendarOpen && <div className="drawer-backdrop no-print"><aside className="tracking-drawer compact-drawer"><header><div><strong>Projektikalenteri</strong><span>Työpäivät ja poikkeukset</span></div><button onClick={() => setCalendarOpen(false)}>×</button></header>
        <div className="calendar-panel"><h3>Työviikko</h3><div className="weekday-list">{["Su","Ma","Ti","Ke","To","Pe","La"].map((name, day) => <label key={day}><input type="checkbox" checked={project.calendar.workdays.includes(day)} onChange={(e) => updateProject({ calendar: { ...project.calendar, workdays: e.target.checked ? [...project.calendar.workdays, day].sort() : project.calendar.workdays.filter((value) => value !== day) } })} />{name}</label>)}</div>
          <h3>Vapaapäivä</h3><div className="inline-form"><input id="holiday-date" type="date" /><button onClick={() => { const input = document.querySelector<HTMLInputElement>("#holiday-date"); if (input?.value && !project.calendar.holidays.includes(input.value)) updateProject({ calendar: { ...project.calendar, holidays: [...project.calendar.holidays, input.value].sort() } }); }}>Lisää</button></div>
          <div className="holiday-list">{project.calendar.holidays.map((date) => <span key={date}>{date}<button onClick={() => updateProject({ calendar: { ...project.calendar, holidays: project.calendar.holidays.filter((item) => item !== date) } })}>×</button></span>)}</div>
        </div>
      </aside></div>}

      {printOpen && <div className="drawer-backdrop no-print"><aside className="tracking-drawer compact-drawer"><header><div><strong>Tulostusasetukset</strong><span>A4- ja A3-seurantatuloste</span></div><button onClick={() => setPrintOpen(false)}>×</button></header>
        <div className="print-settings-panel">
          <label><input type="checkbox" checked={printSettings.showWbs} onChange={(e) => updatePrintSettings({ showWbs: e.target.checked })} /> Hierarkianumerot</label>
          <label><input type="checkbox" checked={printSettings.showDuration} onChange={(e) => updatePrintSettings({ showDuration: e.target.checked })} /> Kesto</label>
          <label><input type="checkbox" checked={printSettings.showStart} onChange={(e) => updatePrintSettings({ showStart: e.target.checked })} /> Aloituspäivä</label>
          <label><input type="checkbox" checked={printSettings.showEnd} onChange={(e) => updatePrintSettings({ showEnd: e.target.checked })} /> Lopetuspäivä</label>
          <label><input type="checkbox" checked={printSettings.showProgress} onChange={(e) => updatePrintSettings({ showProgress: e.target.checked })} /> Valmiusaste</label>
          <label><input type="checkbox" checked={printSettings.showLegend} onChange={(e) => updatePrintSettings({ showLegend: e.target.checked })} /> Selite</label>
          <label><input type="checkbox" checked={printSettings.fitToOnePage} onChange={(e) => updatePrintSettings({ fitToOnePage: e.target.checked })} /> Sovita yhdelle sivulle</label>
          <label><input type="checkbox" checked={printSettings.repeatHeader} onChange={(e) => updatePrintSettings({ repeatHeader: e.target.checked })} /> Toista otsikkorivi monisivutulosteessa</label>

          <div className="print-range-box">
            <strong>Tulostettava aikaväli</strong>
            <label>Alku<input type="date" value={printSettings.rangeStart} onChange={(e) => updatePrintSettings({ rangeStart: e.target.value })} /></label>
            <label>Loppu<input type="date" value={printSettings.rangeEnd} onChange={(e) => updatePrintSettings({ rangeEnd: e.target.value })} /></label>
            <div><button onClick={useProjectRange}>Koko projektin aikaväli</button><button onClick={applyPrintRange}>Näytä aikaväli</button></div>
          </div>

          <div className="print-page-mode">
            <strong>Sivutus</strong>
            <label><input type="radio" name="pageMode" checked={printSettings.pageMode === "one-page"} onChange={() => updatePrintSettings({ pageMode: "one-page", fitToOnePage: true })} /> Yksi sivu</label>
            <label><input type="radio" name="pageMode" checked={printSettings.pageMode === "multi-page"} onChange={() => updatePrintSettings({ pageMode: "multi-page", fitToOnePage: false })} /> Useita sivuja</label>
          </div>

          <div className="print-preview-card">
            <strong>{project.paperSize} vaaka · {printSettings.pageMode === "one-page" ? "1 sivu" : "monisivu"}</strong>
            <span>{project.projectName}</span>
            <span>{visibleTasks.length} riviä · {visibleWeeks} viikkoa</span>
            <span>{printSettings.rangeStart} – {printSettings.rangeEnd}</span>
          </div>
          <button className="primary" onClick={() => { applyPrintRange(); setPrintOpen(false); setTimeout(() => window.print(), 80); }}>Avaa tulostus / PDF</button>
        </div>
      </aside></div>}

      {plrOpen && <div className="drawer-backdrop no-print"><aside className="tracking-drawer plr-drawer"><header><div><strong>Tocoman .plr -analyysi</strong><span>Ensimmäinen vaihe vanhojen aikataulujen tuontiin</span></div><button onClick={() => setPlrOpen(false)}>×</button></header>
        <div className="plr-panel">
          <p>Valitse Tocomanin <code>.plr</code>-tiedosto. Analyysi tehdään vain selaimessa, eikä tiedostoa muuteta.</p>
          <div className="plr-actions">
            <button className="primary" onClick={() => plrRef.current?.click()}>Analysoi yksi tiedosto</button>
            <button onClick={() => plrCompareRef.current?.click()}>Vertaa useita .plr-tiedostoja</button>
          </div>
          <input ref={plrRef} hidden type="file" accept=".plr,application/octet-stream" onChange={async (event) => {
            const file = event.target.files?.[0];
            if (file) {
              setPlrComparison(null);
              setPlrReport(await inspectPlr(file));
            }
          }} />
          <input ref={plrCompareRef} hidden multiple type="file" accept=".plr,application/octet-stream" onChange={async (event) => {
            const files = [...(event.target.files ?? [])];
            if (files.length >= 2) {
              setPlrBusy(true);
              setPlrReport(null);
              try { setPlrComparison(await comparePlrFiles(files)); }
              finally { setPlrBusy(false); }
            } else if (files.length === 1) {
              window.alert("Valitse vähintään kaksi .plr-tiedostoa vertailuun.");
            }
          }} />
          {plrBusy && <p><strong>Analysoidaan tiedostoja…</strong></p>}
          {plrReport && <div className="plr-report">
            <h3>{plrReport.fileName}</h3>
            <dl><dt>Koko</dt><dd>{Math.round(plrReport.fileSize / 1024)} kt</dd><dt>OLE-säiliö</dt><dd>{plrReport.isCompoundFile ? "Kyllä" : "Ei"}</dd></dl>
            <h4>Tunnistetut versio- ja tietovirrat</h4>
            <ul>{plrReport.probableVersionNames.length ? plrReport.probableVersionNames.map((value) => <li key={value}>{value}</li>) : <li>Ei vielä tunnistettuja nimiä.</li>}</ul>
            <h4>Tekstinäytteet</h4>
            <div className="string-samples">{plrReport.textSamples.slice(0, 35).map((value, index) => <code key={`${value}-${index}`}>{value}</code>)}</div>
            <h4>Johtopäätökset</h4>
            <ul>{plrReport.notes.map((value) => <li key={value}>{value}</li>)}</ul>
          </div>}
          {plrComparison && <div className="plr-report comparison-report">
            <h3>Binäärivertailu</h3>
            <p>Vertailun lähtötiedosto: <strong>{plrComparison.baseline}</strong>. Tiedostojen järjestys määräytyy valintaikkunan järjestyksen mukaan.</p>
            <div className="file-summary-grid">
              {plrComparison.files.map((file) => <article key={file.name}>
                <strong>{file.name}</strong>
                <span>{Math.round(file.size / 1024)} kt</span>
                <span>{file.ole ? "OLE tunnistettu" : "Ei OLE-tunnistusta"}</span>
                <code>{file.checksum.slice(0, 16)}…</code>
              </article>)}
            </div>
            {plrComparison.comparisons.map((comparison) => <section className="comparison-item" key={comparison.file}>
              <h4>{comparison.file} verrattuna tiedostoon {plrComparison.baseline}</h4>
              <dl>
                <dt>Kokoero</dt><dd>{comparison.sizeDifference >= 0 ? "+" : ""}{comparison.sizeDifference} tavua</dd>
                <dt>Muuttuneita tavuja</dt><dd>{comparison.changedBytes}</dd>
                <dt>Muutosalueita</dt><dd>{comparison.changedRanges.length} suurinta näytetään</dd>
              </dl>
              <details>
                <summary>Suurimmat muuttuneet alueet</summary>
                <ol>{comparison.changedRanges.map((range, index) => <li key={`${range.start}-${index}`}><code>{rangeLabel(range)}</code></li>)}</ol>
              </details>
              <details>
                <summary>Lisätyt tekstijonot ({comparison.addedStrings.length})</summary>
                <div className="string-samples">{comparison.addedStrings.map((value, index) => <code key={`${value}-${index}`}>{value}</code>)}</div>
              </details>
              <details>
                <summary>Poistuneet tekstijonot ({comparison.removedStrings.length})</summary>
                <div className="string-samples">{comparison.removedStrings.map((value, index) => <code key={`${value}-${index}`}>{value}</code>)}</div>
              </details>
            </section>)}
          </div>}
        </div>
      </aside></div>}
    </div>
  );
}
