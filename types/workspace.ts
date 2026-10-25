import type { Task } from "@/types/schedule";

export type TrackingSnapshot = {
  id: string;
  statusDate: string;
  createdAt: string;
  note: string;
  completion: number;
  tasks: Task[];
};

export type StoredProject = {
  version: 1;
  projectNumber: string;
  projectName: string;
  scheduleName: string;
  statusDate: string;
  tasks: Task[];
  snapshots?: TrackingSnapshot[];
};

export type ProjectListing = {
  id: string;
  projectNumber: string;
  projectName: string;
  scheduleName: string;
  updatedAt: string;
};
