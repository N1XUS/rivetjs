// ICU MessageFormat → compact IR used by the compiler hook. Build-time only.
import { parse, TYPE, type MessageFormatElement } from "@formatjs/icu-messageformat-parser";

export type Part =
  | { t: string }
  | { a: string }
  | { n: string; f?: Intl.NumberFormatOptions }
  | { d: string; f?: Intl.DateTimeFormatOptions }
  | { p: string; ord?: true; cases: Record<string, Part[]> }
  | { s: string; cases: Record<string, Part[]> }
  | { tag: string; c: Part[] };
export type Variant = string | Part[];
export type ParamKind = "string" | "number" | "date" | "select" | "tag";

export class I18nError extends Error {
  override name = "I18nError";
}

const NUMBER_STYLES: Record<string, Intl.NumberFormatOptions> = {
  percent: { style: "percent" },
  integer: { maximumFractionDigits: 0 },
};
const DATE_STYLES: Record<string, "short" | "medium" | "long" | "full"> = {
  short: "short",
  medium: "medium",
  long: "long",
  full: "full",
};

// Style of a number/date argument: named style, skeleton (`::…`, parsed by formatjs) or none.
function styleOf<T>(style: unknown, named: Record<string, T>, where: string, kind: string): T | undefined {
  if (typeof style === "string") {
    const found = named[style];
    if (found === undefined) throw new I18nError(`${where}: unknown ${kind} style "${style}"`);
    return found;
  }
  return style ? (style as { parsedOptions: T }).parsedOptions : undefined;
}

function convert(elements: MessageFormatElement[], where: string, pound: string | null): Part[] {
  const out: Part[] = [];
  const text = (s: string) => {
    const last = out[out.length - 1];
    if (last && "t" in last) last.t += s;
    else out.push({ t: s });
  };
  for (const el of elements) {
    switch (el.type) {
      case TYPE.literal:
        text(el.value);
        break;
      case TYPE.argument:
        out.push({ a: el.value });
        break;
      case TYPE.number: {
        const f = styleOf(el.style, NUMBER_STYLES, where, "number");
        out.push(f && Object.keys(f).length ? { n: el.value, f } : { n: el.value });
        break;
      }
      case TYPE.date:
      case TYPE.time: {
        const style = styleOf<"short" | "medium" | "long" | "full" | Intl.DateTimeFormatOptions>(
          el.style,
          DATE_STYLES,
          where,
          "date",
        );
        const f: Intl.DateTimeFormatOptions | undefined =
          typeof style === "string" ? (el.type === TYPE.time ? { timeStyle: style } : { dateStyle: style }) : style;
        out.push(f && Object.keys(f).length ? { d: el.value, f } : { d: el.value });
        break;
      }
      case TYPE.pound:
        if (!pound) throw new I18nError(`${where}: "#" outside plural`);
        out.push({ n: pound });
        break;
      case TYPE.plural:
      case TYPE.select: {
        if (!el.options.other) throw new I18nError(`${where}: {${el.value}} requires an "other" case`);
        if (el.type === TYPE.plural && el.offset) throw new I18nError(`${where}: plural offset is not supported`);
        const cases: Record<string, Part[]> = {};
        for (const [k, option] of Object.entries(el.options))
          cases[k] = convert(option.value, where, el.type === TYPE.plural ? el.value : pound);
        out.push(
          el.type === TYPE.select
            ? { s: el.value, cases }
            : el.pluralType === "ordinal"
              ? { p: el.value, ord: true, cases }
              : { p: el.value, cases },
        );
        break;
      }
      case TYPE.tag:
        out.push({ tag: el.value, c: convert(el.children, where, pound) });
        break;
    }
  }
  return out;
}

export function parseMessage(message: string, where: string): Variant {
  let ast: MessageFormatElement[];
  try {
    ast = parse(message, { shouldParseSkeletons: true, requiresOtherClause: false });
  } catch (error) {
    throw new I18nError(`${where}: ${(error as Error).message}`);
  }
  const parts = convert(ast, where, null);
  if (parts.length === 0) return "";
  if (parts.length === 1 && "t" in parts[0]!) return parts[0].t;
  return parts;
}

export function paramsOf(v: Variant, into = new Map<string, ParamKind>()): Map<string, ParamKind> {
  if (typeof v === "string") return into;
  for (const part of v) {
    if ("a" in part) into.set(part.a, into.get(part.a) ?? "string");
    else if ("n" in part) into.set(part.n, "number");
    else if ("d" in part) into.set(part.d, "date");
    else if ("p" in part) {
      into.set(part.p, "number");
      for (const c of Object.values(part.cases)) paramsOf(c, into);
    } else if ("s" in part) {
      into.set(part.s, "select");
      for (const c of Object.values(part.cases)) paramsOf(c, into);
    } else if ("tag" in part) {
      into.set(part.tag, "tag");
      paramsOf(part.c, into);
    }
  }
  return into;
}
