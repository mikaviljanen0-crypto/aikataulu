type Props = {
  active: string;
  onNavigate: (key: string) => void;
};

const rows = [
  ["general", "▦", "Yleisaikataulu"],
  ["week", "7", "Viikkoaikataulu"],
  ["tracking", "✓", "Toteumaseuranta"],
  ["versions", "◫", "Aikatauluversiot"],
  ["calendar", "□", "Kalenteri"],
  ["projects", "▣", "Projektit"],
  ["import", "⇩", "Tocoman-tuonti"],
];

export function Sidebar({ active, onNavigate }: Props) {
  return (
    <aside className="snedo-sidebar">
      <div className="snedo-brand">
        <div className="snedo-mark">S</div>
        <div><strong>SNEDO</strong><span>Rakentamisen ohjaus</span></div>
      </div>

      <div className="sidebar-section-title">OHJELMISTOT</div>
      <div className="sidebar-module muted">€ <span>Laskenta</span></div>
      <div className="sidebar-module muted">◎ <span>Tavoitearvio</span></div>
      <div className="sidebar-module muted">↗ <span>Kustannusseuranta</span></div>
      <div className="sidebar-module active-module">▦ <span>Aikataulu</span></div>

      <div className="sidebar-section-title">AIKATAULU</div>
      <nav className="schedule-nav">
        {rows.map(([key, icon, label]) => (
          <button
            type="button"
            key={key}
            className={active === key ? "active" : ""}
            onClick={() => onNavigate(key)}
          >
            <span>{icon}</span>{label}
          </button>
        ))}
      </nav>

      <div className="sidebar-spacer" />
      <div className="sidebar-user">
        <div className="user-avatar">MV</div>
        <div><strong>Mika Viljanen</strong><span>Pääkäyttäjä</span></div>
      </div>
    </aside>
  );
}
