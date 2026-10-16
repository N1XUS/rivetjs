// Shared by the shorthand server tests (UI identity T21): a shorthand form renders the same HTML as its compound form.
// Generated ids (`rvsN`) are renumbered in order of appearance: the id counter is global across renders.
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";

const norm = (html: string): string => {
  const ids = new Map<string, string>();
  return html.replace(/rvs\d+/g, (id) => {
    let next = ids.get(id);
    if (next === undefined) ids.set(id, (next = `id${ids.size}`));
    return next;
  });
};

export async function assertSameHtml(short: () => unknown, long: () => unknown): Promise<void> {
  assert.equal(norm(await renderToString(short as never)), norm(await renderToString(long as never)));
}
