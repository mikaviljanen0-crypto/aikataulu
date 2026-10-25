"use client";

import type { ProjectPulse } from "@/lib/progress";

export type TaskFilter = "all" | "unfinished" | "behind";

type Props = {
  projectName: string;
  statusDate: string;
  search: string;
  filter: TaskFilter;
  pulse: ProjectPulse;
  resultCount: number;
  onSearchChange: (value: string) => void;
  onFilterChange: (value: TaskFilter) => void;
  onOpenMeeting: () => void;
  onOpenProjects: () => void;
};

export function ScheduleInsights(props: Props) {
  return (
    <section className="schedule-insights">
      <div className="schedule-pulse">
        <div className="pulse-progress">
          <div><span>TYÖMAAN TILANNE</span><strong>{props.pulse.totalProgress} %</strong></div>
          <div className="pulse-track"><span style={{ width: `${props.pulse.totalProgress}%` }} /></div>
        </div>
        <div className="pulse-metric"><span>Valmiit</span><strong>{props.pulse.completeCount}/{props.pulse.taskCount}</strong></div>
        <div className="pulse-metric"><span>Kesken</span><strong>{props.pulse.taskCount - props.pulse.completeCount}</strong></div>
        <div className="pulse-metric"><span>Mahdollisesti jäljessä</span><strong>{props.pulse.behindCount}</strong></div>
        <div className="pulse-actions">
          <button type="button" onClick={props.onOpenProjects}>Projektit</button>
          <button type="button" className="snedo-primary-button" onClick={props.onOpenMeeting}>Työmaakokous</button>
        </div>
      </div>
      <div className="schedule-filterbar">
        <label>
          <span className="visually-hidden">Hae työvaiheista</span>
          <input value={props.search} onChange={(e) => props.onSearchChange(e.target.value)} placeholder="Hae työvaihetta tai aluetta…" />
        </label>
        <div className="filter-buttons" role="group" aria-label="Työvaiheiden suodatus">
          <button type="button" className={props.filter === "all" ? "active" : ""} onClick={() => props.onFilterChange("all")}>Kaikki</button>
          <button type="button" className={props.filter === "unfinished" ? "active" : ""} onClick={() => props.onFilterChange("unfinished")}>Kesken</button>
          <button type="button" className={props.filter === "behind" ? "active" : ""} onClick={() => props.onFilterChange("behind")}>Myöhässä ({props.pulse.behindCount})</button>
        </div>
        <span className="filter-results">{props.resultCount} riviä näkyvissä</span>
      </div>
    </section>
  );
}
