import type { ProjectState } from "./types";

export const initialProject: ProjectState = {
  projectName: "As Oy Kissankello",
  scheduleName: "Yleisaikataulu",
  updatedDate: "2026-07-23",
  statusDate: "2026-08-31",
  paperSize: "A4",
  baseline: null,
  snapshots: [],
  tasks: [
    { id: "1", name: "Talo 32", level: 0, start: "2026-07-23", duration: 30, progress: 70, color: "summary" },
    { id: "2", name: "Purkutyöt", level: 1, start: "2026-07-23", duration: 5, progress: 100, color: "task" },
    { id: "3", name: "Muottityö, raudoitus ja valu", level: 1, start: "2026-07-30", duration: 5, progress: 100, color: "task" },
    { id: "4", name: "Hiekkapuhallus", level: 1, start: "2026-08-06", duration: 5, progress: 80, color: "task" },
    { id: "5", name: "Betonikorjaus", level: 1, start: "2026-08-13", duration: 5, progress: 40, color: "task" },
    { id: "6", name: "Ylitasoitus", level: 1, start: "2026-08-20", duration: 5, progress: 0, color: "task" },
    { id: "7", name: "Maalaus- ja pinnoitus", level: 1, start: "2026-08-27", duration: 5, progress: 0, color: "task" },
    { id: "8", name: "Talo 30", level: 0, start: "2026-08-06", duration: 30, progress: 25, color: "summary" },
    { id: "9", name: "Purkutyöt", level: 1, start: "2026-08-06", duration: 5, progress: 100, color: "task" },
    { id: "10", name: "Muottityö, raudoitus ja valu", level: 1, start: "2026-08-13", duration: 5, progress: 40, color: "task" },
    { id: "11", name: "Hiekkapuhallus", level: 1, start: "2026-08-20", duration: 5, progress: 0, color: "task" },
    { id: "12", name: "Betonikorjaus", level: 1, start: "2026-08-27", duration: 5, progress: 0, color: "task" },
    { id: "13", name: "Ylitasoitus", level: 1, start: "2026-09-03", duration: 5, progress: 0, color: "task" },
    { id: "14", name: "Maalaus- ja pinnoitus", level: 1, start: "2026-09-10", duration: 5, progress: 0, color: "task" },
    { id: "15", name: "Parvekekaide- ja lasiasennus", level: 0, start: "2026-08-31", duration: 15, progress: 0, color: "summary" },
    { id: "16", name: "Pihakatoksien rakentaminen", level: 0, start: "2026-07-23", duration: 5, progress: 100, color: "summary" }
  ]
};
