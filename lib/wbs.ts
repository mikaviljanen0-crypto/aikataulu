import { workdayEnd, workdaysInclusive } from "@/lib/calendar";
import type { Task } from "@/types/schedule";

export function getWbs(tasks: Task[], index: number): string {
  const counters: number[] = [];
  for (let i = 0; i <= index; i += 1) {
    const level = tasks[i].level;
    counters[level] = (counters[level] ?? 0) + 1;
    counters.length = level + 1;
  }
  return counters.join(".");
}

export function getDescendantIndexes(tasks: Task[], index: number): number[] {
  const parentLevel = tasks[index].level;
  const indexes: number[] = [];
  for (let i = index + 1; i < tasks.length; i += 1) {
    if (tasks[i].level <= parentLevel) break;
    indexes.push(i);
  }
  return indexes;
}

export function normalizeSummaries(tasks: Task[]): Task[] {
  return tasks.map((task, index) => {
    const directChildren = getDescendantIndexes(tasks, index)
      .map((childIndex) => tasks[childIndex])
      .filter((child) => child.level === task.level + 1);

    if (!directChildren.length) return { ...task, type: "task" };

    const earliest = directChildren.map((child) => child.start).sort()[0];
    const latest = directChildren
      .map((child) => workdayEnd(child.start, child.duration))
      .sort()
      .at(-1)!;

    const totalWeight = directChildren.reduce(
      (sum, child) => sum + Math.max(1, child.duration),
      0,
    );
    const weightedProgress =
      directChildren.reduce(
        (sum, child) =>
          sum + Math.max(1, child.duration) * Math.min(100, Math.max(0, child.progress ?? 0)),
        0,
      ) / Math.max(1, totalWeight);

    const actualStarts = directChildren
      .map((child) => child.actualStart)
      .filter((value): value is string => Boolean(value))
      .sort();
    const allComplete = directChildren.every((child) => (child.progress ?? 0) >= 100);
    const actualEnds = directChildren
      .map((child) => child.actualEnd)
      .filter((value): value is string => Boolean(value))
      .sort();

    return {
      ...task,
      type: "summary",
      start: earliest,
      duration: workdaysInclusive(earliest, latest),
      progress: Math.round(weightedProgress),
      started: directChildren.some((child) => (child.progress ?? 0) > 0),
      actualStart: actualStarts[0],
      actualEnd: allComplete ? actualEnds.at(-1) : undefined,
    };
  });
}

export function isHiddenByCollapsedParent(tasks: Task[], index: number): boolean {
  const level = tasks[index].level;
  for (let i = index - 1; i >= 0; i -= 1) {
    if (tasks[i].level < level) {
      if (tasks[i].collapsed) return true;
      if (tasks[i].level === 0) break;
    }
  }
  return false;
}
