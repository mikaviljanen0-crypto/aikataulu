type Props = {
  readOnly?: boolean;
  saveMessage?: string;
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
        <input disabled={props.readOnly} value={props.projectNumber} onChange={(e) => props.onProjectNumberChange(e.target.value)} />
      </label>

      <label>
        KOHDE
        <input disabled={props.readOnly} value={props.projectName} onChange={(e) => props.onProjectNameChange(e.target.value)} />
      </label>

      <label>
        AIKATAULU
        <input disabled={props.readOnly} value={props.scheduleName} onChange={(e) => props.onScheduleNameChange(e.target.value)} />
      </label>

      <label className="status-field">
        SEURANTA
        <input disabled={props.readOnly} type="date" value={props.statusDate} onChange={(e) => props.onStatusDateChange(e.target.value)} />
      </label>

      <div className="status-stepper">
        <button disabled={props.readOnly} onClick={() => props.onShiftStatusDate(-35)}>← 5 vko</button>
        <button disabled={props.readOnly} onClick={() => props.onStatusDateChange(new Date().toISOString().slice(0,10))}>Tänään</button>
        <button disabled={props.readOnly} onClick={() => props.onShiftStatusDate(35)}>5 vko →</button>
      </div>

      <span className="save-state">{props.saveMessage || "Tallennettu automaattisesti"}</span>
    </section>
  );
}
