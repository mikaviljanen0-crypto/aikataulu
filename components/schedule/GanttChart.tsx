import { dateOffset, RANGE_START } from "@/lib/date";
import type { Task } from "@/types/schedule";

const DAY_WIDTH = 22;

type GanttChartProps = {
  tasks: Task[];
};

export function GanttChart({ tasks }: GanttChartProps) {
  const weeks = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(RANGE_START);
    date.setDate(date.getDate() + index * 7);

    return {
      label: `vko ${27 + index}`,
      month: date.toLocaleDateString("fi-FI", { month: "long" }),
    };
  });

  return (
    <div className="gantt-pane">
      <div className="calendar-header">
        {weeks.map((week, index) => (
          <div className="week" key={week.label}>
            <span>
              {index === 0 || weeks[index - 1].month !== week.month
                ? week.month
                : ""}
            </span>
            <strong>{week.label}</strong>
          </div>
        ))}
      </div>

      <div className="gantt-body">
        {tasks.map((task, index) => (
          <div className="gantt-row" key={task.id}>
            <div
              className="task-bar"
              style={{
                left: dateOffset(task.start) * DAY_WIDTH,
                width: task.duration * DAY_WIDTH,
              }}
            >
              <span>{index + 1}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
