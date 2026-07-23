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
  location?: string;
  responsible?: string;
  predecessorId?: string;
  lagDays?: number;
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
  title?: string;
  description?: string;
  tasks: Array<Pick<Task, "id" | "progress" | "actualStart" | "actualEnd" | "forecastEnd" | "note">>;
}

export interface ScheduleVersion {
  id: string;
  title: string;
  createdAt: string;
  description?: string;
  tasks: Task[];
  baseline: Record<string, BaselineTask> | null;
}

export interface VersionDifference {
  taskId: string;
  taskName: string;
  type: "added" | "removed" | "changed";
  changes: string[];
}

export type WeeklyPlanStatus = "planned" | "in-progress" | "done" | "blocked";

export interface WeeklyPlanItem {
  id: string;
  sourceTaskId?: string;
  day: string;
  taskName: string;
  location?: string;
  responsible?: string;
  target?: string;
  status: WeeklyPlanStatus;
  note?: string;
}

export interface WeeklyPlan {
  id: string;
  weekStart: string;
  title: string;
  createdAt: string;
  items: WeeklyPlanItem[];
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
  scheduleVersions: ScheduleVersion[];
  weeklyPlans: WeeklyPlan[];
}

export type PrintPageMode = "one-page" | "multi-page";

export interface PrintSettings {
  showWbs: boolean;
  showDuration: boolean;
  showStart: boolean;
  showEnd: boolean;
  showProgress: boolean;
  showLegend: boolean;
  fitToOnePage: boolean;
  pageMode: PrintPageMode;
  rangeStart: string;
  rangeEnd: string;
  repeatHeader: boolean;
}

export interface WorkspaceState {
  activeProjectId: string;
  projects: ProjectState[];
  printSettings?: PrintSettings;
}
