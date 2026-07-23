export type PaperSize = "A4" | "A3";
export type TaskKind = "summary" | "task" | "milestone";

export interface ProjectCalendar {
  workdays: number[];
  holidays: string[];
  shutdownPeriods: Array<{ id: string; name: string; start: string; end: string }>;
}

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
  id: string;
  projectName: string;
  scheduleName: string;
  projectNumber?: string;
  client?: string;
  updatedDate: string;
  statusDate: string;
  paperSize: PaperSize;
  calendar: ProjectCalendar;
  tasks: Task[];
  baseline: Record<string, BaselineTask> | null;
  snapshots: TrackingSnapshot[];
}

export interface PrintSettings {
  showWbs: boolean;
  showDuration: boolean;
  showStart: boolean;
  showEnd: boolean;
  showProgress: boolean;
  showLegend: boolean;
  fitToOnePage: boolean;
}

export interface WorkspaceState {
  activeProjectId: string;
  projects: ProjectState[];
  printSettings?: PrintSettings;
}
