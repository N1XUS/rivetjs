// Randomized graph check: 8 seeds × 300 random graphs × 30 batched writes. Every computed and effect
// must agree with a naive recompute from the signal values (no stale reads), effects run at most once
// per batch and never observe an inconsistent (glitched) state.
import { test } from "vitest";
import assert from "node:assert/strict";
import { batch, computed, createRoot, effect, signal, type Signal } from "@rivetjs/reactivity";

// Mulberry32: small deterministic PRNG.
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

// A derived node: f(values of inputs), optionally reading `b` only when `cond` is odd (dynamic deps).
interface Spec {
  inputs: number[];
  cond: number;
  extra: number;
  op: number;
}
const combine = (op: number, values: number[]): number => {
  let acc = op;
  for (const value of values) acc = op % 3 === 0 ? (acc + value) % 1009 : op % 3 === 1 ? (acc * 31 + value) % 1009 : Math.max(acc, value) % 1009;
  return acc;
};

function graph(random: () => number): { failures: string[] } {
  const failures: string[] = [];
  const signalCount = 1 + Math.floor(random() * 6),
    derivedCount = 1 + Math.floor(random() * 14),
    effectCount = 1 + Math.floor(random() * 5);
  const values: number[] = Array.from({ length: signalCount }, () => Math.floor(random() * 10));
  const specs: Spec[] = [];
  for (let i = 0; i < derivedCount; i++) {
    const available = signalCount + i,
      inputs: number[] = [];
    const n = 1 + Math.floor(random() * 3);
    for (let k = 0; k < n; k++) inputs.push(Math.floor(random() * available));
    specs.push({ inputs, cond: Math.floor(random() * available), extra: Math.floor(random() * available), op: Math.floor(random() * 6) });
  }
  // Naive evaluation of node `index` (signals first, then derived) from plain values.
  const naive = (index: number, memo: Map<number, number>): number => {
    if (index < signalCount) return values[index]!;
    const hit = memo.get(index);
    if (hit !== undefined) return hit;
    const spec = specs[index - signalCount]!;
    const inputs = spec.inputs.map((input) => naive(input, memo));
    if (naive(spec.cond, memo) % 2) inputs.push(naive(spec.extra, memo));
    const value = combine(spec.op, inputs);
    memo.set(index, value);
    return value;
  };
  const root = createRoot((dispose) => {
    const signals: Signal<number>[] = values.map((value) => signal(value));
    const nodes: (() => number)[] = [...signals];
    for (const spec of specs) {
      // Equality cut-off matters: many recomputes produce equal values.
      nodes.push(
        computed(() => {
          const inputs = spec.inputs.map((input) => nodes[input]!());
          if (nodes[spec.cond]!() % 2) inputs.push(nodes[spec.extra]!());
          return combine(spec.op, inputs);
        }),
      );
    }
    const watched = Array.from({ length: effectCount }, () => Math.floor(random() * nodes.length));
    const seen: number[] = watched.map(() => -1),
      runs: number[] = watched.map(() => 0);
    watched.forEach((index, e) =>
      effect(() => {
        runs[e]!++;
        seen[e] = nodes[index]!();
        // Glitch check: every node read during an effect run matches a naive recompute of the current values.
        const memo = new Map<number, number>();
        if (seen[e] !== naive(index, memo)) failures.push(`effect ${e} saw ${seen[e]} != ${naive(index, memo)}`);
      }),
    );
    return { dispose, signals, nodes, watched, seen, runs };
  }).value;
  for (let round = 0; round < 30; round++) {
    const before = root.runs.slice();
    const writes = 1 + Math.floor(random() * 3);
    batch(() => {
      for (let w = 0; w < writes; w++) {
        const index = Math.floor(random() * signalCount),
          value = Math.floor(random() * 10);
        values[index] = value;
        root.signals[index]!.set(value);
      }
    });
    const memo = new Map<number, number>();
    root.watched.forEach((index, e) => {
      if (root.runs[e]! - before[e]! > 1) failures.push(`round ${round}: effect ${e} ran ${root.runs[e]! - before[e]!} times in one batch`);
      const expected = naive(index, memo);
      if (root.seen[e] !== expected) failures.push(`round ${round}: effect ${e} = ${root.seen[e]}, expected ${expected}`);
    });
    // Pull reads agree too (lazy computeds not watched by any effect).
    root.nodes.forEach((node, index) => {
      const expected = naive(index, memo);
      if (node() !== expected) failures.push(`round ${round}: node ${index} = ${node()}, expected ${expected}`);
    });
  }
  root.dispose();
  return { failures };
}

test("fuzz: random graphs agree with naive recompute (glitch-free, one run per batch)", () => {
  for (let seed = 1; seed <= 8; seed++) {
    const random = rng(seed * 7919);
    for (let g = 0; g < 300; g++) {
      const { failures } = graph(random);
      if (failures.length) assert.fail(`seed ${seed}, graph ${g}: ${failures.slice(0, 5).join("; ")}`);
    }
  }
});
