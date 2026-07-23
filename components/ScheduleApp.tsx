"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addWorkdays, daysBetween, isoWeek, mondayOfWeek, monthName, parseDate, workdayEnd } from "../lib/calendar";
import { initialProject } from "../lib/sample";
import type { ProjectState, Task } from "../lib/types";

const STORAGE_KEY = "aikataulu-v0.2";
const PX_PER_DAY = 11;
const ROW_HEIGHT = 38;
const CALENDAR_HEIGHT = 58;
const WEEKS_VISIBLE = 20;

function buildWbs(tasks: Task[], index: number): string {
  const counters: number[] = [];
  for (let i = 0; i <= index; i += 1) {
    const level = tasks[i].level;
    counters[level] = (counters[level] ?? 0) + 1;
    counters.length = level + 1;
  }
  return counters.join(".");
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function ScheduleApp() {
  const [project, setProject] = useState<ProjectState>(initialProject);
  const [selectedId, setSelectedId] = useState<string>(initialProject.tasks[0].id);
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [savedAt, setSavedAt] = useState<string>("");
  const [calendarStart, setCalendarStart] = useState(mondayOfWeek("2026-07-06"));
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setProject(JSON.parse(stored) as ProjectState);
      } catch {
        // Keep the bundled sample if local data is invalid.
      }
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    setSavedAt(new Date().toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit" }));
    document.body.dataset.paper = project.paperSize.toLowerCase();
  }, [project]);

  const selectedIndex = project.tasks.findIndex((task) => task.id === selectedId);
  const selectedTask = project.tasks[selectedIndex];

  const calendarWeeks = useMemo(() => {
    const start = parseDate(calendarStart);
    return Array.from({ length: WEEKS_VISIBLE }, (_, index) => {
      const date = new Date(start);
      date.setDate(date.getDate() + index * 7);
      return { date, week: isoWeek(date), month: monthName(date) };
    });
  }, [calendarStart]);

  const updateTask = (id: string, patch: Partial<Task>) => {
    setProject((current) => ({
      ...current,
      tasks: current.tasks.map((task) => (task.id === id ? { ...task, ...patch } : task))
    }));
  };

  const addTask = () => {
    setProject((current) => {
      const index = Math.max(0, current.tasks.findIndex((task) => task.id === selectedId));
      const previous = current.tasks[index];
      const id = crypto.randomUUID();
      const task: Task = {
        id,
        name: "Uusi työvaihe",
        level: previous?.level ?? 0,
        start: previous?.start ?? current.updatedDate,
        duration: 5,
        progress: 0,
        color: "task"
      };
      const tasks = [...current.tasks];
      tasks.splice(index + 1, 0, task);
      setSelectedId(id);
      return { ...current, tasks };
    });
  };

  const deleteTask = () => {
    if (!selectedTask || project.tasks.length === 1) return;
    const nextIndex = Math.max(0, selectedIndex - 1);
    const nextId = project.tasks[nextIndex]?.id;
    setProject((current) => ({ ...current, tasks: current.tasks.filter((task) => task.id !== selectedId) }));
    if (nextId) setSelectedId(nextId);
  };

  const moveRow = (direction: -1 | 1) => {
    if (selectedIndex < 0) return;
    const target = selectedIndex + direction;
    if (target < 0 || target >= project.tasks.length) return;
    setProject((current) => {
      const tasks = [...current.tasks];
      [tasks[selectedIndex], tasks[target]] = [tasks[target], tasks[selectedIndex]];
      return { ...current, tasks };
    });
  };

  const changeIndent = (delta: -1 | 1) => {
    if (!selectedTask) return;
    const maximum = delta > 0 && selectedIndex > 0 ? project.tasks[selectedIndex - 1].level + 1 : selectedTask.level;
    updateTask(selectedTask.id, { level: clamp(selectedTask.level + delta, 0, maximum) });
  };

  const saveBaseline = () => {
    const baseline = Object.fromEntries(project.tasks.map((task) => [task.id, { start: task.start, duration: task.duration }]));
    setProject((current) => ({ ...current, baseline }));
  };

  const saveSnapshot = () => {
    const snapshot = {
      id: crypto.randomUUID(),
      date: project.statusDate,
      createdAt: new Date().toISOString(),
      tasks: project.tasks.map(({ id, progress, actualStart, actualEnd, forecastEnd, note }) => ({
        id,
        progress,
        actualStart,
        actualEnd,
        forecastEnd,
        note
      }))
    };
    setProject((current) => ({ ...current, snapshots: [...current.snapshots, snapshot], updatedDate: current.statusDate }));
  };

  const exportProject = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${project.projectName.replace(/[^a-z0-9åäö]+/gi, "-").toLowerCase()}-aikataulu.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importProject = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as ProjectState;
      if (!Array.isArray(data.tasks)) throw new Error("Virheellinen tiedosto");
      setProject(data);
      setSelectedId(data.tasks[0]?.id ?? "");
    } catch {
      window.alert("Projektitiedostoa ei voitu avata.");
    }
  };

  const startOffset = (start: string) => daysBetween(calendarStart, start) * PX_PER_DAY;
  const durationWidth = (task: Pick<Task, "start" | "duration">) => {
    const end = workdayEnd(task.start, task.duration);
    return Math.max(PX_PER_DAY, (daysBetween(task.start, end) + 1) * PX_PER_DAY);
  };

  const statusOffset = startOffset(project.statusDate);

  return (
    <div className="app-shell">
      <header className="topbar no-print">
        <div className="brand-block">
          <strong>Aikataulu</strong>
          <span>Rakennusalan tuotannonsuunnittelu</span>
        </div>
        <div className="toolbar">
          <button onClick={addTask}>+ Tehtävä</button>
          <button onClick={deleteTask}>Poista</button>
          <button onClick={() => changeIndent(1)}>Sisennä</button>
          <button onClick={() => changeIndent(-1)}>Ulonna</button>
          <button onClick={() => moveRow(-1)}>↑</button>
          <button onClick={() => moveRow(1)}>↓</button>
          <button onClick={saveBaseline}>Tallenna tavoite</button>
          <button className="primary" onClick={() => setTrackingOpen(true)}>Toteumaseuranta</button>
          <button onClick={() => window.print()}>Tulosta / PDF</button>
        </div>
      </header>

      <section className="projectbar no-print">
        <label>
          Projekti
          <input value={project.projectName} onChange={(event) => setProject({ ...project, projectName: event.target.value })} />
        </label>
        <label>
          Aikataulu
          <input value={project.scheduleName} onChange={(event) => setProject({ ...project, scheduleName: event.target.value })} />
        </label>
        <label>
          Seurantahetki
          <input type="date" value={project.statusDate} onChange={(event) => setProject({ ...project, statusDate: event.target.value })} />
        </label>
        <label>
          Paperi
          <select value={project.paperSize} onChange={(event) => setProject({ ...project, paperSize: event.target.value as ProjectState["paperSize"] })}>
            <option value="A4">A4 vaaka</option>
            <option value="A3">A3 vaaka</option>
          </select>
        </label>
        <div className="project-actions">
          <button onClick={exportProject}>Vie JSON</button>
          <button onClick={() => importRef.current?.click()}>Avaa JSON</button>
          <input ref={importRef} hidden type="file" accept="application/json" onChange={(event) => event.target.files?.[0] && importProject(event.target.files[0])} />
        </div>
        <span className="save-state">Tallennettu {savedAt}</span>
      </section>

      <section className="print-heading">
        <div>{project.projectName}</div>
        <div>{project.scheduleName}</div>
      </section>

      <main className="schedule-grid">
        <div className="table-pane">
          <table>
            <thead>
              <tr>
                <th className="select-column"></th>
                <th className="wbs-column">Hier</th>
                <th>Työvaihe</th>
                <th className="duration-column">Kesto</th>
                <th className="date-column">Alku</th>
                <th className="progress-column">Valmis %</th>
              </tr>
            </thead>
            <tbody>
              {project.tasks.map((task, index) => (
                <tr key={task.id} className={`${task.color === "summary" ? "summary-row" : ""} ${task.id === selectedId ? "selected-row" : ""}`} onClick={() => setSelectedId(task.id)}>
                  <td><input type="radio" readOnly checked={task.id === selectedId} /></td>
                  <td>{buildWbs(project.tasks, index)}</td>
                  <td>
                    <input
                      className="task-name-input"
                      style={{ paddingLeft: 8 + task.level * 18 }}
                      value={task.name}
                      onChange={(event) => updateTask(task.id, { name: event.target.value })}
                    />
                  </td>
                  <td><input type="number" min={1} value={task.duration} onChange={(event) => updateTask(task.id, { duration: Math.max(1, Number(event.target.value)) })} /></td>
                  <td><input type="date" value={task.start} onChange={(event) => updateTask(task.id, { start: event.target.value })} /></td>
                  <td><input type="number" min={0} max={100} value={task.progress} onChange={(event) => updateTask(task.id, { progress: clamp(Number(event.target.value), 0, 100) })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="gantt-pane">
          <div className="calendar-header">
            {calendarWeeks.map(({ date, week, month }, index) => (
              <div className="calendar-week" key={`${week}-${index}`}>
                <span>{month}</span>
                <strong>vko {week}</strong>
              </div>
            ))}
          </div>
          <div className="gantt-body" style={{ height: project.tasks.length * ROW_HEIGHT }}>
            <div className="status-line" style={{ left: statusOffset }} />
            {project.tasks.map((task, index) => {
              const baseline = project.baseline?.[task.id];
              return (
                <div className="gantt-row" style={{ top: index * ROW_HEIGHT }} key={task.id}>
                  {baseline && (
                    <div className="baseline-bar" style={{ left: startOffset(baseline.start), width: durationWidth({ ...task, ...baseline }) }} />
                  )}
                  <div
                    className={`task-bar ${task.color === "summary" ? "summary-bar" : ""}`}
                    style={{ left: startOffset(task.start), width: durationWidth(task) }}
                    onPointerDown={(event) => {
                      const target = event.currentTarget;
                      const startX = event.clientX;
                      const originalStart = task.start;
                      target.setPointerCapture(event.pointerId);
                      target.onpointermove = (moveEvent) => {
                        const delta = Math.round((moveEvent.clientX - startX) / PX_PER_DAY);
                        target.style.transform = `translateX(${delta * PX_PER_DAY}px)`;
                      };
                      target.onpointerup = (upEvent) => {
                        const delta = Math.round((upEvent.clientX - startX) / PX_PER_DAY);
                        target.style.transform = "";
                        target.onpointermove = null;
                        target.onpointerup = null;
                        if (delta !== 0) updateTask(task.id, { start: addWorkdays(originalStart, delta) });
                      };
                    }}
                  >
                    <div className="actual-progress" style={{ width: `${task.progress}%` }} />
                    <span>{buildWbs(project.tasks, index)}</span>
                    <button
                      className="resize-handle"
                      aria-label="Muuta kestoa"
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        const target = event.currentTarget.parentElement as HTMLDivElement;
                        const startX = event.clientX;
                        const originalDuration = task.duration;
                        target.setPointerCapture(event.pointerId);
                        target.onpointermove = (moveEvent) => {
                          const delta = Math.round((moveEvent.clientX - startX) / PX_PER_DAY);
                          target.style.width = `${durationWidth(task) + delta * PX_PER_DAY}px`;
                        };
                        target.onpointerup = (upEvent) => {
                          const delta = Math.round((upEvent.clientX - startX) / PX_PER_DAY);
                          target.style.width = `${durationWidth(task)}px`;
                          target.onpointermove = null;
                          target.onpointerup = null;
                          updateTask(task.id, { duration: Math.max(1, originalDuration + delta) });
                        };
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      <footer className="print-footer">
        <span>Laatinut:</span>
        <span>Päivitetty: {project.updatedDate.split("-").reverse().join(".")}</span>
        <span>Sivu 1/1</span>
      </footer>

      {trackingOpen && (
        <div className="drawer-backdrop no-print" onMouseDown={() => setTrackingOpen(false)}>
          <aside className="tracking-drawer" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <strong>Toteumaseuranta</strong>
                <span>Seurantahetki {project.statusDate.split("-").reverse().join(".")}</span>
              </div>
              <button onClick={() => setTrackingOpen(false)}>×</button>
            </header>
            <div className="tracking-actions">
              <button className="primary" onClick={saveSnapshot}>Tallenna seurantatilanne</button>
              <span>{project.snapshots.length} tallennettua tilannetta</span>
            </div>
            <div className="tracking-list">
              {project.tasks.filter((task) => task.color !== "summary").map((task) => (
                <article key={task.id}>
                  <strong>{task.name}</strong>
                  <label>Valmiusaste <input type="range" min={0} max={100} value={task.progress} onChange={(event) => updateTask(task.id, { progress: Number(event.target.value) })} /><output>{task.progress} %</output></label>
                  <label>Toteutunut alku <input type="date" value={task.actualStart ?? ""} onChange={(event) => updateTask(task.id, { actualStart: event.target.value })} /></label>
                  <label>Toteutunut loppu <input type="date" value={task.actualEnd ?? ""} onChange={(event) => updateTask(task.id, { actualEnd: event.target.value, progress: event.target.value ? 100 : task.progress })} /></label>
                  <label>Ennustettu loppu <input type="date" value={task.forecastEnd ?? ""} onChange={(event) => updateTask(task.id, { forecastEnd: event.target.value })} /></label>
                  <label>Huomautus <textarea value={task.note ?? ""} onChange={(event) => updateTask(task.id, { note: event.target.value })} /></label>
                </article>
              ))}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
