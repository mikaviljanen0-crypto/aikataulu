import type { Task } from "@/types/schedule";

export type MeetingTaskState = {
  taskId: number;
  name: string;
  progress: number;
  actualStart?: string;
  actualEnd?: string;
};

export type MeetingSnapshot = {
  id: string;
  statusDate: string;
  savedAt: string;
  note: string;
  tasks: MeetingTaskState[];
};

export function createMeetingSnapshot(
  tasks: Task[],
  statusDate: string,
  note: string,
): MeetingSnapshot {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    statusDate,
    savedAt: new Date().toISOString(),
    note: note.trim(),
    tasks: tasks
      .filter((task) => task.type !== "summary")
      .map((task) => ({
        taskId: task.id,
        name: task.name,
        progress: Math.max(0, Math.min(100, task.progress ?? 0)),
        actualStart: task.actualStart,
        actualEnd: task.actualEnd,
      })),
  };
}

export function countChangesSinceSnapshot(
  tasks: Task[],
  last?: MeetingSnapshot,
): number {
  if (!last) return 0;
  const previous = new Map(last.tasks.map((task) => [task.taskId, task]));
  return tasks.filter((task) => {
    if (task.type === "summary") return false;
    const earlier = previous.get(task.id);
    return !earlier ||
      earlier.progress !== (task.progress ?? 0) ||
      earlier.actualStart !== task.actualStart ||
      earlier.actualEnd !== task.actualEnd;
  }).length;
}
