// Data-grid suite shape: deterministic rows (no Math.random) shared by every lane.
export interface Person {
  id: number;
  name: string;
  email: string;
  role: string;
  team: string;
  age: number;
  salary: number;
}

const FIRST = ["Ada", "Ben", "Cleo", "Dev", "Eli", "Fay", "Gus", "Hana", "Ivo", "Jun", "Kai", "Lia", "Max", "Noa", "Oli", "Pia"];
const LAST = ["Stone", "Rivera", "Okafor", "Lindqvist", "Tanaka", "Moreau", "Kowal", "Haddad", "Novak", "Silva"];
const ROLES = ["Engineer", "Designer", "Manager", "Analyst", "Support", "Sales"];
const TEAMS = ["Platform", "Growth", "Core", "Mobile", "Data", "Infra", "Web"];

export function people(count: number): Person[] {
  const out: Person[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const first = FIRST[(i * 7) % FIRST.length]!,
      last = LAST[(i * 13) % LAST.length]!;
    out[i] = {
      id: i,
      name: `${first} ${last} ${i}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com`,
      role: ROLES[(i * 5) % ROLES.length]!,
      team: TEAMS[(i * 3) % TEAMS.length]!,
      age: 20 + ((i * 17) % 45),
      salary: 40_000 + ((i * 7919) % 120_000),
    };
  }
  return out;
}

/** Contract every lane bundle installs on `window.gridBench`. */
export interface GridBench {
  /** Mount `rows` rows; `virtual` = windowed rendering (DataGrid only). Returns rendered body rows. */
  mount(rows: number, virtual: boolean): number;
  sort(): void;
  filter(query: string): void;
  selectAll(): void;
  /** Scroll the scroll container to `top` (px) synchronously (dispatches the scroll handler). */
  scrollTo(top: number): void;
  scroller(): HTMLElement;
  bodyRows(): number;
  dispose(): void;
}
