// `<Link to="…">` (router Link, route-transitions Q10 / language-service Q4) literals in TSX.
// Type-level first: once `.rivet/routes.d.ts` types `to` as a route-path union, TypeScript checks and
// completes links itself and these helpers stand down (`narrowed`). While `to` is a plain `string`
// they check literals against the manifest routes (RV3101 warning).
import type TS from "typescript";
import type { CheckDiagnostic } from "./compiler.ts";
import type { EditorRoute } from "./manifest.ts";
import { internalPath, matchRoute } from "./routes.ts";

/** Modules whose `Link` export takes a route path in `to`. */
export const LINK_MODULES = ["@rivetjs/router", "@rivetjs/router/client", "@rivetjs/router/link"];

export interface LinkTarget {
  literal: TS.StringLiteral | TS.NoSubstitutionTemplateLiteral;
  /** `to` is typed as a route union (no plain `string` member): TypeScript owns the check. */
  narrowed: boolean;
}

/** Whether a contextual type is narrower than `string`. */
function narrowed(ts: typeof TS, type: TS.Type | undefined): boolean {
  if (!type) return false;
  const members = type.isUnion() ? type.types : [type];
  return members.every((member) => !(member.flags & (ts.TypeFlags.String | ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Intersection)));
}

/** Literal `to` values of `Link` elements imported from `modules` (only the one at `position` when given). */
export function linkTargets(ts: typeof TS, file: TS.SourceFile, checker: TS.TypeChecker, modules: readonly string[] = LINK_MODULES, position?: number): LinkTarget[] {
  const out: LinkTarget[] = [];
  const isLink = (tag: TS.Identifier): boolean => {
    const declaration = checker.getSymbolAtLocation(tag)?.declarations?.[0];
    if (!declaration || !ts.isImportSpecifier(declaration)) return false;
    const specifier = declaration.parent.parent.parent.moduleSpecifier;
    return (declaration.propertyName ?? declaration.name).getText(file) === "Link" && ts.isStringLiteral(specifier) && modules.includes(specifier.text);
  };
  const visit = (node: TS.Node): void => {
    if (position !== undefined && (position < node.getFullStart() || position > node.end)) return;
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && ts.isIdentifier(node.tagName) && isLink(node.tagName)) {
      for (const attribute of node.attributes.properties) {
        if (!ts.isJsxAttribute(attribute) || attribute.name.getText(file) !== "to" || !attribute.initializer) continue;
        let value: TS.Expression | undefined = attribute.initializer;
        if (ts.isJsxExpression(value)) value = value.expression;
        if (!value || !(ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value))) continue;
        if (position !== undefined && (position <= value.getStart(file) || position >= value.end)) continue;
        out.push({ literal: value, narrowed: narrowed(ts, checker.getContextualType(value)) });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return out;
}

/** RV3101 warnings: literal internal links that match no route (plain-`string` `to` only). */
export function linkDiagnostics(
  ts: typeof TS,
  file: TS.SourceFile,
  checker: TS.TypeChecker,
  routes: readonly EditorRoute[],
  { modules = LINK_MODULES, routesDir }: { modules?: readonly string[]; routesDir?: string | undefined } = {},
): CheckDiagnostic[] {
  if (!routes.length) return [];
  const out: CheckDiagnostic[] = [];
  for (const { literal, narrowed } of linkTargets(ts, file, checker, modules)) {
    const path = internalPath(literal.text);
    if (narrowed || path === null || matchRoute(routes, path)) continue;
    const start = literal.getStart(file);
    const { line, character } = file.getLineAndCharacterOfPosition(start);
    out.push({
      code: "RV3101",
      severity: "warning",
      message: `No route matches "${path}" (routes from ${routesDir ?? "the router"}).`,
      filename: file.fileName,
      start,
      end: literal.end,
      line: line + 1,
      column: character + 1,
      targets: [],
    });
  }
  return out;
}
