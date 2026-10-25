import type { ProjectPulse } from "@/lib/progress";

export type TaskFilter = "all" | "unfinished" | "behind";

type Props = {
  search: string;
  filter: TaskFilter;
  pulse: ProjectPulse;
  statusDate: string;
  onSearch: (value: string) => void;
  onFilter: (value: TaskFilter) => void;
  onFit: () => void;
  onProjects: () => void;
  onHistory: () => void;
  onPrint: () => void;
};

export function QuickBar(props: Props) {
  return (
    <section className="quickbar" aria-label="Aikataulun pikatyökalut">
      <div className="quickbar-search">
        <span aria-hidden="true">⌕</span>
        <input
          type="search"
          placeholder="Hae työvaihetta, aluetta tai vastuuta…"
          aria-label="Hae työvaiheista"
          value={props.search}
          onChange={(event) => props.onSearch(event.target.value)}
        />
        {props.search && <button type="button" title="Tyhjennä haku" onClick={() => props.onSearch("")}>×</button>}
      </div>

      <div className="quick-filters" role="group" aria-label="Näytettävät tehtävät">
        <button type="button" className={props.filter === "all" ? "active" : ""} onClick={() => props.onFilter("all")}>Kaikki</button>
        <button type="button" className={props.filter === "unfinished" ? "active" : ""} onClick={() => props.onFilter("unfinished")}>Kesken <b>{props.pulse.taskCount - props.pulse.completeCount}</b></button>
        <button type="button" className={props.filter === "behind" ? "active risk" : ""} onClick={() => props.onFilter("behind")}>Jäljessä <b>{props.pulse.behindCount}</b></button>
      </div>

      <div className="quick-progress" title="Kestolla painotettu toteutuma">
        <span>Valmius <strong>{props.pulse.totalProgress} %</strong></span>
        <div className="quick-progress-track"><div style={{ width: `${props.pulse.totalProgress}%` }} /></div>
      </div>

      <div className="quickbar-actions">
        <button type="button" onClick={props.onFit} title="Sovita koko aikataulu näkyviin">Sovita</button>
        <button type="button" onClick={props.onHistory}>Tilannekuvat</button>
        <button type="button" className="quick-project-button" onClick={props.onProjects}>Projektit</button>
        <button type="button" className="quick-print-button" onClick={props.onPrint}>Tulosta</button>
      </div>
    </section>
  );
}
