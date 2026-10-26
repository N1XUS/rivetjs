// Ported from tailwind-variants 3.3.1 (`src/internal/join-class-value.ts`, `src/utils.ts` `cx`), MIT License,
// Copyright (c) 2020 Tailwid Variants (see libs/ui/NOTICE). Same output as upstream's `cx` (tests/tv-merge.test.ts): ui
// takes it from here so a browser bundle holds tailwind-merge only where an override needs it (ZERO UI-JS2): upstream's
// `cx` shares a module with tailwind-merge's `cn`, and a module ships whole with whichever chunk holds it.

const joinClassValue = (value: unknown): string => {
  if (!value && value !== 0 && value !== 0n) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return value !== value ? "" : "" + value;
  if (typeof value === "bigint") return "" + value;
  let result = "";
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      const item: unknown = value[index];
      if (!item && item !== 0 && item !== 0n) continue;
      const resolved = typeof item === "string" ? item : joinClassValue(item);
      if (resolved) {
        if (result) result += " ";
        result += resolved;
      }
    }
    return result;
  }
  if (typeof value === "object")
    for (const key in value as Record<string, unknown>)
      if ((value as Record<string, unknown>)[key]) {
        if (result) result += " ";
        result += key;
      }
  return result;
};

const needsNormalize = (str: string): boolean => {
  const len = str.length;
  if (len === 0) return false;
  const first = str.charCodeAt(0);
  const last = str.charCodeAt(len - 1);
  if (first === 32 || last === 32 || (first >= 9 && first <= 13) || first === 160 || (last >= 9 && last <= 13) || last === 160) return true;
  for (let i = 0; i < len; i++) {
    const code = str.charCodeAt(i);
    if ((code >= 9 && code <= 13) || code === 160) return true;
    if (code === 32 && i + 1 < len && str.charCodeAt(i + 1) === 32) return true;
  }
  return false;
};

/** tailwind-variants' `cx`: joins class values (strings, numbers, arrays, `{ class: condition }` objects), spaces normalised. */
export const cx = (...classnames: unknown[]): string | undefined => {
  const result = joinClassValue(classnames);
  if (!result) return undefined;
  return needsNormalize(result) ? result.replace(/\s+/g, " ").trim() : result;
};
