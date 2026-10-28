import { useState } from "react";
import type { TrackingSnapshot } from "@/types/workspace";
import type { ProjectPulse } from "@/lib/progress";

type TrackedIssue = {
  id: number;
  wbs: string;
  name: string;
  actual: number;
  expected: number;
};

type Props = {
  open: boolean;
  snapshots: TrackingSnapshot[];
  projectName: string;
  pulse: ProjectPulse;
  changedCount: number;
  lateTasks: TrackedIssue[];
  onShowLate: () => void;
  onClose: () => void;
  onSave: (note: string) => void;
  onRestore: (id: string) => void;
};

function dateText(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("fi-FI");
}

export function HistoryPanel(props: Props) {
  const [note, setNote] = useState("");
  if (!props.open) return null;

  return (
    <div className="ux-overlay" role="presentation" onMouseDown={props.onClose}>
      <section className="ux-panel history-panel" role="dialog" aria-modal="true" aria-label="Seurannan historia" onMouseDown={(e) => e.stopPropagation()}>
        <header className="ux-panel-header">
          <div><span>AIKATAULU / TYÖMAAKOKOUS</span><h2>{props.projectName}</h2><p>Tilannekuva, etenemäpoikkeamat ja kokousten kirjaukset.</p></div>
          <button type="button" aria-label="Sulje" onClick={props.onClose}>×</button>
        </header>
        <div className="meeting-pulse-grid">
          <div><small>Valmiusaste</small><strong>{props.pulse.totalProgress} %</strong></div>
          <div><small>Valmiit työvaiheet</small><strong>{props.pulse.completeCount}/{props.pulse.taskCount}</strong></div>
          <div><small>Tarkistettavat poikkeamat</small><strong>{props.lateTasks.length}</strong></div>
          <div><small>Muuttuneet viime tilannekuvasta</small><strong>{props.snapshots.length ? props.changedCount : "–"}</strong></div>
        </div>
        <div className="meeting-late-block">
          <div className="meeting-late-head">
            <div><strong>Seurannan poikkeamat</strong><small>Suuntaa antava vertailu tasaisen työpäiväetenemän perusteella</small></div>
            <button type="button" onClick={props.onShowLate} disabled={!props.lateTasks.length}>Näytä aikataulussa</button>
          </div>
          {props.lateTasks.length === 0
            ? <p className="meeting-empty">Ei tunnistettuja etenemäpoikkeamia valittuna seurantahetkenä.</p>
            : props.lateTasks.slice(0, 10).map((task) => (
              <div className="meeting-late-row" key={task.id}>
                <span>{task.wbs}</span>
                <strong>{task.name}</strong>
                <small>{Math.round(task.actual)} % / tavoite noin {Math.round(task.expected)} %</small>
              </div>
            ))
          }
          {props.lateTasks.length > 10 && <p className="meeting-empty">Lisäksi {props.lateTasks.length - 10} tehtävää. Avaa poikkeamasuodatus.</p>}
        </div>
        <div className="new-project-card">
          <label>Merkintä / työmaakokous
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Esim. Työmaakokous 5" />
          </label>
          <button type="button" className="ux-primary" onClick={() => { props.onSave(note.trim()); setNote(""); }}>Tallenna nykyinen tilanne</button>
        </div>
        <div className="snapshot-list">
          {[...props.snapshots].reverse().map((item) => (
            <article className="snapshot-item" key={item.id}>
              <div className="snapshot-date-icon">◷</div>
              <div className="snapshot-description">
                <strong>{dateText(item.statusDate)} <span>{item.completion} %</span></strong>
                <p>{item.note || "Tilannekuva"}</p>
                <small>Tallennettu {new Date(item.createdAt).toLocaleString("fi-FI")}</small>
              </div>
              <button type="button" onClick={() => props.onRestore(item.id)}>Palauta</button>
            </article>
          ))}
          {props.snapshots.length === 0 && <div className="ux-empty">Ei tallennettuja tilannekuvia. Tallenna ensimmäinen seurantahetki tästä.</div>}
        </div>
        <p className="ux-panel-note">Tilannekuva sisältää aikataulun ja toteumatiedot sellaisina kuin ne olivat tallennushetkellä. Palautus korvaa nykyiset rivit vahvistuksen jälkeen. Historia sisältyy JSON-varmuuskopioon.</p>
      </section>
    </div>
  );
}
