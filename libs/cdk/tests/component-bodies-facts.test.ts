// SELECT-B 2026-10-28: the build's boundary facts read only a component's own body. These cdk components keep their body
// (handlers, keyed state, rendered parts) in the component instead of `return untrack(() => helper(props))`, so an
// instance on a page with no stateful caller is a boundary of its own: its focus / hover / press listeners are in a
// record (cdk-docs group-focus / group-hover / select-css / select-events / select-disabled were cold no-ops).
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { hasDerivedModel, moduleFacts } from "@rivetjs/compiler";

const cases: [file: string, component: string, renders?: string][] = [
  ["../group/index.tsx", "Group"],
  ["../compare/index.tsx", "Compare"],
  ["../color-area/index.tsx", "ColorArea"],
  ["../disclosure/index.tsx", "Disclosure"],
  ["../drop-zone/index.tsx", "DropZone"],
  ["../select/index.tsx", "SelectPreset", "HiddenSelect"],
  ["../select/select-parts.tsx", "SelectPartsInner"],
];

test("cdk component bodies are visible to the boundary facts", { skip: !hasDerivedModel() }, () => {
  for (const [rel, name, renders] of cases) {
    const file = fileURLToPath(new URL(rel, import.meta.url));
    const facts = moduleFacts(readFileSync(file, "utf8"), file, { boundaries: true }).boundaries.get(name);
    assert.ok(facts, `${name} facts`);
    assert.ok(facts.source || facts.listens, `${name}: a change source or listener of its own`);
    if (renders) assert.ok(facts.renders.has(renders), `${name} renders ${renders}`);
  }
});
