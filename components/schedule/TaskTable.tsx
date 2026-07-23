import { formatEndDate } from "@/lib/date";
import type { Task } from "@/types/schedule";

type TaskTableProps = {
  tasks: Task[];
  selectedId: number;
  onSelect: (id: number) => void;
  onUpdate: (id: number, patch: Partial<Task>) => void;
};

export function TaskTable({
  tasks,
  selectedId,
  onSelect,
  onUpdate,
}: TaskTableProps) {
  return (
    <div className="task-pane">
      <table>
        <thead>
          <tr>
            <th className="number-column">#</th>
            <th>Työvaihe</th>
            <th className="duration-column">Kesto</th>
            <th className="date-column">Alku</th>
            <th className="date-column">Loppu</th>
          </tr>
        </thead>

        <tbody>
          {tasks.map((task, index) => (
            <tr
              key={task.id}
              className={task.id === selectedId ? "selected" : ""}
              onClick={() => onSelect(task.id)}
            >
              <td>{index + 1}</td>
              <td>
                <input
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
                  value={task.start}
                  onChange={(event) =>
                    onUpdate(task.id, { start: event.target.value })
                  }
                />
              </td>
              <td>{formatEndDate(task.start, task.duration)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
