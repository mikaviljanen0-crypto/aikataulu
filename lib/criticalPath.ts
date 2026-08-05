import type { Task } from "@/types/schedule";

export function getCriticalTaskIds(tasks: Task[]): Set<number> {
  const normalTasks = tasks.filter((task) => task.type !== "summary");
  const taskMap = new Map(normalTasks.map((task) => [task.id, task]));
  const scores = new Map<number, number>();
  const previous = new Map<number, number | undefined>();

  function score(taskId: number, visiting = new Set<number>()): number {
    if (scores.has(taskId)) return scores.get(taskId)!;
    if (visiting.has(taskId)) return 0;

    const task = taskMap.get(taskId);
    if (!task) return 0;

    const nextVisiting = new Set(visiting);
    nextVisiting.add(taskId);

    let predecessorScore = 0;
    let predecessorId: number | undefined;

    if (task.predecessorId && taskMap.has(task.predecessorId)) {
      predecessorScore = score(task.predecessorId, nextVisiting);
      predecessorId = task.predecessorId;
    }

    const value = predecessorScore + Math.max(1, task.duration);
    scores.set(taskId, value);
    previous.set(taskId, predecessorId);
    return value;
  }

  let endTaskId: number | undefined;
  let maximum = -1;

  normalTasks.forEach((task) => {
    const value = score(task.id);
    if (value > maximum) {
      maximum = value;
      endTaskId = task.id;
    }
  });

  const result = new Set<number>();
  let currentId = endTaskId;

  while (currentId) {
    result.add(currentId);
    currentId = previous.get(currentId);
  }

  return result;
}
