import { daysBetween, endDateIso } from "@/lib/date";
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

    if (!directChildren.length) {
      return { ...task, type: "task" };
    }

    const earliest = directChildren
      .map((child) => child.start)
      .sort()[0];

    const latest = directChildren
      .map((child) => endDateIso(child.start, child.duration))
      .sort()
      .at(-1)!;

    return {
      ...task,
      type: "summary",
      start: earliest,
      duration: daysBetween(earliest, latest) + 1,
    };
  });
}

export function isHiddenByCollapsedParent(
  tasks: Task[],
  index: number,
): boolean {
  const level = tasks[index].level;

  for (let i = index - 1; i >= 0; i -= 1) {
    if (tasks[i].level < level) {
      if (tasks[i].collapsed) return true;
      if (tasks[i].level === 0) break;
    }
  }

  return false;
}
