"use client";

import { useState } from "react";
import type { MeetingSnapshot } from "@/lib/meeting";

type LateTask = {
  id: number;
  wbs: string;
  name: string;
  actual: number;
  expected: number;
};

type Props = {
  statusDate: string;
  projectName: string;
  totalProgress: number;
  completeCount: number;
  taskCount: number;
  lateTasks: LateTask[];
  snapshots: MeetingSnapshot[];
  changedCount: number;
  onClose: () => void;
  onSaveSnapshot: (note: string) => void;
  onShowLate: () => void;
};

function fi(value: string): string {
  if (!value) return "–";
  return new Date(`${value}T12:00:00`).toLocaleDateString("fi-FI");
}

export function MeetingPanel(props: Props) {
  const [note, setNote] = useState("");
  return (
    <div className="snedo-dialog-layer">
      <button type="button" className="snedo-dialog-backdrop" onClick={props.onClose} aria-label="Sulje työmaakokouksen seuranta" />
      <section className="snedo-dialog snedo-meeting-dialog" role="dialog" aria-modal="true" aria-label="Työmaakokouksen seuranta">
        <header className="snedo-dialog-head">
          <div>
            <span className="eyebrow">TYÖMAAKOKOUS · {fi(props.statusDate)}</span>
            <h2>{props.projectName}</h2>
            <p>Tilanne perustuu valittuun seurantapäivään ja kirjattuihin toteumaprosentteihin.</p>
          </div>
          <button type="button" className="snedo-close" onClick={props.onClose} aria-label="Sulje">×</button>
        </header>
        <div className="snedo-dialog-body">
          <div className="meeting-stats">
            <div><span>Valmiusaste</span><strong>{props.totalProgress} %</strong></div>
            <div><span>Valmiit työvaiheet</span><strong>{props.completeCount}/{props.taskCount}</strong></div>
            <div><span>Mahdollisesti jäljessä</span><strong>{props.lateTasks.length}</strong></div>
            <div><span>Muuttunut edellisestä</span><strong>{props.snapshots.length ? props.changedCount : "–"}</strong></div>
          </div>
          <div className="meeting-section-head">
            <div><strong>Seurantaa vaativat työvaiheet</strong><small>Arvioitu poikkeama tasaisen työpäiväetenemän perusteella</small></div>
            <button type="button" onClick={props.onShowLate} disabled={!props.lateTasks.length}>Näytä aikataulussa</button>
          </div>
          <div className="meeting-issues">
            {props.lateTasks.length === 0 && <p className="muted-paragraph">Ei automaattisesti tunnistettuja etenemäpoikkeamia valitulla seurantapäivällä.</p>}
            {props.lateTasks.slice(0, 12).map((task) => (
              <div className="meeting-issue" key={task.id}>
                <span>{task.wbs}</span>
                <strong>{task.name}</strong>
                <small>Toteuma {Math.round(task.actual)} % / suunnitelma noin {Math.round(task.expected)} %</small>
              </div>
            ))}
            {props.lateTasks.length > 12 && <p className="muted-paragraph">Lisäksi {props.lateTasks.length - 12} työvaihetta; avaa myöhässä-suodatus nähdäksesi kaikki.</p>}
          </div>
          <div className="meeting-section-head">
            <div><strong>Tallenna työmaakokouksen tilanne</strong><small>Kirjaus säilyy projektin seurantahistoriassa tällä koneella.</small></div>
          </div>
          <label className="meeting-note-label">
            Kokousmuistio tai havainnot
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Esim. telineiden purku siirtyi viikolle 44..." />
          </label>
          <button type="button" className="snedo-primary-button meeting-save-button" onClick={() => {
            props.onSaveSnapshot(note);
            setNote("");
          }}>Tallenna seurantatilanne</button>
          <div className="meeting-history">
            <strong>Aiemmat seurantatilanteet</strong>
            {props.snapshots.length === 0 && <p className="muted-paragraph">Ei vielä tallennettuja kokoustilanteita.</p>}
            {[...props.snapshots].reverse().slice(0, 8).map((snapshot) => (
              <div className="meeting-history-item" key={snapshot.id}>
                <span>{fi(snapshot.statusDate)}</span>
                <small>{snapshot.note || "Tilanne tallennettu ilman kommenttia"}</small>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
