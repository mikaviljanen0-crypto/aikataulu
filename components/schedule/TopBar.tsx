type TopBarProps = {
  onAddTask: () => void;
  onRemoveTask: () => void;
};

export function TopBar({ onAddTask, onRemoveTask }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="brand">
        <strong>Aikataulu</strong>
        <span>Rakennusalan tuotannonsuunnittelu</span>
      </div>

      <nav>
        <button onClick={onAddTask}>+ Lisää tehtävä</button>
        <button onClick={onRemoveTask}>Poista</button>
        <button className="primary">Tallenna</button>
        <button>Tulosta / PDF</button>
      </nav>
    </header>
  );
}
