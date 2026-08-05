export type TaskType = "task" | "summary";

export type Task = {
  id: number;
  name: string;
  start: string;
  duration: number;
  level: number;
  type: TaskType;
  collapsed?: boolean;
  predecessorId?: number;
  lagDays?: number;
};
