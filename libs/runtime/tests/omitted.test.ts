import { test } from 'vitest';
import assert from 'node:assert/strict';
import { omitted } from '../omitted.ts';
import { template, renderToString } from '../server.ts';

test('SSR evaluates but never invokes or emits an event handler slot', () => {
  let calls = 0;
  const output = renderToString(template(['<button>', 'ready</button>'], [omitted(() => calls++)]));
  assert.equal(output, '<button>ready</button>');
  assert.equal(calls, 0);
});

test('SSR preserves async omitted-slot rejection in its author position', async () => {
  const error = new Error('event expression failed');
  // An async slot makes the render a promise.
  await assert.rejects(renderToString(template(['<button>', '</button>'], [omitted(Promise.reject(error))])) as Promise<string>, error);
});

test('SSR awaits an omitted async expression without invoking its resolved handler', async () => {
  let calls = 0;
  const output = await renderToString(template(['<button>', 'ready</button>'], [omitted(Promise.resolve(() => calls++))]));
  assert.equal(output, '<button>ready</button>');
  assert.equal(calls, 0);
});

test('inert omitted values need no slot: absent handlers, plain functions and server refs are null (SSR-OMITTED-SLOTS)', async () => {
  const { ref, isOmitted } = { ...(await import('../server.ts')), ...(await import('../omitted.ts')) };
  for (const value of [undefined, null, 0, 'x', false, () => {}, function named() {}, ref()]) assert.equal(omitted(value), null);
  // Values the renderer must still observe keep their slot: thenables, objects, async / own-`then` functions.
  const thenable = Object.assign(() => {}, { then: () => {} });
  for (const value of [Promise.resolve(1), {}, async () => {}, thenable]) assert.ok(isOmitted(omitted(value)));
  // Same markup either way.
  assert.equal(renderToString(template(['<a', '>x</a>'], [omitted(undefined)])), '<a>x</a>');
});
