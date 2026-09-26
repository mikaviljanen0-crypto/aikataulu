type Props = {
  projectNumber: string;
  projectName: string;
  scheduleName: string;
  statusDate: string;
  onProjectNumberChange: (value: string) => void;
  onProjectNameChange: (value: string) => void;
  onScheduleNameChange: (value: string) => void;
  onStatusDateChange: (value: string) => void;
  onShiftStatusDate: (days: number) => void;
};

export function ProjectBar(props: Props) {
  return (
    <section className="projectbar">
      <label className="small-field">
        TYÖNUMERO
        <input value={props.projectNumber} onChange={(e) => props.onProjectNumberChange(e.target.value)} />
      </label>

      <label>
        KOHDE
        <input value={props.projectName} onChange={(e) => props.onProjectNameChange(e.target.value)} />
      </label>

      <label>
        AIKATAULU
        <input value={props.scheduleName} onChange={(e) => props.onScheduleNameChange(e.target.value)} />
      </label>

      <label className="status-field">
        SEURANTA
        <input type="date" value={props.statusDate} onChange={(e) => props.onStatusDateChange(e.target.value)} />
      </label>

      <div className="status-stepper">
        <button onClick={() => props.onShiftStatusDate(-35)}>← 5 vko</button>
        <button onClick={() => props.onStatusDateChange(new Date().toISOString().slice(0,10))}>Tänään</button>
        <button onClick={() => props.onShiftStatusDate(35)}>5 vko →</button>
      </div>

      <span className="save-state">Tallennettu automaattisesti</span>
    </section>
  );
}
