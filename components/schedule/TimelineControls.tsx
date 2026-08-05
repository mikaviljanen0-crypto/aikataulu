export type TimelineZoom = "year" | "month" | "week" | "day";

type TimelineControlsProps = {
  rangeStart: string;
  rangeEnd: string;
  zoom: TimelineZoom;
  onRangeStartChange: (value: string) => void;
  onRangeEndChange: (value: string) => void;
  onZoomChange: (value: TimelineZoom) => void;
  onShowWeeks: (weeks: number) => void;
  onFitProject: () => void;
};

export function TimelineControls({
  rangeStart,
  rangeEnd,
  zoom,
  onRangeStartChange,
  onRangeEndChange,
  onZoomChange,
  onShowWeeks,
  onFitProject,
}: TimelineControlsProps) {
  return (
    <section className="timeline-controls">
      <div className="timeline-control-group">
        <label>
          Näytä alkaen
          <input
            type="date"
            value={rangeStart}
            onChange={(event) => onRangeStartChange(event.target.value)}
          />
        </label>

        <label>
          Näytä asti
          <input
            type="date"
            value={rangeEnd}
            min={rangeStart}
            onChange={(event) => onRangeEndChange(event.target.value)}
          />
        </label>
      </div>

      <div className="timeline-control-group">
        <span className="timeline-label">Aikaväli</span>
        <button onClick={() => onShowWeeks(4)}>4 viikkoa</button>
        <button onClick={() => onShowWeeks(13)}>3 kk</button>
        <button onClick={() => onShowWeeks(26)}>6 kk</button>
        <button onClick={onFitProject}>Koko projekti</button>
      </div>

      <label className="zoom-control">
        Zoom
        <select
          value={zoom}
          onChange={(event) =>
            onZoomChange(event.target.value as TimelineZoom)
          }
        >
          <option value="year">Vuosi</option>
          <option value="month">Kuukausi</option>
          <option value="week">Viikko</option>
          <option value="day">Päivä</option>
        </select>
      </label>
    </section>
  );
}
