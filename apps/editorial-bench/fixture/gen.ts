// Deterministic editorial fixture: N Markdown articles with front matter + site.json (tags, authors, nav).
// Every lane reads the same files. Article i depends only on (SEED, i) and the article count (internal links,
// related rail), so two runs with the same N are byte-identical.
//
//   node apps/editorial-bench/fixture/gen.ts [--n 100,1000,5000] [--out apps/editorial-bench/fixture/content]
//
// Layout per N: <out>/n<N>/site.json, <out>/n<N>/content/articles/<slug>.md
// Front matter values are JSON literals (valid YAML), parsed by every lane's own front matter reader.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

export const SEED = 0x5eed_ed17;
export const PER_PAGE = 20;
/** Tag and author pages list this many of the newest matching articles. */
export const LIST_LIMIT = 50;
export const RELATED = 4;

export const TAGS = [
  "politics",
  "economy",
  "climate",
  "science",
  "health",
  "technology",
  "culture",
  "books",
  "film",
  "music",
  "sport",
  "travel",
  "food",
  "education",
  "cities",
  "energy",
  "media",
  "law",
  "space",
  "history",
];
export const AUTHORS = [
  ["ada-lindqvist", "Ada Lindqvist"],
  ["bruno-okafor", "Bruno Okafor"],
  ["chen-wei", "Chen Wei"],
  ["dara-murphy", "Dara Murphy"],
  ["elena-sokolova", "Elena Sokolova"],
  ["farid-haddad", "Farid Haddad"],
  ["grace-kim", "Grace Kim"],
  ["hugo-martin", "Hugo Martin"],
  ["ines-duarte", "Ines Duarte"],
  ["jonas-weber", "Jonas Weber"],
  ["keiko-tanaka", "Keiko Tanaka"],
  ["luis-romero", "Luis Romero"],
] as const;
/** Tags linked from the header of every page. */
export const NAV_TAGS = TAGS.slice(0, 5);

const WORDS = (
  "the report shows that city council budget housing market policy research team data river coast school hospital " +
  "festival reader editor season record winter summer court ruling minister trade deal network station museum " +
  "archive library village harbour bridge tunnel railway airport market price wage worker union farm harvest " +
  "storm forecast satellite orbit rocket lab study trial vaccine clinic doctor patient novel author film director " +
  "album concert stadium league match coach player recipe kitchen menu bakery coffee garden forest mountain valley " +
  "island ocean energy grid solar wind battery factory engine software platform device signal language history " +
  "century empire treaty election campaign voter survey poll committee inquiry hearing statement interview source"
).split(" ");
const VERBS = "says found reported announced expects plans rejected approved measured opened closed reviewed described".split(" ");

/** mulberry32 */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type ArticleMeta = {
  slug: string;
  title: string;
  date: string;
  author: string;
  authorSlug: string;
  tags: string[];
  description: string;
  related: string[];
};

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

function words(r: () => number, n: number): string {
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(WORDS[Math.floor(r() * WORDS.length)]!);
  return out.join(" ");
}

function sentence(r: () => number): string {
  return cap(words(r, 4 + Math.floor(r() * 5))) + " " + VERBS[Math.floor(r() * VERBS.length)] + " " + words(r, 5 + Math.floor(r() * 8)) + ".";
}

const slugOf = (i: number) => `story-${String(i + 1).padStart(5, "0")}`;

/** Title, date, author, tags of article i (independent of N). */
function head(i: number) {
  const r = rng(SEED ^ Math.imul(i + 1, 0x9e3779b1));
  const title = cap(words(r, 3 + Math.floor(r() * 4))) + " " + VERBS[Math.floor(r() * VERBS.length)] + " " + words(r, 2 + Math.floor(r() * 3));
  // Newest first: article 0 is the most recent; one article every 3 hours.
  const date = new Date(Date.UTC(2026, 9, 1, 12) - i * 3 * 3600_000).toISOString().replace(".000Z", "Z");
  const [authorSlug, author] = AUTHORS[Math.floor(r() * AUTHORS.length)]!;
  const tagCount = 2 + Math.floor(r() * 3);
  const tags: string[] = [];
  while (tags.length < tagCount) {
    const t = TAGS[Math.floor(r() * TAGS.length)]!;
    if (!tags.includes(t)) tags.push(t);
  }
  const description = sentence(r);
  return { r, title, date, author, authorSlug, tags, description };
}

/** 3–6 KB body: headings, paragraphs with inline marks + links, two images, lists, a code block, a quote. */
function body(r: () => number, i: number, n: number): string {
  const target = 3000 + Math.floor(r() * 3000);
  const link = () => {
    const j = (i + 1 + Math.floor(r() * (n - 1))) % n;
    return `[${words(r, 2)}](/articles/${slugOf(j)}/)`;
  };
  const para = () => {
    const parts: string[] = [];
    const count = 3 + Math.floor(r() * 3);
    for (let k = 0; k < count; k++) {
      let s = sentence(r);
      const roll = r();
      if (roll < 0.2) s = s.replace(/^(\S+ \S+)/, "**$1**");
      else if (roll < 0.35) s = s.replace(/ (\S+ \S+)\.$/, " *$1*.");
      else if (roll < 0.45) s = s.replace(/ (\S+)\.$/, " `$1`.");
      else if (roll < 0.6) s = s.replace(/\.$/, `, see ${link()}.`);
      else if (roll < 0.65) s = s.replace(/\.$/, `, via [the source](https://example.com/${words(r, 1)}/${i}).`);
      parts.push(s);
    }
    return parts.join(" ");
  };
  const img = (k: number) => `![${cap(words(r, 3))}](/img/photo-${((i + k) % 4) + 1}.jpg)`;
  const blocks: string[] = [para(), para()];
  const push = (b: string) => blocks.push(b);
  push(`## ${cap(words(r, 3))}`);
  push(para());
  push(img(0));
  push(para());
  push(Array.from({ length: 3 + Math.floor(r() * 3) }, () => `- ${cap(words(r, 4 + Math.floor(r() * 4)))}`).join("\n"));
  push(`## ${cap(words(r, 2))}`);
  push(para());
  push(
    "```js\n" +
      `const ${words(r, 1)}Count = items.filter((item) => item.year === ${2000 + (i % 26)}).length;\n` +
      `console.log("${words(r, 3)}", ${words(r, 1)}Count);\n` +
      "```",
  );
  push(`> ${sentence(r)} ${sentence(r)}`);
  push(img(1));
  push(Array.from({ length: 3 }, (_, k) => `${k + 1}. ${cap(words(r, 5))}`).join("\n"));
  while (blocks.join("\n\n").length < target) {
    if (r() < 0.25) push(`### ${cap(words(r, 3))}`);
    push(para());
  }
  return blocks.join("\n\n") + "\n";
}

export function generate(n: number, out: string): ArticleMeta[] {
  const dir = join(out, `n${n}`);
  rmSync(dir, { recursive: true, force: true });
  const articles = join(dir, "content", "articles");
  mkdirSync(articles, { recursive: true });
  const heads = Array.from({ length: n }, (_, i) => head(i));
  const metas: ArticleMeta[] = [];
  for (let i = 0; i < n; i++) {
    const h = heads[i]!;
    // Related: the nearest (by date) articles sharing the first tag, then any tag; deterministic.
    const related: string[] = [];
    for (let d = 1; related.length < RELATED && d < n; d++) {
      for (const j of [i + d, i - d]) {
        if (j < 0 || j >= n || related.length >= RELATED) continue;
        if (heads[j]!.tags.includes(h.tags[0]!)) related.push(slugOf(j));
      }
    }
    for (let d = 1; related.length < RELATED && d < n; d++) if (!related.includes(slugOf((i + d) % n))) related.push(slugOf((i + d) % n));
    const meta: ArticleMeta = {
      slug: slugOf(i),
      title: h.title,
      date: h.date,
      author: h.author,
      authorSlug: h.authorSlug,
      tags: h.tags,
      description: h.description,
      related,
    };
    metas.push(meta);
    const front = Object.entries(meta)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join("\n");
    writeFileSync(join(articles, `${meta.slug}.md`), `---\n${front}\n---\n\n${body(h.r, i, n)}`);
  }
  const site = {
    title: "The Daily Fixture",
    perPage: PER_PAGE,
    listLimit: LIST_LIMIT,
    navTags: NAV_TAGS,
    tags: TAGS,
    authors: AUTHORS.map(([slug, name]) => ({ slug, name })),
    count: n,
  };
  writeFileSync(join(dir, "site.json"), JSON.stringify(site, null, 2) + "\n");
  return metas;
}

if (import.meta.main) {
  const { values } = parseArgs({ options: { n: { type: "string", default: "100,1000,5000" }, out: { type: "string" } } });
  const out = resolve(values.out ?? join(import.meta.dirname, "content"));
  for (const n of values.n!.split(",").map(Number)) {
    const t = performance.now();
    generate(n, out);
    console.log(`fixture n=${n} → ${join(out, `n${n}`)} (${(performance.now() - t).toFixed(0)} ms)`);
  }
}
