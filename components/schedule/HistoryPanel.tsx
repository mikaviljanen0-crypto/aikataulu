import { useState } from "react";
import type { TrackingSnapshot } from "@/types/workspace";

type Props = {
  open: boolean;
  snapshots: TrackingSnapshot[];
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
          <div><span>AIKATAULU / SEURANTA</span><h2>Tilannekuvat</h2><p>Tallenna työmaakokouksen toteumatiedot vertailua varten.</p></div>
          <button type="button" aria-label="Sulje" onClick={props.onClose}>×</button>
        </header>
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
