type Props = {
  showPlanningColumns: boolean;
  modeLabel?: string;
  showTrackingColumns: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onAddTask: () => void;
  onRemoveTask: () => void;
  onCopyTask: () => void;
  onIndent: () => void;
  onOutdent: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onCalculateDependencies: () => void;
  onTogglePlanningColumns: () => void;
  onToggleTrackingColumns: () => void;
  onSaveBaseline: () => void;
  onOpenView: () => void;
  onExportJson: () => void;
  onImportJson: () => void;
  onExportCsv: () => void;
  onImportCsv: () => void;
};

export function TopBar(props: Props) {
  return (
    <header className="topbar">
      <div className="page-title">
        <span>{props.modeLabel ?? "YLEISAIKATAULU"}</span>
        <strong>Snedo Aikataulu</strong>
      </div>

      <nav className="topbar-actions">
        <div className="topbar-group">
          <button disabled={!props.canUndo} onClick={props.onUndo} title="Kumoa (Ctrl+Z)">↶</button>
          <button disabled={!props.canRedo} onClick={props.onRedo} title="Tee uudelleen (Ctrl+Y)">↷</button>
        </div>

        <div className="topbar-group">
          <button className="primary-action" onClick={props.onAddTask}>+ Työvaihe</button>
          <button onClick={props.onCopyTask} title="Kopioi rivit (Ctrl+D)">Kopioi</button>
          <button className="danger-text" onClick={() => { if (window.confirm("Poistetaanko valitut työvaiheet?")) props.onRemoveTask(); }}>Poista</button>
        </div>

        <div className="topbar-group compact">
          <button onClick={props.onIndent} title="Sisennä">→|</button>
          <button onClick={props.onOutdent} title="Ulonna">|←</button>
          <button onClick={props.onMoveUp} title="Siirrä ylös">↑</button>
          <button onClick={props.onMoveDown} title="Siirrä alas">↓</button>
        </div>

        <div className="topbar-group topbar-group-right">
          <button
            className={props.showPlanningColumns ? "active-tool" : ""}
            onClick={props.onTogglePlanningColumns}
          >
            Suunnittelu
          </button>
          <button
            className={props.showTrackingColumns ? "active-tool" : ""}
            onClick={props.onToggleTrackingColumns}
          >
            Seuranta
          </button>
          <button onClick={props.onOpenView}>⚙ Näkymä</button>

          <details className="more-menu">
            <summary>Lisää ▾</summary>
            <div className="more-menu-popover">
              <button onClick={props.onSaveBaseline}>Tallenna tavoite</button>
              <button onClick={props.onCalculateDependencies}>Laske riippuvuudet</button>
              <div className="more-menu-divider" />
              <button onClick={props.onExportJson}>Varmuuskopio (JSON)</button>
              <button onClick={props.onImportJson}>Avaa JSON</button>
              <button onClick={props.onExportCsv}>Vie CSV</button>
              <button onClick={props.onImportCsv}>Tuo CSV</button>
            </div>
          </details>

        </div>
      </nav>
    </header>
  );
}
