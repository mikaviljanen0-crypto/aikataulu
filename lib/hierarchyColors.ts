/** Vain suunnittelujanan värit – tavoite (oranssi) ja toteuma (vihreä) pysyvät ennallaan. */
export type HierarchyPalette = [string, string, string, string];
export const DEFAULT_HIERARCHY_PALETTE: HierarchyPalette = [
  "#24527a", // 1. taso: päätyövaihe
  "#36a9ad", // 2. taso: alatyövaihe
  "#92cfd2", // 3. taso
  "#c2e7e8", // 4. ja sitä alemmat tasot
];

export const HIERARCHY_LEVEL_NAMES = [
  "Taso 1 – päätyövaihe",
  "Taso 2 – alatyövaihe",
  "Taso 3 – tarkempi työvaihe",
  "Taso 4+ – yksityiskohta",
] as const;

export function readHierarchyPalette(value: unknown): HierarchyPalette | null {
  if (!Array.isArray(value) || value.length !== 4) return null;
  if (!value.every((v) => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v))) {
    return null;
  }
  return value as HierarchyPalette;
}
