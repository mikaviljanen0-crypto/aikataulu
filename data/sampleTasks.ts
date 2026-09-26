import type { Task } from "@/types/schedule";

export const initialTasks: Task[] = [
  { id: 1, name: "Talo 32", start: "2026-07-23", duration: 41, level: 0, type: "summary", progress: 53 },
  { id: 2, name: "Purkutyöt", start: "2026-07-23", duration: 5, level: 1, type: "task", progress: 100, actualStart: "2026-07-23", actualEnd: "2026-07-29" },
  { id: 3, name: "Muottityö, raudoitus ja valu", start: "2026-07-30", duration: 5, level: 1, type: "task", predecessorId: 2, progress: 100, actualStart: "2026-07-30", actualEnd: "2026-08-05" },
  { id: 4, name: "Hiekkapuhallus", start: "2026-08-06", duration: 5, level: 1, type: "task", predecessorId: 3, progress: 80, actualStart: "2026-08-06" },
  { id: 5, name: "Betonikorjaus", start: "2026-08-13", duration: 5, level: 1, type: "task", predecessorId: 4, progress: 40, actualStart: "2026-08-13" },
  { id: 6, name: "Ylitasoitus", start: "2026-08-20", duration: 5, level: 1, type: "task", predecessorId: 5, progress: 0 },
  { id: 7, name: "Maalaus- ja pinnoitus", start: "2026-08-27", duration: 5, level: 1, type: "task", predecessorId: 6, progress: 0 },
  { id: 8, name: "Talo 30", start: "2026-08-06", duration: 41, level: 0, type: "summary", progress: 23 },
  { id: 9, name: "Purkutyöt", start: "2026-08-06", duration: 5, level: 1, type: "task", progress: 100, actualStart: "2026-08-06", actualEnd: "2026-08-12" },
  { id: 10, name: "Muottityö, raudoitus ja valu", start: "2026-08-13", duration: 5, level: 1, type: "task", predecessorId: 9, progress: 40, actualStart: "2026-08-13" },
  { id: 11, name: "Hiekkapuhallus", start: "2026-08-20", duration: 5, level: 1, type: "task", predecessorId: 10, progress: 0 },
  { id: 12, name: "Betonikorjaus", start: "2026-08-27", duration: 5, level: 1, type: "task", predecessorId: 11, progress: 0 },
  { id: 13, name: "Ylitasoitus", start: "2026-09-03", duration: 5, level: 1, type: "task", predecessorId: 12, progress: 0 },
  { id: 14, name: "Maalaus- ja pinnoitus", start: "2026-09-10", duration: 5, level: 1, type: "task", predecessorId: 13, progress: 0 },
  { id: 15, name: "Parvekekaide- ja lasiasennus", start: "2026-08-31", duration: 15, level: 0, type: "task", progress: 0, area: "Parvekkeet" },
  { id: 16, name: "Pihakatoksien rakentaminen", start: "2026-07-23", duration: 5, level: 0, type: "task", progress: 100, actualStart: "2026-07-23", actualEnd: "2026-07-29" },
];
