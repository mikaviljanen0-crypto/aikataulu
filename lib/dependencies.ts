import { addDays, endDateIso } from "@/lib/date";
import type { Task } from "@/types/schedule";

export type DependencyResult = {
  tasks: Task[];
  changedCount: number;
  errors: string[];
};

export function scheduleDependencies(tasks: Task[]): DependencyResult {
  const taskMap = new Map(tasks.map((task) => [task.id, { ...task }]));
  const visiting = new Set<number>();
  const visited = new Set<number>();
  const errors: string[] = [];
  let changedCount = 0;

  function resolve(taskId: number) {
    if (visited.has(taskId)) return;

    if (visiting.has(taskId)) {
      const task = taskMap.get(taskId);
      errors.push(
        `Riippuvuuskehä havaittiin${task ? ` tehtävässä "${task.name}"` : ""}.`,
      );
      return;
    }

    const task = taskMap.get(taskId);
    if (!task || !task.predecessorId || task.type === "summary") {
      visited.add(taskId);
      return;
    }

    visiting.add(taskId);
    resolve(task.predecessorId);

    const predecessor = taskMap.get(task.predecessorId);

    if (!predecessor) {
      errors.push(`Edeltävää tehtävää ei löytynyt tehtävälle "${task.name}".`);
    } else if (predecessor.id === task.id) {
      errors.push(`Tehtävä "${task.name}" ei voi olla oma edeltäjänsä.`);
    } else {
      const predecessorEnd = endDateIso(
        predecessor.start,
        predecessor.duration,
      );
      const requiredStart = addDays(
        predecessorEnd,
        1 + (task.lagDays ?? 0),
      );

      if (requiredStart !== task.start) {
        task.start = requiredStart;
        changedCount += 1;
      }
    }

    visiting.delete(taskId);
    visited.add(taskId);
  }

  tasks.forEach((task) => resolve(task.id));

  return {
    tasks: tasks.map((task) => taskMap.get(task.id) ?? task),
    changedCount,
    errors,
  };
}
