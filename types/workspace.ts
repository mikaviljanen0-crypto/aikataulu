import type { Task } from "@/types/schedule";

export type TrackingSnapshot = {
  id: string;
  statusDate: string;
  createdAt: string;
  note: string;
  completion: number;
  tasks: Task[];
};

/** Käyttäjän itse määrittämä, työvaiheista riippumaton sopimusvälitavoite. */
export type ScheduleMilestone = {
  id: string;
  title: string;
  date: string;
};

export type StoredProject = {
  version: 1;
  projectNumber: string;
  projectName: string;
  scheduleName: string;
  statusDate: string;
  tasks: Task[];
  snapshots?: TrackingSnapshot[];
  extraDaysOff?: string[];
  milestones?: ScheduleMilestone[];
};

export type ProjectListing = {
  id: string;
  projectNumber: string;
  projectName: string;
  scheduleName: string;
  updatedAt: string;
};
