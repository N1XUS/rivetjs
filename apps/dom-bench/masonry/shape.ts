// Masonry suite shape: deterministic tiles (no Math.random) shared by every lane, and the page contract.
export interface Tile {
  id: number;
  aspectRatio: number;
  label: string;
}

const RATIOS = [1, 0.66, 1.5, 0.8, 1.25, 0.75, 1.78, 0.56];

export function tiles(count: number): Tile[] {
  const out: Tile[] = new Array(count);
  for (let i = 0; i < count; i++) out[i] = { id: i, aspectRatio: RATIOS[(i * 5) % RATIOS.length]!, label: `Tile ${i}` };
  return out;
}

/** Breakpoints every lane uses: 2 columns < 640 px, 3 < 1024 px, 4 above; 12 px gaps. */
export const GAP = 12;
export const columnsAt = (width: number) => (width >= 1024 ? 4 : width >= 640 ? 3 : 2);

export type Mode = "exact" | "exact-fixed" | "justified" | "justified-max" | "measure" | "virtual" | "css-columns" | "round-robin" | "measure-absolute";

export interface MasonryBench {
  /** Mounts `count` tiles at the host width; returns the rendered item count. */
  mount(count: number, mode: Mode): number;
  /** Sets the host width and runs whatever relayout the mode needs, synchronously. */
  resize(width: number): void;
  /** Bottom of the lowest item relative to the host (placement check across lanes). */
  height(): number;
  scroller(): HTMLElement | null;
  /** Live item control: toggles item `index` (default 0) between span 1 and 2 (rivet exact / justified), synchronously; false = not supported. */
  toggle?(index?: number): boolean;
  rendered(): number;
  dispose(): void;
}
