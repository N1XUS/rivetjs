// JSX / statement helpers shared by the build walks (`static-class.ts`, `native-lite.ts`, `static-motion.ts`).
export type Node = { type: string; start: number; end: number; [key: string]: unknown };

/** TS wrappers around a value expression: the walks enter their `expression` only. */
export const TS_EXPRESSIONS = new Set(["TSAsExpression", "TSSatisfiesExpression", "TSNonNullExpression", "TSInstantiationExpression", "TSTypeAssertion"]);

export function jsxName(node: Node): string | null {
  if (node.type === "JSXIdentifier") return node.name as string;
  if (node.type === "JSXMemberExpression") {
    const head = jsxName(node.object as Node);
    return head === null ? null : head + "." + ((node.property as Node).name as string);
  }
  return null;
}

/** The component a top-level statement declares (`ModuleFacts.boundaries` key), or null. */
export function componentOf(statement: Node): string | null {
  let node = statement;
  const isFn = (n: Node | null | undefined): n is Node =>
    !!n && (n.type === "FunctionDeclaration" || n.type === "FunctionExpression" || n.type === "ArrowFunctionExpression");
  if (node.type === "ExportNamedDeclaration") {
    if (!node.declaration) return null;
    node = node.declaration as Node;
  } else if (node.type === "ExportDefaultDeclaration") {
    const declaration = node.declaration as Node;
    if (!isFn(declaration)) return null;
    return (declaration.id as { name: string } | null | undefined)?.name ?? "default";
  }
  if (node.type === "FunctionDeclaration") return (node.id as { name: string } | null)?.name ?? null;
  if (node.type === "VariableDeclaration") {
    const decls = node.declarations as Node[];
    if (decls.length !== 1) return null;
    const id = decls[0]!.id as Node;
    return id.type === "Identifier" && isFn(decls[0]!.init as Node | null) ? (id.name as string) : null;
  }
  return null;
}
