import type { Task } from "@/types/schedule";

export const initialTasks: Task[] = [
  { id: 1, name: "Työmaan perustaminen", start: "2026-07-06", duration: 5 },
  { id: 2, name: "Telineet ja suojaukset", start: "2026-07-13", duration: 10 },
  { id: 3, name: "Purkutyöt", start: "2026-07-20", duration: 8 },
  { id: 4, name: "Betonikorjaukset", start: "2026-07-30", duration: 12 },
  { id: 5, name: "Tasoitus ja maalaus", start: "2026-08-17", duration: 15 },
];
