// Ported from react-spectrum (packages/react-aria/src/dnd/constants.ts), Apache-2.0, © Adobe.
// Rivet: the `DROP_OPERATION` enum is a frozen object literal (no TS enum emit).
import type { DropOperation } from "./types.ts";

export const DROP_OPERATION = { none: 0, cancel: 0, move: 1 << 0, copy: 1 << 1, link: 1 << 2, all: (1 << 0) | (1 << 1) | (1 << 2) } as const;
export type DROP_OPERATION = number;

// See https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer/effectAllowed
export const DROP_OPERATION_ALLOWED: Record<string, number> = {
  ...DROP_OPERATION,
  copyMove: DROP_OPERATION.copy | DROP_OPERATION.move,
  copyLink: DROP_OPERATION.copy | DROP_OPERATION.link,
  linkMove: DROP_OPERATION.link | DROP_OPERATION.move,
  all: DROP_OPERATION.all,
  uninitialized: DROP_OPERATION.all,
};

type EffectAllowed = "none" | "cancel" | "move" | "copy" | "copyMove" | "link" | "linkMove" | "copyLink" | "all";
export const EFFECT_ALLOWED: Record<number, EffectAllowed> = invert(DROP_OPERATION_ALLOWED) as unknown as Record<number, EffectAllowed>;
EFFECT_ALLOWED[DROP_OPERATION.all] = "all"; // ensure we don't map to 'uninitialized'.

export type DropEffect = "none" | "link" | "copy" | "move";

export const DROP_EFFECT_TO_DROP_OPERATION: { [K in DropEffect]: DropOperation } = {
  none: "cancel",
  link: "link",
  copy: "copy",
  move: "move",
};

export const DROP_OPERATION_TO_DROP_EFFECT: { [K in DropOperation]: DropEffect } = invert(DROP_EFFECT_TO_DROP_OPERATION) as {
  [K in DropOperation]: DropEffect;
};

function invert<T extends string | number, C extends string | number>(object: Record<T, C>): Record<C, T> {
  const res = {} as Record<C, T>;
  for (const key in object) res[object[key]] = key as T;
  return res;
}

export const NATIVE_DRAG_TYPES: Set<string> = new Set(["text/plain", "text/uri-list", "text/html"]);
export const CUSTOM_DRAG_TYPE = "application/vnd.react-aria.items+json";
export const GENERIC_TYPE = "application/octet-stream";
