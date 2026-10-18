// apps/ssr-bench/adapters/rivet-compiled.jsx — the row every SSR lane renders (Razor, Solid, Qwik render
// the same markup from the same gRPC DTO). 40 elements, 10 dynamic values. ×1,000 or ×5,000 per page.
function Row({ row }) {
  if (!Array.isArray(row.values) || row.values.length !== 10) throw new Error('A row requires ten field values');
  return <article data-row={row.id} data-state="even">
    <header><h2>Record</h2><p>Static description and supporting HTML.</p></header>
    <section><dl>
      <div><dt>Field 0</dt><dd>{row.values[0]}</dd></div>
      <div><dt>Field 1</dt><dd>{row.values[1]}</dd></div>
      {/* … Field 2–8 … */}
      <div><dt>Field 9</dt><dd>{row.values[9]}</dd></div>
    </dl></section>
    <footer><button type="button" disabled>Increment</button><label>Selected<input type="checkbox" readonly /></label></footer>
  </article>;
}
function Body({ page }) {
  return <main data-token={page.token}><h1>{page.title}</h1><section data-grid="">{page.rows.map(row => <Row row={row} />)}</section></main>;
}
export async function renderPage(page, { signal }, sink) {
  const writer = new NodeStreamWriter(sink, { signal });
  await writer.write(`<!doctype html><html lang="en"><head>…</head><body>`);
  await renderToWriter(Body({ page }), writer, { signal });
  await writer.write('<!--complete--></body></html>');
  await writer.finish();
}
