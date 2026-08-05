import type { TimelineZoom } from "./TimelineControls";

type Props = {
  open: boolean;
  rangeStart: string;
  rangeEnd: string;
  zoom: TimelineZoom;
  fitToWindow: boolean;
  showWeekends: boolean;
  showToday: boolean;
  onClose: () => void;
  onRangeStartChange: (value: string) => void;
  onRangeEndChange: (value: string) => void;
  onZoomChange: (value: TimelineZoom) => void;
  onShowWeeks: (weeks: number) => void;
  onFitProject: () => void;
  onFitToWindowChange: (value: boolean) => void;
  onShowWeekendsChange: (value: boolean) => void;
  onShowTodayChange: (value: boolean) => void;
};

export function ViewPanel(props: Props) {
  if (!props.open) return null;

  return (
    <>
      <button className="view-panel-backdrop" aria-label="Sulje" onClick={props.onClose} />
      <aside className="view-panel">
        <header className="view-panel-header">
          <div><strong>Näkymä</strong><span>Aikaskaala ja näkyvä alue</span></div>
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
          {[
            ["Sovita ikkunaan", "Näytä aikaväli ilman vaakavieritystä.", props.fitToWindow, props.onFitToWindowChange],
            ["Näytä viikonloput", "Harmaa tausta lauantaille ja sunnuntaille.", props.showWeekends, props.onShowWeekendsChange],
            ["Näytä tänään", "Ohut punainen viiva nykyisen päivän kohdalla.", props.showToday, props.onShowTodayChange],
          ].map(([title, note, checked, handler]) => (
            <label className="view-panel-check" key={title as string}>
              <input type="checkbox" checked={checked as boolean} onChange={(e) => (handler as (v:boolean)=>void)(e.target.checked)} />
              <span><strong>{title as string}</strong><small>{note as string}</small></span>
            </label>
          ))}
        </section>
      </aside>
    </>
  );
}
