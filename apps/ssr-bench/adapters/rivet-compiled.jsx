import { renderToWriter, template } from '../../../libs/runtime/server.ts';
import { PAGE_STYLE, escapeText } from '../fixture/emitter.ts';
import { NodeStreamWriter } from '../../../libs/runtime/node.ts';
const scalar = value => String(value ?? '');
function Row({ row }) {
  if (!Array.isArray(row.values) || row.values.length !== 10) throw new Error('A row requires ten field values');
  return <article data-row={row.id} data-state="even"><header><h2>Record</h2><p>Static description and supporting HTML.</p></header><section><dl><div><dt>Field 0</dt><dd>{row.values[0]}</dd></div><div><dt>Field 1</dt><dd>{row.values[1]}</dd></div><div><dt>Field 2</dt><dd>{row.values[2]}</dd></div><div><dt>Field 3</dt><dd>{row.values[3]}</dd></div><div><dt>Field 4</dt><dd>{row.values[4]}</dd></div><div><dt>Field 5</dt><dd>{row.values[5]}</dd></div><div><dt>Field 6</dt><dd>{row.values[6]}</dd></div><div><dt>Field 7</dt><dd>{row.values[7]}</dd></div><div><dt>Field 8</dt><dd>{row.values[8]}</dd></div><div><dt>Field 9</dt><dd>{row.values[9]}</dd></div></dl></section><footer><button type="button" disabled>Increment</button><label>Selected<input type="checkbox" readonly /></label></footer></article>;
}
function Body({ page, articleHtml }) {
  // Only Marked's trusted benchmark fixture output crosses this explicit raw boundary.
  return <main data-token={scalar(page.token)}><h1>{scalar(page.title)}</h1>{articleHtml ? <div data-article="">{template([articleHtml])}</div> : null}<section data-grid="">{page.rows.map(row => <Row row={row} />)}</section></main>;
}
/** Stream the benchmark page using actual Rivet-compiled JSX. */
export async function renderPage(page, { signal, articleHtml = '' }, sink) {
  const writer = new NodeStreamWriter(sink, { signal });
  await writer.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeText(page.title)}</title><style>${PAGE_STYLE}</style></head><body>`);
  await renderToWriter(Body({ page, articleHtml }), writer, { signal });
  await writer.write('<!--complete--></body></html>');
  await writer.finish();
}
