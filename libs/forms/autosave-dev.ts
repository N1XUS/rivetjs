// Development façade of `@rivetjs/forms/autosave` (`development` export condition). Same exports; with
// a devtools hook installed every `createAutosave` state is reported (`lib.autosave`) with its owner and
// a describer (saving, unsaved fields, confirmed version, last save, error, conflict) for the Forms pane.
import { getOwner, untrack } from "@rivetjs/reactivity";
import { devtoolsHook } from "@rivetjs/reactivity/debug";
import * as autosave from "./autosave.ts";
import type { AutosaveState } from "./autosave.ts";
import type { DraftVersion } from "./wizard.ts";
import type { Issue } from "./types.ts";
export * from "./autosave.ts";

/** What the DevTools Forms pane shows for one autosave state. */
export interface AutosaveSnapshot {
  status: "saving" | "unsaved" | "saved" | "conflict" | "error" | "idle";
  version?: DraftVersion;
  unsavedFields: number;
  savedAt?: number;
  error?: Issue;
  conflict?: { version: DraftVersion; value?: unknown };
  draft?: string;
}

function describeAutosave(state: AutosaveState): AutosaveSnapshot {
  return untrack(() => {
    const saving = autosave.saving(state), unsaved = state.n(), error = state.e(), conflict = state.c(), at = state.t(), version = state.v();
    return {
      status: conflict ? "conflict" : saving ? "saving" : error ? "error" : unsaved ? "unsaved" : at !== undefined ? "saved" : "idle",
      unsavedFields: unsaved,
      ...(version !== undefined ? { version } : {}),
      ...(at !== undefined ? { savedAt: at } : {}),
      ...(error ? { error } : {}),
      ...(conflict ? { conflict } : {}),
      ...(state.k ? { draft: state.k } : {}),
    };
  });
}

/** `createAutosave`, reporting the state (`lib.autosave { state, owner, describe }`). */
export function createAutosave(options?: { version?: DraftVersion; draft?: string }): AutosaveState {
  const state = autosave.createAutosave(options);
  const hook = devtoolsHook();
  if (hook !== undefined) hook.emit("lib.autosave", { state, owner: getOwner(), describe: () => describeAutosave(state) });
  return state;
}
