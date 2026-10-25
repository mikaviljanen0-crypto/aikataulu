type Props = {
  projectNumber: string;
  projectName: string;
  scheduleName: string;
  statusDate: string;
  updatedDate: string;
};

function fiDate(value: string): string {
  if (!value) return "";
  return new Date(`${value}T12:00:00`).toLocaleDateString("fi-FI");
}

export function PrintHeader({
  projectNumber,
  projectName,
  scheduleName,
  statusDate,
  updatedDate,
}: Props) {
  return (
    <>
      <header className="print-report-header">
        <div className="print-brand">
          <span className="print-brand-mark">S</span>
          <span className="print-brand-copy">
            <strong>SNEDO</strong>
            <small>Rakentamisen ohjaus</small>
          </span>
        </div>

        <div className="print-report-title">
          <span>TYÖMAASEURANTA</span>
          <strong>{projectName}</strong>
          <small>{projectNumber} · {scheduleName}</small>
        </div>

        <div className="print-status-card">
          <span>SEURANTAPÄIVÄ</span>
          <strong>{fiDate(statusDate)}</strong>
          <small>Päivitetty {fiDate(updatedDate)}</small>
        </div>
      </header>

      <div className="print-legend">
        <span><i className="legend-plan" /> Suunnitelma</span>
        <span><i className="legend-target" /> Tavoite</span>
        <span><i className="legend-actual" /> Toteutuma</span>
        <span><i className="legend-tracking" /> Seurantaviiva</span>
        <span><i className="legend-now" /> Nykyhetki</span>
      </div>

      <footer className="print-report-footer">
        <span>Tampereen Julkisivutekniikka Oy</span>
        <span>Snedo Aikataulu · Työmaakokousraportti</span>
      </footer>
    </>
  );
}
