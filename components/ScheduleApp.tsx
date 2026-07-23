"use client";

import { useMemo, useState } from "react";

type Task = {
  id: number;
  name: string;
  start: string;
  duration: number;
};

const DAY_WIDTH = 22;
const RANGE_START = new Date("2026-07-01T00:00:00");

const initialTasks: Task[] = [
  { id: 1, name: "Työmaan perustaminen", start: "2026-07-06", duration: 5 },
  { id: 2, name: "Telineet ja suojaukset", start: "2026-07-13", duration: 10 },
  { id: 3, name: "Purkutyöt", start: "2026-07-20", duration: 8 },
  { id: 4, name: "Betonikorjaukset", start: "2026-07-30", duration: 12 },
  { id: 5, name: "Tasoitus ja maalaus", start: "2026-08-17", duration: 15 },
];

function dateOffset(date: string) {
  return Math.round(
    (new Date(`${date}T00:00:00`).getTime() - RANGE_START.getTime()) /
      86_400_000,
  );
}

function formatEndDate(start: string, duration: number) {
  const date = new Date(`${start}T00:00:00`);
  date.setDate(date.getDate() + Math.max(1, duration) - 1);
  return date.toLocaleDateString("fi-FI");
}

export default function ScheduleApp() {
  const [projectName, setProjectName] = useState("As Oy Kissankello");
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [selectedId, setSelectedId] = useState(1);

  const weeks = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const date = new Date(RANGE_START);
        date.setDate(date.getDate() + index * 7);
        return {
          label: `vko ${27 + index}`,
          month: date.toLocaleDateString("fi-FI", { month: "long" }),
        };
      }),
    [],
  );

  function updateTask(id: number, patch: Partial<Task>) {
    setTasks((current) =>
      current.map((task) => (task.id === id ? { ...task, ...patch } : task)),
    );
  }

  function addTask() {
    const id = Date.now();
    setTasks((current) => [
      ...current,
      { id, name: "Uusi työvaihe", start: "2026-07-06", duration: 5 },
    ]);
    setSelectedId(id);
  }

  function removeTask() {
    if (tasks.length === 1) return;
    const remaining = tasks.filter((task) => task.id !== selectedId);
    setTasks(remaining);
    setSelectedId(remaining[0].id);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <strong>Aikataulu</strong>
          <span>Rakennusalan tuotannonsuunnittelu</span>
        </div>
        <nav>
          <button onClick={addTask}>+ Lisää tehtävä</button>
          <button onClick={removeTask}>Poista</button>
          <button className="primary">Tallenna</button>
          <button>Tulosta / PDF</button>
        </nav>
      </header>

      <section className="projectbar">
        <label>
          Projekti
          <input value={projectName} onChange={(event) => setProjectName(event.target.value)} />
        </label>
        <label>
          Aikataulu
          <input defaultValue="Yleisaikataulu" />
        </label>
        <label>
          Päivitetty
          <input type="date" defaultValue="2026-07-23" />
        </label>
      </section>

      <section className="schedule">
        <div className="task-pane">
          <table>
            <thead>
              <tr>
                <th className="number-column">#</th>
                <th>Työvaihe</th>
                <th className="duration-column">Kesto</th>
                <th className="date-column">Alku</th>
                <th className="date-column">Loppu</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task, index) => (
                <tr key={task.id} className={task.id === selectedId ? "selected" : ""} onClick={() => setSelectedId(task.id)}>
                  <td>{index + 1}</td>
                  <td><input value={task.name} onChange={(event) => updateTask(task.id, { name: event.target.value })} /></td>
                  <td><input type="number" min={1} value={task.duration} onChange={(event) => updateTask(task.id, { duration: Math.max(1, Number(event.target.value)) })} /></td>
                  <td><input type="date" value={task.start} onChange={(event) => updateTask(task.id, { start: event.target.value })} /></td>
                  <td>{formatEndDate(task.start, task.duration)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="gantt-pane">
          <div className="calendar-header">
            {weeks.map((week, index) => (
              <div className="week" key={week.label}>
                <span>{index === 0 || weeks[index - 1].month !== week.month ? week.month : ""}</span>
                <strong>{week.label}</strong>
              </div>
            ))}
          </div>
          <div className="gantt-body">
            {tasks.map((task, index) => (
              <div className="gantt-row" key={task.id}>
                <div className="task-bar" style={{ left: dateOffset(task.start) * DAY_WIDTH, width: task.duration * DAY_WIDTH }}>
                  <span>{index + 1}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer>
        <span>{projectName}</span>
        <span>Yleisaikataulu · kehitysversio 0.1</span>
      </footer>
    </main>
  );
}
