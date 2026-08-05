type Props = {
  showPlanningColumns: boolean;
  onAddTask: () => void;
  onRemoveTask: () => void;
  onIndent: () => void;
  onOutdent: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onCalculateDependencies: () => void;
  onTogglePlanningColumns: () => void;
  onOpenView: () => void;
  onReset: () => void;
};

export function TopBar(props: Props) {
  return (
    <header className="topbar">
      <div className="brand"><strong>Aikataulu</strong><span>Rakennusalan tuotannonsuunnittelu</span></div>
      <nav className="topbar-actions">
        <div className="topbar-group">
          <button className="primary-action" onClick={props.onAddTask}>+ Lisää</button>
          <button onClick={props.onRemoveTask}>Poista</button>
        </div>
        <div className="topbar-group">
          <button onClick={props.onIndent}>Sisennä</button>
          <button onClick={props.onOutdent}>Ulonna</button>
          <button className="icon-button" onClick={props.onMoveUp}>↑</button>
          <button className="icon-button" onClick={props.onMoveDown}>↓</button>
        </div>
        <div className="topbar-group topbar-group-right">
          <button onClick={props.onTogglePlanningColumns}>{props.showPlanningColumns ? "Piilota suunnittelu" : "Suunnittelu"}</button>
          {props.showPlanningColumns && <button onClick={props.onCalculateDependencies}>Laske riippuvuudet</button>}
          <button onClick={props.onOpenView}>⚙ Näkymä</button>
          <button onClick={() => window.print()}>Tulosta</button>
          <span className="autosave-status">Tallennettu</span>
          <button className="quiet-button" onClick={props.onReset}>Palauta</button>
        </div>
      </nav>
    </header>
  );
}
