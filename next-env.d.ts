export interface PlrFileSummary {
  name: string;
  size: number;
  checksum: string;
  ole: boolean;
  strings: string[];
}

export interface PlrChangedRange {
  start: number;
  end: number;
  length: number;
}

export interface PlrComparison {
  files: PlrFileSummary[];
  baseline: string;
  comparisons: Array<{
    file: string;
    sizeDifference: number;
    changedBytes: number;
    changedRanges: PlrChangedRange[];
    addedStrings: string[];
    removedStrings: string[];
  }>;
}

const OLE_SIGNATURE = [0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1];

function hex(value: number): string {
  return `0x${value.toString(16).padStart(6, "0")}`;
}

function extractStrings(bytes: Uint8Array): string[] {
  const result: string[] = [];
  let ascii = "";
  for (const code of bytes) {
    if (code === 9 || (code >= 32 && code <= 126)) ascii += String.fromCharCode(code);
    else {
      if (ascii.trim().length >= 5) result.push(ascii.trim());
      ascii = "";
    }
  }
  if (ascii.trim().length >= 5) result.push(ascii.trim());

  let utf16 = "";
  for (let index = 0; index + 1 < bytes.length; index += 2) {
    const code = bytes[index] | (bytes[index + 1] << 8);
    const valid = code === 9 || (code >= 32 && code <= 126) || (code >= 160 && code <= 591);
    if (valid) utf16 += String.fromCharCode(code);
    else {
      if (utf16.trim().length >= 4) result.push(utf16.trim());
      utf16 = "";
    }
  }
  if (utf16.trim().length >= 4) result.push(utf16.trim());

  return [...new Set(result.filter((value) => value.length <= 180))];
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function changedRanges(base: Uint8Array, next: Uint8Array): { count: number; ranges: PlrChangedRange[] } {
  const maximum = Math.max(base.length, next.length);
  const ranges: PlrChangedRange[] = [];
  let start = -1;
  let count = 0;

  for (let index = 0; index < maximum; index += 1) {
    const changed = base[index] !== next[index];
    if (changed) {
      count += 1;
      if (start < 0) start = index;
    } else if (start >= 0) {
      ranges.push({ start, end: index - 1, length: index - start });
      start = -1;
    }
  }
  if (start >= 0) ranges.push({ start, end: maximum - 1, length: maximum - start });

  // Merge tiny gaps, because structured binary values often change in nearby fields.
  const merged: PlrChangedRange[] = [];
  for (const range of ranges) {
    const previous = merged[merged.length - 1];
    if (previous && range.start - previous.end <= 16) {
      previous.end = range.end;
      previous.length = previous.end - previous.start + 1;
    } else {
      merged.push({ ...range });
    }
  }

  return { count, ranges: merged.sort((a, b) => b.length - a.length).slice(0, 40) };
}

export async function comparePlrFiles(files: File[]): Promise<PlrComparison> {
  const loaded = await Promise.all(files.map(async (file) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return {
      file,
      bytes,
      summary: {
        name: file.name,
        size: file.size,
        checksum: await sha256(bytes),
        ole: OLE_SIGNATURE.every((value, index) => bytes[index] === value),
        strings: extractStrings(bytes)
      } satisfies PlrFileSummary
    };
  }));

  const baseline = loaded[0];
  const baselineStrings = new Set(baseline.summary.strings);

  return {
    files: loaded.map((item) => item.summary),
    baseline: baseline.summary.name,
    comparisons: loaded.slice(1).map((item) => {
      const nextStrings = new Set(item.summary.strings);
      const difference = changedRanges(baseline.bytes, item.bytes);
      return {
        file: item.summary.name,
        sizeDifference: item.bytes.length - baseline.bytes.length,
        changedBytes: difference.count,
        changedRanges: difference.ranges,
        addedStrings: item.summary.strings.filter((value) => !baselineStrings.has(value)).slice(0, 40),
        removedStrings: baseline.summary.strings.filter((value) => !nextStrings.has(value)).slice(0, 40)
      };
    })
  };
}

export function rangeLabel(range: PlrChangedRange): string {
  return `${hex(range.start)}–${hex(range.end)} (${range.length} tavua)`;
}
