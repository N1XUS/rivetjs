// Strict page validation, a byte-for-byte port of load.py's validate_response.
// Bodies are decoded as latin1 so every byte maps to one UTF-16 unit, matching
// Python's bytes regexes (\b and character classes stay ASCII-only).

const FIELDS = /<dd\b[^>]*>(?:<!--[\s\S]*?-->)*([^<]*)(?:<!--[\s\S]*?-->)*<\/dd>/g;
const ROWS = /<article\b[^>]*\bdata-row="([^"]*)"/g;

type Expected = { identities: string[]; fields: string[] };
const cache = new Map<string, Expected>();

/** Text variant (proto `PageRequest.strings`): 0 integers, 1 escaping, 2 text grid. `true` (older configs) = 1. */
export type TextProfile = boolean | number;
const two = (n: number): string => (n < 10 ? "0" : "") + n;
/** Fixture field text; must match `FieldText` in dotnet/ContentService/Program.cs. Escaping variant (1): field 3
 * of every row (10% of fields) is markup-significant + non-ASCII (BMP and astral). Text grid (2): every field is
 * a 24-64 char ASCII string (an admin / CRM grid); fields 3 and 4 carry `&` `<` `>`. */
export function fieldText(row: number, field: number, strings: TextProfile = 0): string {
  const value = row * 100 + field;
  const profile = strings === true ? 1 : Number(strings) || 0;
  if (profile === 2) {
    switch (field) {
      case 0: return `Northwind Customer ${value} Holdings Ltd`;
      case 1: return `customer.${value}@accounts.example.com`;
      case 2: return `Order ${value} shipped to warehouse 7, aisle 12`;
      case 3: return `Ada Lovelace & Co <ada.${value}@example.com>`;
      case 4: return `/catalog/category-${value % 97}/item-${value}?ref=grid&page=2`;
      case 5: return `Updated 2026-10-07 12:${two(value % 60)}:00 UTC by system`;
      case 6: return `Awaiting review by finance team, ticket ${value}`;
      case 7: return `Priority normal; SLA 48 hours; region EU-West-${value % 9}`;
      case 8: return `Tags: billing, invoices, quarterly-report-${value}`;
      default: return `Note: customer prefers email contact, ref ${value}`;
    }
  }
  return profile === 1 && field === 3 ? `<b>"${value}"</b> & 'é€漢字𝄞'` : String(value);
}

/** Deterministic fixture row identities and field values, computed outside measured requests. */
export function expectedContent(rows: number, strings: TextProfile = 0): Expected {
  const profile = strings === true ? 1 : Number(strings) || 0;
  const key = `${profile}:${rows}`;
  let value = cache.get(key);
  if (!value) {
    const identities: string[] = [];
    const fields: string[] = [];
    for (let row = 0; row < rows; row++) {
      identities.push(String(row));
      for (let field = 0; field < 10; field++) fields.push(fieldText(row, field, profile));
    }
    value = { identities, fields };
    if (cache.size > 16) cache.clear();
    cache.set(key, value);
  }
  return value;
}

const ENTITY = /&(?:#(\d{1,7})|#[xX]([\da-fA-F]{1,6})|(amp|lt|gt|quot|apos));/g;
const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
/** Text as the browser parses it: latin1-decoded bytes back to UTF-8, character references resolved. Any
 * encoding style (named, decimal, hex, raw non-ASCII) is accepted; a raw `<` can never reach here. */
function parsedText(raw: string): string {
  let text = raw;
  for (let i = 0; i < text.length; i++)
    if (text.charCodeAt(i) > 0x7f) {
      text = Buffer.from(text, "latin1").toString("utf8");
      break;
    }
  return text.includes("&")
    ? text.replace(ENTITY, (_, decimal: string, hex: string, name: string) => (name ? NAMED[name]! : String.fromCodePoint(decimal ? Number(decimal) : parseInt(hex, 16))))
    : text;
}

function count(text: string, needle: string): number {
  let total = 0;
  for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + needle.length)) total++;
  return total;
}

function matchesExactly(text: string, pattern: RegExp, expected: string[], parse = false): boolean {
  let index = 0;
  for (const match of text.matchAll(pattern)) {
    if (index >= expected.length || (parse ? parsedText(match[1]!) : match[1]) !== expected[index]) return false;
    index++;
  }
  return index === expected.length;
}

/** Accept complete pages only when every row/value and requested article content matches. With `strings`, field
 * text is compared after HTML parsing semantics (exact characters, any valid escaping). */
export function validateResponse(status: number, body: Buffer | string, rows: number, token: string, article = false, strings: TextProfile = 0): boolean {
  const text = typeof body === "string" ? body : body.toString("latin1");
  if (
    !(status === 200 && text.includes("</html>") && text.includes("<!--complete-->") && text.includes(`data-token="${token}"`))
  )
    return false;
  const { identities, fields } = expectedContent(rows, strings);
  if (!matchesExactly(text, ROWS, identities) || !matchesExactly(text, FIELDS, fields, !!strings)) return false;
  if (article) {
    return (
      text.includes("<h1>Benchmark article</h1>") &&
      text.includes("<strong>gRPC</strong>") &&
      count(text, "<h2>Section</h2>") === 32 &&
      count(text, "<em>emphasis</em>") === 32 &&
      count(text, 'href="https://example.com"') === 32 &&
      count(text, "<li>First item</li>") === 32 &&
      count(text, "<li>Second item</li>") === 32
    );
  }
  return true;
}
