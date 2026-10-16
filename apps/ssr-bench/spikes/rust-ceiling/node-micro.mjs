// Single-thread in-process Node micro-bench: rivet-compiled render-only, JSON.stringify / JSON.parse of the page.
import { Writable } from "node:stream";
const { renderPage } = await import("/workspace/apps/ssr-bench/dist/rivet-compiled.mjs");
function fixture(rows, strings) {
  const r = [];
  for (let i = 0; i < rows; i++) {
    const values = [];
    for (let f = 0; f < 10; f++) { const v = i * 100 + f; values.push(strings ? (f === 3 ? `<b>"${v}"</b> & 'é€漢字𝄞'` : String(v)) : v); }
    r.push({ id: i, values });
  }
  return { token: "trial-0", title: "SSR benchmark <content> & data", markdown: "", rows: r };
}
let bytes = 0;
const sink = () => new Writable({ write(c, e, cb) { bytes += c.length; cb(); } });
async function time(fn) {
  let n = 1;
  for (;;) { const t = performance.now(); for (let i = 0; i < n; i++) await fn(); if (performance.now() - t > 50) break; n *= 2; }
  const s = [];
  for (let k = 0; k < 15; k++) { const t = performance.now(); for (let i = 0; i < n; i++) await fn(); s.push(((performance.now() - t) * 1e6) / n); }
  s.sort((a, b) => a - b); return s[7];
}
const out = [];
for (const strings of [false, true]) for (const rows of [100, 1000]) {
  const page = fixture(rows, strings);
  const signal = new AbortController().signal;
  const render = await time(() => renderPage(page, { signal, articleHtml: "" }, sink()));
  bytes = 0; await renderPage(page, { signal, articleHtml: "" }, sink());
  const json = JSON.stringify(page);
  const stringify = await time(() => { JSON.stringify(page); });
  const parse = await time(() => { JSON.parse(json); });
  out.push({ rows, strings, html_bytes_without_trailer: bytes, render_ns: Math.round(render), json_stringify_ns: Math.round(stringify), json_parse_ns: Math.round(parse) });
}
console.log(JSON.stringify({ node: process.version, bench: out }, null, 0));
