import { expect, test } from "vitest";
import { spawnSync } from "node:child_process";

function run(code: number, quietSuccess: boolean) {
  const source = `import { runSteps } from "./libs/nx/executors/run.ts";
    const result = await runSteps([{label:"check",cwd:process.cwd(),quietSuccess:${quietSuccess},args:["-e",${JSON.stringify(`console.log('{"errors":${code}}');process.exitCode=${code};`)}]}],{verbose:false});
    process.exitCode = result.success ? 0 : 1;`;
  return spawnSync(process.execPath, ["--input-type=module", "-e", source], { encoding: "utf8" });
}
test("executor prerequisite stdout is hidden only on success; failed JSON is replayed intact", () => {
  const success = run(0, true);
  expect(success.status).toBe(0);
  expect(success.stdout).toBe("");
  expect(success.stderr).toBe("");
  const failure = run(1, true);
  expect(failure.status).toBe(1);
  expect(JSON.parse(failure.stdout)).toEqual({ errors: 1 });
  expect(failure.stderr).toBe("");
  expect(JSON.parse(run(0, false).stdout)).toEqual({ errors: 0 });
});
