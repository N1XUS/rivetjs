import type { Finding, Regression } from "./types.ts";
const object = (v: unknown): Record<string, any> => {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("Expected object evidence");
  return v as Record<string, any>;
};
const text = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= 20000;
export function parseFinding(value: unknown): Finding {
  const v = object(value);
  const keys = ["disposition", "summary", "scenario", "expected", "actual", "changedPaths", "testPaths", "reproPaths", "evidencePaths", "regression"];
  if (Object.keys(v).some((k) => !keys.includes(k)) || keys.some((k) => !(k in v))) throw new Error("Invalid finding fields");
  if (!["finding", "no-finding", "needs-attention"].includes(v.disposition) || ["summary", "scenario", "expected", "actual"].some((k) => !text(v[k])))
    throw new Error("Invalid finding disposition or description");
  for (const key of ["changedPaths", "testPaths", "reproPaths", "evidencePaths"])
    if (!Array.isArray(v[key]) || v[key].length > 100 || v[key].some((x: unknown) => !text(x)) || new Set(v[key]).size !== v[key].length)
      throw new Error(`Invalid ${key}`);
  if (v.evidencePaths.length === 0) throw new Error("Executed probe evidence is required");
  if (v.disposition === "finding") {
    const r = object(v.regression);
    if (Object.keys(r).sort().join() !== ["assertion", "file", "project", "testName"].join() || Object.values(r).some((x) => !text(x)))
      throw new Error("Invalid regression selector");
    if (!v.changedPaths.length || !v.testPaths.includes(r.file) || !v.reproPaths.length) throw new Error("Finding requires regression and minimized repro");
  } else if (v.regression !== null || v.changedPaths.length || v.testPaths.length) throw new Error("Non-finding cannot propose source changes");
  return v as Finding;
}
export function checkBaseline(value: unknown, code: number): void {
  const v = object(value);
  const counts = [v.numTotalTests, v.numPassedTests, v.numFailedTests, v.numPendingTests, v.numTodoTests];
  if (
    code !== 0 ||
    v.success !== true ||
    counts.some((n) => !Number.isInteger(n) || n < 0) ||
    v.numPassedTests === 0 ||
    v.numFailedTests !== 0 ||
    v.numTotalTests !== v.numPassedTests + v.numPendingTests + v.numTodoTests ||
    !Array.isArray(v.testResults) ||
    !v.testResults.length
  )
    throw new Error("No-finding baseline did not execute a passing native suite");
  const actual = { passed: 0, skipped: 0, todo: 0 };
  for (const result of v.testResults) {
    const file = object(result);
    if (!text(file.name) || file.message !== "" || file.status !== "passed" || !Array.isArray(file.assertionResults))
      throw new Error("No-finding baseline collection/setup failed");
    for (const result of file.assertionResults) {
      const a = object(result);
      if (!Object.hasOwn(actual, a.status) || !text(a.fullName) || !Array.isArray(a.failureMessages) || a.failureMessages.length)
        throw new Error("No-finding baseline contains invalid or failing tests");
      actual[a.status as keyof typeof actual]++;
    }
  }
  if (actual.passed !== v.numPassedTests || actual.skipped !== v.numPendingTests || actual.todo !== v.numTodoTests)
    throw new Error("No-finding baseline test counts do not match executed results");
}
export function checkRegression(value: unknown, r: Regression, code: number, phase: "red" | "green", identity?: string): string {
  const v = object(value);
  if (v.numTotalTests !== 1 || v.numPendingTests !== 0 || v.numTodoTests !== 0 || !Array.isArray(v.testResults) || v.testResults.length !== 1)
    throw new Error("Regression must discover and execute exactly one test");
  const file = object(v.testResults[0]);
  if (
    typeof file.name !== "string" ||
    !file.name.replaceAll("\\", "/").endsWith("/" + r.file) ||
    file.message ||
    !Array.isArray(file.assertionResults) ||
    file.assertionResults.length !== 1
  )
    throw new Error("Regression collection/setup failed or wrong file");
  const a = object(file.assertionResults[0]);
  if ((a.fullName !== r.testName && a.title !== r.testName) || !text(a.fullName) || (identity && a.fullName !== identity))
    throw new Error("Regression discovered a different test");
  if (phase === "red") {
    if (
      code !== 1 ||
      v.success !== false ||
      v.numFailedTests !== 1 ||
      v.numPassedTests !== 0 ||
      a.status !== "failed" ||
      !Array.isArray(a.failureMessages) ||
      a.failureMessages.length !== 1 ||
      !/AssertionError/.test(a.failureMessages[0]) ||
      !a.failureMessages[0].includes(r.assertion)
    )
      throw new Error("RED requires the recorded behavioral AssertionError");
    if (/beforeAll|beforeEach|afterAll|afterEach|Cannot find module|Failed to resolve|timed out|TimeoutError/.test(a.failureMessages[0]))
      throw new Error("Infrastructure failure is not RED");
  } else if (
    code !== 0 ||
    v.success !== true ||
    v.numFailedTests !== 0 ||
    v.numPassedTests !== 1 ||
    a.status !== "passed" ||
    !Array.isArray(a.failureMessages) ||
    a.failureMessages.length
  )
    throw new Error("Regression is not GREEN");
  return a.fullName;
}
export function checkGates(plan: unknown, result: unknown): void {
  const expected = object(plan).gates;
  const actual = object(result).gates;
  if (!Array.isArray(expected) || !Array.isArray(actual) || !expected.length || expected.length !== actual.length) throw new Error("Incomplete gates report");
  const ids = expected.map((v) => object(v).id);
  if (new Set(ids).size !== ids.length || ids.some((id) => typeof id !== "string")) throw new Error("Invalid gate plan");
  for (let i = 0; i < actual.length; i++) {
    const row = object(actual[i]);
    if (
      row.id !== ids[i] ||
      !["pass", "known-red", "noise"].includes(row.status) ||
      !Number.isInteger(row.exitCode) ||
      (row.status === "pass" && row.exitCode !== 0)
    )
      throw new Error(`Gate failed or omitted: ${ids[i]}`);
  }
}
