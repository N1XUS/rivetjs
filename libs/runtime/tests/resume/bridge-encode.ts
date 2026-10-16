// Function Bridge unit-test helper: encode `make()`'s values as the captures of one client effect (a resumable render,
// no element needed), then decode them with the browser decoder. `symbols`: id → factory (what the symbol chunk exports).
import { resumableToString, _rEffect } from "@rivetjs/runtime/server-resume";
import { createDecoder } from "@rivetjs/runtime/resume-format";
import type { DecoderHooks, ResumeState } from "@rivetjs/runtime/resume-format";
import { readable } from "./wire.ts";

export const FX = "t.tsx#T$fx";
const fakeSignal = (): DecoderHooks["signal"] => () => {
  let value: unknown;
  const s = (() => value) as (() => unknown) & { set(v: unknown): void; update(f: (v: unknown) => unknown): void };
  s.set = (v) => void (value = v);
  s.update = (f) => void (value = f(value));
  return s as never;
};
export async function roundTrip(
  make: () => unknown[],
  symbols: Record<string, (...captures: never[]) => unknown> = {},
  hooks: DecoderHooks = {},
): Promise<{ state: ResumeState; values: unknown[]; html: string }> {
  const manifest = { runtime: "/rt.js", symbols: Object.fromEntries([FX, ...Object.keys(symbols)].map((id) => [id, "/c.js"])) };
  const html = (await resumableToString(
    () => {
      _rEffect(FX, make());
      return "x" as never;
    },
    { manifest },
  )) as string;
  const state = readable(JSON.parse(/<script type="rivet\/state"[^>]*>(.*?)<\/script>/s.exec(html)![1]!)) as ResumeState;
  const decoder = createDecoder(state.t, {
    signal: fakeSignal(),
    fn: (id, captures) => (symbols[id as string] as (...c: unknown[]) => unknown)(...captures),
    ...hooks,
  });
  return { state, html, values: (state.fx[0]![1] as number[]).map(decoder.get) };
}
