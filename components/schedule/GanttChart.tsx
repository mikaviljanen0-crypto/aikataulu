import {
  addDays,
  dateOffsetFrom,
  daysBetween,
} from "@/lib/date";
import {
  isWorkday,
  workdayEnd,
  workdaysInclusive,
} from "@/lib/calendar";
import { getWbs } from "@/lib/wbs";
import type { Task } from "@/types/schedule";
import { useEffect, useRef, useState } from "react";
import type { TimelineZoom } from "./TimelineControls";

const ROW_HEIGHT = 28;

const DAY_WIDTHS: Record<TimelineZoom, number> = {
  year: 3,
  month: 7,
  week: 14,
  day: 24,
};

type Props = {
  tasks: Task[];
  visibleTasks: Task[];
  criticalTaskIds: Set<number>;
  rangeStart: string;
  rangeEnd: string;
  zoom: TimelineZoom;
  fitToWindow: boolean;
  showWeekends: boolean;
  showToday: boolean;
  statusDate: string;
  showBaseline: boolean;
  onUpdate: (id: number, patch: Partial<Task>) => void;
};

type DragMode = "move" | "resize-start" | "resize-end";

function isoWeekNumber(date: Date): number {
  const value = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  return Math.ceil(((value.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

export function GanttChart({
  tasks,
  visibleTasks,
  criticalTaskIds,
  rangeStart,
  rangeEnd,
  zoom,
  fitToWindow,
  showWeekends,
  showToday,
  statusDate,
  showBaseline,
  onUpdate,
}: Props) {
  const ganttRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(900);

  useEffect(() => {
    const element = ganttRef.current;
    if (!element) return;
    const update = () => setViewportWidth(element.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const totalDays = Math.max(1, daysBetween(rangeStart, rangeEnd) + 1);
  const dayWidth = fitToWindow
    ? Math.max(1.6, (viewportWidth - 2) / totalDays)
    : DAY_WIDTHS[zoom];
  const chartWidth = fitToWindow
    ? Math.max(viewportWidth, totalDays * dayWidth)
    : totalDays * dayWidth;

  const days = Array.from({ length: totalDays }, (_, index) => {
    const value = addDays(rangeStart, index);
    const date = new Date(`${value}T12:00:00`);
    return {
      iso: value,
      date,
      index,
      monthKey: `${date.getFullYear()}-${date.getMonth()}`,
      monthLabel: date.toLocaleDateString("fi-FI", { month: "long" }),
      weekKey: `${date.getFullYear()}-${isoWeekNumber(date)}`,
      weekLabel: `Vko ${isoWeekNumber(date)}`,
      weekend: date.getDay() === 0 || date.getDay() === 6,
      workday: isWorkday(value),
    };
  });

  const monthSegments = days.reduce<Array<{key:string; label:string; start:number; days:number}>>(
    (segments, day) => {
      const prev = segments.at(-1);
      if (prev?.key === day.monthKey) prev.days += 1;
      else segments.push({ key: day.monthKey, label: day.monthLabel, start: day.index, days: 1 });
      return segments;
    }, [],
  );

  const weekSegments = days.reduce<Array<{key:string; label:string; start:number; days:number}>>(
    (segments, day) => {
      const prev = segments.at(-1);
      if (prev?.key === day.weekKey) prev.days += 1;
      else segments.push({ key: day.weekKey, label: day.weekLabel, start: day.index, days: 1 });
      return segments;
    }, [],
  );

  const todayIso = new Date().toISOString().slice(0, 10);
  const todayOffset = dateOffsetFrom(todayIso, rangeStart);
  const statusOffset = dateOffsetFrom(statusDate, rangeStart);

  const dependencyLines = visibleTasks.flatMap((task, targetIndex) => {
    if (!task.predecessorId) return [];
    const predecessorIndex = visibleTasks.findIndex((item) => item.id === task.predecessorId);
    const predecessor = visibleTasks[predecessorIndex];
    if (!predecessor || predecessorIndex < 0) return [];

    const predecessorEnd = workdayEnd(predecessor.start, predecessor.duration);
    const predecessorEndX =
      (dateOffsetFrom(predecessorEnd, rangeStart) + 1) * dayWidth;
    const targetStartX = dateOffsetFrom(task.start, rangeStart) * dayWidth;
    const predecessorY = predecessorIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
    const targetY = targetIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
    const bendX = Math.max(predecessorEndX + 10, targetStartX - 14);

    return [{
      id: `${predecessor.id}-${task.id}`,
      critical: criticalTaskIds.has(predecessor.id) && criticalTaskIds.has(task.id),
      path: `M ${predecessorEndX} ${predecessorY} H ${bendX} V ${targetY} H ${targetStartX - 4}`,
    }];
  });

  function beginDrag(
    event: React.PointerEvent<HTMLElement>,
    task: Task,
    mode: DragMode,
  ) {
    if (task.type === "summary") return;
    event.preventDefault();
    event.stopPropagation();

    const bar = event.currentTarget.closest(".task-bar") as HTMLDivElement | null;
    if (!bar) return;

    const startX = event.clientX;
    const originalStart = task.start;
    const originalDuration = task.duration;
    const originalEnd = workdayEnd(originalStart, originalDuration);
    const originalCalendarWidth =
      (daysBetween(originalStart, originalEnd) + 1) * dayWidth;

    bar.classList.add("dragging");

    const onMove = (moveEvent: PointerEvent) => {
      const deltaDays = Math.round((moveEvent.clientX - startX) / dayWidth);
      if (mode === "move") {
        bar.style.transform = `translateX(${deltaDays * dayWidth}px)`;
        return;
      }
      if (mode === "resize-end") {
        bar.style.width = `${Math.max(dayWidth, originalCalendarWidth + deltaDays * dayWidth)}px`;
        return;
      }
      bar.style.transform = `translateX(${deltaDays * dayWidth}px)`;
      bar.style.width = `${Math.max(dayWidth, originalCalendarWidth - deltaDays * dayWidth)}px`;
    };

    const onUp = (upEvent: PointerEvent) => {
      const deltaDays = Math.round((upEvent.clientX - startX) / dayWidth);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      bar.classList.remove("dragging");
      bar.style.transform = "";
      bar.style.width = `${originalCalendarWidth}px`;

      if (mode === "move") {
        if (deltaDays !== 0) onUpdate(task.id, { start: addDays(originalStart, deltaDays) });
        return;
      }

      if (mode === "resize-end") {
        const newEnd = addDays(originalEnd, deltaDays);
        onUpdate(task.id, { duration: workdaysInclusive(originalStart, newEnd) });
        return;
      }

      const newStart = addDays(originalStart, deltaDays);
      onUpdate(task.id, {
        start: newStart,
        duration: workdaysInclusive(newStart, originalEnd),
      });
    };

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp, { once: true });
    window.addEventListener("pointercancel", onUp, { once: true });
  }

  const gridStep = dayWidth >= 12 ? dayWidth : dayWidth * 7;

  return (
    <div ref={ganttRef} className={`gantt-pane ${fitToWindow ? "fit-to-window" : ""}`}>
      <div className="calendar-header" style={{ width: chartWidth }}>
        <div className="calendar-month-row">
          {monthSegments.map((segment) => (
            <div
              key={segment.key}
              className="month-segment"
              style={{ left: segment.start * dayWidth, width: segment.days * dayWidth }}
            >
              {segment.label}
            </div>
          ))}
        </div>
        <div className="calendar-week-row">
          {weekSegments.map((segment) => (
            <div
              key={segment.key}
              className="week-segment"
              style={{ left: segment.start * dayWidth, width: segment.days * dayWidth }}
            >
              {segment.days * dayWidth >= 32 ? segment.label : ""}
            </div>
          ))}
        </div>
      </div>

      <div
        className="gantt-body"
        style={{
          width: chartWidth,
          minWidth: chartWidth,
          backgroundSize: `${gridStep}px 100%`,
        }}
      >
        {showWeekends &&
          days.filter((day) => !day.workday).map((day) => (
            <div
              key={day.iso}
              className={day.weekend ? "nonwork-column weekend" : "nonwork-column holiday"}
              style={{
                left: day.index * dayWidth,
                width: dayWidth,
                height: visibleTasks.length * ROW_HEIGHT,
              }}
            />
          ))}

        {showToday && todayOffset >= 0 && todayOffset < totalDays && (
          <div
            className="today-line"
            style={{
              left: todayOffset * dayWidth + dayWidth / 2,
              height: visibleTasks.length * ROW_HEIGHT,
            }}
          />
        )}

        {statusOffset >= 0 && statusOffset < totalDays && (
          <div
            className="status-line"
            style={{
              left: statusOffset * dayWidth + dayWidth / 2,
              height: visibleTasks.length * ROW_HEIGHT,
            }}
          >
            <span>Seuranta</span>
          </div>
        )}

        <svg
          className="dependency-overlay"
          width={chartWidth}
          height={visibleTasks.length * ROW_HEIGHT}
          aria-hidden="true"
        >
          <defs>
            <marker id="dependency-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
              <path d="M0,0 L7,3.5 L0,7 Z" />
            </marker>
          </defs>
          {dependencyLines.map((line) => (
            <path
              key={line.id}
              className={line.critical ? "critical-dependency" : ""}
              d={line.path}
              markerEnd="url(#dependency-arrow)"
            />
          ))}
        </svg>

        {visibleTasks.map((task) => {
          const originalIndex = tasks.findIndex((item) => item.id === task.id);
          const end = workdayEnd(task.start, task.duration);
          const calendarDays = Math.max(1, daysBetween(task.start, end) + 1);
          const left = dateOffsetFrom(task.start, rangeStart) * dayWidth;
          const width = Math.max(dayWidth, calendarDays * dayWidth);

          const baselineEnd =
            task.baselineStart && task.baselineDuration
              ? workdayEnd(task.baselineStart, task.baselineDuration)
              : undefined;
          const baselineWidth =
            task.baselineStart && baselineEnd
              ? Math.max(dayWidth, (daysBetween(task.baselineStart, baselineEnd) + 1) * dayWidth)
              : 0;

          return (
            <div
              className={`gantt-row level-${task.level}`}
              style={{ width: chartWidth }}
              key={task.id}
            >
              {showBaseline && task.baselineStart && baselineEnd && (
                <div
                  className="baseline-bar"
                  style={{
                    left: dateOffsetFrom(task.baselineStart, rangeStart) * dayWidth,
                    width: baselineWidth,
                  }}
                />
              )}

              <div
                className={[
                  "task-bar",
                  `level-${task.level}`,
                  task.type === "summary" ? "summary-bar" : "",
                  criticalTaskIds.has(task.id) ? "critical-bar" : "",
                ].join(" ")}
                style={{ left, width }}
                onPointerDown={(event) => beginDrag(event, task, "move")}
              >
                {task.type !== "summary" && (
                  <>
                    <div
                      className="progress-fill"
                      style={{ width: `${Math.min(100, Math.max(0, task.progress ?? 0))}%` }}
                    />
                    <button
                      type="button"
                      className="resize-handle start"
                      aria-label="Muuta aloitusta"
                      onPointerDown={(event) => beginDrag(event, task, "resize-start")}
                    />
                  </>
                )}

                <strong>{getWbs(tasks, originalIndex)}</strong>

                {task.type !== "summary" && (
                  <button
                    type="button"
                    className="resize-handle end"
                    aria-label="Muuta kestoa"
                    onPointerDown={(event) => beginDrag(event, task, "resize-end")}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
