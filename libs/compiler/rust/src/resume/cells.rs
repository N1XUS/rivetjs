//! Function Bridge C6 / T8 (2026-10-11, spec `docs/design/specs/2026-10-09-function-bridge-design.md` §3.3 "Boxed `let`
//! cells", plan D13): captured mutable locals become shared cells.
//!
//! A `let` declared in a statement list (not a `for` head: per-iteration bindings stay plain) that a resumed site
//! captures is boxed when it has any write (assignment, update, destructuring / `for … of` target) anywhere: in the
//! declaring function, a nested function / method / arrow, a class field initializer — whatever its position relative
//! to the capture (T8 fix round 1, review H1: source order is not execution order — a hoisted function declaration or a
//! class field can run before or after a write, so any write boxes).
//!
//! Server target: `const x = _rCell(init)`, every reference `x.v` (callee / tag `(0, x.v)` keeps `this` undefined,
//! shorthand `{ x }` → `{ x: x.v }`); symbols capturing it rewrite the same references in their text (the cell arrives
//! as the capture: one browser cell shared by every symbol, `{k:"cell"}` interned at its first encode); the DOM main
//! module keeps the plain `let`. Capture kind `"cell"`.
//!
//! Snapshot captures (review M1): an Event / ClientEvent / Ref / Model site whose expression is not a function literal
//! (`onClick={h}`, `onClick={m ? a : b}`) evaluates it when the JSX evaluates, so it captures the cell's VALUE
//! (`[h.v]`, kind `"value"`, no `.v` edit in its symbol): a later `h = …` does not change the bound listener. Unless a
//! reference sits inside a function nested in that expression (`onClick={p.on ? () => { x++ } : undefined}`, fix round
//! 2, review M2): that function runs later and shares the cell, so the site keeps the cell for every reference (an eager
//! reference next to it then reads the cell at resume, not the value at JSX evaluation — documented limit).
//!
//! Not boxed (old snapshot behaviour, documented): `var`, destructured `let`s, a binding also used as a JSX tag or inside
//! a `<slot>` element, captured by a spread / styled / props / element site (their symbol text is assembled from parts),
//! or declared in a function that calls a direct `eval` (review L2: it may write the binding, which is `const` on the
//! server once boxed).

use oxc_ast::{AstKind, ast::*};
use oxc_semantic::NodeId;
use oxc_span::{GetSpan, Span};
use rustc_hash::{FxHashMap, FxHashSet};

use super::{Analysis, SiteKind, hoist_container};

/// Boxed declarators and the rewrite of each of their references (reference node → replacement text).
#[derive(Default)]
pub(super) struct Cells {
    pub(super) decls: FxHashSet<NodeId>,
    /// Per boxed declarator: (reference node, span, replacement), source order.
    pub(super) uses: FxHashMap<NodeId, Vec<(NodeId, Span, String)>>,
    /// (site, boxed declarator) pairs captured by value (module docs, review M1): kind `"value"`, no edits, `[x.v]`.
    pub(super) snapshots: FxHashSet<(usize, NodeId)>,
    /// Mixed sites (T8 follow-up): (site, declarator) → (snapshot parameter `x$s`, the eager reference nodes it
    /// replaces); the site captures both the cell and the snapshot.
    pub(super) mixed: FxHashMap<(usize, NodeId), (String, String, FxHashSet<NodeId>)>,
}

impl Cells {
    /// Edits for site `site`'s symbol whose text spans `spans`: references of its captured cells inside them (snapshot
    /// captures keep the plain name: the capture is the value).
    pub(super) fn edits(&self, site: usize, captures: &[NodeId], spans: &[Span]) -> Vec<(Span, String)> {
        let mut out = Vec::new();
        let mut seen: Vec<NodeId> = Vec::new();
        for decl in captures {
            // A mixed site captures a cell twice (cell + `x$s`); member captures repeat their object's declaration.
            if seen.contains(decl) {
                continue;
            }
            seen.push(*decl);
            if self.snapshots.contains(&(site, *decl)) {
                continue;
            }
            let Some(uses) = self.uses.get(decl) else { continue };
            let mixed = self.mixed.get(&(site, *decl));
            for (node, span, text) in uses {
                if spans.iter().any(|s| span.start >= s.start && span.end <= s.end) {
                    match mixed {
                        Some((name, param, direct)) if direct.contains(node) => out.push((*span, text.replace(&format!("{name}.v"), param))),
                        _ => out.push((*span, text.clone())),
                    }
                }
            }
        }
        out.sort_by_key(|(span, _)| span.start);
        out
    }
}

/// An expression evaluated where it stands (not a function literal): its captures are values, not cells.
fn eager(kind: &AstKind) -> bool {
    match kind {
        AstKind::ParenthesizedExpression(p) => {
            !matches!(p.expression.without_parentheses(), Expression::ArrowFunctionExpression(_) | Expression::FunctionExpression(_))
        }
        _ => !matches!(kind, AstKind::ArrowFunctionExpression(_) | AstKind::Function(_)),
    }
}

/// `span` is the binding of an `AssignmentTargetPropertyIdentifier` somewhere in `target`.
fn shorthand_in(target: &AssignmentTarget, span: Span) -> bool {
    fn maybe(m: &AssignmentTargetMaybeDefault, span: Span) -> bool {
        match m {
            AssignmentTargetMaybeDefault::AssignmentTargetWithDefault(d) => shorthand_in(&d.binding, span),
            _ => m.as_assignment_target().is_some_and(|t| shorthand_in(t, span)),
        }
    }
    match target {
        AssignmentTarget::ObjectAssignmentTarget(o) => {
            o.properties.iter().any(|p| match p {
                AssignmentTargetProperty::AssignmentTargetPropertyIdentifier(p) => p.binding.span == span,
                AssignmentTargetProperty::AssignmentTargetPropertyProperty(p) => maybe(&p.binding, span),
            }) || o.rest.as_ref().is_some_and(|r| shorthand_in(&r.target, span))
        }
        AssignmentTarget::ArrayAssignmentTarget(a) => {
            a.elements.iter().flatten().any(|e| maybe(e, span)) || a.rest.as_ref().is_some_and(|r| shorthand_in(&r.target, span))
        }
        _ => false,
    }
}

fn contains(outer: Span, inner: Span) -> bool {
    inner.start >= outer.start && inner.end <= outer.end
}

impl<'t, 'a> Analysis<'t, 'a> {
    /// The nearest function enclosing `node` (None at module level).
    fn owner_function(&self, node: NodeId) -> Option<NodeId> {
        let tree = self.tree;
        let mut n = tree.raw_parent(node);
        while let Some(id) = n {
            if tree.is_function(id) {
                return Some(id);
            }
            n = tree.raw_parent(id);
        }
        None
    }

    /// A reference that is (part of) a JSX tag name (`<Comp />`): lowered from the tag text, not rewritten.
    fn jsx_tag(&self, node: NodeId, span: Span) -> bool {
        let tree = self.tree;
        let mut n = tree.raw_parent(node);
        for _ in 0..3 {
            let Some(id) = n else { return false };
            match tree.kind(id) {
                AstKind::JSXOpeningElement(o) => return contains(o.name.span(), span),
                AstKind::JSXClosingElement(c) => return contains(c.name.span(), span),
                _ => n = tree.raw_parent(id),
            }
        }
        false
    }

    /// A reference that is called (`x()`, `x?.()`, `(x)()`, `x!()`, `` x`…` ``): `(0, x.v)` keeps `this` undefined, as
    /// for the plain binding (`x.v()` would pass the cell).
    fn callee(&self, node: NodeId) -> bool {
        let tree = self.tree;
        let mut at = tree.span(node);
        let mut n = tree.parent(node);
        while let Some(id) = n {
            match tree.kind(id) {
                AstKind::ParenthesizedExpression(p) if p.expression.span() == at => at = p.span,
                AstKind::TSNonNullExpression(p) if p.expression.span() == at => at = p.span,
                AstKind::TSAsExpression(p) if p.expression.span() == at => at = p.span,
                AstKind::TSSatisfiesExpression(p) if p.expression.span() == at => at = p.span,
                AstKind::CallExpression(c) => return c.callee.span() == at,
                AstKind::TaggedTemplateExpression(t) => return t.tag.span() == at,
                _ => return false,
            }
            n = tree.parent(id);
        }
        false
    }

    /// A write reference that is a shorthand destructuring target (`({ x } = o)`, `({ x = 1 } = o)`, nested, also a
    /// `for ({ x } of xs)` head): its rewrite is `x: x.v`. Found through the typed pattern of the nearest assignment.
    fn shorthand_target(&self, node: NodeId, span: Span) -> bool {
        let tree = self.tree;
        let mut n = tree.raw_parent(node);
        while let Some(id) = n {
            match tree.kind(id) {
                AstKind::AssignmentExpression(a) => return shorthand_in(&a.left, span),
                AstKind::ForOfStatement(f) => return f.left.as_assignment_target().is_some_and(|t| shorthand_in(t, span)),
                AstKind::ForInStatement(f) => return f.left.as_assignment_target().is_some_and(|t| shorthand_in(t, span)),
                kind if tree.is_function(id) || matches!(kind, AstKind::Program(_)) => return false,
                _ => n = tree.raw_parent(id),
            }
        }
        false
    }

    /// `node` sits inside a function nested in `closure` (fix round 2, review M2): such a reference runs later, so the
    /// site keeps the shared cell for it instead of the value snapshot.
    fn in_nested_function(&self, node: NodeId, closure: NodeId) -> bool {
        let tree = self.tree;
        let mut n = tree.raw_parent(node);
        while let Some(id) = n {
            if id == closure {
                return false;
            }
            if tree.is_function(id) {
                // Only a function inside `closure` counts: keep walking to confirm `closure` is an ancestor.
                let mut m = tree.raw_parent(id);
                while let Some(up) = m {
                    if up == closure {
                        return true;
                    }
                    m = tree.raw_parent(up);
                }
                return false;
            }
            n = tree.raw_parent(id);
        }
        false
    }

    /// `function` calls a direct `eval` (a plain `eval(…)` call naming the global, anywhere in its body).
    fn calls_eval(&self, function: NodeId) -> bool {
        let tree = self.tree;
        let mut found = false;
        tree.walk(function, &mut |n| {
            if let AstKind::CallExpression(c) = tree.kind(n) {
                if let Expression::Identifier(callee) = c.callee.without_parentheses() {
                    if callee.name == "eval" && callee.reference_id.get().is_some_and(|r| tree.sem.scoping().get_reference(r).symbol_id().is_none()) {
                        found = true;
                    }
                }
            }
            !found
        });
        found
    }

    /// The `let`s to box (module docs), from the final site queue's capture lists.
    pub(super) fn boxed_lets(&self, queue: &[usize], ref_cells: &FxHashSet<NodeId>, fn_sites: &FxHashSet<NodeId>) -> Cells {
        let tree = self.tree;
        let mut capturing: FxHashMap<NodeId, Vec<usize>> = FxHashMap::default();
        let mut order: Vec<NodeId> = Vec::new();
        for &index in queue {
            for &decl in &self.sites[index].capture_decls {
                if !matches!(tree.kind(decl), AstKind::VariableDeclarator(d) if d.kind == VariableDeclarationKind::Let) {
                    continue;
                }
                let sites = capturing.entry(decl).or_default();
                if sites.is_empty() {
                    order.push(decl);
                }
                if !sites.contains(&index) {
                    sites.push(index);
                }
            }
        }
        let mut cells = Cells::default();
        let mut evals: FxHashMap<NodeId, bool> = FxHashMap::default();
        for decl in order {
            let sites = &capturing[&decl];
            if ref_cells.contains(&decl) || fn_sites.contains(&decl) {
                continue;
            }
            if sites.iter().any(|&s| matches!(self.sites[s].kind, SiteKind::Spread | SiteKind::Styled | SiteKind::Props | SiteKind::Element)) {
                continue;
            }
            let AstKind::VariableDeclarator(d) = tree.kind(decl) else { continue };
            let BindingPatternKind::BindingIdentifier(binding) = &d.id.kind else { continue };
            let Some(symbol) = binding.symbol_id.get() else { continue };
            // A statement-list declaration (a `for` head binding is per iteration: a snapshot is right there).
            let Some(declaration) = tree.raw_parent(decl) else { continue };
            if hoist_container(tree, declaration).is_none() {
                continue;
            }
            let owner = self.owner_function(decl);
            if let Some(owner) = owner {
                if *evals.entry(owner).or_insert_with(|| self.calls_eval(owner)) {
                    continue;
                }
            }
            let name = binding.name.as_str();
            let mut boxed = false;
            let mut rejected = false;
            let mut uses = Vec::new();
            for reference in tree.sem.scoping().get_resolved_references(symbol) {
                let node = reference.node_id();
                let parent = tree.parent_kind(node);
                if tree.in_type_name(node) || matches!(parent, Some(AstKind::TSTypeQuery(_))) {
                    continue;
                }
                let span = tree.span(node);
                // Positions the rewrite cannot reach: JSX tags, exports, `<slot>` elements (lowered from raw text).
                if matches!(parent, Some(AstKind::JSXMemberExpression(_) | AstKind::ExportSpecifier(_))) || self.jsx_tag(node, span) {
                    rejected = true;
                    break;
                }
                let mut n = tree.raw_parent(node);
                while let Some(id) = n {
                    if Some(id) == owner {
                        break;
                    }
                    if let AstKind::JSXElement(el) = tree.kind(id) {
                        if crate::slots::is_slot(tree, Some(id), el) {
                            rejected = true;
                        }
                    }
                    n = tree.raw_parent(id);
                }
                if rejected {
                    break;
                }
                // Review H1: any write boxes (execution order is not source order).
                let write = reference.flags().is_write();
                boxed |= write;
                let text = match parent {
                    Some(AstKind::ObjectProperty(p)) if p.shorthand => format!("{name}: {name}.v"),
                    _ if write && self.shorthand_target(node, span) => format!("{name}: {name}.v"),
                    _ if self.callee(node) => format!("(0, {name}.v)"),
                    _ => format!("{name}.v"),
                };
                uses.push((node, span, text));
            }
            if boxed && !rejected {
                uses.sort_by_key(|(_, span, _)| span.start);
                for &s in sites {
                    let site = &self.sites[s];
                    let Some(closure) = site.closure else { continue };
                    if !matches!(site.kind, SiteKind::Event | SiteKind::ClientEvent | SiteKind::Ref | SiteKind::Model) || !eager(&tree.kind(closure)) {
                        continue;
                    }
                    let at = tree.span(closure);
                    let inside: Vec<NodeId> = uses.iter().filter(|(_, span, _)| contains(at, *span)).map(|&(node, _, _)| node).collect();
                    let (nested, direct): (Vec<NodeId>, Vec<NodeId>) = inside.into_iter().partition(|&node| self.in_nested_function(node, closure));
                    if nested.is_empty() {
                        cells.snapshots.insert((s, decl));
                    } else if !direct.is_empty() {
                        // T8 follow-up (mixed site): eager references read a JSX-time snapshot capture `x$s`, nested
                        // ones keep the shared cell (`compile`: the snapshot is `_rMember(x, "v")` on the server).
                        let base = format!("{name}$s");
                        let mut param = base.clone();
                        let mut k = 1;
                        while site.captures.contains(&param) || site.params.contains(&param) {
                            k += 1;
                            param = format!("{base}{k}");
                        }
                        cells.mixed.insert((s, decl), (name.to_string(), param, direct.into_iter().collect()));
                    }
                }
                cells.decls.insert(decl);
                cells.uses.insert(decl, uses);
            }
        }
        cells
    }
}
