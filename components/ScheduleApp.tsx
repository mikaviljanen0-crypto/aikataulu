"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addWorkdays, daysBetween, formatDate, isoWeek, mondayOfWeek, monthName, parseDate, workdayEnd } from "../lib/calendar";
import { initialProject } from "../lib/sample";
import type { ProjectState, Task, TaskKind } from "../lib/types";

const STORAGE_KEY = "aikataulu-v0.3";
const PX_PER_DAY = 11;
const ROW_HEIGHT = 38;
const WEEKS_VISIBLE = 22;

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

function descendants(tasks: Task[], index: number): Task[] {
  const parentLevel = tasks[index].level;
  const result: Task[] = [];
  for (let i = index + 1; i < tasks.length; i += 1) {
    if (tasks[i].level <= parentLevel) break;
    result.push(tasks[i]);
  }
  return result;
}

function normalizedTasks(tasks: Task[]): Task[] {
  return tasks.map((task, index) => {
    const children = descendants(tasks, index).filter((child) => child.level === task.level + 1);
    if (children.length === 0) return { ...task, kind: task.kind === "summary" ? "task" : task.kind };

    const earliest = children.reduce((value, child) => child.start < value ? child.start : value, children[0].start);
    const latest = children.reduce((value, child) => {
      const end = workdayEnd(child.start, child.duration);
      return end > value ? end : value;
    }, workdayEnd(children[0].start, children[0].duration));
    const weighted = children.reduce((sum, child) => sum + child.progress * child.duration, 0);
    const total = children.reduce((sum, child) => sum + child.duration, 0);
    return {
      ...task,
      kind: "summary",
      start: earliest,
      duration: Math.max(1, daysBetween(earliest, latest) + 1),
      progress: total ? Math.round(weighted / total) : 0
    };
  });
}

export function ScheduleApp() {
  const [project, setProject] = useState<ProjectState>(initialProject);
  const [selectedId, setSelectedId] = useState<string>(initialProject.tasks[0].id);
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [snapshotsOpen, setSnapshotsOpen] = useState(false);
  const [savedAt, setSavedAt] = useState("");
  const [calendarStart, setCalendarStart] = useState(mondayOfWeek("2026-07-06"));
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try { setProject(JSON.parse(stored) as ProjectState); } catch {}
    }
  }, []);

  useEffect(() => {
    const next = { ...project, tasks: normalizedTasks(project.tasks) };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSavedAt(new Date().toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit" }));
    document.body.dataset.paper = project.paperSize.toLowerCase();
  }, [project]);

  const tasks = useMemo(() => normalizedTasks(project.tasks), [project.tasks]);
  const selectedIndex = tasks.findIndex((task) => task.id === selectedId);
  const selectedTask = tasks[selectedIndex];

  const calendarWeeks = useMemo(() => {
    const start = parseDate(calendarStart);
    return Array.from({ length: WEEKS_VISIBLE }, (_, index) => {
      const date = new Date(start);
      date.setDate(date.getDate() + index * 7);
      return { date, week: isoWeek(date), month: monthName(date) };
    });
  }, [calendarStart]);

  const updateTask = (id: string, patch: Partial<Task>) => {
    setProject((current) => ({ ...current, tasks: current.tasks.map((task) => task.id === id ? { ...task, ...patch } : task) }));
  };

  const addTask = (kind: TaskKind = "task") => {
    setProject((current) => {
      const index = Math.max(0, current.tasks.findIndex((task) => task.id === selectedId));
      const previous = current.tasks[index];
      const id = crypto.randomUUID();
      const task: Task = {
        id,
        name: kind === "milestone" ? "Uusi välitavoite" : "Uusi työvaihe",
        level: previous?.level ?? 0,
        start: previous?.start ?? current.updatedDate,
        duration: kind === "milestone" ? 1 : 5,
        progress: 0,
        kind
      };
      const next = [...current.tasks];
      next.splice(index + 1, 0, task);
      setSelectedId(id);
      return { ...current, tasks: next };
    });
  };

  const duplicateTask = () => {
    if (!selectedTask) return;
    setProject((current) => {
      const index = current.tasks.findIndex((task) => task.id === selectedId);
      const copy = { ...current.tasks[index], id: crypto.randomUUID(), name: `${current.tasks[index].name} (kopio)` };
      const next = [...current.tasks];
      next.splice(index + 1, 0, copy);
      setSelectedId(copy.id);
      return { ...current, tasks: next };
    });
  };

  const deleteTask = () => {
    if (!selectedTask || tasks.length === 1) return;
    const childIds = new Set(descendants(tasks, selectedIndex).map((task) => task.id));
    const count = childIds.size + 1;
    if (!window.confirm(`Poistetaanko valittu rivi${count > 1 ? ` ja ${count - 1} alariviä` : ""}?`)) return;
    const nextId = tasks[Math.max(0, selectedIndex - 1)]?.id;
    setProject((current) => ({ ...current, tasks: current.tasks.filter((task) => task.id !== selectedId && !childIds.has(task.id)) }));
    if (nextId) setSelectedId(nextId);
  };

  const moveRow = (direction: -1 | 1) => {
    if (selectedIndex < 0) return;
    const block = [tasks[selectedIndex], ...descendants(tasks, selectedIndex)];
    const ids = new Set(block.map((task) => task.id));
    const remaining = project.tasks.filter((task) => !ids.has(task.id));
    const currentPosition = project.tasks.findIndex((task) => task.id === selectedId);
    const targetPosition = direction < 0
      ? Math.max(0, remaining.findIndex((_, index) => index >= currentPosition - 1))
      : Math.min(remaining.length, currentPosition + 1);
    remaining.splice(targetPosition, 0, ...block);
    setProject((current) => ({ ...current, tasks: remaining }));
  };

  const changeIndent = (delta: -1 | 1) => {
    if (!selectedTask) return;
    const maximum = delta > 0 && selectedIndex > 0 ? tasks[selectedIndex - 1].level + 1 : selectedTask.level;
    updateTask(selectedTask.id, { level: clamp(selectedTask.level + delta, 0, maximum) });
  };

  const saveBaseline = () => {
    const baseline = Object.fromEntries(tasks.map((task) => [task.id, { start: task.start, duration: task.duration }]));
    setProject((current) => ({ ...current, baseline }));
  };

  const saveSnapshot = () => {
    const snapshot = {
      id: crypto.randomUUID(),
      date: project.statusDate,
      createdAt: new Date().toISOString(),
      tasks: tasks.map(({ id, progress, actualStart, actualEnd, forecastEnd, note }) => ({ id, progress, actualStart, actualEnd, forecastEnd, note }))
    };
    setProject((current) => ({ ...current, snapshots: [...current.snapshots, snapshot], updatedDate: current.statusDate }));
  };

  const restoreSnapshot = (snapshotId: string) => {
    const snapshot = project.snapshots.find((item) => item.id === snapshotId);
    if (!snapshot || !window.confirm(`Palautetaanko seurantatilanne ${snapshot.date}?`)) return;
    const values = new Map(snapshot.tasks.map((task) => [task.id, task]));
    setProject((current) => ({
      ...current,
      statusDate: snapshot.date,
      tasks: current.tasks.map((task) => ({ ...task, ...(values.get(task.id) ?? {}) }))
    }));
    setSnapshotsOpen(false);
  };

  const exportProject = () => {
    const blob = new Blob([JSON.stringify({ ...project, tasks }, null, 2)], { type: "application/json" });
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
      if (!Array.isArray(data.tasks)) throw new Error();
      setProject(data);
      setSelectedId(data.tasks[0]?.id ?? "");
    } catch {
      window.alert("Projektitiedostoa ei voitu avata.");
    }
  };

  const startOffset = (start: string) => daysBetween(calendarStart, start) * PX_PER_DAY;
  const durationWidth = (task: Pick<Task, "start" | "duration">) =>
    Math.max(PX_PER_DAY, (daysBetween(task.start, workdayEnd(task.start, task.duration)) + 1) * PX_PER_DAY);

  return (
    <div className="app-shell">
      <header className="topbar no-print">
        <div className="brand-block"><strong>Aikataulu</strong><span>Rakennusalan tuotannonsuunnittelu</span></div>
        <div className="toolbar">
          <button onClick={() => addTask()}>+ Tehtävä</button>
          <button onClick={() => addTask("milestone")}>◇ Välitavoite</button>
          <button onClick={duplicateTask}>Kopioi</button>
          <button onClick={deleteTask}>Poista</button>
          <button onClick={() => changeIndent(1)}>Sisennä</button>
          <button onClick={() => changeIndent(-1)}>Ulonna</button>
          <button onClick={() => moveRow(-1)}>↑</button>
          <button onClick={() => moveRow(1)}>↓</button>
          <button onClick={saveBaseline}>Tallenna tavoite</button>
          <button className="primary" onClick={() => setTrackingOpen(true)}>Toteumaseuranta</button>
          <button onClick={() => setSnapshotsOpen(true)}>Seurantahistoria</button>
          <button onClick={() => window.print()}>Tulosta / PDF</button>
        </div>
      </header>

      <section className="projectbar no-print">
        <label>Projekti<input value={project.projectName} onChange={(e) => setProject({ ...project, projectName: e.target.value })} /></label>
        <label>Aikataulu<input value={project.scheduleName} onChange={(e) => setProject({ ...project, scheduleName: e.target.value })} /></label>
        <label>Seurantahetki<input type="date" value={project.statusDate} onChange={(e) => setProject({ ...project, statusDate: e.target.value })} /></label>
        <label>Paperi<select value={project.paperSize} onChange={(e) => setProject({ ...project, paperSize: e.target.value as ProjectState["paperSize"] })}><option value="A4">A4 vaaka</option><option value="A3">A3 vaaka</option></select></label>
        <div className="calendar-controls">
          <button onClick={() => setCalendarStart(addWorkdays(calendarStart, -35))}>← 5 vko</button>
          <button onClick={() => setCalendarStart(mondayOfWeek(project.statusDate))}>Seurantahetkeen</button>
          <button onClick={() => setCalendarStart(addWorkdays(calendarStart, 35))}>5 vko →</button>
        </div>
        <div className="project-actions">
          <button onClick={exportProject}>Vie JSON</button>
          <button onClick={() => importRef.current?.click()}>Avaa JSON</button>
          <input ref={importRef} hidden type="file" accept="application/json" onChange={(e) => e.target.files?.[0] && importProject(e.target.files[0])} />
        </div>
        <span className="save-state">Tallennettu {savedAt}</span>
      </section>

      <section className="print-heading"><div>{project.projectName}</div><div>{project.scheduleName}</div></section>

      <main className="schedule-grid">
        <div className="table-pane">
          <table>
            <thead><tr><th className="select-column"></th><th className="wbs-column">Hier</th><th>Työvaihe</th><th className="duration-column">Kesto</th><th className="date-column">Alku</th><th className="date-column">Loppu</th><th className="progress-column">Valmis %</th></tr></thead>
            <tbody>
              {tasks.map((task, index) => (
                <tr key={task.id} className={`${task.kind === "summary" ? "summary-row" : ""} ${task.kind === "milestone" ? "milestone-row" : ""} ${task.id === selectedId ? "selected-row" : ""}`} onClick={() => setSelectedId(task.id)}>
                  <td><input type="radio" readOnly checked={task.id === selectedId} /></td>
                  <td>{buildWbs(tasks, index)}</td>
                  <td><input className="task-name-input" style={{ paddingLeft: 8 + task.level * 18 }} value={task.name} onChange={(e) => updateTask(task.id, { name: e.target.value })} /></td>
                  <td><input type="number" min={1} disabled={task.kind === "summary"} value={task.duration} onChange={(e) => updateTask(task.id, { duration: Math.max(1, Number(e.target.value)) })} /></td>
                  <td><input type="date" disabled={task.kind === "summary"} value={task.start} onChange={(e) => updateTask(task.id, { start: e.target.value })} /></td>
                  <td><input type="date" readOnly value={workdayEnd(task.start, task.duration)} /></td>
                  <td><input type="number" min={0} max={100} disabled={task.kind === "summary"} value={task.progress} onChange={(e) => updateTask(task.id, { progress: clamp(Number(e.target.value), 0, 100) })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="gantt-pane">
          <div className="calendar-header">
            {calendarWeeks.map(({ date, week, month }, index) => <div className="calendar-week" key={`${week}-${index}`}><span>{month}</span><strong>vko {week}</strong></div>)}
          </div>
          <div className="gantt-body" style={{ height: tasks.length * ROW_HEIGHT }}>
            <div className="status-line" style={{ left: startOffset(project.statusDate) }} />
            {tasks.map((task, index) => {
              const left = startOffset(task.start);
              const width = durationWidth(task);
              const baseline = project.baseline?.[task.id];
              return (
                <div className="gantt-row" style={{ top: index * ROW_HEIGHT }} key={task.id}>
                  {baseline && <div className="baseline-bar" style={{ left: startOffset(baseline.start), width: durationWidth({ start: baseline.start, duration: baseline.duration }) }} />}
                  {task.kind === "milestone" ? (
                    <div className="milestone" style={{ left }} title={task.name}>◆</div>
                  ) : (
                    <div
                      className={`task-bar ${task.kind === "summary" ? "summary-bar" : ""}`}
                      style={{ left, width }}
                      onPointerDown={(event) => {
                        if (task.kind === "summary") return;
                        const element = event.currentTarget;
                        const startX = event.clientX;
                        const initialLeft = left;
                        const initialWidth = width;
                        const resize = (event.target as HTMLElement).classList.contains("resize-handle");
                        element.setPointerCapture(event.pointerId);
                        const move = (moveEvent: PointerEvent) => {
                          const delta = Math.round((moveEvent.clientX - startX) / PX_PER_DAY);
                          if (resize) element.style.width = `${Math.max(PX_PER_DAY, initialWidth + delta * PX_PER_DAY)}px`;
                          else element.style.left = `${initialLeft + delta * PX_PER_DAY}px`;
                        };
                        const up = (upEvent: PointerEvent) => {
                          element.releasePointerCapture(upEvent.pointerId);
                          element.removeEventListener("pointermove", move);
                          element.removeEventListener("pointerup", up);
                          const delta = Math.round((upEvent.clientX - startX) / PX_PER_DAY);
                          if (resize) updateTask(task.id, { duration: Math.max(1, task.duration + delta) });
                          else updateTask(task.id, { start: addWorkdays(task.start, delta) });
                        };
                        element.addEventListener("pointermove", move);
                        element.addEventListener("pointerup", up);
                      }}
                    >
                      <span>{buildWbs(tasks, index)}</span>
                      <div className="actual-progress" style={{ width: `${task.progress}%` }} />
                      <button className="resize-handle" aria-label="Muuta kestoa" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>

      <footer className="print-footer"><span>Päivitetty: {project.updatedDate}</span><span>Seurantahetki: {project.statusDate}</span></footer>

      {trackingOpen && (
        <div className="drawer-backdrop no-print">
          <aside className="tracking-drawer">
            <header><div><strong>Toteumaseuranta</strong><span>Seurantahetki {project.statusDate}</span></div><button onClick={() => setTrackingOpen(false)}>×</button></header>
            <div className="tracking-actions"><button className="primary" onClick={saveSnapshot}>Tallenna seurantatilanne</button><span>Tilanteita tallennettu {project.snapshots.length}</span></div>
            <div className="tracking-list">
              {tasks.filter((task) => task.kind !== "summary").map((task) => (
                <article key={task.id}>
                  <strong>{task.name}</strong>
                  <label>Valmiusaste<input type="range" min={0} max={100} value={task.progress} onChange={(e) => updateTask(task.id, { progress: Number(e.target.value) })} /><output>{task.progress}%</output></label>
                  <label>Toteutunut alku<input type="date" value={task.actualStart ?? ""} onChange={(e) => updateTask(task.id, { actualStart: e.target.value })} /></label>
                  <label>Toteutunut loppu<input type="date" value={task.actualEnd ?? ""} onChange={(e) => updateTask(task.id, { actualEnd: e.target.value, progress: e.target.value ? 100 : task.progress })} /></label>
                  <label>Ennustettu loppu<input type="date" value={task.forecastEnd ?? ""} onChange={(e) => updateTask(task.id, { forecastEnd: e.target.value })} /></label>
                  <label>Huomautus<textarea value={task.note ?? ""} onChange={(e) => updateTask(task.id, { note: e.target.value })} /></label>
                </article>
              ))}
            </div>
          </aside>
        </div>
      )}

      {snapshotsOpen && (
        <div className="drawer-backdrop no-print">
          <aside className="tracking-drawer compact-drawer">
            <header><div><strong>Seurantahistoria</strong><span>Työmaakokouksiin tallennetut tilanteet</span></div><button onClick={() => setSnapshotsOpen(false)}>×</button></header>
            <div className="snapshot-list">
              {project.snapshots.length === 0 && <p>Seurantatilanteita ei ole vielä tallennettu.</p>}
              {[...project.snapshots].reverse().map((snapshot) => (
                <article key={snapshot.id}>
                  <div><strong>{snapshot.date}</strong><span>{new Date(snapshot.createdAt).toLocaleString("fi-FI")}</span></div>
                  <button onClick={() => restoreSnapshot(snapshot.id)}>Palauta</button>
                </article>
              ))}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
