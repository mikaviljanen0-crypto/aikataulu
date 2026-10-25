import { isWorkday, workdayEnd } from "@/lib/calendar";
import { addDays } from "@/lib/date";
import type { Task } from "@/types/schedule";

function clamp(value: number, low = 0, high = 100): number {
  return Math.max(low, Math.min(high, value));
}

export function expectedProgress(task: Task, statusDate: string): number {
  if (task.type === "summary") return 0;
  if (statusDate < task.start) return 0;
  const last = workdayEnd(task.start, task.duration);
  if (statusDate >= last) return 100;
  let completedDays = 0;
  for (let day = task.start; day <= statusDate; day = addDays(day, 1)) {
    if (isWorkday(day)) completedDays += 1;
  }
  return clamp((completedDays / Math.max(1, task.duration)) * 100);
}

/** Suuntaa antava poikkeama perustuu tasaisesti etenevään työpäiväsuunnitelmaan. */
export function isBehind(task: Task, statusDate: string): boolean {
  if (task.type === "summary" || (task.progress ?? 0) >= 100) return false;
  const expected = expectedProgress(task, statusDate);
  return expected >= 25 && expected - (task.progress ?? 0) >= 20;
}

export type ProjectPulse = {
  taskCount: number;
  completeCount: number;
  startedCount: number;
  behindCount: number;
  totalProgress: number;
  forecastEnd: string;
};

export function getProjectPulse(tasks: Task[], statusDate: string): ProjectPulse {
  const leaves = tasks.filter((task) => task.type !== "summary");
  const taskCount = leaves.length;
  const completeCount = leaves.filter((task) => (task.progress ?? 0) >= 100).length;
  const startedCount = leaves.filter((task) => (task.progress ?? 0) > 0 && (task.progress ?? 0) < 100).length;
  const behindCount = leaves.filter((task) => isBehind(task, statusDate)).length;
  const totalWeight = leaves.reduce((sum, task) => sum + Math.max(1, task.duration), 0);
  const weighted = leaves.reduce((sum, task) => sum + Math.max(1, task.duration) * clamp(task.progress ?? 0), 0);
  const forecastEnd = leaves.map((task) => workdayEnd(task.start, task.duration)).sort().at(-1) ?? "";

  return {
    taskCount,
    completeCount,
    startedCount,
    behindCount,
    totalProgress: totalWeight > 0 ? Math.round(weighted / totalWeight) : 0,
    forecastEnd,
  };
}
