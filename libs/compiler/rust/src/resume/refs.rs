//! Function Bridge C3 / T3 (2026-10-09): module references. A module-level function / `const` function or a static import
//! used as a value inside a component of a resume module (`const api = { inc }`, `[double]`, `signal(fmt)`, `ns.member`)
//! is recorded once per binding (+ member): it covers prop values and captures (`ref_covered` / `bind_module_ref`), so
//! the analysis does not turn it into a site. `own_exports` names a module's own exports (derived boundary names).

use oxc_ast::{
    AstKind,
    ast::{BindingPatternKind, Declaration, ExportDefaultDeclarationKind, Expression, IdentifierReference, PropertyKind, Statement},
};
use oxc_semantic::NodeId;

use super::{Analysis, import_source, unwrap, value_positions};
use crate::tree::Tree;

/// The first value use (inside a component) of a module function / import (+ member of a namespace / default import).
pub(super) struct RefUse {
    decl: NodeId,
    member: Option<String>,
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
        let Some((decl, _)) = self.module_ref_target(ident, member) else { return };
        if self.refs.iter().any(|r| r.decl == decl && r.member.as_deref() == member) || self.id(ident).is_none() {
            return;
        }
        self.refs.push(RefUse { decl, member: member.map(str::to_string) });
    }

}

/// Every name under which the module exports its own binding `local` (`export function inc` / `export { inc }` → `inc`,
/// `export { plus as inc }` → `inc` for `plus`, `export default inc` / `export default function inc` → `default`),
/// sorted in code-unit order, without duplicates. Empty: not exported (re-exports `export { x } from "…"` name another
/// module's binding, never `local`).
pub(super) fn own_exports(tree: &Tree, local: &str) -> Vec<String> {
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
