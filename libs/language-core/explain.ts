// Explanations of Rivet diagnostic codes for people and AI assistants: the registry entry
// (`@rivetjs/compiler/codes`: severity, title, docs) plus the emitted messages, a short mechanical fix,
// an Avoid / Prefer pair and the quick fix that applies (`explain.json`). Served by `@rivetjs/mcp`
// (`explain_diagnostic`, `check_code`) and `rivet check --explain`-style hosts.
import { codeInfo, CODES, docsUrl, type CodeInfo } from "@rivetjs/compiler/codes";
import table from "./explain.json" with { type: "json" };

export interface CodeExplanation extends CodeInfo {
  /** Emitted message texts (`{x}` = placeholder). */
  messages: string[];
  /** Mechanical fix, imperative, 1–3 sentences. */
  fix: string;
  /** Smallest source that triggers the code (compiler codes). */
  avoid?: string;
  /** The same source fixed (compiles without diagnostics). */
  prefer?: string;
  /** Language-core quick fix (`codeFixes`) that applies, if any. */
  quickFix?: string;
  /** Where / when it fires (target, mode). */
  note?: string;
}

interface Entry {
  code: string;
  messages: string[];
  fix: string;
  avoid?: string;
  prefer?: string;
  quickFix?: string;
  note?: string;
}

const entries = new Map((table.codes as Entry[]).map((entry) => [entry.code, entry]));

/** Explanation of `code` (`RV1016`, case-insensitive, `1016` accepted); undefined when unregistered. */
export function explainCode(code: string): CodeExplanation | undefined {
  const normalized = /^\d+$/.test(code.trim()) ? "RV" + code.trim() : code.trim().toUpperCase();
  const info = codeInfo(normalized);
  const entry = entries.get(normalized);
  if (!info || !entry) return undefined;
  const { code: _, ...rest } = entry;
  return { ...info, docs: info.docs ?? docsUrl(normalized), ...rest };
}

/** Every registered code with its explanation, in code order. */
export function explainedCodes(): CodeExplanation[] {
  return CODES.map((info) => explainCode(info.code)!).filter(Boolean);
}

/** Markdown of one explanation (MCP, docs). */
export function explanationMarkdown(explanation: CodeExplanation): string {
  const lines = [
    `## ${explanation.code}: ${explanation.title}`,
    "",
    `Severity: ${explanation.severity}${explanation.retired ? " (retired: no longer emitted)" : ""} · docs: ${explanation.docs}`,
    "",
  ];
  lines.push("Messages:", ...explanation.messages.map((message) => `- ${message}`), "");
  lines.push(`Fix: ${explanation.fix}`, "");
  if (explanation.quickFix) lines.push(`Quick fix (editor / check_code): ${explanation.quickFix}`, "");
  if (explanation.avoid) lines.push("Avoid:", "```tsx", explanation.avoid, "```", "");
  if (explanation.prefer) lines.push("Prefer:", "```tsx", explanation.prefer, "```", "");
  if (explanation.note) lines.push(`Note: ${explanation.note}`, "");
  return lines.join("\n");
}
