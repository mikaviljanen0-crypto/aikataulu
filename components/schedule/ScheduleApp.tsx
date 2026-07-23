"use client";

import { useState } from "react";
import { initialTasks } from "@/data/sampleTasks";
import type { Task } from "@/types/schedule";
import { GanttChart } from "./GanttChart";
import { ProjectBar } from "./ProjectBar";
import { TaskTable } from "./TaskTable";
import { TopBar } from "./TopBar";

export default function ScheduleApp() {
  const [projectName, setProjectName] = useState("As Oy Kissankello");
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [selectedId, setSelectedId] = useState(initialTasks[0].id);

  function updateTask(id: number, patch: Partial<Task>) {
    setTasks((current) =>
      current.map((task) => (task.id === id ? { ...task, ...patch } : task)),
    );
  }

  function addTask() {
    const id = Date.now();

    setTasks((current) => [
      ...current,
      {
        id,
        name: "Uusi työvaihe",
        start: "2026-07-06",
        duration: 5,
      },
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
      <TopBar onAddTask={addTask} onRemoveTask={removeTask} />

      <ProjectBar
        projectName={projectName}
        onProjectNameChange={setProjectName}
      />

      <section className="schedule">
        <TaskTable
          tasks={tasks}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onUpdate={updateTask}
        />

        <GanttChart tasks={tasks} />
      </section>

      <footer>
        <span>{projectName}</span>
        <span>Yleisaikataulu · kehitysversio 0.1</span>
      </footer>
    </main>
  );
}
