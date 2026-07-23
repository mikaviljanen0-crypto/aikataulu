export type PaperSize = "A4" | "A3";
export type TaskKind = "summary" | "task" | "milestone";

export interface Task {
  id: string;
  name: string;
  level: number;
  start: string;
  duration: number;
  progress: number;
  kind: TaskKind;
  color?: string;
  actualStart?: string;
  actualEnd?: string;
  forecastEnd?: string;
  note?: string;
}

export interface BaselineTask {
  start: string;
  duration: number;
}

export interface TrackingSnapshot {
  id: string;
  date: string;
  createdAt: string;
  tasks: Array<Pick<Task, "id" | "progress" | "actualStart" | "actualEnd" | "forecastEnd" | "note">>;
}

export interface ProjectState {
  projectName: string;
  scheduleName: string;
  updatedDate: string;
  statusDate: string;
  paperSize: PaperSize;
  tasks: Task[];
  baseline: Record<string, BaselineTask> | null;
  snapshots: TrackingSnapshot[];
}
