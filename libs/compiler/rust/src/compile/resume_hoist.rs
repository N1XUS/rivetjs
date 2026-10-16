//! Function Bridge C5 / T6 (2026-10-11): hoisted function-declaration registrations (server resume target). A local
//! `function f() {}` that is an Fn site (`resume.rs` `Site.hoisted`, container `resume::hoist_container`) registers at
//! the TOP of its statement list — `_rFn(id, f, () => [caps]);` before the first statement, source order of the
//! declarations — instead of after itself: the declaration is hoisted, so a use before it (or a declaration after
//! `return`) must find the recipe already stamped. Captures are a thunk (T5 late captures: read at the first encode),
//! because at the top of the body they may still be in their TDZ.

use super::Compiler;
use crate::ir::Expr;
use oxc_ast::AstKind;
use oxc_semantic::NodeId;
use oxc_span::{GetSpan, Span};
use rustc_hash::FxHashMap;

impl<'t, 'a> Compiler<'t, 'a> {
    /// Container (statement list) → hoisted Fn sites in it, source order. Only sites keyed by their declaration (the
    /// ones the declaration arm of `resume_node` registered before T6).
    pub(super) fn hoisted_containers(&self) -> FxHashMap<NodeId, Vec<usize>> {
        let mut out: FxHashMap<NodeId, Vec<usize>> = FxHashMap::default();
        let Some(resumed) = self.resumed.as_ref() else { return out };
        let tree = self.tree;
        let mut found: Vec<(u32, NodeId, usize)> = Vec::new();
        for (index, site) in resumed.sites.iter().enumerate() {
            let Some(closure) = site.closure.filter(|_| site.hoisted) else { continue };
            // T10: a group site is keyed by its statement list, not by a member.
            // T10 fix 1 (F1): a group site has no map key (several groups may share a statement list).
            let keyed = site.group_container.is_some() || resumed.site_at(closure) == Some(index);
            if !keyed {
                continue;
            }
            if let Some(container) = crate::resume::hoist_container(tree, closure) {
                found.push((tree.span(closure).start, container, index));
            }
        }
        found.sort_by_key(|&(start, _, _)| start);
        for (_, container, index) in found {
            out.entry(container).or_default().push(index);
        }
        out
    }

    /// The statement list `id` with `_rFn(id, f, () => [caps]);` per hoisted site before its first statement. Infallible
    /// (T6 review M1, T8): `hoisted_containers` only lists sites of named function declarations inside the list, so the
    /// list has a first statement and every site a name.
    pub(super) fn hoisted_body(&mut self, id: NodeId, sites: &[usize]) -> Expr {
        let tree = self.tree;
        let span = tree.span(id);
        let first = match tree.kind(id) {
            AstKind::FunctionBody(b) => b.statements.first().map(GetSpan::span),
            AstKind::BlockStatement(b) => b.body.first().map(GetSpan::span),
            AstKind::StaticBlock(b) => b.body.first().map(GetSpan::span),
            AstKind::SwitchCase(c) => c.consequent.first().map(GetSpan::span),
            _ => None,
        };
        // An empty list holds no declaration (unreachable); render it unchanged.
        let Some(at) = first.map(|s| s.start) else {
            let reps = self.visit_children(id);
            return Expr::Stmts(self.render(span, &reps));
        };
        let mut prologue = String::new();
        for &site in sites {
            if self.resumed.as_ref().is_some_and(|r| !r.sites[site].group_names.is_empty()) {
                prologue.push_str(&self.group_call(site).print());
                prologue.push_str(";\n");
                continue;
            }
            let closure = self.resumed.as_ref().and_then(|r| r.sites[site].closure);
            let name = closure.and_then(|c| match tree.kind(c) {
                AstKind::Function(f) => f.id.as_ref().map(|i| i.name.to_string()),
                _ => None,
            });
            let Some(name) = name else { continue };
            let args = vec![self.site_str(site), Expr::Ident(name), Expr::thunk(self.capture_list(site))];
            prologue.push_str(&self.r("fn", args).print());
            prologue.push_str(";\n");
        }
        let mut reps = self.visit_children(id);
        let index = reps.partition_point(|(span, _)| span.start < at);
        reps.insert(index, (Span::new(at, at), Expr::Raw(prologue)));
        Expr::Stmts(self.render(span, &reps))
    }

    /// Function Bridge C8 / T10: `_rGroup(id, [members], () => [caps])` — one registration per instance of a group site.
    pub(super) fn group_call(&mut self, site: usize) -> Expr {
        let names: Vec<Expr> = self.resumed.as_ref().map_or_else(Vec::new, |r| r.sites[site].group_names.iter().map(|n| Expr::Ident(n.clone())).collect());
        let args = vec![self.site_str(site), Expr::Array(names), Expr::thunk(self.capture_list(site))];
        self.r("group", args)
    }

    /// T10: the hoisted group whose FIRST member is the function declaration `id`, when its statement list was not
    /// rendered by `resume_node` (still pending in `hoisted_at`). T10 fix 2 (F8): the first member, not the last — the
    /// members are hoisted declarations, so registering right after the first one is valid and nothing between the
    /// members (a `return` before the hoisting idiom's tail) can make it dead code; `compile.rs` reports RV2011 when an
    /// early exit precedes the first member as well.
    pub(super) fn pending_group(&self, id: NodeId) -> Option<usize> {
        let resumed = self.resumed.as_ref()?;
        let &group = resumed.group_of.get(&id)?;
        let site = &resumed.sites[group];
        let container = site.group_container?;
        let first = resumed.group_of.iter().filter(|(_, g)| **g == group).map(|(d, _)| *d).min_by_key(|d| self.tree.span(*d).start)?;
        (site.hoisted && first == id && self.hoisted_at.get(&container).is_some_and(|sites| sites.contains(&group))).then_some(group)
    }

}
