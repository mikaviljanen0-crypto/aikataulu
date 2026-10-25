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

  area?: string;
  owner?: string;

  progress?: number;
  started?: boolean;
  actualStart?: string;
  actualEnd?: string;

  baselineStart?: string;
  baselineDuration?: number;
};
