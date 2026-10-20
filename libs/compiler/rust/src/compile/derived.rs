//! Derived resume model, server target (M2 C2, plan `docs/design/plans/2026-10-18-derived-client.md`, spec
//! `docs/design/specs/2026-10-18-structural-resume-design.md` §3.3): plain server output plus, per boundary
//! (`resume::derived::plan`), `const __rivetB = _rB("Name", flags[, props]); try { … return _rBOut(__rivetB, v); … }
//! finally { _rBEnd(__rivetB); }`, `_rBAttr(__rivetB)` last in an ATTR root's start tag, keyed state
//! `signal(x)` → `_rSig("<h5>-<n>", x)` / `createStore(x)` → `_rSigStore(…)`, and `<!--[-->…<!--]-->` around the
//! dynamic slots of a native element the adopt walk needs delimited (a structural slot, or any dynamic slot among
//! other children). ABI from `@rivetjs/runtime/server-derived`. Hooks in `compile.rs` (`// exception: derived model`).

use oxc_ast::{AstKind, ast::*};
use oxc_semantic::NodeId;
use oxc_span::{GetSpan, Span};

use super::{Compiler, Diags, OPAQUE_CONTENT, Options, ServerTemplate, jsx_text};
use crate::ir::{Expr, quote};
use crate::resume::{self, derived::Plan, derived::Verdicts};

/// Derived ABI: local suffix → export of `@rivetjs/runtime/server-derived`.
const DERIVED_ABI: &[(&str, &str)] =
    &[("b", "_rB"), ("bOut", "_rBOut"), ("bEnd", "_rBEnd"), ("bAttr", "_rBAttr"), ("sig", "_rSig"), ("sigStore", "_rSigStore")];

pub struct Derived {
    pub plan: Plan,
    /// The boundary token local (`__rivetB`).
    token: String,
    /// (ABI suffix, local) in `DERIVED_ABI` order.
    names: Vec<(&'static str, String)>,
    used: Vec<&'static str>,
}

/// An expression child that is a render function (`{(row) => …}`): never wrapped in markers.
pub(super) fn is_function_child(e: &Expression<'_>) -> bool {
    matches!(resume::unwrap(e), Expression::ArrowFunctionExpression(_) | Expression::FunctionExpression(_))
}

impl<'t, 'a> Compiler<'t, 'a> {
    /// Run the resume analysis for its sites only (its capture / serializability diagnostics are dropped: nothing
    /// serializes), keep RV2001, plan boundaries / keyed state (RV2103 / RV2104), allocate the ABI locals.
    pub(super) fn derived_setup(&mut self, module: &str, verdicts: &Verdicts, options: &Options) {
        let tree = self.tree;
        let mut scratch = Diags { tree: Some(tree), filename: self.diags.filename.clone(), list: Vec::new() };
        let resumed = resume::analyze(tree, module, &mut scratch, &self.static_decls, &options.source_packages, &options.resolved_imports);
        resume::browser_global_reads(tree, &resumed, &mut self.diags);
        let plan = resume::derived::plan(tree, &resumed, module, verdicts, &mut self.diags);
        let token = self.unique("__rivetB");
        let names = DERIVED_ABI.iter().map(|(name, _)| (*name, self.unique(&format!("__rivetR_{name}")))).collect();
        self.derived = Some(Derived { plan, token, names, used: Vec::new() });
    }

    fn derived_name(&mut self, name: &'static str) -> String {
        let Some(d) = self.derived.as_mut() else { return String::new() };
        if !d.used.contains(&name) {
            d.used.push(name);
        }
        d.names.iter().find(|(n, _)| *n == name).map(|(_, local)| local.clone()).unwrap_or_default()
    }

    fn derived_token(&self) -> String {
        self.derived.as_ref().map(|d| d.token.clone()).unwrap_or_default()
    }

    /// Boundary bodies, their returns and keyed state calls.
    pub(super) fn derived_node(&mut self, id: NodeId) -> Option<Expr> {
        let d = self.derived.as_ref()?;
        if let Some((name, flags, props)) = d.plan.boundaries.get(&id).cloned() {
            return self.boundary_body(id, &name, flags, props.as_deref());
        }
        if d.plan.returns.contains(&id) {
            return self.boundary_return(id);
        }
        if let Some((key, store)) = d.plan.keyed.get(&id).cloned() {
            return self.keyed_call(id, &key, store);
        }
        None
    }

    fn render_sorted(&self, span: Span, mut reps: Vec<(Span, Expr)>) -> String {
        // Zero-width insertions sort before a replacement starting at the same offset.
        reps.sort_by_key(|(s, _)| (s.start, s.end));
        self.render(span, &reps)
    }

    fn boundary_body(&mut self, id: NodeId, name: &str, flags: u32, props: Option<&str>) -> Option<Expr> {
        let tree = self.tree;
        let token = self.derived_token();
        let b = self.derived_name("b");
        let end = self.derived_name("bEnd");
        let props = props.map(|p| format!(", {p}")).unwrap_or_default();
        let open = format!("const {token} = {b}({}, {flags}{props});", quote(name));
        let close = format!(" finally {{ {end}({token}); }}");
        let (body, concise) = match tree.kind(id) {
            AstKind::Function(f) => (f.body.as_deref()?, false),
            AstKind::ArrowFunctionExpression(a) => (&*a.body, a.expression),
            _ => return None,
        };
        let mut reps = self.visit_children(id);
        if concise {
            let Some(Statement::ExpressionStatement(s)) = body.statements.first() else { return None };
            let out = self.derived_name("bOut");
            let span = s.expression.span();
            reps.push((Span::new(span.start, span.start), Expr::Raw(format!("{{ {open} try {{ return {out}({token}, "))));
            reps.push((Span::new(span.end, span.end), Expr::Raw(format!("); }}{close} }}"))));
        } else {
            let start = body.directives.last().map_or(body.span.start + 1, |d| d.span.end);
            reps.push((Span::new(start, start), Expr::Raw(format!(" {open} try {{"))));
            let at = body.span.end.saturating_sub(1);
            reps.push((Span::new(at, at), Expr::Raw(format!("}}{close} "))));
        }
        let text = self.render_sorted(tree.span(id), reps);
        Some(Expr::Func(text))
    }

    fn boundary_return(&mut self, id: NodeId) -> Option<Expr> {
        let tree = self.tree;
        let AstKind::ReturnStatement(r) = tree.kind(id) else { return None };
        let argument = r.argument.as_ref()?.span();
        let token = self.derived_token();
        let out = self.derived_name("bOut");
        let mut reps = self.visit_children(id);
        reps.push((Span::new(argument.start, argument.start), Expr::Raw(format!("{out}({token}, "))));
        reps.push((Span::new(argument.end, argument.end), Expr::Raw(")".into())));
        Some(Expr::Stmts(self.render_sorted(tree.span(id), reps)))
    }

    fn keyed_call(&mut self, id: NodeId, key: &str, store: bool) -> Option<Expr> {
        let tree = self.tree;
        let AstKind::CallExpression(call) = tree.kind(id) else { return None };
        let local = self.derived_name(if store { "sigStore" } else { "sig" });
        let callee = call.callee.span();
        let mut reps = self.visit_children(id);
        reps.retain(|(s, _)| !(callee.start <= s.start && s.end <= callee.end));
        reps.push((callee, Expr::Ident(local)));
        match call.arguments.first() {
            Some(first) => {
                let at = first.span().start;
                reps.push((Span::new(at, at), Expr::Raw(format!("{}, ", quote(key)))));
            }
            None => {
                let at = call.span.end.saturating_sub(1);
                reps.push((Span::new(at, at), Expr::Raw(quote(key))));
            }
        }
        Some(Expr::Raw(self.render_sorted(tree.span(id), reps)))
    }

    /// `_rBAttr(__rivetB)` for an ATTR boundary's root element (an attribute slot last in its start tag).
    pub(super) fn derived_attr(&mut self, el: Option<NodeId>) -> Option<Expr> {
        let el = el?;
        if !self.derived.as_ref()?.plan.attr_roots.contains(&el) {
            return None;
        }
        let token = self.derived_token();
        let attr = self.derived_name("bAttr");
        Some(Expr::call(&attr, vec![Expr::Ident(token)]))
    }

    /// Marker pairs in a native element's content: `Some(sole)` (whether the slot is the element's only child) under the
    /// derived model outside opaque content, `None` otherwise.
    pub(super) fn slot_marks(&self, tag: &str, children: &[JSXChild<'a>]) -> Option<bool> {
        self.derived.as_ref()?;
        if OPAQUE_CONTENT.contains(&tag) {
            return None;
        }
        let count = children
            .iter()
            .filter(|child| match child {
                JSXChild::Text(text) => !jsx_text(self.tree.text_of(text.span)).is_empty(),
                JSXChild::ExpressionContainer(c) => c.expression.as_expression().is_some(),
                _ => true,
            })
            .count();
        Some(count == 1)
    }

    /// A content slot, between `<!--[-->` / `<!--]-->` when `marked`.
    pub(super) fn marked_slot(t: &mut ServerTemplate, value: Expr, marked: bool) {
        if marked {
            t.append("<!--[-->");
            t.slot(value);
            t.append("<!--]-->");
        } else {
            t.slot(value);
        }
    }

    /// `import { _rB as __rivetR_b, … } from "@rivetjs/runtime/server-derived";` (used names, ABI order).
    pub(super) fn derived_imports(&self) -> String {
        let Some(d) = &self.derived else { return String::new() };
        let list: Vec<String> = DERIVED_ABI
            .iter()
            .zip(&d.names)
            .filter(|((name, _), _)| d.used.contains(name))
            .map(|((_, export), (_, local))| format!("{export} as {local}"))
            .collect();
        if list.is_empty() {
            return String::new();
        }
        format!("import {{ {} }} from \"@rivetjs/runtime/server-derived\";\n", list.join(", "))
    }
}
