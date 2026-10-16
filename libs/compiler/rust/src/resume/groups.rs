//! Function Bridge C8 / T10 (2026-10-12): function groups. Mutually recursive local functions (`function even(k) { … odd(k
//! - 1) }` / `function odd(k) { … even(k - 1) }`, or `const` arrows) capture each other: as separate Fn symbols each
//! recipe's captures reach the other recipe, a capture cycle the decoder rejects ("Cyclic reference"). A strongly
//! connected set (≥ 2) of Fn sites declared in ONE statement list becomes one group symbol instead:
//! `export const Page$g = (<union of outer captures>) => { function even(k) {…} function odd(k) {…} return [even, odd]; };`.
//! The member sites leave the queue (no symbol, no per-member registration); the server registers the instance once,
//! `_rGroup(id, [even, odd], () => [caps])` — at the top of the statement list when every member is a function
//! declaration (hoisted, T6), else after the last `const` member's declaration — and the runtime encodes each member as
//! `{i: [groupRef, k]}` (`libs/runtime/server-resume.ts`). Captures: the union of the members' free names, narrowed
//! jointly like one site's (T11 `member_captures` over every member: `_rMember(base, key)` per (base, key); a member
//! needing the whole base widens it for the group).
//! A `return` / `throw` / `break` / `continue` between the first member and a `const` group's registration point
//! (after the last member) is RV2011 (fix 1, F3): a render leaving there would encode unregistered members.
//! Not grouped (today's behaviour kept, "Cyclic reference"): members in different statement lists, a cycle through a
//! function that is not a declaration-keyed Fn site (a `let` function, an object method / holder value: the graph only
//! has eligible nodes).

use oxc_ast::{
    AstKind,
    ast::{BindingPatternKind, Expression, VariableDeclarationKind},
};
use oxc_semantic::NodeId;
use rustc_hash::{FxHashMap, FxHashSet};

use super::cells::Cells;
use super::{Analysis, Site, SiteKind, hoist_container, is_function};
use crate::compile::Diags;
use crate::tree::DeclKind;

/// A group member: name, statement list, the `const` declaration statement (None: a function declaration).
struct Member {
    name: String,
    container: NodeId,
    statement: Option<NodeId>,
}

impl<'t, 'a> Analysis<'t, 'a> {
    fn group_member(&self, site: &Site) -> Option<Member> {
        let tree = self.tree;
        let (decl, closure) = (site.declaration?, site.closure?);
        if site.kind != SiteKind::Fn || self.map.get(decl).is_some() {
            return None;
        }
        if tree.decl_kind(decl) == DeclKind::FunctionDeclaration {
            let AstKind::Function(f) = tree.kind(decl) else { return None };
            return Some(Member { name: f.id.as_ref()?.name.to_string(), container: hoist_container(tree, decl)?, statement: None });
        }
        let AstKind::VariableDeclarator(d) = tree.kind(decl) else { return None };
        let BindingPatternKind::BindingIdentifier(id) = &d.id.kind else { return None };
        let init = d.init.as_ref()?;
        if d.kind != VariableDeclarationKind::Const
            || !matches!(init, Expression::ArrowFunctionExpression(_) | Expression::FunctionExpression(_))
            || tree.expr_id(init) != Some(closure)
        {
            return None;
        }
        let statement = tree.raw_parent(decl)?;
        Some(Member { name: id.name.to_string(), container: hoist_container(tree, statement)?, statement: Some(statement) })
    }

    /// Replace each strongly connected set of ≥ 2 group-eligible Fn sites in `queue` by one group site (pushed to `sites`
    /// and `queue`). Returns `(group site, members' declarations)` per group.
    pub(super) fn function_groups(
        &mut self,
        queue: &mut Vec<usize>,
        ref_cells: &FxHashSet<NodeId>,
        fn_sites: &FxHashSet<NodeId>,
        cells: &Cells,
        diags: &mut Diags,
    ) -> Vec<(usize, Vec<NodeId>)> {
        let tree = self.tree;
        // Graph nodes: eligible Fn sites; edges: captures of another eligible site's declaration.
        let nodes: Vec<(usize, Member)> = queue.iter().filter_map(|&s| self.group_member(&self.sites[s]).map(|m| (s, m))).collect();
        if nodes.len() < 2 {
            return Vec::new();
        }
        let by_decl: FxHashMap<NodeId, usize> = nodes.iter().enumerate().map(|(i, (s, _))| (self.sites[*s].declaration.unwrap(), i)).collect();
        let edges: Vec<Vec<usize>> = nodes
            .iter()
            .map(|(s, _)| {
                let mut out: Vec<usize> = self.sites[*s].capture_decls.iter().filter_map(|d| by_decl.get(d).copied()).collect();
                out.dedup();
                out
            })
            .collect();
        let mut out = Vec::new();
        for component in strongly_connected(&edges) {
            if component.len() < 2 {
                continue;
            }
            let container = nodes[component[0]].1.container;
            if component.iter().any(|&i| nodes[i].1.container != container) {
                continue;
            }
            let mut members: Vec<usize> = component;
            members.sort_by_key(|&i| tree.span(self.sites[nodes[i].0].closure.unwrap()).start);
            let decls: Vec<NodeId> = members.iter().map(|&i| self.sites[nodes[i].0].declaration.unwrap()).collect();
            let closures: Vec<NodeId> = members.iter().map(|&i| self.sites[nodes[i].0].closure.unwrap()).collect();
            // Union of the members' free names (source order of first use), members themselves excluded.
            let mut captures: Vec<(String, NodeId)> = Vec::new();
            let mut spans = Vec::new();
            let mut scope: Vec<(String, NodeId)> = Vec::new();
            for &closure in &closures {
                let (more, more_scope, _, _, more_spans) = self.free_names(closure);
                for (entry, span) in more.into_iter().zip(more_spans) {
                    if !decls.contains(&entry.1) && !captures.iter().any(|(n, _)| *n == entry.0) {
                        captures.push(entry);
                        spans.push(span);
                    }
                }
                for entry in more_scope {
                    if !scope.iter().any(|(n, _)| *n == entry.0) {
                        scope.push(entry);
                    }
                }
            }
            let first = &self.sites[nodes[members[0]].0];
            let mut site = Site::new(SiteKind::Fn);
            site.closure = Some(closures[0]);
            site.component = first.component.clone();
            site.opportunistic = members.iter().all(|&i| self.sites[nodes[i].0].opportunistic);
            // T10 fix 1 (F4): narrowed jointly over every member (as one Fn site's closures).
            match self.member_captures(&closures, &captures, ref_cells, true, true) {
                Some(m) => {
                    site.captures = m.captures;
                    site.capture_decls = m.decls;
                    site.capture_spans = m.spans;
                    site.params = m.params;
                    site.prologue = m.prologue;
                    site.members = m.members;
                    site.members_helper = m.helper;
                }
                None => {
                    site.captures = captures.iter().map(|(n, _)| n.clone()).collect();
                    site.capture_decls = captures.iter().map(|(_, d)| *d).collect();
                    site.capture_spans = spans;
                }
            }
            site.capture_kinds = site
                .capture_decls
                .iter()
                .enumerate()
                .map(|(i, decl)| {
                    if site.members.get(i).is_some_and(Option::is_some) {
                        "value"
                    } else if ref_cells.contains(decl) {
                        "ref"
                    } else if fn_sites.contains(decl) {
                        "fn"
                    } else if cells.decls.contains(decl) {
                        "cell"
                    } else {
                        "value"
                    }
                })
                .collect();
            site.scope = scope.iter().map(|(n, _)| n.clone()).collect();
            site.scope_decls = scope;
            site.group_names = members.iter().map(|&i| nodes[i].1.name.clone()).collect();
            site.group_closures = closures;
            site.group_container = Some(container);
            site.group_after = members.iter().filter_map(|&i| nodes[i].1.statement).max_by_key(|&s| tree.span(s).start);
            // F3: an early exit between the members' first availability and the registration point.
            if let (Some(after), false) = (site.group_after, site.opportunistic) {
                let from = if members.iter().any(|&i| nodes[i].1.statement.is_none()) {
                    tree.span(container).start
                } else {
                    members.iter().filter_map(|&i| nodes[i].1.statement).map(|s| tree.span(s).end).min().unwrap_or(0)
                };
                let to = tree.span(after).start;
                if let Some(exit) = early_exit(tree, container, from, to) {
                    diags.add(split_group_message(&site.group_names), Some(exit));
                }
            }
            let index = self.sites.len();
            self.sites.push(site);
            let removed: FxHashSet<usize> = members.iter().map(|&i| nodes[i].0).collect();
            queue.retain(|s| !removed.contains(s));
            queue.push(index);
            out.push((index, decls));
        }
        out
    }
}

/// RV2011 text: a group whose registration point lies after an early exit (`groups.rs`, compile `pending_group` fallback).
pub(crate) fn split_group_message(names: &[String]) -> String {
    let names: Vec<String> = names.iter().map(|n| format!("`{n}`")).collect();
    format!(
        "Mutually recursive functions {} are separated by an early exit (return / throw / break / continue): their group registers after the last one, so a render leaving early cannot resume them; move the group's functions together before the early exit",
        names.join(", ")
    )
}

/// The first `return` / `throw` / `break` / `continue` (not inside a nested function; `break` / `continue` without a
/// label only when not inside a nested loop / switch) in the statements of `container` lying within `[from, to)`.
pub(crate) fn early_exit(tree: &crate::tree::Tree, container: NodeId, from: u32, to: u32) -> Option<NodeId> {
    {
        let mut stack: Vec<(NodeId, bool)> = tree
            .children(container)
            .iter()
            .filter(|&&c| {
                let span = tree.span(c);
                span.start >= from && span.end <= to
            })
            .map(|&c| (c, false))
            .collect();
        while let Some((n, nested)) = stack.pop() {
            match tree.kind(n) {
                AstKind::ReturnStatement(_) | AstKind::ThrowStatement(_) => return Some(n),
                AstKind::BreakStatement(b) if b.label.is_some() || !nested => return Some(n),
                AstKind::ContinueStatement(c) if c.label.is_some() || !nested => return Some(n),
                _ => {}
            }
            if is_function(tree, n) {
                continue;
            }
            let inner = nested
                || matches!(
                    tree.kind(n),
                    AstKind::ForStatement(_)
                        | AstKind::ForInStatement(_)
                        | AstKind::ForOfStatement(_)
                        | AstKind::WhileStatement(_)
                        | AstKind::DoWhileStatement(_)
                        | AstKind::SwitchStatement(_)
                );
            for &child in tree.children(n) {
                stack.push((child, inner));
            }
        }
        None
    }
}

/// Tarjan's strongly connected components over `edges` (node → successors), iterative.
fn strongly_connected(edges: &[Vec<usize>]) -> Vec<Vec<usize>> {
    let n = edges.len();
    let (mut index, mut low, mut on) = (vec![usize::MAX; n], vec![0; n], vec![false; n]);
    let (mut next, mut stack, mut out) = (0, Vec::new(), Vec::new());
    for root in 0..n {
        if index[root] != usize::MAX {
            continue;
        }
        // (node, next edge to visit)
        let mut work = vec![(root, 0)];
        while let Some(top) = work.last_mut() {
            let (v, at) = *top;
            if at == 0 && index[v] == usize::MAX {
                index[v] = next;
                low[v] = next;
                next += 1;
                stack.push(v);
                on[v] = true;
            }
            if let Some(&w) = edges[v].get(at) {
                top.1 += 1;
                if index[w] == usize::MAX {
                    work.push((w, 0));
                } else if on[w] {
                    low[v] = low[v].min(index[w]);
                }
                continue;
            }
            work.pop();
            if let Some(&(parent, _)) = work.last() {
                low[parent] = low[parent].min(low[v]);
            }
            if low[v] == index[v] {
                let mut component = Vec::new();
                while let Some(w) = stack.pop() {
                    on[w] = false;
                    component.push(w);
                    if w == v {
                        break;
                    }
                }
                out.push(component);
            }
        }
    }
    out
}
