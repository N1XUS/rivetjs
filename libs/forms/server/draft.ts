// Autosave endpoint: a router action that merges a raw field patch into the app's DraftStore.
// Answers `{ ok: true, version, draft }`, or `fail(409, { ok: false, conflict: true, version, value })`.
import { fail, type RequestEvent } from "@rivetjs/router";
import { rawValues } from "../decode.ts";
import { matchesPattern } from "../path.ts";
import type { DraftStore } from "../wizard.ts";
import { readForm, type BodyLimits } from "./action.ts";
import { draftFrom } from "./wizard.ts";

/** Raw draft fields by path, as posted. */
export type RawDraft = Record<string, string | string[]>;
/** Options of the draft save action. */
export interface DraftActionOptions {
  /** `"strict"` (default) or `"lax"`, as for `action()`. */
  csrf?: "strict" | "lax";
  limits?: BodyLimits;
  /** Never stored (default: paths containing "password"/"secret"). */
  exclude?: readonly string[];
}
const SECRET = /password|secret/i;

/** `export const serverActions = { draft: draftAction(drafts) }`. Versions travel as strings (`_version`). */
export function draftAction(drafts: DraftStore<RawDraft>, options: DraftActionOptions = {}): (event: RequestEvent) => Promise<unknown> {
  return async (event) => {
    const data = await readForm(event.request, options.limits, !event.dev && options.csrf !== "lax");
    const id = draftFrom(event, data) ?? crypto.randomUUID();
    const version = data.get("_version");
    const exclude = options.exclude;
    const patch = rawValues(data, (name) => (exclude ? !exclude.some((pattern) => matchesPattern(pattern, name)) : !SECRET.test(name)));
    const result = await drafts.save(id, patch, typeof version === "string" && version ? { version } : {}, event);
    if (!result.ok) return fail(409, { ok: false, conflict: true, version: result.version, ...(result.value !== undefined ? { value: result.value } : {}) });
    return { ok: true, version: result.version, draft: id };
  };
}
