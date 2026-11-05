// Duplicate-link checks past `SCAN` links use a per-run index (`linked` in index.ts): an effect reading thousands of
// sources interleaved with nested computed reads of the same sources links each source once, follows order changes,
// and stays linear.
import { test } from "vitest";
import assert from "node:assert/strict";
import { batch, computed, createRoot, effect, signal } from "@rivetjs/reactivity";
import { _debug } from "@rivetjs/reactivity/debug";

const N = 2000;

function build(n: number) {
  const s = Array.from({ length: n }, (_, i) => signal(i));
  const c = s.map((x) => computed(() => x() * 2));
  return { s, c };
}

test("interleaved nested computed reads link each source once past the scan limit", () => {
  const { s, c } = build(N);
  let runs = 0,
    sum = 0;
  let reverse = false;
  const order = signal(0);
  const root = createRoot((dispose) => {
    effect(() => {
      runs++;
      order();
      let total = 0;
      for (let k = 0; k < N; k++) {
        const i = reverse ? N - 1 - k : k;
        total += c[i]() + s[i]() + s[i]();
      }
      sum = total;
    });
    return dispose;
  });
  const expected = () => s.reduce((acc, x) => acc + 4 * x(), 0);
  assert.equal(sum, expected());
  for (const x of [s[0], s[N >> 1], s[N - 1]]) assert.equal(_debug(x)!.observers().length, 2, "the effect and its computed, once each");
  // Re-run in the same order (cursor path), then a diverged order (index rebuilt for the new run).
  batch(() => {
    for (let i = 0; i < N; i += 7) s[i].set(s[i]() + 1);
  });
  assert.equal(sum, expected());
  reverse = true;
  order.set(1);
  assert.equal(sum, expected());
  for (const x of [s[0], s[N >> 1], s[N - 1]]) assert.equal(_debug(x)!.observers().length, 2);
  const before = runs;
  s[N - 1].set(-5);
  assert.equal(runs, before + 1);
  assert.equal(sum, expected());
  root.value();
  for (const x of [s[0], s[N - 1]]) assert.equal(_debug(x)!.observers().length, 1, "only its computed is left");
});

test("deduplication stays linear in the number of interleaved reads", () => {
  const time = (n: number) => {
    const { s, c } = build(n);
    const t0 = performance.now();
    const root = createRoot((dispose) => {
      effect(() => {
        for (let i = 0; i < n; i++) {
          c[i]();
          s[i]();
        }
      });
      return dispose;
    });
    const t = performance.now() - t0;
    root.value();
    return t;
  };
  time(500);
  const small = Math.min(time(2000), time(2000), time(2000));
  const large = Math.min(time(16000), time(16000), time(16000));
  // 8x the reads: linear ≈ 8x, the quadratic scan was ≈ 64x. Generous bound for noisy hosts.
  assert.ok(large < small * 30 + 5, `2000: ${small.toFixed(2)} ms, 16000: ${large.toFixed(2)} ms`);
});

test("a long nested run interleaved with a long outer run keeps both runs' links exact across re-runs", () => {
  const n = 400;
  const s = Array.from({ length: n }, (_, i) => signal(i));
  const c = s.map((x) => computed(() => x() + 1));
  const d = s.map((x) => computed(() => x() - 1));
  // `inner` checks its own long links (d[i] then s[i]) while the outer effect is mid-run with an index.
  const inner = computed(() => {
    let t = 0;
    for (let i = 0; i < n; i++) t += d[i]() + s[i]();
    return t;
  });
  const gate = signal(0);
  let sum = 0;
  const root = createRoot((dispose) => {
    effect(() => {
      gate();
      let t = 0;
      for (let i = 0; i < n; i++) {
        t += c[i]() + s[i]();
        if (i === n >> 1) t += inner();
      }
      sum = t;
    });
    return dispose;
  });
  const expected = () => {
    let t = 0;
    for (const x of s) t += 2 * x() + 1;
    let u = 0;
    for (const x of s) u += 2 * x() - 1;
    return t + u;
  };
  for (let round = 0; round < 3; round++) {
    assert.equal(sum, expected());
    // effect + c[i] + inner + d[i]: each once.
    for (let i = 0; i < n; i++) assert.equal(_debug(s[i])!.observers().length, 4, `s[${i}] round ${round}`);
    batch(() => {
      for (let i = round; i < n; i += 5) s[i].set(s[i]() + 3);
    });
    gate.set(round + 1);
  }
  // Every source still wakes the effect.
  for (let i = 0; i < n; i += 37) {
    s[i].set(s[i]() + 1);
    assert.equal(sum, expected());
  }
  root.value();
});

test("an effect re-running with fresh nested computeds re-indexes each run (no index leaks into the next run)", () => {
  const n = 300;
  const s = Array.from({ length: n }, (_, i) => signal(i));
  const order = signal(false);
  let sum = 0,
    runs = 0;
  const root = createRoot((dispose) => {
    effect(() => {
      runs++;
      const reverse = order();
      // Created per run (children of the effect): each first read is a nested run that saw `s[i]` first.
      const c = s.map((x) => computed(() => x() * 2));
      let t = 0;
      for (let k = 0; k < n; k++) {
        const i = reverse ? n - 1 - k : k;
        t += c[i]() + s[i]();
      }
      sum = t;
    });
    return dispose;
  });
  const expected = () => s.reduce((acc, x) => acc + 3 * x(), 0);
  for (let round = 0; round < 4; round++) {
    assert.equal(sum, expected());
    // The effect + this run's computed: each once.
    for (let i = 0; i < n; i++) assert.equal(_debug(s[i])!.observers().length, 2, `s[${i}] round ${round}`);
    if (round & 1) order.set(!order());
    else s[(round * 41) % n].set(-round - 1);
  }
  const before = runs;
  for (let i = 0; i < n; i += 29) s[i].set(s[i]() + 1);
  assert.equal(runs, before + Math.ceil(n / 29));
  assert.equal(sum, expected());
  root.value();
});
