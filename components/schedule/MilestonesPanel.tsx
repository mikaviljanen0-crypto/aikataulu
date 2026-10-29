"use client";

import { useState } from "react";
import type { ScheduleMilestone } from "@/types/workspace";

type Props = {
  milestones: ScheduleMilestone[];
  initialDate: string;
  onAdd: (title: string, date: string) => void;
  onUpdate: (id: string, patch: Partial<Pick<ScheduleMilestone, "title" | "date">>) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
};

function formatDate(date: string): string {
  const [year, month, day] = date.split("-");
  return day && month && year ? `${Number(day)}.${Number(month)}.${year}` : date;
}

export function MilestonesPanel(props: Props) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(props.initialDate);
  const sorted = [...props.milestones].sort((a, b) => a.date.localeCompare(b.date));

  function add() {
    if (!title.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    props.onAdd(title.trim(), date);
    setTitle("");
  }

  return (
    <div className="snedo-dialog-layer" role="dialog" aria-modal="true" aria-label="Välitavoitteet">
      <button className="snedo-dialog-backdrop" aria-label="Sulje välitavoitteet" onClick={props.onClose}/>
      <aside className="snedo-dialog">
        <header className="snedo-dialog-head">
          <div>
            <span className="eyebrow">AIKATAULUN MÄÄRÄPÄIVÄT</span>
            <h2>Välitavoitteet</h2>
            <p>Kirjaa sovitut nimet ja päivämäärät. Pystysuorat viivat näkyvät Ganttissa ja A3/PDF-tulosteessa.</p>
          </div>
          <button className="snedo-close" aria-label="Sulje" onClick={props.onClose}>×</button>
        </header>
        <div className="snedo-dialog-body">
          <div className="milestone-form">
            <label>Nimi
              <input value={title} onChange={e => setTitle(e.target.value)}
                placeholder="Esim. Parvekkeiden maalaus valmis"
                onKeyDown={e => { if (e.key === "Enter") add(); }}/>
            </label>
            <label>Määräpäivä
              <input type="date" value={date} onChange={e => setDate(e.target.value)}/>
            </label>
            <button className="snedo-primary-button" disabled={!title.trim() || !date} onClick={add}>+ Lisää välitavoite</button>
          </div>

          <h3 className="calendar-heading">Merkityt välitavoitteet ({sorted.length})</h3>
          {sorted.length === 0 ? <p className="muted-paragraph">Ei vielä välitavoitteita. Voit lisätä niitä tarvittavan määrän.</p> :
            <div className="milestone-list">
              {sorted.map((item, index) => (
                <div className="milestone-item" key={item.id}>
                  <span className="milestone-index">VT{index + 1}</span>
                  <label>Nimi
                    <input aria-label={`VT${index+1} nimi`} value={item.title}
                      onChange={e => props.onUpdate(item.id, {title:e.target.value})}/>
                  </label>
                  <label>Päivä
                    <input aria-label={`VT${index+1} päivä`} type="date" value={item.date}
                      onChange={e => props.onUpdate(item.id, {date:e.target.value})}/>
                  </label>
                  <button className="milestone-delete" aria-label={`Poista VT${index+1}`}
                    onClick={() => props.onRemove(item.id)}>Poista</button>
                </div>
              ))}
            </div>
          }
          <p className="calendar-tip">Välitavoitteen viiva pysyy sovitussa päivämäärässä, vaikka työvaiheiden ajoitus muuttuu. Muutokset tallentuvat automaattisesti tälle projektille ja JSON-varmuuskopioon.</p>
          {sorted.length > 0 && <div className="milestone-summary">
            {sorted.map((item,i) => <div key={item.id}><strong>VT{i+1}</strong> {item.title || "Nimeämätön"} – {formatDate(item.date)}</div>)}
          </div>}
        </div>
      </aside>
    </div>
  );
}
