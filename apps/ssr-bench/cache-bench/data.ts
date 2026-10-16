// Deterministic per-request loader data (a pool of distinct documents; the article is never cached).
const SECTIONS = 12,
  LINKS = 12;
export function doc(i: number) {
  const s = i % SECTIONS,
    l = Math.floor(i / SECTIONS) % LINKS;
  const word = (k: number) => ["signal", "region", "resume", "router", "writer", "slab", "<tag>", "café", "a & b", '"quoted"'][(i * 7 + k * 13) % 10];
  const paragraph = (k: number) => Array.from({ length: 48 }, (_, w) => word(k + w) + (w % 9 === 0 ? " " + ((i * 31 + k * 17 + w) % 1000) : "")).join(" ");
  return {
    token: `tok-${i}-${(i * 2654435761) >>> 0}-"<&>'`,
    path: `/docs/s${s}/page-${l}`,
    title: `Topic ${s}.${l}: request ${i} <draft>`,
    updated: `2026-10-${String(1 + (i % 28)).padStart(2, "0")}`,
    minutes: 3 + (i % 9),
    crumbs: [
      { href: "/docs", label: "Docs" },
      { href: `/docs/s${s}`, label: `Section ${s + 1}` },
      { href: `/docs/s${s}/page-${l}`, label: `Topic ${s}.${l}` },
    ],
    sections: Array.from({ length: 6 }, (_, k) => ({
      id: `part-${k}`,
      heading: `Part ${k + 1} — ${word(k)} ${i}`,
      paragraphs: [paragraph(k), paragraph(k + 1), paragraph(k + 2)],
    })),
    options: Array.from({ length: 15 }, (_, k) => ({
      name: `option${k}`,
      type: k % 2 ? "boolean" : "string | null",
      value: k % 3 ? "undefined" : `"${word(k)}"`,
      description: `Controls ${word(k + 3)} for request ${i}, row ${k}.`,
    })),
  };
}
