import type { ScheduleVersion, Task, VersionDifference } from "./types";

function taskKey(task: Task): string {
  return task.id;
}

export function compareScheduleVersions(
  left: ScheduleVersion,
  right: ScheduleVersion
): VersionDifference[] {
  const leftMap = new Map(left.tasks.map((task) => [taskKey(task), task]));
  const rightMap = new Map(right.tasks.map((task) => [taskKey(task), task]));
  const ids = new Set([...leftMap.keys(), ...rightMap.keys()]);
  const differences: VersionDifference[] = [];

  for (const id of ids) {
    const before = leftMap.get(id);
    const after = rightMap.get(id);

    if (!before && after) {
      differences.push({
        taskId: id,
        taskName: after.name,
        type: "added",
        changes: ["Tehtävä lisätty"]
      });
      continue;
    }

    if (before && !after) {
      differences.push({
        taskId: id,
        taskName: before.name,
        type: "removed",
        changes: ["Tehtävä poistettu"]
      });
      continue;
    }

    if (!before || !after) continue;

    const changes: string[] = [];
    if (before.name !== after.name) changes.push(`Nimi: "${before.name}" → "${after.name}"`);
    if (before.start !== after.start) changes.push(`Alku: ${before.start} → ${after.start}`);
    if (before.duration !== after.duration) changes.push(`Kesto: ${before.duration} pv → ${after.duration} pv`);
    if (before.level !== after.level) changes.push(`Hierarkiataso: ${before.level} → ${after.level}`);
    if (before.location !== after.location) changes.push(`Rakennus/alue: ${before.location || "–"} → ${after.location || "–"}`);
    if (before.responsible !== after.responsible) changes.push(`Vastuu: ${before.responsible || "–"} → ${after.responsible || "–"}`);
    if (before.predecessorId !== after.predecessorId) changes.push("Edeltävä tehtävä muuttui");
    if ((before.lagDays ?? 0) !== (after.lagDays ?? 0)) changes.push(`Viive: ${before.lagDays ?? 0} pv → ${after.lagDays ?? 0} pv`);
    if (before.color !== after.color) changes.push(`Väri: ${before.color || "oletus"} → ${after.color || "oletus"}`);

    if (changes.length) {
      differences.push({
        taskId: id,
        taskName: after.name,
        type: "changed",
        changes
      });
    }
  }

  return differences.sort((a, b) => a.taskName.localeCompare(b.taskName, "fi"));
}
