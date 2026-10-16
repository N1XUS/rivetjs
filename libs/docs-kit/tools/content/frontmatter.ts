// Frontmatter: a small YAML subset (`key: value`, quoted strings, `[a, b]` lists, booleans) checked
// against the page schema. Errors name the file and the field.

export const STATUSES = ["stable", "experimental", "planned"] as const;
export const TEMPLATES = ["home", "concept", "guide", "recipe", "best-practice", "gotcha", "reference", "tutorial", "stub", "page"] as const;
export type Status = (typeof STATUSES)[number];
export type Template = (typeof TEMPLATES)[number];

/** Validated page metadata. */
export interface Frontmatter {
  title: string;
  /** Meta description; at most 160 characters. */
  description: string;
  template: Template;
  status: Status;
  since?: string;
  tags: string[];
  /** Content paths (`guides/components`) shown under "Related". */
  related: string[];
  /** Planned pages: link to the design spec or issue. */
  spec?: string;
}

type Raw = Record<string, string | string[] | boolean>;

function scalar(text: string): string | boolean {
  const value = text.trim();
  if (value === "true") return true;
  if (value === "false") return false;
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.startsWith('"') ? (JSON.parse(value) as string) : value.slice(1, -1).replaceAll("''", "'");
  }
  return value;
}

/** Split `---` frontmatter from the body. Throws on a missing or malformed block. */
export function splitFrontmatter(source: string, file: string): { raw: Raw; body: string; bodyLine: number } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);
  if (!match) throw new Error(`${file}: missing frontmatter (--- block at the top)`);
  const raw: Raw = {};
  for (const [index, line] of match[1]!.split(/\r?\n/).entries()) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const at = line.indexOf(":");
    if (at <= 0) throw new Error(`${file}:${index + 2}: expected "key: value"`);
    const key = line.slice(0, at).trim();
    const value = line.slice(at + 1).trim();
    if (value.startsWith("[")) {
      if (!value.endsWith("]")) throw new Error(`${file}:${index + 2}: unterminated list for ${key}`);
      const inner = value.slice(1, -1).trim();
      raw[key] = inner ? inner.split(",").map((item) => String(scalar(item))) : [];
    } else raw[key] = scalar(value);
  }
  return { raw, body: source.slice(match[0].length), bodyLine: match[0].split("\n").length };
}

/** Check raw frontmatter against the schema. */
export function validateFrontmatter(raw: Raw, file: string): Frontmatter {
  const known = new Set(["title", "description", "template", "status", "since", "tags", "related", "spec"]);
  for (const key of Object.keys(raw)) if (!known.has(key)) throw new Error(`${file}: unknown frontmatter field "${key}"`);
  const text = (key: string, required: boolean): string | undefined => {
    const value = raw[key];
    if (value === undefined) {
      if (required) throw new Error(`${file}: frontmatter "${key}" is required`);
      return undefined;
    }
    if (typeof value !== "string" || !value) throw new Error(`${file}: frontmatter "${key}" must be a non-empty string`);
    return value;
  };
  const list = (key: string): string[] => {
    const value = raw[key];
    if (value === undefined) return [];
    if (!Array.isArray(value)) throw new Error(`${file}: frontmatter "${key}" must be a list ([a, b])`);
    return value;
  };
  const title = text("title", true)!;
  const description = text("description", true)!;
  if (description.length > 160) throw new Error(`${file}: description is ${description.length} characters (max 160)`);
  const template = (text("template", false) ?? "page") as Template;
  if (!TEMPLATES.includes(template)) throw new Error(`${file}: template must be one of ${TEMPLATES.join(", ")}`);
  const status = (text("status", false) ?? "stable") as Status;
  if (!STATUSES.includes(status)) throw new Error(`${file}: status must be one of ${STATUSES.join(", ")}`);
  const since = text("since", false);
  const spec = text("spec", false);
  if (template === "stub" && status !== "planned") throw new Error(`${file}: stub pages must have status: planned`);
  return { title, description, template, status, tags: list("tags"), related: list("related"), ...(since ? { since } : {}), ...(spec ? { spec } : {}) };
}
