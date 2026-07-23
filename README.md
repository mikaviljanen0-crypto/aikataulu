export interface PlrReport {
  fileName: string;
  fileSize: number;
  isCompoundFile: boolean;
  streamNames: string[];
  textSamples: string[];
  probableVersionNames: string[];
  notes: string[];
}

const OLE_SIGNATURE = [0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1];

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function extractUtf16Strings(bytes: Uint8Array): string[] {
  const values: string[] = [];
  let current = "";
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const code = bytes[i] | (bytes[i + 1] << 8);
    const allowed = code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 126) || (code >= 160 && code <= 591);
    if (allowed) current += String.fromCharCode(code);
    else {
      if (current.trim().length >= 4) values.push(current.trim());
      current = "";
    }
  }
  if (current.trim().length >= 4) values.push(current.trim());
  return values;
}

function extractAsciiStrings(bytes: Uint8Array): string[] {
  const values: string[] = [];
  let current = "";
  for (const code of bytes) {
    if (code === 9 || (code >= 32 && code <= 126)) current += String.fromCharCode(code);
    else {
      if (current.trim().length >= 5) values.push(current.trim());
      current = "";
    }
  }
  if (current.trim().length >= 5) values.push(current.trim());
  return values;
}

export async function inspectPlr(file: File): Promise<PlrReport> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isCompoundFile = OLE_SIGNATURE.every((value, index) => bytes[index] === value);
  const allStrings = unique([...extractUtf16Strings(bytes), ...extractAsciiStrings(bytes)])
    .filter((value) => value.length <= 160);

  const streamNames = allStrings.filter((value) =>
    /^(Contents|ContentsRev\d+|Pluto project management|SummaryInformation|DocumentSummaryInformation)/i.test(value)
  ).slice(0, 50);

  const probableVersionNames = allStrings.filter((value) =>
    /ContentsRev\d+|Pluto project management ver\.|Tocoman|PlanMan/i.test(value)
  ).slice(0, 30);

  const textSamples = allStrings.filter((value) =>
    /[A-Za-zÅÄÖåäö]{4}/.test(value) &&
    !/Microsoft|SummaryInformation|ContentsRev/i.test(value)
  ).slice(0, 120);

  return {
    fileName: file.name,
    fileSize: file.size,
    isCompoundFile,
    streamNames: unique(streamNames),
    textSamples: unique(textSamples),
    probableVersionNames: unique(probableVersionNames),
    notes: [
      isCompoundFile
        ? "Tiedosto tunnistettiin Microsoft Compound Document / OLE -säiliöksi."
        : "Tiedosto ei vastaa tunnettua OLE-säiliön allekirjoitusta.",
      "Tämä vaihe vain analysoi tiedoston rakennetta eikä muuta alkuperäistä tiedostoa.",
      "Varsinainen tehtävä-, päivämäärä- ja hierarkiatuonti rakennetaan tunnistettujen tietovirtojen perusteella."
    ]
  };
}
