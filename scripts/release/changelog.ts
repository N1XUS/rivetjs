// Changelog from conventional commits (`type(scope)!: subject`) since the last `v*` tag (all history when none).
// Sections: breaking changes, features, fixes, performance; other types are counted, not listed.
import { spawnSync } from "node:child_process";
import { ROOT } from "./version.ts";

export interface Commit {
  hash: string;
  type: string;
  scope?: string;
  breaking: boolean;
  subject: string;
  /** `BREAKING CHANGE:` footer text, when present. */
  note?: string;
}

const git = (args: string[], cwd: string) => {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", maxBuffer: 64 << 20 });
  return result.status === 0 ? result.stdout : null;
};

/** The newest `v*` tag reachable from HEAD, or `undefined`. */
export function lastTag(cwd = ROOT): string | undefined {
  return git(["describe", "--tags", "--abbrev=0", "--match", "v*"], cwd)?.trim() || undefined;
}

const HEADER = /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/;

/** Parses one commit; `undefined` for a non-conventional subject. */
export function parseCommit(hash: string, subject: string, body = ""): Commit | undefined {
  const match = HEADER.exec(subject.trim());
  if (!match) return undefined;
  const note = /^BREAKING[ -]CHANGE:\s*([\s\S]+?)(?:\n\s*\n|$)/m.exec(body)?.[1]?.trim();
  return {
    hash,
    type: match[1]!.toLowerCase(),
    ...(match[2] ? { scope: match[2] } : {}),
    breaking: Boolean(match[3]) || Boolean(note),
    subject: match[4]!,
    ...(note ? { note } : {}),
  };
}

/** Commits in `from..HEAD` (all of HEAD's history without `from`), oldest first. */
export function commitsSince(from: string | undefined, cwd = ROOT): { commits: Commit[]; skipped: number } {
  const out = git(["log", "--reverse", "--format=%H%x1f%s%x1f%b%x1e", ...(from ? [`${from}..HEAD`] : ["HEAD"])], cwd) ?? "";
  const commits: Commit[] = [];
  let skipped = 0;
  for (const record of out.split("\x1e")) {
    const [hash, subject, body] = record.replace(/^\n/, "").split("\x1f");
    if (!hash || subject === undefined) continue;
    const commit = parseCommit(hash, subject, body);
    if (commit) commits.push(commit);
    else skipped++;
  }
  return { commits, skipped };
}

const SECTIONS: [string, (commit: Commit) => boolean][] = [
  ["Features", (commit) => commit.type === "feat"],
  ["Fixes", (commit) => commit.type === "fix"],
  ["Performance", (commit) => commit.type === "perf"],
];

/** Markdown for one release: `## <version> (<date>)` + sections; scopes bold, short hashes. */
export function renderChangelog(version: string, commits: Commit[], { date = new Date().toISOString().slice(0, 10), skipped = 0 } = {}): string {
  const line = (commit: Commit) => `- ${commit.scope ? `**${commit.scope}:** ` : ""}${commit.subject} (${commit.hash.slice(0, 8)})`;
  const parts = [`## ${version} (${date})`, ""];
  const breaking = commits.filter((commit) => commit.breaking);
  if (breaking.length) {
    parts.push("### Breaking changes", "", ...breaking.map((commit) => line(commit) + (commit.note ? `\n  ${commit.note.replaceAll("\n", "\n  ")}` : "")), "");
  }
  for (const [title, test] of SECTIONS) {
    const listed = commits.filter(test);
    if (listed.length) parts.push(`### ${title}`, "", ...listed.map(line), "");
  }
  const other = commits.filter((commit) => !SECTIONS.some(([, test]) => test(commit)));
  const byType = new Map<string, number>();
  for (const commit of other) byType.set(commit.type, (byType.get(commit.type) ?? 0) + 1);
  const counts = [...byType].map(([type, count]) => `${count} ${type}`);
  if (counts.length || skipped) parts.push(`Not listed: ${[...counts, ...(skipped ? [`${skipped} non-conventional`] : [])].join(", ")}.`, "");
  return parts.join("\n");
}
