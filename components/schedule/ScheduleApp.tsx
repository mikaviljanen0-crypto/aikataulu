"use client";

import { useEffect, useMemo, useState } from "react";
import { initialTasks } from "@/data/sampleTasks";
import { getCriticalTaskIds } from "@/lib/criticalPath";
import { scheduleDependencies } from "@/lib/dependencies";
import {
  getDescendantIndexes,
  isHiddenByCollapsedParent,
  normalizeSummaries,
} from "@/lib/wbs";
import type { Task } from "@/types/schedule";
import { addDays, endDateIso, maxIsoDate, minIsoDate } from "@/lib/date";
import { GanttChart } from "./GanttChart";
import type { TimelineZoom } from "./TimelineControls";
import { ViewPanel } from "./ViewPanel";
import { ProjectBar } from "./ProjectBar";
import { TaskTable } from "./TaskTable";
import { TopBar } from "./TopBar";

const STORAGE_KEY = "aikataulu-project-v0.4.0";
const VIEW_STORAGE_KEY = "aikataulu-view-v0.4.0";

export default function ScheduleApp() {
  const [projectName, setProjectName] = useState("As Oy Kissankello");
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [selectedId, setSelectedId] = useState(initialTasks[0].id);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");
  const [tableWidth, setTableWidth] = useState(680);
  const [taskNameWidth, setTaskNameWidth] = useState(280);
  const [showPlanningColumns, setShowPlanningColumns] = useState(false);
  const [rangeStart, setRangeStart] = useState("2026-07-01");
  const [rangeEnd, setRangeEnd] = useState("2026-09-30");
  const [timelineZoom, setTimelineZoom] = useState<TimelineZoom>("week");
  const [viewPanelOpen, setViewPanelOpen] = useState(false);
  const [fitToWindow, setFitToWindow] = useState(true);
  const [showWeekends, setShowWeekends] = useState(true);
  const [showToday, setShowToday] = useState(true);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);

    if (saved) {
      try {
        const parsed = JSON.parse(saved) as {
          projectName: string;
          tasks: Task[];
        };

        setProjectName(parsed.projectName);
        setTasks(parsed.tasks);
        setSelectedId(parsed.tasks[0]?.id ?? initialTasks[0].id);
      } catch {
        // Virheellinen tallennus ohitetaan.
      }
    }

    const savedView = window.localStorage.getItem(VIEW_STORAGE_KEY);

    if (savedView) {
      try {
        const parsedView = JSON.parse(savedView) as {
          tableWidth?: number;
          taskNameWidth?: number;
          showPlanningColumns?: boolean;
          rangeStart?: string;
          rangeEnd?: string;
          timelineZoom?: TimelineZoom;
          fitToWindow?: boolean;
          showWeekends?: boolean;
          showToday?: boolean;
        };

        setTableWidth(parsedView.tableWidth ?? 680);
        setTaskNameWidth(parsedView.taskNameWidth ?? 280);
        setShowPlanningColumns(parsedView.showPlanningColumns ?? false);
        setRangeStart(parsedView.rangeStart ?? "2026-07-01");
        setRangeEnd(parsedView.rangeEnd ?? "2026-09-30");
        setTimelineZoom(parsedView.timelineZoom ?? "week");
        setFitToWindow(parsedView.fitToWindow ?? true);
        setShowWeekends(parsedView.showWeekends ?? true);
        setShowToday(parsedView.showToday ?? true);
      } catch {
        // Virheellinen näkymäasetus ohitetaan.
      }
    }

    setLoaded(true);
  }, []);

  const normalizedTasks = useMemo(() => normalizeSummaries(tasks), [tasks]);

  const criticalTaskIds = useMemo(
    () => getCriticalTaskIds(normalizedTasks),
    [normalizedTasks],
  );

  const visibleTasks = useMemo(
    () =>
      normalizedTasks.filter(
        (_, index) => !isHiddenByCollapsedParent(normalizedTasks, index),
      ),
    [normalizedTasks],
  );

  useEffect(() => {
    if (!loaded) return;

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        projectName,
        tasks: normalizedTasks,
      }),
    );
  }, [loaded, projectName, normalizedTasks]);

  useEffect(() => {
    if (!loaded) return;

    window.localStorage.setItem(
      VIEW_STORAGE_KEY,
      JSON.stringify({
        tableWidth,
        taskNameWidth,
        showPlanningColumns,
        rangeStart,
        rangeEnd,
        timelineZoom,
        fitToWindow,
        showWeekends,
        showToday,
      }),
    );
  }, [
    loaded,
    tableWidth,
    taskNameWidth,
    showPlanningColumns,
    rangeStart,
    rangeEnd,
    timelineZoom,
    fitToWindow,
    showWeekends,
    showToday,
  ]);

  function updateTask(id: number, patch: Partial<Task>) {
    setTasks((current) => {
      const next = current.map((task) =>
        task.id === id ? { ...task, ...patch } : task,
      );

      const affectsSchedule =
        "start" in patch ||
        "duration" in patch ||
        "predecessorId" in patch ||
        "lagDays" in patch;

      if (!affectsSchedule) return next;

      const result = scheduleDependencies(next);

      if (result.errors.length) {
        setMessage(result.errors.join(" "));
        window.setTimeout(() => setMessage(""), 5000);
        return next;
      }

      return result.tasks;
    });
  }

  function selectedIndex() {
    return tasks.findIndex((task) => task.id === selectedId);
  }

  function addTask() {
    const index = selectedIndex();
    const selected = tasks[index];
    const id = Date.now();

    const newTask: Task = {
      id,
      name: "Uusi työvaihe",
      start: selected?.start ?? "2026-07-06",
      duration: 5,
      level: selected?.level ?? 0,
      type: "task",
    };

    setTasks((current) => {
      const next = [...current];
      next.splice(Math.max(0, index + 1), 0, newTask);
      return next;
    });

    setSelectedId(id);
  }

  function removeTask() {
    const index = selectedIndex();
    if (index < 0 || tasks.length === 1) return;

    const descendants = new Set(getDescendantIndexes(tasks, index));
    const next = tasks.filter(
      (_, taskIndex) => taskIndex !== index && !descendants.has(taskIndex),
    );

    setTasks(next);
    setSelectedId(next[Math.max(0, index - 1)]?.id ?? next[0].id);
  }

  function indentTask() {
    const index = selectedIndex();
    if (index <= 0) return;

    const previous = tasks[index - 1];
    const current = tasks[index];
    const maximumLevel = previous.level + 1;

    updateTask(current.id, {
      level: Math.min(current.level + 1, maximumLevel),
    });
  }

  function outdentTask() {
    const index = selectedIndex();
    if (index < 0) return;

    const current = tasks[index];
    updateTask(current.id, { level: Math.max(0, current.level - 1) });
  }

  function moveSelected(direction: -1 | 1) {
    const index = selectedIndex();
    if (index < 0) return;

    const blockIndexes = [index, ...getDescendantIndexes(tasks, index)];
    const block = blockIndexes.map((taskIndex) => tasks[taskIndex]);
    const blockSet = new Set(blockIndexes);
    const remaining = tasks.filter((_, taskIndex) => !blockSet.has(taskIndex));

    const insertIndex =
      direction > 0
        ? Math.min(remaining.length, index + 1)
        : Math.max(0, index - 1);

    remaining.splice(insertIndex, 0, ...block);
    setTasks(remaining);
  }

  function toggleCollapse(id: number) {
    updateTask(id, {
      collapsed: !tasks.find((task) => task.id === id)?.collapsed,
    });
  }


  function showWeeks(weeks: number) {
    setRangeEnd(addDays(rangeStart, weeks * 7 - 1));
  }

  function fitProjectToView() {
    const normalTasks = normalizedTasks.filter(
      (task) => task.type !== "summary",
    );

    if (!normalTasks.length) return;

    const start = minIsoDate(normalTasks.map((task) => task.start));
    const end = maxIsoDate(
      normalTasks.map((task) => endDateIso(task.start, task.duration)),
    );

    setRangeStart(addDays(start, -7));
    setRangeEnd(addDays(end, 14));
  }

  function beginPaneResize(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();

    const startX = event.clientX;
    const startWidth = tableWidth;

    const onMove = (moveEvent: PointerEvent) => {
      const nextWidth = Math.min(
        window.innerWidth - 360,
        Math.max(390, startWidth + moveEvent.clientX - startX),
      );
      setTableWidth(nextWidth);
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  }

  function calculateDependencies() {
    const result = scheduleDependencies(normalizedTasks);
    setTasks(result.tasks);

    if (result.errors.length) {
      setMessage(result.errors.join(" "));
    } else {
      setMessage(
        result.changedCount
          ? `${result.changedCount} tehtävän aloitus päivitettiin.`
          : "Riippuvuudet ovat ajan tasalla.",
      );
    }

    window.setTimeout(() => setMessage(""), 5000);
  }

  function resetExample() {
    if (!window.confirm("Palautetaanko esimerkkidata?")) return;

    setProjectName("As Oy Kissankello");
    setTasks(initialTasks);
    setSelectedId(initialTasks[0].id);
    window.localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <main className="app-shell">
      <TopBar
        onAddTask={addTask}
        onRemoveTask={removeTask}
        onIndent={indentTask}
        onOutdent={outdentTask}
        onMoveUp={() => moveSelected(-1)}
        onMoveDown={() => moveSelected(1)}
        showPlanningColumns={showPlanningColumns}
        onCalculateDependencies={calculateDependencies}
        onTogglePlanningColumns={() => setShowPlanningColumns((current) => !current)}
        onOpenView={() => setViewPanelOpen(true)}
        onReset={resetExample}
      />

      {message && <div className="schedule-message">{message}</div>}

      <ProjectBar
        projectName={projectName}
        onProjectNameChange={setProjectName}
      />

      <section
        className="schedule"
        style={{ gridTemplateColumns: `${tableWidth}px 8px minmax(520px, 1fr)` }}
      >
        <TaskTable
          tasks={normalizedTasks}
          visibleTasks={visibleTasks}
          selectedId={selectedId}
          criticalTaskIds={criticalTaskIds}
          showPlanningColumns={showPlanningColumns}
          taskNameWidth={taskNameWidth}
          onTaskNameWidthChange={setTaskNameWidth}
          onSelect={setSelectedId}
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
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          zoom={timelineZoom}
          fitToWindow={fitToWindow}
          showWeekends={showWeekends}
          showToday={showToday}
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
        onClose={() => setViewPanelOpen(false)}
        onRangeStartChange={setRangeStart}
        onRangeEndChange={setRangeEnd}
        onZoomChange={setTimelineZoom}
        onShowWeeks={showWeeks}
        onFitProject={fitProjectToView}
        onFitToWindowChange={setFitToWindow}
        onShowWeekendsChange={setShowWeekends}
        onShowTodayChange={setShowToday}
      />

      <footer>
        <span>{projectName}</span>
        <span>Yleisaikataulu · kehitysversio 0.4.0</span>
      </footer>
    </main>
  );
}
