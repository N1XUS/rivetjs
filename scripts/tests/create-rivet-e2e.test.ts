// create-rivet end to end (scripts/package/create-e2e.ts): packed packages, the CLI run from its tarball for every
// template, offline install, `npm run build`, the app served on a free port ≥ 4400, `/` resumable HTML (the server
// starter: no script + a working form action); every
// `--deploy` target over the server starter: build output layout (no deploy). ~1.5 min.
import { strict as assert } from "node:assert";
import { test } from "vitest";
import { createE2E, E2E_DEPLOYS, E2E_TEMPLATES, PAGE_CHECK } from "../package/create-e2e.ts";

test("npm create rivet: every template installs from the tarballs, builds, serves its page (resumable, or zero JS + form action)", async () => {
  const { bundled, results } = await createE2E();
  assert.deepEqual(bundled, ["starter-minimal", "starter-server", "starter-static", "starter-ui"]);
  assert.deepEqual(
    results.map((result) => result.template),
    [...E2E_TEMPLATES, ...E2E_DEPLOYS],
  );
  for (const result of results) {
    assert.ok(result.ok, `${result.template}: ${result.steps.join(" → ")}\n${result.error}`);
    if (result.template.includes("+")) assert.match(result.steps.at(-1)!, new RegExp(`^${result.template.split("+")[1]} layout: `));
    else if (PAGE_CHECK[result.template] === "zero-js") assert.match(result.steps.at(-1)!, /^GET \/ 200 .*no script\), POST \?\/add 303 → \/ lists the note$/);
    else assert.match(result.steps.at(-1)!, /^GET \/ 200 .*resume state \+ bootstrap.*, GET \/assets\/resume-entry-[\w-]+\.js 200$/);
  }
});
