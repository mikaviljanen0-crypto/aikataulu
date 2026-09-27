import type { TimelineZoom } from "./TimelineControls";

type Props = {
  open: boolean;
  rangeStart: string;
  rangeEnd: string;
  zoom: TimelineZoom;
  fitToWindow: boolean;
  showWeekends: boolean;
  showToday: boolean;
  showBaseline: boolean;
  onClose: () => void;
  onRangeStartChange: (value: string) => void;
  onRangeEndChange: (value: string) => void;
  onZoomChange: (value: TimelineZoom) => void;
  onShowWeeks: (weeks: number) => void;
  onFitProject: () => void;
  onFitToWindowChange: (value: boolean) => void;
  onShowWeekendsChange: (value: boolean) => void;
  onShowTodayChange: (value: boolean) => void;
  onShowBaselineChange: (value: boolean) => void;
};

export function ViewPanel(props: Props) {
  if (!props.open) return null;

  return (
    <>
      <button className="view-panel-backdrop" aria-label="Sulje" onClick={props.onClose} />
      <aside className="view-panel">
        <header className="view-panel-header">
          <div><strong>Näkymä</strong><span>Aikaskaala ja näkyvät tiedot</span></div>
          <button className="view-panel-close" onClick={props.onClose}>×</button>
        </header>

        <section className="view-panel-section">
          <label>Zoom
            <select value={props.zoom} onChange={(e) => props.onZoomChange(e.target.value as TimelineZoom)}>
              <option value="year">Vuosi</option>
              <option value="month">Kuukausi</option>
              <option value="week">Viikko</option>
              <option value="day">Päivä</option>
            </select>
          </label>
        </section>

        <section className="view-panel-section">
          <label>Näytä alkaen
            <input type="date" value={props.rangeStart} onChange={(e) => props.onRangeStartChange(e.target.value)} />
          </label>
          <label>Näytä asti
            <input type="date" min={props.rangeStart} value={props.rangeEnd} onChange={(e) => props.onRangeEndChange(e.target.value)} />
          </label>
          <div className="view-panel-button-grid">
            <button onClick={() => props.onShowWeeks(4)}>4 viikkoa</button>
            <button onClick={() => props.onShowWeeks(13)}>3 kuukautta</button>
            <button onClick={() => props.onShowWeeks(26)}>6 kuukautta</button>
            <button onClick={props.onFitProject}>Koko projekti</button>
          </div>
        </section>

        <section className="view-panel-section">
          <label className="view-panel-check">
            <input type="checkbox" checked={props.fitToWindow} onChange={(e) => props.onFitToWindowChange(e.target.checked)} />
            <span><strong>Sovita ikkunaan</strong><small>Näytä valittu aikaväli ilman vaakavieritystä.</small></span>
          </label>
          <label className="view-panel-check">
            <input type="checkbox" checked={props.showWeekends} onChange={(e) => props.onShowWeekendsChange(e.target.checked)} />
            <span><strong>Näytä vapaat päivät</strong><small>Viikonloput ja Suomen arkipyhät taustalla.</small></span>
          </label>
          <label className="view-panel-check">
            <input type="checkbox" checked={props.showToday} onChange={(e) => props.onShowTodayChange(e.target.checked)} />
            <span><strong>Näytä nykyhetki</strong><small>Harmaa viiva tämän päivän kohdalla.</small></span>
          </label>
          <label className="view-panel-check">
            <input type="checkbox" checked={props.showBaseline} onChange={(e) => props.onShowBaselineChange(e.target.checked)} />
            <span><strong>Näytä tavoite</strong><small>Tallennettu tavoite näkyy matalana harmaana janana.</small></span>
          </label>
        </section>
      </aside>
    </>
  );
}
