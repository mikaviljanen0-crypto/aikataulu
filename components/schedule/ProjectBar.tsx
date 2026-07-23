type ProjectBarProps = {
  projectName: string;
  onProjectNameChange: (value: string) => void;
};

export function ProjectBar({
  projectName,
  onProjectNameChange,
}: ProjectBarProps) {
  return (
    <section className="projectbar">
      <label>
        Projekti
        <input
          value={projectName}
          onChange={(event) => onProjectNameChange(event.target.value)}
        />
      </label>

      <label>
        Aikataulu
        <input defaultValue="Yleisaikataulu" />
      </label>

      <label>
        Päivitetty
        <input type="date" defaultValue="2026-07-23" />
      </label>
    </section>
  );
}
