import { addDays, daysBetween } from "@/lib/date";
import { addWorkdays, workdayEnd } from "@/lib/calendar";
import { getWbs } from "@/lib/wbs";
import { isBehind } from "@/lib/progress";
import type { Task } from "@/types/schedule";

type Props = {
  tasks: Task[];
  fullTasks: Task[];
  projectNumber: string;
  projectName: string;
  scheduleName: string;
  statusDate: string;
  showBaseline: boolean;
  showTracking: boolean;
  extraDaysOff: string[];
};

const MAX_ROWS = 38;

function fiDate(value: string): string {
  if (!value) return "—";
  const parts = value.split("-");
  return parts.length === 3 ? `${Number(parts[2])}.${Number(parts[1])}.${parts[0]}` : value;
}

function isoWeek(value: string): number {
  const date = new Date(`${value}T12:00:00Z`);
  const d = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - d);
  const first = new Date(Date.UTC(date.getUTCFullYear(), 0, 1, 12));
  return Math.ceil(((date.getTime() - first.getTime()) / 86400000 + 1) / 7);
}

function segments(start: string, count: number, unit: "month" | "week") {
  const out: { key: string; label: string; first: number; count: number }[] = [];
  for (let index = 0; index < count; index += 1) {
    const value = addDays(start, index);
    const date = new Date(`${value}T12:00:00Z`);
    const week = isoWeek(value);
    const key = unit === "month" ? `${date.getUTCFullYear()}-${date.getUTCMonth()}` : `${date.getUTCFullYear()}-${week}`;
    const label = unit === "month"
      ? date.toLocaleDateString("fi-FI", { month: "long", year: "numeric", timeZone: "UTC" })
      : `vko ${week}`;
    const previous = out.at(-1);
    if (previous && previous.key === key) previous.count += 1;
    else out.push({ key, label, first: index, count: 1 });
  }
  return out;
}

function trackingDate(task: Task, statusDate: string, extraDaysOff: string[]): string {
  const start = task.baselineStart ?? task.start;
  const duration = task.baselineDuration ?? task.duration;
  const progress = Math.max(0, Math.min(100, task.progress ?? 0));
  if (progress === 0) return start > statusDate ? statusDate : start;
  if (progress === 100) return task.actualEnd || workdayEnd(start, duration, extraDaysOff);
  return addWorkdays(start, Math.max(0, Math.round((duration - 1) * progress / 100)), extraDaysOff);
}

function xPercent(value: string, start: string, total: number): number {
  return Math.max(0, Math.min(100, ((daysBetween(start, value) + .5) / total) * 100));
}

function barStyle(begin: string, finish: string, start: string, total: number) {
  const from = daysBetween(start, begin);
  const end = daysBetween(start, finish) + 1;
  const left = Math.max(0, from / total * 100);
  const right = Math.min(100, end / total * 100);
  return { left: `${left}%`, width: `${Math.max(0, right - left)}%` };
}

export function PrintReport(props: Props) {
  const leaves = props.fullTasks.filter((task) => task.type !== "summary");
  const starts = leaves.map((task) => task.start).sort();
  const ends = leaves.map((task) => workdayEnd(task.start, task.duration, props.extraDaysOff)).sort();
  const first = starts[0] ?? props.statusDate;
  const last = ends.at(-1) ?? props.statusDate;
  const start = addDays(first, -5);
  const end = addDays(last, 12);
  const total = Math.max(1, daysBetween(start, end) + 1);
  const monthSegments = segments(start, total, "month");
  const weekSegments = segments(start, total, "week");
  const pages: Task[][] = [];
  for (let index = 0; index < props.tasks.length; index += MAX_ROWS) {
    pages.push(props.tasks.slice(index, index + MAX_ROWS));
  }
  if (!pages.length) pages.push([]);
  const today = new Date().toISOString().slice(0, 10);
  const nowVisible = start <= today && today <= end;

  return (
    <section className="snedo-print" aria-label="Tulostettava työmaakokousraportti">
      {pages.map((rows, pageIndex) => {
        const rowHeight = Math.min(10, Math.max(5.6, 205 / Math.max(1, rows.length)));
        const trackingPoints = rows.map((task, i) => ({
          x: xPercent(trackingDate(task, props.statusDate, props.extraDaysOff), start, total) * 10,
          y: i * 28 + 14,
        }));
        const line = trackingPoints.length
          ? trackingPoints.slice(1).reduce((path, point, i) => {
              const previous = trackingPoints[i];
              const middle = (previous.y + point.y) / 2;
              return `${path} V${middle} H${point.x} V${point.y}`;
            }, `M${trackingPoints[0].x} ${trackingPoints[0].y}`)
          : "";

        return (
          <div className="report-sheet" key={pageIndex} style={{ "--report-row-height": `${rowHeight}mm` } as React.CSSProperties}>
            <header className="report-head">
              <div className="report-logo"><span>S</span><strong>SNEDO</strong></div>
              <div className="report-title">
                <small>{props.showTracking ? "TYÖMAAKOKOUS · AIKATAULUSEURANTA" : "TYÖMAAN YLEISAIKATAULU"}</small>
                <h1>{props.projectName}</h1>
                <p>{props.projectNumber} · {props.scheduleName}</p>
              </div>
              <div className="report-date"><small>SEURANTAPÄIVÄ</small><strong>{fiDate(props.statusDate)}</strong><span>{pageIndex + 1} / {pages.length}</span></div>
            </header>

            <div className="report-legend">
              <span><i className="plan" /> Suunnitelma</span>
              {props.showBaseline && <span><i className="target" /> Tavoite</span>}
              {props.showTracking && <><span><i className="actual" /> Toteuma</span><span><i className="tracking" /> Tilanneviiva</span></>}
              <span><i className="today" /> Nykyhetki</span>
            </div>

            <div className="report-table-grid">
              <div className="report-left">
                <div className="report-column-head">
                  <span>WBS</span><span>Työvaihe</span><span>Kesto</span><span>Alku</span><span>Loppu</span><span>Valmis</span><span>Tot. %</span>
                </div>
                {rows.map((task) => {
                  const originalIndex = props.fullTasks.findIndex((value) => value.id === task.id);
                  const behind = isBehind(task, props.statusDate, props.extraDaysOff);
                  return (
                    <div key={task.id} className={`report-table-row ${task.type === "summary" ? "summary" : ""} ${behind ? "late" : ""}`}>
                      <span>{originalIndex < 0 ? "" : getWbs(props.fullTasks, originalIndex)}</span>
                      <strong style={{ paddingLeft: `${Math.min(18, task.level * 5)}px` }}>{task.name}</strong>
                      <span>{task.duration}</span>
                      <span>{fiDate(task.start)}</span>
                      <span>{fiDate(workdayEnd(task.start, task.duration, props.extraDaysOff))}</span>
                      <span>{(task.progress ?? 0) >= 100 ? "Kyllä" : "Ei"}</span>
                      <span>{Math.round(task.progress ?? 0)} %</span>
                    </div>
                  );
                })}
              </div>

              <div className="report-right">
                <div className="report-calendar">
                  <div>{monthSegments.map((segment) => (
                    <span key={segment.key} style={{ left: `${segment.first / total * 100}%`, width: `${segment.count / total * 100}%` }}>{segment.count / total > .09 ? segment.label : ""}</span>
                  ))}</div>
                  <div>{weekSegments.map((segment) => (
                    <span key={segment.key} style={{ left: `${segment.first / total * 100}%`, width: `${segment.count / total * 100}%` }}>{segment.count / total > .035 ? segment.label : ""}</span>
                  ))}</div>
                </div>
                <div className="report-chart-body" style={{ height: `calc(var(--report-row-height) * ${rows.length})` }}>
                  {weekSegments.map((segment) => <div key={segment.key} className="report-week-gridline" style={{ left: `${segment.first / total * 100}%` }} />)}
                  {rows.map((task, i) => {
                    const lastDay = workdayEnd(task.start, task.duration, props.extraDaysOff);
                    const baselineEnd = task.baselineStart && task.baselineDuration
                      ? workdayEnd(task.baselineStart, task.baselineDuration, props.extraDaysOff) : undefined;
                    const current = barStyle(task.start, lastDay, start, total);
                    const progress = Math.max(0, Math.min(100, task.progress ?? 0));
                    return (
                      <div key={task.id} className={`report-chart-row ${task.type === "summary" ? "summary" : ""}`} style={{ top: `calc(var(--report-row-height) * ${i})` }}>
                        {props.showBaseline && task.baselineStart && baselineEnd && <div className="report-target-bar" style={barStyle(task.baselineStart, baselineEnd, start, total)} />}
                        <div className="report-plan-bar" style={current}>
                          {props.showTracking && <div className="report-actual-fill" style={{ width: `${progress}%` }} />}
                        </div>
                      </div>
                    );
                  })}
                  {nowVisible && <div className="report-today-line" style={{ left: `${xPercent(today, start, total)}%` }} />}
                  {props.showTracking && line && (
                    <svg className="report-tracking" preserveAspectRatio="none" viewBox={`0 0 1000 ${rows.length * 28}`} aria-hidden="true">
                      <path d={line} />
                    </svg>
                  )}
                </div>
              </div>
            </div>

            <footer className="report-footer">
              <span>Tampereen Julkisivutekniikka Oy</span>
              <span>Tulostettu {fiDate(today)} · Snedo Aikataulu</span>
              <span>Sivu {pageIndex + 1} / {pages.length}</span>
            </footer>
          </div>
        );
      })}
    </section>
  );
}
