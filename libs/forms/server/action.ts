// `action(def, fn)`: a router action (`(event) => result`) for a form definition. Pipeline:
// CSRF → content type → bounded body → `_form` / `_intent` → decode → schema → server field checks
// → handler. Failures answer `fail(400, FormReply)`: the page re-renders with issues and echoed
// values (no JS), the enhanced submit receives the same reply as JSON.
import { ActionFailure, fail, HttpError, isActionFailure, type RequestEvent } from "@rivetjs/router";
import type { FieldConfig, FormDefinition } from "../define.ts";
import { FormDecodeError, rawValues } from "../decode.ts";
import { decodeWith, runSchema } from "../engine.ts";
import { toIssues, type IssueMap } from "../issues.ts";
import { byPattern, canonicalName, getAt, matchesPattern } from "../path.ts";
import type { FormReply } from "../store.ts";
import type { InferOutput, Issue, IssueLike } from "../types.ts";
import type { MappedIssue } from "../errors.ts";
import { applyIntent, parseIntent } from "./intents.ts";

export type { MappedIssue };

type MaybePromise<T> = T | Promise<T>;
/** A server-only field check (availability lookups): issues for the value, or nothing. */
export type ServerCheck = (
  value: unknown,
  context: { values: unknown; path: string; event: RequestEvent; signal: AbortSignal },
) => MaybePromise<IssueLike | readonly IssueLike[] | undefined | null | void>;
export interface BodyLimits {
  /** Max urlencoded body bytes (default 1 MiB). */
  urlencoded?: number;
  /** Max multipart body bytes (default 10 MiB). */
  multipart?: number;
  /** Max bytes per uploaded file (default: the multipart limit). */
  file?: number;
}
/** Options of `action()`: CSRF check, body limits and decoding. */
export interface ActionOptions {
  /**
   * `"strict"` (default): like the router, reject cross-site posts, and in production also posts
   * that carry neither `Origin` nor `Sec-Fetch-Site` (403). `"lax"`: the router's check only. A
   * function: custom verification (e.g. `verifyCsrf` from `@rivetjs/forms/csrf`) after the strict check.
   */
  csrf?: "strict" | "lax" | ((event: RequestEvent, data: FormData) => MaybePromise<boolean>);
  limits?: BodyLimits;
  /** Server-only checks by path or pattern; also answer remote (`_intent=validate:<path>`) checks. */
  checks?: Readonly<Record<string, ServerCheck>>;
  /** Status of validation failures (default 400). */
  status?: number;
}
export interface HandlerContext {
  /** The submitted FormData (files included). */
  readonly data: FormData;
  /** Form instance id (`_form`). */
  readonly id: string;
  /** The submitted `_intent`, if any (e.g. a "save draft" button). */
  readonly intent?: string;
}

const URLENCODED = "application/x-www-form-urlencoded";
const MULTIPART = "multipart/form-data";
const MiB = 1024 * 1024;
const SECRET = /password|secret/i;

/**
 * Wrap a form handler as a router action. `fn` receives the parsed schema output; it may return
 * data (→ `{ ok: true, data }`), `invalid(...)`, `redirect(...)`, a `Response`, or throw.
 */
export function action<D extends FormDefinition<any>>(
  def: D,
  fn: (value: InferOutput<D>, event: RequestEvent, context: HandlerContext) => unknown,
  options: ActionOptions = {},
): (event: RequestEvent) => Promise<unknown> {
  return async (event) => {
    const data = await readForm(event.request, options.limits, !event.dev && options.csrf !== "lax");
    if (typeof options.csrf === "function" && !(await options.csrf(event, data))) throw new HttpError(403, "Invalid form token");
    const submitted = data.get("_form");
    const id = typeof submitted === "string" && /^[A-Za-z][\w-]*$/.test(submitted) ? submitted : def.name;
    const raw = data.get("_intent");
    const intent = typeof raw === "string" && raw ? raw : undefined;
    const echo = () => echoValues(def, data);

    if (intent?.startsWith("validate:")) return validateField(def, options, event, data, id, intent);
    const array = intent ? parseIntent(intent) : null;
    if (intent && array) {
      const applied = applyIntent(echo(), array);
      const reply: FormReply = { ok: false, id, intent, values: applied.values, rows: { [array.path]: applied.rows } };
      return reply;
    }

    const parsed = await parse(def, data, { event, checks: options.checks });
    if (!parsed.ok) return fail(options.status ?? 400, { ok: false, id, issues: parsed.issues, form: parsed.form, values: echo() } satisfies FormReply);
    const result = await fn(parsed.value as InferOutput<D>, event, { data, id, ...(intent ? { intent } : {}) });
    if (isActionFailure(result)) {
      const reply = result.data as FormReply;
      return reply && typeof reply === "object" && reply.ok === false
        ? new ActionFailure(result.status, { ...reply, id, values: reply.values ?? echo() })
        : result;
    }
    if (result instanceof HttpError || result instanceof Response) return result;
    return { ok: true, id, data: result } satisfies FormReply;
  };
}

/** Fail the handler with issues by path (`""` = form) or a mapped issue list; status 400 by default. */
export function invalid(
  issues: Readonly<Record<string, IssueLike | readonly IssueLike[]>> | readonly MappedIssue[],
  form?: IssueLike | readonly IssueLike[],
  status = 400,
): ActionFailure<FormReply> {
  const fields: Record<string, Issue[]> = {};
  const root: Issue[] = toIssues(form);
  const add = (path: string, issue: Issue) => (path === "" ? root.push(issue) : (fields[path] ??= []).push(issue));
  if (Array.isArray(issues)) for (const { path, ...issue } of issues as readonly MappedIssue[]) add(path, issue);
  else
    for (const [path, list] of Object.entries(issues as Record<string, IssueLike | readonly IssueLike[]>)) for (const issue of toIssues(list)) add(path, issue);
  return fail(status, { ok: false, issues: fields, form: root });
}

/** Result of `parse()`: the typed value, or the issues by field and for the whole form. */
export type ParseResult<T> = { ok: true; value: T } | { ok: false; issues: Record<string, Issue[]>; form: Issue[] };

/** Decode and validate FormData (or a request's body) against a definition, plus server field checks. */
export async function parse<D extends FormDefinition<any>>(
  def: D,
  input: FormData | Request,
  context: { event?: RequestEvent; checks?: Readonly<Record<string, ServerCheck>> } = {},
): Promise<ParseResult<InferOutput<D>>> {
  const data = input instanceof FormData ? input : await readForm(input);
  let decoded: Record<string, unknown>;
  try {
    decoded = decodeWith(def, data);
  } catch (error) {
    if (error instanceof FormDecodeError) throw new HttpError(400, error.message);
    throw error;
  }
  const outcome: { value?: unknown; issues: IssueMap } = await runSchema(def, decoded);
  const issues: Record<string, Issue[]> = { ...outcome.issues.fields };
  const form = [...outcome.issues.form];
  // Server field checks for submitted paths the schema accepted.
  const paths = new Set<string>();
  for (const [name] of data) {
    const path = canonicalName(name);
    if (path) paths.add(path);
  }
  const signal = context.event?.signal ?? new AbortController().signal;
  await Promise.all(
    [...paths].map(async (path) => {
      if (issues[path]) return;
      const found = await runChecks(def, context.checks, path, decoded, context.event, signal);
      if (found.length) issues[path] = found;
    }),
  );
  if (Object.keys(issues).length || form.length) {
    // Submitted (DOM) order, so the re-rendered page autofocuses the first invalid control.
    const ordered: Record<string, Issue[]> = {};
    for (const path of paths) if (issues[path]) ordered[path] = issues[path];
    for (const path in issues) ordered[path] ??= issues[path]!;
    return { ok: false, issues: ordered, form };
  }
  return { ok: true, value: outcome.value as InferOutput<D> };
}

/** Checks for one path: the definition's `server: true` field check, then `options.checks`. */
async function runChecks(
  def: FormDefinition<any>,
  checks: Readonly<Record<string, ServerCheck>> | undefined,
  path: string,
  values: unknown,
  event: RequestEvent | undefined,
  signal: AbortSignal,
): Promise<Issue[]> {
  const out: Issue[] = [];
  const config = byPattern<FieldConfig | undefined>(def.fields, path);
  const value = getAt(values, path);
  if (config?.server && config.validate) out.push(...toIssues((await config.validate(value, { signal, values, path })) as never));
  const own = byPattern(checks, path);
  if (own && event) out.push(...toIssues((await own(value, { values, path, event, signal })) as never));
  return out;
}

/** Remote field check (`_intent=validate:<path>`): schema issues for the path, else its checks. No handler. */
async function validateField(
  def: FormDefinition<any>,
  options: ActionOptions,
  event: RequestEvent,
  data: FormData,
  id: string,
  intent: string,
): Promise<FormReply> {
  const path = canonicalName(intent.slice("validate:".length));
  if (!path) throw new HttpError(400, "Invalid validate intent");
  let decoded: Record<string, unknown>;
  try {
    decoded = decodeWith(def, data);
  } catch (error) {
    if (error instanceof FormDecodeError) throw new HttpError(400, error.message);
    throw error;
  }
  const outcome: { issues: IssueMap } = await runSchema(def, decoded);
  const found = outcome.issues.fields[path] ?? (await runChecks(def, options.checks, path, decoded, event, event.signal));
  return { ok: found.length === 0, id, intent, issues: found.length ? { [path]: found } : {} };
}

/**
 * Submitted values to re-render with: strings only, files dropped, names matching `SECRET` always
 * dropped, plus any `echo.exclude` paths/patterns (a union — custom excludes never re-enable secrets).
 */
function echoValues(def: FormDefinition<any>, data: FormData): Record<string, string | string[]> {
  const exclude = def.echo?.exclude;
  return rawValues(data, (name) => !SECRET.test(name) && !(exclude && exclude.some((pattern) => matchesPattern(pattern, name))));
}

/**
 * Read a form body with size limits: 415 for other content types, 413 past the limit (checked on
 * `content-length` first, then while streaming). `strict` adds the missing-provenance check (403).
 */
export async function readForm(request: Request, limits: BodyLimits = {}, strict = false): Promise<FormData> {
  if (strict && !request.headers.has("origin") && !request.headers.has("sec-fetch-site")) throw new HttpError(403, "Cross-site form submission rejected");
  const type = (request.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
  if (type !== URLENCODED && type !== MULTIPART) throw new HttpError(415, "Unsupported form encoding");
  const max = type === URLENCODED ? (limits.urlencoded ?? MiB) : (limits.multipart ?? 10 * MiB);
  const declared = Number(request.headers.get("content-length"));
  if (declared > max) throw new HttpError(413, "Form too large");
  const bytes = await readBounded(request, max);
  let data: FormData;
  try {
    data = await new Response(bytes, { headers: { "content-type": request.headers.get("content-type")! } }).formData();
  } catch {
    throw new HttpError(400, "Malformed form body");
  }
  if (type === MULTIPART && limits.file !== undefined) {
    for (const [, value] of data) if (typeof value !== "string" && value.size > limits.file) throw new HttpError(413, "File too large");
  }
  return data;
}

async function readBounded(request: Request, max: number): Promise<Uint8Array<ArrayBuffer>> {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array<ArrayBufferLike>[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => {});
      throw new HttpError(413, "Form too large");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.byteLength;
  }
  return out;
}
