// create-rivet end to end (scripts/package/create-e2e.ts): packed packages, the CLI run from its tarball for every
// template, its AI files = `libs/mcp/ai/sync.ts` output, offline install, `npm run build`, `npm run check`, the app
// served on a free port ≥ 4400, `/` resumable HTML (the server starter: no script + a working form action); every
// `--deploy` target over the server starter: build output layout (no deploy). ~1.5 min.
import { strict as assert } from "node:assert";
import { test } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { aiFileProblems, createE2E, E2E_DEPLOYS, E2E_TEMPLATES, PAGE_CHECK } from "../package/create-e2e.ts";

test("aiFileProblems: only the starter's generated files, missing and differing ones named", () => {
  const app = mkdtempSync(join(tmpdir(), "rivet-ai-files-"));
  try {
    writeFileSync(join(app, "AGENTS.md"), "same\n");
    writeFileSync(join(app, "CLAUDE.md"), "edited\n");
    const ai = new Map([
      ["templates/starter-x/AGENTS.md", "same\n"],
      ["templates/starter-x/CLAUDE.md", "generated\n"],
      ["templates/starter-x/.cursor/rules/rivet.mdc", "rule\n"],
      ["templates/starter-y/AGENTS.md", "other starter\n"],
      ["skills/rivet-x/SKILL.md", "not a starter file\n"],
    ]);
    assert.deepEqual(aiFileProblems(app, "starter-x", ai), ["differs CLAUDE.md", "missing .cursor/rules/rivet.mdc"]);
  } finally {
    rmSync(app, { recursive: true, force: true });
  }
});

test("npm create rivet: every template installs from the tarballs, builds, serves its page (resumable, or zero JS + form action)", async () => {
  const { bundled, results } = await createE2E();
  assert.deepEqual(bundled, ["starter-minimal", "starter-server", "starter-static", "starter-ui"]);
  assert.deepEqual(
    results.map((result) => result.template),
    [...E2E_TEMPLATES, ...E2E_DEPLOYS],
  );
  for (const result of results) {
    assert.ok(result.ok, `${result.template}: ${result.steps.join(" → ")}\n${result.error}`);
    if (!result.template.includes("+")) {
      assert.ok(
        result.steps.some((step) => /^AI files = sync\.ts output \(\d+ files\)$/.test(step)),
        `${result.template}: AI files not checked`,
      );
      assert.ok(result.steps.includes("npm run check"), `${result.template}: npm run check not run`);
    }
    if (result.template.includes("+")) assert.match(result.steps.at(-1)!, new RegExp(`^${result.template.split("+")[1]} layout: `));
    else if (PAGE_CHECK[result.template] === "zero-js") assert.match(result.steps.at(-1)!, /^GET \/ 200 .*no script\), POST \?\/add 303 → \/ lists the note$/);
    // The page's runtime: `dom-lite` when every boundary has a lite residual (RT-DIET: minimal starter), else `dom-derived`.
    else assert.match(result.steps.at(-1)!, /^GET \/ 200 .*resume boundaries \+ bootstrap.*, GET \/assets\/dom-(derived|lite)-[\w-]+\.js 200$/);
  }
});
