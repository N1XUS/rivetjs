//! Function Bridge C11 / T13 (2026-10-12, spec `docs/design/specs/2026-10-09-function-bridge-design.md` §3.3 "Stores"):
//! literal store paths. A captured store ships only the paths its server render read plus the literal paths code can
//! reach (runtime T12 `_rStorePaths`: the union per store and render, pruned containers, no narrowing while streamed
//! segments are pending; dev warns on a browser read of an unshipped path).
//!
//! Marked (server target: `const s = _rStorePaths(createStore(…), ["a", "b.c"])`, paths sorted + deduped): a `const`
//! declarator with a plain binding whose initializer calls `createStore` imported from `@rivetjs/reactivity/store`
//! (named import with any local name, or a namespace import `st.createStore`), captured by at least one resumed site
//! (directly, or through a captured `const v = at(s, …)` view, views of views included), whose EVERY reference in the
//! program is the first argument of `read(s, path)` / `write(s, path, next)` / `at(s, path)` (same import) with a literal
//! path (string or substitution-free template). Parentheses and TS casts around the argument are looked through
//! (`read((s), "a")`, `read(s as Store<T>, "a")`).
//!
//! Views (fix round 1): `at(s, "p")` is followed. Its value must itself be the first argument of `read` / `write` / `at`
//! (inline) or the initializer of a `const v` view whose every reference is, recursively: `read(v)` / `write(v, next)` /
//! `read(v, dynamic)` / `read(v, "")` add `p` (the subtree ships whole), `at(v, dynamic)` adds `p` and clamps everything
//! read below that view to `p` (fix round 2: the real prefix `p.<k>` is unknown), `read(v, "q")` / `write(v, "q", next)` add `p.q`, `at(v, "q")`
//! a view at `p.q`. Any other use of a view (`v.s` / `v.p`, passed, returned, aliased, spread, a JSX attribute or child
//! prop, `let v`) keeps the WHOLE store: a view holds its root store (`StoreView.s`). References outside the sites count
//! too (a server-only view can reach the browser through a capture).
//!
//! Not marked (whole store, as before): any other reference — `read(s)` / `write(s, next)` (whole), a dynamic path
//! (variable, template with a substitution), the store passed / returned / aliased / spread, a member of the store
//! (`s.v`), a JSX attribute value — or a `let` / destructured binding. The language service warns on the dynamic-path
//! case (RV2104, plan T20). A store capture is never member-narrowed (`narrow_decl`: the initializer is a call, not an
//! object literal), so it always arrives whole and its signals carry the pruned values.

use oxc_ast::{AstKind, ast::*};
use oxc_semantic::NodeId;
use oxc_span::GetSpan;
use rustc_hash::FxHashMap;
use std::collections::BTreeSet;

use super::{Analysis, import_source, unwrap};

const STORE: &str = "@rivetjs/reactivity/store";

/// A literal path argument: a string literal or a template literal without substitutions.
fn literal(argument: &Argument) -> Option<String> {
    match argument.as_expression().map(unwrap)? {
        Expression::StringLiteral(s) => Some(s.value.to_string()),
        Expression::TemplateLiteral(t) if t.expressions.is_empty() => t.quasis.first().and_then(|q| q.value.cooked.as_ref()).map(|c| c.to_string()),
        _ => None,
    }
}

impl<'t, 'a> Analysis<'t, 'a> {
    /// Store declarators to mark → their sorted literal paths (module docs). `queue`: the resumed sites.
    pub(super) fn store_paths(&self, queue: &[usize]) -> FxHashMap<NodeId, Vec<String>> {
        let mut out = FxHashMap::default();
        let mut seen: Vec<NodeId> = Vec::new();
        for &index in queue {
            for &captured in &self.sites[index].capture_decls {
                // A captured `const v = at(s, "p")` view reaches the browser holding its store (`v.s`): `s` is a candidate.
                let decl = self.view_store(captured, 0).unwrap_or(captured);
                if seen.contains(&decl) {
                    continue;
                }
                seen.push(decl);
                if let Some(paths) = self.store_decl_paths(decl) {
                    out.insert(decl, paths);
                }
            }
        }
        out
    }

    /// The store declarator of a `const v = at(s, …)` view (through views of views and nested `at` calls, depth-limited).
    fn view_store(&self, decl: NodeId, depth: u32) -> Option<NodeId> {
        let AstKind::VariableDeclarator(d) = self.tree.kind(decl) else { return None };
        if d.kind != VariableDeclarationKind::Const || depth > 8 {
            return None;
        }
        self.at_root(d.init.as_ref()?, depth)
    }

    /// The declarator an `at(x, …)` chain starts from: `at(at(s, "a"), "b")`, `at(v, "b")` with `v` a view.
    fn at_root(&self, expr: &Expression<'a>, depth: u32) -> Option<NodeId> {
        let Expression::CallExpression(call) = unwrap(expr) else { return None };
        if self.store_callee(&call.callee) != Some("at") || depth > 8 {
            return None;
        }
        match unwrap(call.arguments.first()?.as_expression()?) {
            Expression::Identifier(object) => {
                let target = self.tree.resolve(object, false)?;
                Some(self.view_store(target, depth + 1).unwrap_or(target))
            }
            inner => self.at_root(inner, depth + 1),
        }
    }

    /// The `@rivetjs/reactivity/store` export a callee names: `read` (named import, any local name) or `st.read`
    /// (namespace import).
    fn store_callee(&self, callee: &Expression<'a>) -> Option<&'static str> {
        let name = match unwrap(callee) {
            Expression::StaticMemberExpression(m) => {
                let Expression::Identifier(object) = unwrap(&m.object) else { return None };
                let decl = self.tree.resolve(object, false)?;
                let AstKind::ImportNamespaceSpecifier(_) = self.tree.kind(decl) else { return None };
                if import_source(self.tree, decl)? != STORE {
                    return None;
                }
                m.property.name.to_string()
            }
            callee => {
                let (name, from) = self.import_of(callee)?;
                if from != STORE {
                    return None;
                }
                name
            }
        };
        ["createStore", "read", "write", "at"].into_iter().find(|n| *n == name)
    }

    fn store_decl_paths(&self, decl: NodeId) -> Option<Vec<String>> {
        let tree = self.tree;
        let AstKind::VariableDeclarator(d) = tree.kind(decl) else { return None };
        if d.kind != VariableDeclarationKind::Const {
            return None;
        }
        let BindingPatternKind::BindingIdentifier(binding) = &d.id.kind else { return None };
        let Expression::CallExpression(init) = unwrap(d.init.as_ref()?) else { return None };
        if self.store_callee(&init.callee) != Some("createStore") {
            return None;
        }
        let mut paths: BTreeSet<String> = BTreeSet::new();
        self.binding_paths(binding, None, false, &mut paths, 0)?;
        Some(paths.into_iter().collect())
    }

    /// Every reference of a store (`view: None`) or view (`Some(p)`) binding through `value_paths`; `fixed`: a view below a
    /// dynamic `at` — everything reached from it is clamped to `p` (fix round 2).
    fn binding_paths(&self, binding: &BindingIdentifier<'a>, view: Option<&str>, fixed: bool, paths: &mut BTreeSet<String>, depth: u32) -> Option<()> {
        let tree = self.tree;
        if depth > 8 {
            return None;
        }
        for reference in tree.sem.scoping().get_resolved_references(binding.symbol_id.get()?) {
            let node = reference.node_id();
            if tree.in_type_name(node) || matches!(tree.parent_kind(node), Some(AstKind::TSTypeQuery(_))) {
                continue;
            }
            if reference.flags().is_write() {
                return None;
            }
            self.value_paths(node, view, fixed, paths, depth)?;
        }
        Some(())
    }

    /// The paths reached by the store / view value at `node` (a reference or an `at` call); `None` = whole store.
    fn value_paths(&self, node: NodeId, view: Option<&str>, fixed: bool, paths: &mut BTreeSet<String>, depth: u32) -> Option<()> {
        let tree = self.tree;
        // Look through `(s)`, `s as T`, `s satisfies T`, `s!` (F3).
        let mut outer = node;
        while let Some(parent) = tree.parent(outer) {
            match tree.kind(parent) {
                AstKind::ParenthesizedExpression(_) | AstKind::TSAsExpression(_) | AstKind::TSSatisfiesExpression(_) | AstKind::TSNonNullExpression(_) => {
                    outer = parent
                }
                _ => break,
            }
        }
        let span = tree.span(outer);
        match tree.parent_kind(outer)? {
            // `const v = at(s, "p")` (only a view value; `const t = s` aliases the store → whole).
            AstKind::VariableDeclarator(d) if view.is_some() => {
                if d.kind != VariableDeclarationKind::Const || d.init.as_ref().is_none_or(|init| init.span() != span) {
                    return None;
                }
                let BindingPatternKind::BindingIdentifier(binding) = &d.id.kind else { return None };
                self.binding_paths(binding, view, fixed, paths, depth + 1)
            }
            AstKind::CallExpression(call) => {
                if call.arguments.first().is_none_or(|first| first.span() != span) {
                    return None;
                }
                let name = self.store_callee(&call.callee)?;
                // `read(x)` / `write(x, next)`: whole value — a view's subtree, the store's root (whole).
                let whole = matches!((name, call.arguments.len()), ("read", 1) | ("write", 2));
                let pathed = matches!((name, call.arguments.len()), ("read" | "at", 2) | ("write", 3));
                // `fixed` (below a dynamic `at`): the real prefix is unknown below `p`; any access ships `p` whole.
                let dynamic_at = name == "at" && pathed && view.is_some() && literal(&call.arguments[1]).is_none();
                let full = if fixed && (whole || pathed) {
                    view?.to_string()
                } else if whole {
                    view?.to_string()
                } else if pathed {
                    match (view, literal(&call.arguments[1])) {
                        // `""` names the value itself (`store.ts` `absolute`): a view's subtree, the root whole.
                        (Some(p), Some(q)) if q.is_empty() => p.to_string(),
                        (None, Some(q)) if q.is_empty() => return None,
                        (Some(p), Some(q)) => format!("{p}.{q}"),
                        (None, Some(q)) => q,
                        // A dynamic path below a view stays inside its subtree.
                        (Some(p), None) => p.to_string(),
                        (None, None) => return None,
                    }
                } else {
                    return None;
                };
                if name == "at" {
                    // A dynamic `at` below a view (`at(u, props.k)`, fix round 2): the new view sits at `p.<k>`, unknown —
                    // ship `p` and keep checking its uses (an escape such as `w.s` still keeps the whole store).
                    let call_id = tree.parent(outer)?;
                    if dynamic_at {
                        paths.insert(full.clone());
                    }
                    return self.value_paths(call_id, Some(&full), fixed || dynamic_at, paths, depth + 1);
                }
                paths.insert(full);
                Some(())
            }
            _ => None,
        }
    }
}
