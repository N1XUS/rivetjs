export type Area = "reactivity" | "router" | "resume";
export type Status = "running" | "committed" | "verified" | "no-finding" | "needs-attention" | "failed" | "interrupted";
export interface Regression {
  project: string;
  file: string;
  testName: string;
  assertion: string;
}
export interface Finding {
  disposition: "finding" | "no-finding" | "needs-attention";
  summary: string;
  scenario: string;
  expected: string;
  actual: string;
  changedPaths: string[];
  testPaths: string[];
  reproPaths: string[];
  evidencePaths: string[];
  regression: Regression | null;
}
export interface Command {
  file: string;
  args: string[];
  stdin?: string;
}
export interface AgentContext {
  role: "worker" | "reviewer";
  workspace: string;
  output: string;
  schema: string;
  prompt: string;
  model?: string;
  mcpServers?: string[];
}
export type Agent = (context: AgentContext) => Command;
export interface RunRecord {
  id: string;
  area: Area;
  base: string;
  status: Status;
  phase: string;
  model?: string;
  startedAt: string;
  finishedAt?: string;
  message?: string;
  commit?: string;
  finding?: Finding;
  hashes?: Record<string, string>;
  peakRssBytes: number;
}
