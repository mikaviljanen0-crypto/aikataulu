import { workdayEnd } from "@/lib/calendar";
import { getWbs } from "@/lib/wbs";
import type { Task } from "@/types/schedule";

type TaskTableProps = {
  tasks: Task[];
  visibleTasks: Task[];
  selectedIds: Set<number>;
  criticalTaskIds: Set<number>;
  showPlanningColumns: boolean;
  showTrackingColumns: boolean;
  statusDate: string;
  taskNameWidth: number;
  onTaskNameWidthChange: (width: number) => void;
  onSelect: (id: number, options: { additive: boolean; range: boolean }) => void;
  onUpdate: (id: number, patch: Partial<Task>) => void;
  onToggleCollapse: (id: number) => void;
};

function displayDate(value: string): string {
  if (!value) return "";
  return new Date(`${value}T12:00:00`).toLocaleDateString("fi-FI");
}

export function TaskTable({
  tasks,
  visibleTasks,
  selectedIds,
  criticalTaskIds,
  showPlanningColumns,
  showTrackingColumns,
  statusDate,
  taskNameWidth,
  onTaskNameWidthChange,
  onSelect,
  onUpdate,
  onToggleCollapse,
}: TaskTableProps) {
  function beginColumnResize(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = taskNameWidth;

    const onMove = (moveEvent: PointerEvent) => {
      onTaskNameWidthChange(
        Math.min(520, Math.max(170, startWidth + moveEvent.clientX - startX)),
      );
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  }

  return (
    <div
      className="task-pane"
      style={{ "--task-name-width": `${taskNameWidth}px` } as React.CSSProperties}
    >
      <table className="schedule-table">
        <thead>
          <tr>
            <th className="number-column">WBS</th>
            <th className="task-name-column">
              Työvaihe
              <button
                type="button"
                className="column-resizer"
                aria-label="Muuta työvaihesarakkeen leveyttä"
                onPointerDown={beginColumnResize}
              />
            </th>
            <th className="duration-column">Kesto</th>
            <th className="date-column">Alku</th>
            <th className="date-column">Loppu</th>

            {showPlanningColumns && (
              <>
                <th className="area-column">Rakennus / alue</th>
                <th className="owner-column">Vastuu</th>
                <th className="predecessor-column">Edeltävä</th>
                <th className="lag-column">Viive</th>
              </>
            )}

            {showTrackingColumns && (
              <>
                <th className="complete-column">Valmis</th>
                <th className="progress-column">Tot. kesto-%</th>
                <th className="date-column">Tot. alku</th>
                <th className="date-column">Tot. loppu</th>
              </>
            )}
          </tr>
        </thead>

        <tbody>
          {visibleTasks.map((task) => {
            const originalIndex = tasks.findIndex((item) => item.id === task.id);
            const end = workdayEnd(task.start, task.duration);
            const complete = (task.progress ?? 0) >= 100;

            return (
              <tr
                key={task.id}
                className={[
                  selectedIds.has(task.id) ? "selected" : "",
                  task.type === "summary" ? "summary-row" : "",
                  criticalTaskIds.has(task.id) ? "critical-row" : "",
                ].join(" ")}
                onClick={(event) =>
                  onSelect(task.id, {
                    additive: event.ctrlKey || event.metaKey,
                    range: event.shiftKey,
                  })
                }
              >
                <td className="wbs-cell">{getWbs(tasks, originalIndex)}</td>

                <td className="task-name-cell">
                  {task.type === "summary" && (
                    <button
                      className="collapse-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggleCollapse(task.id);
                      }}
                    >
                      {task.collapsed ? "▸" : "▾"}
                    </button>
                  )}
                  <input
                    className="task-name-input"
                    style={{ paddingLeft: 7 + task.level * 16 }}
                    value={task.name}
                    onFocus={() => onSelect(task.id, { additive: false, range: false })}
                    onChange={(event) => onUpdate(task.id, { name: event.target.value })}
                  />
                </td>

                <td>
                  <input
                    type="number"
                    min={1}
                    disabled={task.type === "summary"}
                    value={task.duration}
                    onChange={(event) =>
                      onUpdate(task.id, {
                        duration: Math.max(1, Number(event.target.value)),
                      })
                    }
                  />
                </td>

                <td>
                  <input
                    type="date"
                    disabled={task.type === "summary"}
                    value={task.start}
                    onChange={(event) => onUpdate(task.id, { start: event.target.value })}
                  />
                </td>

                <td className="readonly-date">{displayDate(end)}</td>

                {showPlanningColumns && (
                  <>
                    <td>
                      <input
                        value={task.area ?? ""}
                        disabled={task.type === "summary"}
                        onChange={(event) => onUpdate(task.id, { area: event.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        value={task.owner ?? ""}
                        disabled={task.type === "summary"}
                        onChange={(event) => onUpdate(task.id, { owner: event.target.value })}
                      />
                    </td>
                    <td>
                      <select
                        value={task.predecessorId ?? ""}
                        disabled={task.type === "summary"}
                        onChange={(event) =>
                          onUpdate(task.id, {
                            predecessorId: event.target.value
                              ? Number(event.target.value)
                              : undefined,
                          })
                        }
                      >
                        <option value="">–</option>
                        {tasks
                          .filter(
                            (candidate) =>
                              candidate.id !== task.id && candidate.type !== "summary",
                          )
                          .map((candidate) => {
                            const i = tasks.findIndex((item) => item.id === candidate.id);
                            return (
                              <option key={candidate.id} value={candidate.id}>
                                {getWbs(tasks, i)} {candidate.name}
                              </option>
                            );
                          })}
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        value={task.lagDays ?? 0}
                        disabled={task.type === "summary" || !task.predecessorId}
                        onChange={(event) =>
                          onUpdate(task.id, { lagDays: Number(event.target.value) })
                        }
                      />
                    </td>
                  </>
                )}

                {showTrackingColumns && (
                  <>
                    <td className="complete-cell">
                      <select
                        value={complete ? "yes" : "no"}
                        disabled={task.type === "summary"}
                        onChange={(event) => {
                          const isComplete = event.target.value === "yes";
                          onUpdate(task.id, isComplete
                            ? {
                                progress: 100,
                                started: true,
                                actualStart: task.actualStart ?? task.start,
                                actualEnd: task.actualEnd ?? statusDate,
                              }
                            : {
                                progress: Math.min(99, task.progress ?? 0),
                                actualEnd: undefined,
                              });
                        }}
                      >
                        <option value="no">Ei</option>
                        <option value="yes">Kyllä</option>
                      </select>
                    </td>
                    <td className="progress-cell">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        disabled={task.type === "summary"}
                        value={Math.round(task.progress ?? 0)}
                        onChange={(event) => {
                          const progress = Math.min(
                            100,
                            Math.max(0, Number(event.target.value)),
                          );
                          onUpdate(task.id, {
                            progress,
                            started: progress > 0,
                            actualStart:
                              progress > 0 ? task.actualStart ?? task.start : undefined,
                            actualEnd:
                              progress >= 100 ? task.actualEnd ?? statusDate : undefined,
                          });
                        }}
                      />
                      <span>%</span>
                    </td>
                    <td>
                      <input
                        type="date"
                        disabled={task.type === "summary"}
                        value={task.actualStart ?? ""}
                        onChange={(event) =>
                          onUpdate(task.id, {
                            actualStart: event.target.value || undefined,
                            started: Boolean(event.target.value),
                          })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        disabled={task.type === "summary"}
                        value={task.actualEnd ?? ""}
                        onChange={(event) =>
                          onUpdate(task.id, {
                            actualEnd: event.target.value || undefined,
                            progress: event.target.value ? 100 : task.progress,
                          })
                        }
                      />
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
