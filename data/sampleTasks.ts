import type { Task } from "@/types/schedule";

export const initialTasks: Task[] = [
  {
    id: 1,
    name: "Talo 32",
    start: "2026-07-06",
    duration: 30,
    level: 0,
    type: "summary",
  },
  {
    id: 2,
    name: "Työmaan perustaminen",
    start: "2026-07-06",
    duration: 5,
    level: 1,
    type: "task",
  },
  {
    id: 3,
    name: "Telineet ja suojaukset",
    start: "2026-07-13",
    duration: 10,
    level: 1,
    type: "task",
  },
  {
    id: 4,
    name: "Purkutyöt",
    start: "2026-07-20",
    duration: 8,
    level: 1,
    type: "task",
  },
  {
    id: 5,
    name: "Betonikorjaukset",
    start: "2026-07-30",
    duration: 12,
    level: 1,
    type: "task",
  },
  {
    id: 6,
    name: "Tasoitus ja maalaus",
    start: "2026-08-17",
    duration: 15,
    level: 1,
    type: "task",
  },
];
