//! Function Bridge C3 / T3 (2026-10-09, spec `docs/design/specs/2026-10-09-function-bridge-design.md` §3.1 / §3.2): module
//! references. A module-level function / `const` function or a static import used as a value inside a component of a
//! resume module (`const api = { inc }`, `[double]`, `signal(fmt)`, `ns.member`) is stamped once per module load by the
//! server epilogue `_rMod(() => value, "id"[, 1])` (a thunk: an import binding may still be in its TDZ while an import
//! cycle evaluates; the runtime reads it before the first encode), after the module's last statement; the browser symbol
//! `() => (g)` returns the module's own binding (the encoder writes `{f: id, a: []}` wherever a render reaches the value).
//!
//! Ids `<unit>#<name>$<h>$ref` (`$ref` is a reserved hash suffix, so no closure symbol shares it):
//! - `unit`: the module itself (own functions) or the imported module — its RESOLVED module id when the bundler passed one
//!   (`resolvedImports`: `./util`, `./util.js`, `./util.ts` from any importer → `src/util.ts`; `util.ts` and
//!   `util/index.ts` stay two units), else the specifier (packages) or the specifier resolved against the importing
//!   module's directory. One id per value whatever module imports it: state never depends on which importers loaded.
//! - `name`: the EXPORTED name — an import's imported name (`ns.member` → `member`, a default import's member →
//!   `default_member`), an own function's name in the module's exports (`export { plus as inc }` → `inc` for `plus`,
//!   `export default inc` → `default`) — so an import of an own export gets the own id (same unit + name) and the same
//!   value; an own function the module does not export gets `<local>$l` with the digest salted (`unit, "\0local",
//!   local`): no import can name it, so a local `inc` next to `export { plus as inc }` / `export { inc } from "./o"`
//!   never shares an id with that export (fix round 2, N1a). Non-identifier characters → `_`; `h` = 5 base-36 digits of
//!   FNV-1a over unit + name, so two values never share an export name in one symbol module (two `default` imports,
//!   `fmt` from two packages, own `double` + `u.double`).
//! - flag `1` on the stamp = an import: the runtime keeps an own-module stamp over import stamps.

use oxc_ast::{
    AstKind,
    ast::{BindingPatternKind, Declaration, ExportDefaultDeclarationKind, Expression, IdentifierReference, PropertyKind, Statement},
};
use oxc_semantic::NodeId;
use rustc_hash::FxHashMap;

use super::{Analysis, Import, ModuleRef, Symbol, content_digest, import_source, unwrap, value_positions};
use crate::compile::Diags;
use crate::tree::Tree;

/// The first value use (inside a component) of a module function / import (+ member of a namespace / default import).
pub(super) struct RefUse {
    decl: NodeId,
    member: Option<String>,
    component: String,
    /// Every component using it (source order; `component` first).
    components: Vec<String>,
    node: NodeId,
}

/// Digits of the unit hash in a reference name.
const UNIT_HASH: usize = 5;

/// `from` mapped to its resolved module id (`resolved`), else resolved against the directory of `module` when relative
/// (`.` / `..` segments folded), else `from` itself.
fn unit(module: &str, resolved: &FxHashMap<String, String>, from: &str) -> String {
    if let Some(id) = resolved.get(from) {
        return id.clone();
    }
    if !(from == "." || from == ".." || from.starts_with("./") || from.starts_with("../")) {
        return from.to_string();
    }
    let mut parts: Vec<&str> = module.split('/').collect();
    parts.pop();
    for segment in from.split('/') {
        match segment {
            "" | "." => {}
            ".." if parts.last().is_some_and(|p| !p.is_empty() && *p != "..") => {
                parts.pop();
            }
            segment => parts.push(segment),
        }
    }
    parts.join("/")
}

/// `name` with every character an identifier cannot hold replaced by `_` (`"a-b"` → `a_b`).
fn identifier_part(name: &str) -> String {
    name.chars().map(|c| if c == '_' || c == '$' || c.is_alphanumeric() { c } else { '_' }).collect()
}

/// A context token by convention (`ButtonContext`): PascalCase ending in `Context`. Context ids are Function Bridge
/// T14 / T16; a token never needs a module reference (a provided value encodes as `{x}`).
fn context_token(name: &str) -> bool {
    name.len() > "Context".len() && name.ends_with("Context") && name.starts_with(|c: char| c.is_ascii_uppercase())
}

/// A context lookup (`useContext(X)`, `useSlottedContext(X)`, `useContextProps(p, ref, X)`): its arguments are tokens.
fn context_call(callee: &Expression) -> bool {
    matches!(unwrap(callee), Expression::Identifier(i) if i.name.as_str().starts_with("use") && i.name.as_str().contains("Context"))
}

impl<'t, 'a> Analysis<'t, 'a> {
    /// `scan` hook (outside sites): module functions / imports in value positions — property values, call / new
    /// arguments, assigned / returned / initial values, concise arrow bodies, yields.
    pub(super) fn scan_refs(&mut self, kind: AstKind<'a>) {
        match kind {
            AstKind::ObjectProperty(p) if p.kind == PropertyKind::Init && !p.method => self.module_refs(&p.value),
            AstKind::ReturnStatement(r) => {
                if let Some(argument) = &r.argument {
                    self.module_refs(argument);
                }
            }
            AstKind::VariableDeclarator(d) => {
                if let Some(init) = &d.init {
                    self.module_refs(init);
                }
            }
            AstKind::AssignmentExpression(assign) => self.module_refs(&assign.right),
            AstKind::CallExpression(call) if !context_call(&call.callee) => {
                for argument in &call.arguments {
                    if let Some(value) = argument.as_expression() {
                        self.module_refs(value);
                    }
                }
            }
            AstKind::NewExpression(call) => {
                for argument in &call.arguments {
                    if let Some(value) = argument.as_expression() {
                        self.module_refs(value);
                    }
                }
            }
            AstKind::ArrowFunctionExpression(f) if f.expression => {
                if let Some(Statement::ExpressionStatement(s)) = f.body.statements.first() {
                    self.module_refs(&s.expression);
                }
            }
            AstKind::YieldExpression(y) => {
                if let Some(argument) = &y.argument {
                    self.module_refs(argument);
                }
            }
            _ => {}
        }
    }

    /// Module references among `e`'s values (conditional / logical / sequence branches, parentheses, TS casts, array
    /// elements): an identifier or a static member of a namespace / default import (`ns.member`), see `module_ref_target`.
    pub(super) fn module_refs(&mut self, e: &'a Expression<'a>) {
        let mut values = Vec::new();
        value_positions(e, &mut values);
        for value in values {
            match value {
                Expression::Identifier(ident) => self.module_ref(ident, None),
                Expression::StaticMemberExpression(m) if !m.optional => {
                    if let Expression::Identifier(object) = unwrap(&m.object) {
                        self.module_ref(object, Some(m.property.name.as_str()));
                    }
                }
                Expression::ArrayExpression(array) => {
                    for element in &array.elements {
                        if let Some(element) = element.as_expression() {
                            self.module_refs(element);
                        }
                    }
                }
                _ => {}
            }
        }
    }

    /// `ident` (`.member`) as a module reference: a module function or an import (not `@rivetjs/*` framework packages,
    /// static-call bindings, `#` subpath imports or context tokens), read inside a component (PascalCase top-level
    /// function or the default export). Returns the declaration and the component.
    fn module_ref_target(&self, ident: &IdentifierReference<'a>, member: Option<&str>) -> Option<(NodeId, String)> {
        let tree = self.tree;
        let decl = tree.resolve(ident, true)?;
        let reference = match (member, tree.kind(decl)) {
            (None, AstKind::ImportNamespaceSpecifier(_)) => false,
            (None, _) => self.module_function(decl),
            (Some(_), AstKind::ImportNamespaceSpecifier(_) | AstKind::ImportDefaultSpecifier(_)) => true,
            _ => false,
        };
        if !reference || self.statics.contains(&decl) || context_token(member.unwrap_or(ident.name.as_str())) {
            return None;
        }
        if let Some(from) = import_source(tree, decl) {
            let package = |p: &str| from == p || from.strip_prefix(p).is_some_and(|rest| rest.starts_with('/'));
            if from.contains('#') || (from.starts_with("@rivetjs/") && !self.source_packages.iter().any(|p| package(p))) {
                return None;
            }
        }
        let node = self.id(ident)?;
        let top = self.top_function(node)?;
        let default_export = matches!(tree.parent_kind(top), Some(AstKind::ExportDefaultDeclaration(_)));
        if !self.component_function(top) && !default_export {
            return None;
        }
        Some((decl, self.component_of(node)?))
    }

    /// A value a module reference covers (CORE-GAPS (d) prop / alias `_rFn` sites and `equals` sites skip it: the
    /// `_rMod` stamp wins over a per-render `_rFn` anyway, so their symbols would be unreachable).
    pub(super) fn ref_covered(&self, ident: &IdentifierReference<'a>) -> bool {
        self.module_ref_target(ident, None).is_some()
    }

    /// Function Bridge C9 / T10: the callee of a captured `f.bind(…)` const as a module reference (`_rMod` stamp), when it
    /// is one (a module function / import read inside a component).
    pub(super) fn bind_module_ref(&mut self, ident: &'a IdentifierReference<'a>) -> bool {
        if self.module_ref_target(ident, None).is_none() {
            return false;
        }
        self.module_ref(ident, None);
        true
    }

    /// Record a module reference use; the first use per binding + member wins, later ones add their component.
    fn module_ref(&mut self, ident: &IdentifierReference<'a>, member: Option<&str>) {
        let Some((decl, component)) = self.module_ref_target(ident, member) else { return };
        if let Some(r) = self.refs.iter_mut().find(|r| r.decl == decl && r.member.as_deref() == member) {
            if !r.components.contains(&component) {
                r.components.push(component);
            }
            return;
        }
        let Some(node) = self.id(ident) else { return };
        self.refs.push(RefUse { decl, member: member.map(str::to_string), components: vec![component.clone()], component, node });
    }

    /// One `() => (g)` symbol per module reference id, after the closure symbols (its id is not a content hash); the
    /// symbol module export names are unique (`<name>$<h>$ref`): a name another value already took (a unit hash
    /// collision) is a named error, never a silent skip. Extends `scope` with own functions.
    pub(super) fn module_ref_symbols(&self, module: &str, symbols: &mut Vec<Symbol>, scope: &mut Vec<String>, diags: &mut Diags) -> Vec<ModuleRef> {
        let mut module_refs = Vec::new();
        for r in &self.refs {
            let Some((mut symbol, reference)) = reference(self.tree, module, self.resolved, r.decl, r.member.as_deref(), &r.component) else {
                debug_assert!(false, "module reference without a name");
                continue;
            };
            if symbols.iter().any(|s| s.id == symbol.id) {
                // Another binding of the same value (`import { a }` + `import { a as b }` from one module).
                continue;
            }
            if let Some(other) = symbols.iter().find(|s| s.name == symbol.name) {
                diags.add(
                    format!(
                        "Cannot resume {module}: module references `{}` and `{}` share the browser name `{}`; rename one import",
                        other.id, symbol.id, symbol.name
                    ),
                    Some(r.node),
                );
                continue;
            }
            if r.components.len() > 1 {
                symbol.uses = r.components.clone();
            }
            for name in &symbol.scope {
                if !scope.contains(name) {
                    scope.push(name.clone());
                }
            }
            symbols.push(symbol);
            module_refs.push(reference);
        }
        module_refs
    }
}

/// The symbol + server stamp of the module reference `decl` (`.member` of a namespace / default import). None only for a
/// declaration no identifier can name (unreachable: `module_ref_target` resolved one).
fn reference(
    tree: &Tree,
    module: &str,
    resolved: &FxHashMap<String, String>,
    decl: NodeId,
    member: Option<&str>,
    component: &str,
) -> Option<(Symbol, ModuleRef)> {
    let (local, imported) = match tree.kind(decl) {
        AstKind::ImportSpecifier(s) => (s.local.name.to_string(), Some(s.imported.name().to_string())),
        AstKind::ImportDefaultSpecifier(s) => (s.local.name.to_string(), Some("default".to_string())),
        AstKind::ImportNamespaceSpecifier(s) => (s.local.name.to_string(), Some("*".to_string())),
        AstKind::Function(f) => (f.id.as_ref()?.name.to_string(), None),
        AstKind::VariableDeclarator(d) => match &d.id.kind {
            BindingPatternKind::BindingIdentifier(b) => (b.name.to_string(), None),
            _ => return None,
        },
        _ => return None,
    };
    let from = import_source(tree, decl);
    // (exported name, unit, server value); an own function the module does not export: salted (`None`).
    // Every name the module exports `local` under; the id uses the smallest (code-unit order), the others are `aliases`
    // (fix round 3, L2: `export { inc, inc as plus }` / `export default inc` + `export { inc }` → one id for the value).
    let mut exported = if imported.is_none() { own_exports(tree, &local) } else { Vec::new() };
    let own = (!exported.is_empty()).then(|| exported.remove(0));
    let (export, unit, value) = match (&imported, member) {
        (None, _) => (own.clone().unwrap_or_else(|| format!("{local}$l")), module.to_string(), local.clone()),
        (Some(imported), None) => (imported.clone(), unit(module, resolved, from?), local.clone()),
        (Some(imported), Some(member)) if imported == "*" => (member.to_string(), unit(module, resolved, from?), format!("{local}.{member}")),
        (Some(_), Some(member)) => (format!("default.{member}"), unit(module, resolved, from?), format!("{local}.{member}")),
    };
    let digest = if imported.is_none() && own.is_none() {
        content_digest(&[unit.as_str(), "\0local", local.as_str()])
    } else {
        content_digest(&[unit.as_str(), export.as_str()])
    };
    let name = format!("{}${}$ref", identifier_part(&export), &digest[..UNIT_HASH]);
    let id = format!("{unit}#{name}");
    let (source, imports, locals, scope) = match (from, &imported) {
        // An import: the symbol module imports only that value from its module (never the importer's module graph).
        (Some(from), Some(imported)) => {
            let alias = format!("__rivetRef_{name}");
            let (imported, read) = match member {
                Some(member) if imported == "*" => (member.to_string(), alias.clone()),
                Some(member) => ("default".to_string(), format!("{alias}.{member}")),
                None => (imported.clone(), alias.clone()),
            };
            let import = Import { local: alias, imported, from: from.to_string() };
            (format!("export const {name} = () => ({read});\n"), vec![import], Vec::new(), Vec::new())
        }
        // Own module function: from the source module (its DOM output exports it: `scope`).
        _ => (format!("export const {name} = () => ({value});\n"), Vec::new(), vec![local.clone()], vec![local]),
    };
    let symbol = Symbol {
        source,
        name,
        id: id.clone(),
        kind: "ref",
        component: component.to_string(),
        captures: Vec::new(),
        labels: Vec::new(),
        scope,
        imports,
        locals,
        uses: Vec::new(),
        aliases: exported,
    };
    Some((symbol, ModuleRef { value, id, imported: imported.is_some() }))
}

/// Every name under which the module exports its own binding `local` (`export function inc` / `export { inc }` → `inc`,
/// `export { plus as inc }` → `inc` for `plus`, `export default inc` / `export default function inc` → `default`),
/// sorted in code-unit order, without duplicates. Empty: not exported (re-exports `export { x } from "…"` name another
/// module's binding, never `local`).
fn own_exports(tree: &Tree, local: &str) -> Vec<String> {
    let mut names: Vec<String> = Vec::new();
    for statement in &tree.program.body {
        match statement {
            Statement::ExportNamedDeclaration(e) if e.source.is_none() => {
                match &e.declaration {
                    Some(Declaration::FunctionDeclaration(f)) if f.id.as_ref().is_some_and(|id| id.name.as_str() == local) => {
                        names.push(local.to_string());
                    }
                    Some(Declaration::VariableDeclaration(v)) => {
                        for d in &v.declarations {
                            if matches!(&d.id.kind, BindingPatternKind::BindingIdentifier(b) if b.name.as_str() == local) {
                                names.push(local.to_string());
                            }
                        }
                    }
                    _ => {}
                }
                for s in &e.specifiers {
                    if s.local.name().as_str() == local {
                        names.push(s.exported.name().to_string());
                    }
                }
            }
            Statement::ExportDefaultDeclaration(e) => match &e.declaration {
                ExportDefaultDeclarationKind::FunctionDeclaration(f) if f.id.as_ref().is_some_and(|id| id.name.as_str() == local) => {
                    names.push("default".to_string());
                }
                ExportDefaultDeclarationKind::Identifier(i) if i.name.as_str() == local => names.push("default".to_string()),
                _ => {}
            },
            _ => {}
        }
    }
    names.sort_by(|a, b| a.encode_utf16().cmp(b.encode_utf16()));
    names.dedup();
    names
}
