import type { ProjectState, WorkspaceState } from "./types";
import { finnishPublicHolidays } from "./calendar";

export const initialProject: ProjectState = {
  id: "kissankello",
  projectName: "As Oy Kissankello",
  scheduleName: "Yleisaikataulu",
  projectNumber: "2607",
  client: "As Oy Kissankello",
  updatedDate: "2026-07-23",
  statusDate: "2026-08-31",
  paperSize: "A4",
  calendar: {
    workdays: [1,2,3,4,5],
    holidays: finnishPublicHolidays(2026),
    shutdownPeriods: []
  },
  baseline: null,
  snapshots: [],
  scheduleVersions: [],
  weeklyPlans: [],
  tasks: [
    { id: "1", name: "Talo 32", location: "Talo 32", level: 0, start: "2026-07-23", duration: 30, progress: 70, kind: "summary" },
    { id: "2", name: "Purkutyöt", location: "Talo 32", level: 1, start: "2026-07-23", duration: 5, progress: 100, kind: "task", actualStart: "2026-07-23", actualEnd: "2026-07-29" },
    { id: "3", name: "Muottityö, raudoitus ja valu", location: "Talo 32", level: 1, start: "2026-07-30", duration: 5, progress: 100, kind: "task", actualStart: "2026-07-30", actualEnd: "2026-08-05" },
    { id: "4", name: "Hiekkapuhallus", location: "Talo 32", level: 1, start: "2026-08-06", duration: 5, progress: 80, kind: "task", actualStart: "2026-08-06" },
    { id: "5", name: "Betonikorjaus", location: "Talo 32", level: 1, start: "2026-08-13", duration: 5, progress: 40, kind: "task" },
    { id: "6", name: "Ylitasoitus", location: "Talo 32", level: 1, start: "2026-08-20", duration: 5, progress: 0, kind: "task" },
    { id: "7", name: "Maalaus- ja pinnoitus", location: "Talo 32", level: 1, start: "2026-08-27", duration: 5, progress: 0, kind: "task" },
    { id: "8", name: "Talo 30", location: "Talo 30", level: 0, start: "2026-08-06", duration: 30, progress: 25, kind: "summary" },
    { id: "9", name: "Purkutyöt", location: "Talo 30", level: 1, start: "2026-08-06", duration: 5, progress: 100, kind: "task" },
    { id: "10", name: "Muottityö, raudoitus ja valu", location: "Talo 30", level: 1, start: "2026-08-13", duration: 5, progress: 40, kind: "task" },
    { id: "11", name: "Hiekkapuhallus", location: "Talo 30", level: 1, start: "2026-08-20", duration: 5, progress: 0, kind: "task" },
    { id: "12", name: "Betonikorjaus", location: "Talo 30", level: 1, start: "2026-08-27", duration: 5, progress: 0, kind: "task" },
    { id: "13", name: "Ylitasoitus", location: "Talo 30", level: 1, start: "2026-09-03", duration: 5, progress: 0, kind: "task" },
    { id: "14", name: "Maalaus- ja pinnoitus", location: "Talo 30", level: 1, start: "2026-09-10", duration: 5, progress: 0, kind: "task" },
    { id: "15", name: "Parvekekaide- ja lasiasennus", location: "Molemmat talot", level: 0, start: "2026-08-31", duration: 15, progress: 0, kind: "task" },
    { id: "16", name: "Pihakatoksien rakentaminen", location: "Piha-alue", level: 0, start: "2026-07-23", duration: 5, progress: 100, kind: "task" }
  ]
};

export const initialWorkspace: WorkspaceState = {
  activeProjectId: initialProject.id,
  projects: [initialProject],
  printSettings: {
    showWbs: true,
    showDuration: true,
    showStart: true,
    showEnd: true,
    showProgress: true,
    showLegend: true,
    fitToOnePage: true,
    pageMode: "one-page",
    rangeStart: "2026-07-06",
    rangeEnd: "2026-12-06",
    repeatHeader: true
  }
};
