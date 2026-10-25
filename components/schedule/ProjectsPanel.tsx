import { useState } from "react";
import type { ProjectListing } from "@/types/workspace";

type Props = {
  open: boolean;
  catalog: ProjectListing[];
  activeId: string;
  onClose: () => void;
  onOpen: (id: string) => void;
  onCreate: (number: string, name: string) => void;
  onDuplicate: (id: string) => void;
};

function formatUpdated(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("fi-FI");
}

export function ProjectsPanel(props: Props) {
  const [newNumber, setNewNumber] = useState("");
  const [newName, setNewName] = useState("");
  const [query, setQuery] = useState("");
  if (!props.open) return null;

  const projects = [...props.catalog]
    .filter((entry) => `${entry.projectNumber} ${entry.projectName} ${entry.scheduleName}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="ux-overlay" role="presentation" onMouseDown={props.onClose}>
      <section className="ux-panel projects-panel" role="dialog" aria-modal="true" aria-label="Projektit" onMouseDown={(event) => event.stopPropagation()}>
        <header className="ux-panel-header">
          <div><span>SNEDO / TYÖT</span><h2>Projektit</h2><p>Avaa tai aloita työmaan aikataulu.</p></div>
          <button type="button" aria-label="Sulje" onClick={props.onClose}>×</button>
        </header>

        <div className="new-project-card">
          <strong>+ Uusi aikataulu</strong>
          <div className="new-project-fields">
            <label>Työnumero<input value={newNumber} onChange={(e) => setNewNumber(e.target.value)} placeholder="27001" /></label>
            <label>Kohde<input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="As Oy…" /></label>
            <button type="button" disabled={!newName.trim()} onClick={() => {
              props.onCreate(newNumber.trim(), newName.trim());
              setNewNumber(""); setNewName("");
            }}>Luo</button>
          </div>
        </div>

        <div className="projects-search">
          <label htmlFor="search-schedules">Aiemmat projektit</label>
          <input id="search-schedules" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Hae kohdetta…" />
        </div>

        <div className="project-card-list">
          {projects.map((entry) => (
            <article key={entry.id} className={entry.id === props.activeId ? "project-card-item current" : "project-card-item"}>
              <div className="project-tile-mark">▤</div>
              <div className="project-tile-content">
                <strong>{entry.projectName}</strong>
                <span>{entry.projectNumber || "Ei työnumeroa"} · {entry.scheduleName}</span>
                <small>Muokattu {formatUpdated(entry.updatedAt)}</small>
              </div>
              <div className="project-tile-actions">
                <button type="button" disabled={entry.id === props.activeId} onClick={() => props.onOpen(entry.id)}>{entry.id === props.activeId ? "Auki" : "Avaa"}</button>
                <button type="button" onClick={() => props.onDuplicate(entry.id)} title="Tee erillinen kopio projektista">Kopioi</button>
              </div>
            </article>
          ))}
          {projects.length === 0 && <div className="ux-empty">Hakua vastaavia projekteja ei löytynyt.</div>}
        </div>
        <p className="ux-panel-note">Projektit tallentuvat tällä hetkellä vain tämän tietokoneen selaimeen. Ota tärkeistä aikatauluista JSON-varmuuskopiot. Tiedot eivät vielä synkronoidu muiden käyttäjien kesken.</p>
      </section>
    </div>
  );
}
