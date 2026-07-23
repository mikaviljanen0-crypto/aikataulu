"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addCalendarDays, addWorkdays, daysBetween, formatDate, isoWeek, mondayOfWeek, monthName, parseDate, workdayEnd } from "../lib/calendar";
import { initialWorkspace } from "../lib/sample";
import type { ProjectState, Task, TaskKind, WorkspaceState } from "../lib/types";
import { inspectPlr, type PlrReport } from "../lib/plrInspector";

const STORAGE_KEY = "aikataulu-v0.4";
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
    baseline: null, snapshots: [],
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
  const [savedAt, setSavedAt] = useState("");
  const [calendarStart, setCalendarStart] = useState(mondayOfWeek("2026-07-06"));
  const importRef = useRef<HTMLInputElement>(null);
  const plrRef = useRef<HTMLInputElement>(null);

  const project = workspace.projects.find((item) => item.id === workspace.activeProjectId) ?? workspace.projects[0];

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try { setWorkspace(JSON.parse(stored) as WorkspaceState); } catch {}
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
    setSavedAt(new Date().toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit" }));
    document.body.dataset.paper = project.paperSize.toLowerCase();
  }, [workspace, project.paperSize]);

  const updateProject = (patch: Partial<ProjectState>) => {
    setWorkspace((current) => ({ ...current, projects: current.projects.map((item) => item.id === current.activeProjectId ? { ...item, ...patch } : item) }));
  };
  const tasks = useMemo(() => normalizedTasks(project), [project]);
  const selectedIndex = tasks.findIndex((task) => task.id === selectedId);
  const selectedTask = tasks[selectedIndex];
  const { workdays, holidays } = project.calendar;

  const calendarWeeks = useMemo(() => {
    const start = parseDate(calendarStart);
    return Array.from({ length: WEEKS_VISIBLE }, (_, index) => {
      const date = new Date(start);
      date.setDate(date.getDate() + index * 7);
      return { date, week: isoWeek(date), month: monthName(date) };
    });
  }, [calendarStart]);

  const updateTask = (id: string, patch: Partial<Task>) => updateProject({ tasks: project.tasks.map((task) => task.id === id ? { ...task, ...patch } : task) });

  const addTask = (kind: TaskKind = "task") => {
    const index = Math.max(0, project.tasks.findIndex((task) => task.id === selectedId));
    const previous = project.tasks[index];
    const id = crypto.randomUUID();
    const task: Task = { id, name: kind === "milestone" ? "Uusi välitavoite" : "Uusi työvaihe", level: previous?.level ?? 0, start: previous?.start ?? project.updatedDate, duration: kind === "milestone" ? 1 : 5, progress: 0, kind };
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
    setWorkspace((current) => ({ activeProjectId: next.id, projects: [...current.projects, next] }));
    setSelectedId(next.tasks[0].id); setProjectsOpen(false); setCalendarStart(mondayOfWeek(next.statusDate));
  };
  const duplicateProject = () => {
    const copy = { ...project, id: crypto.randomUUID(), projectName: `${project.projectName} (kopio)`, tasks: project.tasks.map((task) => ({ ...task, id: crypto.randomUUID() })), snapshots: [] };
    setWorkspace((current) => ({ activeProjectId: copy.id, projects: [...current.projects, copy] }));
    setSelectedId(copy.tasks[0].id); setProjectsOpen(false);
  };
  const deleteProject = () => {
    if (workspace.projects.length === 1 || !window.confirm(`Poistetaanko projekti ${project.projectName}?`)) return;
    const remaining = workspace.projects.filter((item) => item.id !== project.id);
    setWorkspace({ activeProjectId: remaining[0].id, projects: remaining }); setSelectedId(remaining[0].tasks[0]?.id ?? "");
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
          <button onClick={() => addTask()}>+ Tehtävä</button>
          <button onClick={() => addTask("milestone")}>◇ Välitavoite</button>
          <button onClick={duplicateTask}>Kopioi</button><button onClick={deleteTask}>Poista</button>
          <button onClick={() => changeIndent(1)}>Sisennä</button><button onClick={() => changeIndent(-1)}>Ulonna</button>
          <button onClick={() => moveRow(-1)}>↑</button><button onClick={() => moveRow(1)}>↓</button>
          <button onClick={saveBaseline}>Tallenna tavoite</button>
          <button className="primary" onClick={() => setTrackingOpen(true)}>Toteumaseuranta</button>
          <button onClick={() => setSnapshotsOpen(true)}>Historia</button>
          <button onClick={() => setCalendarOpen(true)}>Kalenteri</button>
          <button onClick={() => setPlrOpen(true)}>Tocoman-tuonti</button>
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

      <section className="print-heading"><div>{project.projectName}</div><div>{project.scheduleName}</div></section>
      <section className="schedule-legend">
        <span><i className="legend-baseline" />Tavoite</span>
        <span><i className="legend-plan" />Suunnitelma / jäljellä</span>
        <span><i className="legend-actual" />Toteutuma</span>
        <span><i className="legend-status" />Seurantahetki</span>
      </section>

      <main className="schedule-grid">
        <div className="table-pane">
          <table><thead><tr><th className="select-column"></th><th className="wbs-column">Hier</th><th>Työvaihe</th><th className="duration-column">Kesto</th><th className="date-column">Alku</th><th className="date-column">Loppu</th><th className="progress-column">Valmis %</th></tr></thead>
            <tbody>{tasks.map((task, index) => (
              <tr key={task.id} className={`${task.kind === "summary" ? "summary-row" : ""} ${task.kind === "milestone" ? "milestone-row" : ""} ${task.id === selectedId ? "selected-row" : ""}`} onClick={() => setSelectedId(task.id)}>
                <td><input type="radio" readOnly checked={task.id === selectedId} /></td><td>{buildWbs(tasks, index)}</td>
                <td><input className="task-name-input" style={{ paddingLeft: 8 + task.level * 18 }} value={task.name} onChange={(e) => updateTask(task.id, { name: e.target.value })} /></td>
                <td><input type="number" min={1} disabled={task.kind === "summary"} value={task.duration} onChange={(e) => updateTask(task.id, { duration: Math.max(1, Number(e.target.value)) })} /></td>
                <td><input type="date" disabled={task.kind === "summary"} value={task.start} onChange={(e) => updateTask(task.id, { start: e.target.value })} /></td>
                <td><input type="date" readOnly value={workdayEnd(task.start, task.duration, workdays, holidays)} /></td>
                <td><input type="number" min={0} max={100} disabled={task.kind === "summary"} value={task.progress} onChange={(e) => updateTask(task.id, { progress: clamp(Number(e.target.value), 0, 100) })} /></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <div className="gantt-pane">
          <div className="calendar-header">{calendarWeeks.map(({ week, month }, index) => <div className="calendar-week" key={`${week}-${index}`}><span>{month}</span><strong>vko {week}</strong></div>)}</div>
          <div className="gantt-body" style={{ height: tasks.length * ROW_HEIGHT }}>
            <div className="status-line" style={{ left: startOffset(project.statusDate) }} />
            {tasks.map((task, index) => {
              const left = startOffset(task.start), width = durationWidth(task), baseline = project.baseline?.[task.id];
              return <div className="gantt-row" style={{ top: index * ROW_HEIGHT }} key={task.id}>
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
      </main>

      <footer className="print-footer"><span>Päivitetty: {project.updatedDate}</span><span>Seurantahetki: {project.statusDate}</span></footer>

      {trackingOpen && <div className="drawer-backdrop no-print"><aside className="tracking-drawer"><header><div><strong>Toteumaseuranta</strong><span>Seurantahetki {project.statusDate}</span></div><button onClick={() => setTrackingOpen(false)}>×</button></header>
        <div className="tracking-actions"><button className="primary" onClick={saveSnapshot}>Tallenna seurantatilanne</button><span>Tilanteita {project.snapshots.length}</span></div>
        <div className="tracking-list">{tasks.filter((task) => task.kind !== "summary").map((task) => <article key={task.id}><strong>{task.name}</strong>
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

      {plrOpen && <div className="drawer-backdrop no-print"><aside className="tracking-drawer plr-drawer"><header><div><strong>Tocoman .plr -analyysi</strong><span>Ensimmäinen vaihe vanhojen aikataulujen tuontiin</span></div><button onClick={() => setPlrOpen(false)}>×</button></header>
        <div className="plr-panel">
          <p>Valitse Tocomanin <code>.plr</code>-tiedosto. Analyysi tehdään vain selaimessa, eikä tiedostoa muuteta.</p>
          <button className="primary" onClick={() => plrRef.current?.click()}>Valitse .plr-tiedosto</button>
          <input ref={plrRef} hidden type="file" accept=".plr,application/octet-stream" onChange={async (event) => {
            const file = event.target.files?.[0];
            if (file) setPlrReport(await inspectPlr(file));
          }} />
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
        </div>
      </aside></div>}
    </div>
  );
}
