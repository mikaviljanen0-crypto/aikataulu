import { formatEndDate } from "@/lib/date";
import { getWbs } from "@/lib/wbs";
import type { Task } from "@/types/schedule";

type TaskTableProps = {
  tasks: Task[];
  visibleTasks: Task[];
  selectedId: number;
  criticalTaskIds: Set<number>;
  showPlanningColumns: boolean;
  taskNameWidth: number;
  onTaskNameWidthChange: (width: number) => void;
  onSelect: (id: number) => void;
  onUpdate: (id: number, patch: Partial<Task>) => void;
  onToggleCollapse: (id: number) => void;
};

export function TaskTable({
  tasks,
  visibleTasks,
  selectedId,
  criticalTaskIds,
  showPlanningColumns,
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
      const nextWidth = Math.min(
        520,
        Math.max(150, startWidth + moveEvent.clientX - startX),
      );
      onTaskNameWidthChange(nextWidth);
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
      <table>
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
                <th className="predecessor-column">Edeltävä</th>
                <th className="lag-column">Viive</th>
              </>
            )}
          </tr>
        </thead>

        <tbody>
          {visibleTasks.map((task) => {
            const originalIndex = tasks.findIndex((item) => item.id === task.id);

            return (
              <tr
                key={task.id}
                className={`${task.id === selectedId ? "selected" : ""} ${
                  task.type === "summary" ? "summary-row" : ""
                } ${
                  criticalTaskIds.has(task.id) ? "critical-row" : ""
                }`}
                onClick={() => onSelect(task.id)}
              >
                <td>{getWbs(tasks, originalIndex)}</td>

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
                    style={{ paddingLeft: 8 + task.level * 18 }}
                    value={task.name}
                    onChange={(event) =>
                      onUpdate(task.id, { name: event.target.value })
                    }
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
                    onChange={(event) =>
                      onUpdate(task.id, { start: event.target.value })
                    }
                  />
                </td>

                <td>{formatEndDate(task.start, task.duration)}</td>

                {showPlanningColumns && (
                  <>
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
                              candidate.id !== task.id &&
                              candidate.type !== "summary",
                          )
                          .map((candidate) => {
                            const candidateIndex = tasks.findIndex(
                              (item) => item.id === candidate.id,
                            );

                            return (
                              <option key={candidate.id} value={candidate.id}>
                                {getWbs(tasks, candidateIndex)} {candidate.name}
                              </option>
                            );
                          })}
                      </select>
                    </td>

                    <td>
                      <input
                        type="number"
                        value={task.lagDays ?? 0}
                        disabled={
                          task.type === "summary" || !task.predecessorId
                        }
                        onChange={(event) =>
                          onUpdate(task.id, {
                            lagDays: Number(event.target.value),
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
