"use client";

import { useState } from "react";

export type ProjectSummary = {
  id: string;
  projectNumber: string;
  projectName: string;
  scheduleName: string;
  taskCount: number;
  progress: number;
  active: boolean;
};

type Props = {
  projects: ProjectSummary[];
  onClose: () => void;
  onOpen: (id: string) => void;
  onCreate: (number: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
};

export function ProjectManager({
  projects, onClose, onOpen, onCreate, onDuplicate, onDelete,
}: Props) {
  const [search, setSearch] = useState("");
  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const filtered = projects.filter((project) =>
    `${project.projectNumber} ${project.projectName} ${project.scheduleName}`
      .toLocaleLowerCase("fi-FI")
      .includes(search.toLocaleLowerCase("fi-FI")),
  );

  function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    onCreate(number.trim(), name.trim());
    setName("");
    setNumber("");
  }

  return (
    <div className="snedo-dialog-layer">
      <button type="button" className="snedo-dialog-backdrop" onClick={onClose} aria-label="Sulje projektivalinta" />
      <section className="snedo-dialog snedo-project-dialog" role="dialog" aria-modal="true" aria-label="Projektien hallinta">
        <header className="snedo-dialog-head">
          <div>
            <span className="eyebrow">SNEDO AIKATAULU</span>
            <h2>Projektit</h2>
            <p>Vaihda työmaata tai aloita uusi aikataulu. Tiedot tallentuvat tämän selaimen muistiin.</p>
          </div>
          <button type="button" className="snedo-close" onClick={onClose} aria-label="Sulje">×</button>
        </header>
        <div className="snedo-dialog-body">
          <label className="snedo-search-field">
            <span>Hae projektia</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Työnumero tai kohteen nimi" />
          </label>
          <div className="project-picker-list">
            {filtered.length === 0 && <p className="muted-paragraph">Hakua vastaavia projekteja ei löytynyt.</p>}
            {filtered.map((project) => (
              <article className={`project-picker-item ${project.active ? "is-active" : ""}`} key={project.id}>
                <div className="project-picker-main">
                  <span className="project-picker-number">{project.projectNumber || "Ei työnumeroa"}</span>
                  <strong>{project.projectName}</strong>
                  <small>{project.scheduleName} · {project.taskCount} työvaihetta · {project.progress} % valmis</small>
                </div>
                <div className="project-picker-actions">
                  <button type="button" className={project.active ? "snedo-secondary-button" : "snedo-primary-button"} onClick={() => onOpen(project.id)}>
                    {project.active ? "Auki" : "Avaa"}
                  </button>
                  <button type="button" onClick={() => onDuplicate(project.id)} title="Tee projektista kopio">Kopioi</button>
                  <button type="button" onClick={() => onDelete(project.id)} title="Poista tämä projekti" disabled={projects.length < 2}>Poista</button>
                </div>
              </article>
            ))}
          </div>
          <form className="project-create-form" onSubmit={create}>
            <strong>Uusi työmaa</strong>
            <div className="project-create-fields">
              <label>Työnumero <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="27001" /></label>
              <label>Kohteen nimi <input value={name} onChange={(e) => setName(e.target.value)} placeholder="As Oy ..." required /></label>
              <button type="submit" className="snedo-primary-button">Luo projekti</button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
