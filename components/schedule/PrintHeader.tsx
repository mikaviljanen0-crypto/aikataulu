type Props = {
  projectName: string;
  statusDate: string;
  updatedDate: string;
};

function fiDate(value: string): string {
  if (!value) return "";
  return new Date(`${value}T12:00:00`).toLocaleDateString("fi-FI");
}

export function PrintHeader({ projectName, statusDate, updatedDate }: Props) {
  return (
    <>
      <header className="print-header">
        <strong>{projectName}</strong>
        <span>Seuranta {fiDate(statusDate)}</span>
      </header>
      <footer className="print-footer">
        <span>Laatinut: Tampereen Julkisivutekniikka Oy</span>
        <span>Päivitetty: {fiDate(updatedDate)}</span>
      </footer>
    </>
  );
}
