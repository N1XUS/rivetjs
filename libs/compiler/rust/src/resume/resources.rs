//! RESOURCE-COMPILER (2026-10-20, spec `docs/design/specs/2026-10-20-resource-design.md` §4): `resource()` recipes.
//!
//! The server encodes a resource as `bind` of the recipe its `const` has (`libs/runtime/server-resource.ts`), so every
//! captured `const r = resource(…)` must be an Fn recipe, whatever its arguments: `fn_closure` accepts a `const` whose
//! initializer is a call of `resource` imported from `@rivetjs/runtime/dom` / `/server` (aliased imports included, a
//! local function named `resource` excluded), so `resource(fetchUser)`, `resource(id, loadUser, { initialValue })` and
//! `resource(src, f)` with a local `const f` resume like the inline-arrow form. Module functions / imports in the recipe
//! resume by reference (`_rMod`), locals as its captures (a local function becomes its own Fn site).
//!
//! The forms that still cannot resume warn RV2016 (render code only: closures that run in the browser only are not
//! scanned): a destructured handle (`const { loading } = resource(…)`: methods lose their handle; `const [d] = …`: the
//! handle is not iterable), a `let` / `var`, a call that is not a `const` initializer (JSX attribute, object value,
//! returned value), and a `const` inside a named non-component function (a hook: its caller's `const` is not a recipe).

use oxc_ast::{AstKind, ast::*};
use oxc_semantic::NodeId;

use super::{Analysis, unwrap};
use crate::compile::Diags;

impl<'t, 'a> Analysis<'t, 'a> {
    /// `e` (parentheses / TS wrappers unwrapped) calls `resource` from `@rivetjs/runtime/dom` or `@rivetjs/runtime/server`.
    pub(super) fn resource_call(&self, e: &Expression<'a>) -> bool {
        let Expression::CallExpression(call) = unwrap(e) else { return false };
        self.resource_callee(&call.callee)
    }

    fn resource_callee(&self, callee: &Expression<'a>) -> bool {
        self.import_of(unwrap(callee))
            .is_some_and(|(name, from)| name == "resource" && (from == "@rivetjs/runtime/dom" || from == "@rivetjs/runtime/server"))
    }

    /// Scan hook (render code, outside site closures): RV2016 for a `resource()` call that cannot resume.
    pub(super) fn scan_resource(&self, id: NodeId, call: &'a CallExpression<'a>, diags: &mut Diags) {
        if !self.resource_callee(&call.callee) {
            return;
        }
        let tree = self.tree;
        // Up through parentheses / TS casts to the position the value lands in.
        let mut at = id;
        let mut parent = tree.parent(at);
        while let Some(p) = parent {
            match tree.kind(p) {
                AstKind::ParenthesizedExpression(_) | AstKind::TSAsExpression(_) | AstKind::TSSatisfiesExpression(_) | AstKind::TSNonNullExpression(_) => {
                    at = p;
                    parent = tree.parent(p);
                }
                _ => break,
            }
        }
        let form = match parent.map(|p| (p, tree.kind(p))) {
            Some((p, AstKind::VariableDeclarator(d))) if d.init.as_ref().and_then(|i| tree.expr_id(i)) == Some(at) => match &d.id.kind {
                BindingPatternKind::ObjectPattern(_) => Some("when destructured (`const { … } = resource(…)`: its methods lose their handle)".to_string()),
                BindingPatternKind::ArrayPattern(_) => Some("when destructured (`const [ … ] = resource(…)`: the handle is not iterable)".to_string()),
                _ if d.kind != VariableDeclarationKind::Const => Some("from a `let` / `var` (only a `const` is a recipe)".to_string()),
                // Module scope: the browser imports the module's own resource (a module reference), nothing to recipe.
                _ if self.module_scoped(p) => None,
                _ => self.hook_form(id),
            },
            // A discarded call (`resource(…);`) holds nothing a site could capture (a concise arrow body returns it).
            Some((p, AstKind::ExpressionStatement(_))) if !self.concise_body(p) => None,
            _ => {
                // A call at module scope (outside every function) is never captured state of a component.
                if self.top_function(id).is_none() {
                    None
                } else {
                    Some("outside a `const` initializer (JSX attribute, object value, argument or returned value)".to_string())
                }
            }
        };
        if let Some(form) = form {
            diags.warn(resource_message(&form), Some(id));
        }
    }

    /// `statement` is a concise arrow body (`(id) => resource(…)`).
    fn concise_body(&self, statement: NodeId) -> bool {
        let tree = self.tree;
        let Some(body) = tree.parent(statement) else { return false };
        matches!(tree.kind(body), AstKind::FunctionBody(_))
            && matches!(tree.parent(body).map(|f| tree.kind(f)), Some(AstKind::ArrowFunctionExpression(a)) if a.expression)
    }

    /// A `const r = resource(…)` inside a named non-component (lowercase) outermost function: its caller's `const` holds
    /// the call's result, not a recipe.
    fn hook_form(&self, id: NodeId) -> Option<String> {
        let tree = self.tree;
        let top = self.top_function(id)?;
        // A default export may be a lowercase-named component (`export default function page()`).
        if matches!(tree.raw_parent(top).map(|p| tree.kind(p)), Some(AstKind::ExportDefaultDeclaration(_))) {
            return None;
        }
        let name = match tree.kind(top) {
            AstKind::Function(f) => f.id.as_ref().map(|i| i.name.to_string()),
            _ => None,
        }
        .or_else(|| match tree.raw_parent(top).map(|p| tree.kind(p)) {
            Some(AstKind::VariableDeclarator(d)) => match &d.id.kind {
                BindingPatternKind::BindingIdentifier(i) => Some(i.name.to_string()),
                _ => None,
            },
            _ => None,
        })?;
        name.starts_with(|c: char| c.is_ascii_lowercase() || c == '_' || c == '$')
            .then(|| format!("inside `{name}`, which is not a component (the caller's `const` holds a value, not a recipe)"))
    }
}

/// RV2016 (warning) text; `diagnostics::classify` matches the prefix.
fn resource_message(form: &str) -> String {
    format!("`resource()` cannot resume {form}: create it in the component as `const name = resource(…)` and call its methods on the handle (`name.loading()`)")
}
