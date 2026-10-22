// Route `head` exports in server / static apps are server data: the handler merges them into the document, and
// client navigation applies the `head` the data endpoint answers with. Client builds of route modules un-export
// `head` (same byte length: positions and source maps unchanged), so the bundler drops it together with whatever
// only it uses (raw CSS strings, meta builders). Kept when the module's own code reads it. CSR apps keep the export
// (no server: the client applies route heads, `client/index.ts` `_csrHead`).
import { parseAst } from "vite";

interface Node {
  type: string;
  start: number;
  end: number;
}
interface Named extends Node {
  name?: string;
  value?: unknown;
}
interface ExportNamed extends Node {
  declaration?: (Node & { id?: Named | null; declarations?: { id: Named }[] }) | null;
  specifiers?: (Node & { exported: Named })[];
}

const isHead = (name: Named | null | undefined) => !!name && (name.name === "head" || name.value === "head");

/** `code` (JavaScript) with its `head` export un-exported, or null when it has none (or does not parse). */
export function unexportHead(code: string): string | null {
  if (!/\bhead\b/.test(code)) return null;
  let body: Node[];
  try {
    body = (parseAst(code) as unknown as { body: Node[] }).body;
  } catch {
    return null;
  }
  const blanks: [number, number][] = [];
  for (const statement of body) {
    if (statement.type !== "ExportNamedDeclaration") continue;
    const { declaration, specifiers = [] } = statement as ExportNamed;
    if (declaration) {
      // `export const head = …` (one declarator) / `export function head() {}`: drop the `export` keyword.
      const single = declaration.type === "VariableDeclaration" && declaration.declarations?.length === 1 && isHead(declaration.declarations[0]!.id);
      if (single || (declaration.type === "FunctionDeclaration" && isHead(declaration.id))) blanks.push([statement.start, declaration.start]);
      continue;
    }
    const at = specifiers.findIndex((specifier) => isHead(specifier.exported));
    if (at < 0) continue;
    // `export { x as head }` alone: the whole statement; among others: the specifier and its comma.
    if (specifiers.length === 1) blanks.push([statement.start, statement.end]);
    else if (at > 0) blanks.push([specifiers[at - 1]!.end, specifiers[at]!.end]);
    else blanks.push([specifiers[0]!.start, specifiers[1]!.start]);
  }
  if (!blanks.length) return null;
  let out = "",
    pos = 0;
  for (const [start, end] of blanks) {
    out += code.slice(pos, start) + code.slice(start, end).replace(/[^\n\r]/g, " ");
    pos = end;
  }
  return out + code.slice(pos);
}
