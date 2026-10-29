// Stand-in for a database table: 240 books, generated once per process (deterministic). Server-only.
export type Book = { id: number; title: string; author: string; year: number; rating: number };
export type Sort = "title" | "author" | "year" | "rating";
export type Dir = "asc" | "desc";

const ADJ = ["Silent", "Hidden", "Last", "Golden", "Broken", "Northern", "Paper", "Glass", "Distant", "Little", "Burning", "Quiet"];
const NOUN = [
  "River",
  "Garden",
  "Empire",
  "Machine",
  "Harbor",
  "Orchard",
  "Lantern",
  "Signal",
  "Mountain",
  "Library",
  "Winter",
  "Compass",
  "Archive",
  "Tide",
  "Forest",
  "City",
  "Engine",
  "Atlas",
  "Bridge",
  "Window",
];
const FIRST = ["Ada", "Grace", "Alan", "Edsger", "Barbara", "Ken", "Margaret", "Donald", "Frances", "Linus", "Radia", "Niklaus"];
const LAST = ["Lovelace", "Hopper", "Turing", "Dijkstra", "Liskov", "Thompson", "Hamilton", "Knuth", "Allen", "Torvalds", "Perlman", "Wirth"];

export const books: readonly Book[] = Array.from({ length: 240 }, (_, i) => ({
  id: i + 1,
  title: `The ${ADJ[i % ADJ.length]} ${NOUN[(i * 7) % NOUN.length]}${i >= 120 ? " II" : ""}`,
  author: `${FIRST[(i * 5) % FIRST.length]} ${LAST[(i * 11) % LAST.length]}`,
  year: 1950 + ((i * 37) % 75),
  rating: 1 + ((i * 13) % 41) / 10,
}));

export interface Query {
  q: string;
  sort: Sort;
  dir: Dir;
  page: number;
  per: number;
}

/** Filter, sort and slice: returns only the rows of one page, plus the counts the page needs. */
export function pageOf({ q, sort, dir, page, per }: Query) {
  const needle = q.trim().toLowerCase();
  const rows = needle ? books.filter((b) => b.title.toLowerCase().includes(needle) || b.author.toLowerCase().includes(needle)) : [...books];
  const sign = dir === "asc" ? 1 : -1;
  rows.sort((a, b) => {
    const x = a[sort];
    const y = b[sort];
    return (typeof x === "string" ? x.localeCompare(y as string) : x - (y as number)) * sign || a.id - b.id;
  });
  const pages = Math.max(1, Math.ceil(rows.length / per));
  const start = (page - 1) * per;
  return { items: rows.slice(start, start + per), total: rows.length, pages };
}
