import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { compile } from '@rivetjs/compiler';
import { emitPage, type Page } from '../fixture/emitter.ts';
import { StringWriter } from '@rivetjs/runtime/node';
import { Writable } from 'node:stream';
for (const lane of ['rivet-compiled', 'rivet-for']) {
const sourceURL = new URL(`../adapters/${lane}.jsx`, import.meta.url);
test(`${lane}: actual compiled JSX preserves fixture semantics and one native boundary per Row`, async () => {
  const source = await readFile(sourceURL, 'utf8');
  const compiled = compile(source, { filename: sourceURL.pathname });
  assert.deepEqual(compiled.diagnostics, []);
  const rowCode = compiled.code.slice(compiled.code.indexOf('function Row'), compiled.code.indexOf('function Body'));
  assert.equal((rowCode.match(/__rivetTemplate\(/g) ?? []).length, 1);
  const result = await build({ stdin: { contents: compiled.code, resolveDir: new URL('../adapters/', import.meta.url).pathname, loader: 'js' }, bundle: true, write: false, platform: 'node', format: 'esm', alias: { '@rivetjs/runtime/server': new URL('../../../libs/runtime/server.ts', import.meta.url).pathname } });
  const { renderPage } = (await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0]!.contents).toString('base64')}`)) as typeof import('../adapters/rivet.ts');
  // Values are proto int32 in the fixture; JSX omits booleans, so only null/undefined/number/string inputs share hand-emitter output.
  for (const rows of [[], [{ id: 'id<>&"\'😀', values: [null, -0, 0, 'a&b', '<x>', '😀', 'lone\ud800', '"', "'", undefined] }]]) {
    const page: Page = { title: 'Title <&>😀', token: 'token<>&"\'', rows };
    for (const articleHtml of ['', '<p>trusted &amp; article</p>']) {
      let html = ''; const sink = new Writable({ write(bytes: Buffer, _enc, done) { html += bytes.toString(); done(); } });
      await renderPage(page, { articleHtml }, sink);
      const writer = new StringWriter(); await emitPage(page, writer, { rawArticleHtml: articleHtml });
      // Runtime deliberately escapes apostrophes in double-quoted attributes; same HTML value.
      assert.equal(html.replaceAll('&#39;', "'"), Buffer.from(writer.finish() as string).toString());
    }
  }
});
}
