//! ZERO REGRESS (2026-10-26): props read back from the server markup. An independent boundary's record carries its props
//! (C3: the instance adopts standalone, from its record) — on a 500-card page that is 500 × `{title, author}`, +3 KB gz
//! of HTML and +40 % server time, although the browser's adopt run only writes those values into text the server already
//! rendered. A prop whose every use is the sole text of a native element on a static path from the boundary's root
//! element (`<p>{title}</p>`) is readable from that element's text: the server target names such props in `_rB`'s
//! `read` argument (`"title=ff author=ffn"`: key `=` path from the root element, `f` firstChild / `n` nextSibling, as
//! `derived_lite.rs` addresses server nodes), the server leaves a string / number value of them out of the record, and
//! the browser reads a key its record lacks from the element's `textContent` before the adopt run (`dom-derived.ts`
//! `propsOf`). The value only ever reaches that text (or the probe's copy of it), so reading it back is exact.
//!
//! Eligible: an `INDEPENDENT` + `ATTR` boundary (one native root element) without i18n, whose props parameter is a flat
//! object pattern (`{ title, n: count = 0, ...rest }`) or an identifier only ever destructured flat by top-level `const`s
//! of the body (`const { title } = props`). Per key: its binding is referenced at least once and every reference is a
//! bare `{key}` container that is the only content of a native element (no spread / `innerHTML` / `textContent` /
//! `children` attribute; not opaque, `script`, `style`, `pre`, form-select, foreign or custom content), whose ancestors
//! up to the root are native elements of the same kind, each preceded in its parent only by JSX text, folded literals
//! and native elements (whose node counts the server markup fixes). Anything else ships the prop as before.

use oxc_ast::{AstKind, ast::*};
use oxc_semantic::{NodeId, SymbolId};
use oxc_span::GetSpan;

use super::{Compiler, OPAQUE_CONTENT, attr_name, jsx_text, literal_child};
use crate::resume::derived::{ATTR, INDEPENDENT};

/// Tags whose text the parser or the browser rewrites, or whose content is not plain children.
const NO_READ: &[&str] = &["script", "style", "pre", "listing", "select", "option", "optgroup", "svg", "math", "foreignObject"];

impl<'t, 'a> Compiler<'t, 'a> {
    /// The `read` argument of `_rB` for boundary `function` (server target), else None.
    pub(super) fn derived_read_back(&self, function: NodeId, flags: u32) -> Option<String> {
        if !self.server || self.i18n || flags & INDEPENDENT == 0 || flags & ATTR == 0 {
            return None;
        }
        let tree = self.tree;
        let d = self.derived.as_ref()?;
        let (params, body, concise) = match tree.kind(function) {
            AstKind::Function(f) => (&*f.params, f.body.as_deref()?, false),
            AstKind::ArrowFunctionExpression(a) => (&*a.params, &*a.body, a.expression),
            _ => return None,
        };
        // The root: the one returned native element (ATTR: every return is one).
        let root = if concise {
            let Some(Statement::ExpressionStatement(s)) = body.statements.first() else { return None };
            element_id(tree, &s.expression)?
        } else {
            let mut roots: Vec<NodeId> = Vec::new();
            tree.walk(function, &mut |n| {
                if n != function && tree.is_function(n) {
                    return false;
                }
                if let AstKind::ReturnStatement(r) = tree.kind(n) {
                    if let Some(id) = r.argument.as_ref().and_then(|a| element_id(tree, a)) {
                        roots.push(id);
                    }
                }
                true
            });
            if roots.len() != 1 {
                return None;
            }
            roots[0]
        };
        if !d.plan.attr_roots.contains(&root) {
            return None;
        }
        let first = params.items.first()?;
        if params.items.len() != 1 || params.rest.is_some() {
            return None;
        }
        // Key → the expressions reading it (binding references, `props.key` members; None: a use proving nothing), in key
        // order of appearance.
        let mut keys: Vec<(String, Vec<Option<NodeId>>)> = Vec::new();
        let add = |keys: &mut Vec<(String, Vec<Option<NodeId>>)>, key: &str, at: Option<NodeId>| match keys.iter_mut().find(|(k, _)| k == key) {
            Some((_, list)) => list.push(at),
            None => keys.push((key.to_string(), vec![at])),
        };
        let mut bound: Vec<(String, SymbolId)> = Vec::new();
        match &first.pattern.kind {
            BindingPatternKind::ObjectPattern(o) => flat_keys(o, &mut bound)?,
            BindingPatternKind::BindingIdentifier(id) => {
                // `props` read only as `props.key` and destructured flat by top-level `const`s of the body: anything else
                // (passed on, spread, `splitProps(props)`) may hand any key to code that reads it. A member that is no sole
                // text (`props.x()`, `props.x = …`, `f(props.x)`) fails that key in `read_path`.
                let symbol = id.symbol_id.get()?;
                for reference in tree.sem.scoping().get_resolved_references(symbol) {
                    let at = reference.node_id();
                    let parent = tree.parent(at)?;
                    match tree.kind(parent) {
                        AstKind::StaticMemberExpression(m) if m.object.span() == tree.span(at) && !m.optional => add(&mut keys, m.property.name.as_str(), Some(parent)),
                        AstKind::VariableDeclarator(v) if !concise && v.init.as_ref().map(|i| i.span()) == Some(tree.span(at)) => {
                            let declaration = tree.parent(parent)?;
                            let AstKind::VariableDeclaration(decl) = tree.kind(declaration) else { return None };
                            if decl.kind != VariableDeclarationKind::Const || !body.statements.iter().any(|s| s.span() == decl.span) {
                                return None;
                            }
                            let BindingPatternKind::ObjectPattern(o) = &v.id.kind else { return None };
                            flat_keys(o, &mut bound)?;
                        }
                        _ => return None,
                    }
                }
            }
            _ => return None,
        }
        for (key, symbol) in bound {
            let mut any = false;
            for r in tree.sem.scoping().get_resolved_references(symbol) {
                any = true;
                add(&mut keys, &key, Some(r.node_id()));
            }
            // An unread binding has no markup to read from: the key ships.
            if !any {
                add(&mut keys, &key, None);
            }
        }
        let mut out: Vec<String> = Vec::new();
        for (key, list) in keys {
            // (`__proto__`: the browser's plain assignment would set the prototype, not a key.)
            if key.is_empty() || key.contains([' ', '=']) || key == "__proto__" {
                continue;
            }
            if let Some(path) = self.read_path(&list, root) {
                out.push(format!("{key}={path}"));
            }
        }
        (!out.is_empty()).then(|| out.join(" "))
    }

    /// The path from `root` to the element whose sole text every expression of `uses` is, else None.
    fn read_path(&self, uses: &[Option<NodeId>], root: NodeId) -> Option<String> {
        let tree = self.tree;
        let mut path: Option<String> = None;
        for &at in uses {
            let at = at?;
            let container = tree.parent(at)?;
            let AstKind::JSXExpressionContainer(c) = tree.kind(container) else { return None };
            if c.expression.span() != tree.span(at) {
                return None;
            }
            let mut el_id = tree.parent(container)?;
            let AstKind::JSXElement(el) = tree.kind(el_id) else { return None };
            if !self.readable(el) || counted(tree, &el.children) != 1 {
                return None;
            }
            // Climb to the root: each step's position among its parent's server nodes.
            let mut here = String::new();
            while el_id != root {
                let parent_id = tree.parent(el_id)?;
                let AstKind::JSXElement(parent) = tree.kind(parent_id) else { return None };
                if !self.readable(parent) {
                    return None;
                }
                let mut step = String::from("f");
                let mut run = false;
                let mut found = false;
                for child in &parent.children {
                    match child {
                        JSXChild::Element(e) if tree.id_of(&**e) == Some(el_id) => {
                            found = true;
                            break;
                        }
                        JSXChild::Text(text) => run |= !jsx_text(tree.text_of(text.span)).is_empty(),
                        JSXChild::ExpressionContainer(c) => match c.expression.as_expression() {
                            None => {}
                            Some(e) => run |= !literal_child(tree, e)?.is_empty(),
                        },
                        JSXChild::Element(e) if self.native(e) => {
                            if run {
                                step.push('n');
                                run = false;
                            }
                            step.push('n');
                        }
                        _ => return None,
                    }
                }
                if !found {
                    return None;
                }
                if run {
                    step.push('n');
                }
                here = step + &here;
                el_id = parent_id;
            }
            // Every use renders the same value: the first element's text answers.
            path.get_or_insert(here);
        }
        path
    }

    /// A native element whose children the server markup holds as written (see the module docs).
    fn readable(&self, el: &JSXElement<'a>) -> bool {
        let tag = self.tree.text_of(el.opening_element.name.span());
        self.native(el)
            && !tag.contains('-')
            && !OPAQUE_CONTENT.contains(&tag)
            && !NO_READ.contains(&tag)
            && el.opening_element.attributes.iter().all(|a| match a {
                JSXAttributeItem::SpreadAttribute(_) => false,
                JSXAttributeItem::Attribute(attr) => !matches!(attr_name(self.tree, attr), "innerHTML" | "textContent" | "children" | "dangerouslySetInnerHTML"),
            })
    }
}

/// `{ a, b: c = 1, ...rest }` → (key, binding) of the non-rest properties; None for a computed key or a nested pattern.
fn flat_keys(o: &ObjectPattern<'_>, out: &mut Vec<(String, SymbolId)>) -> Option<()> {
    for p in &o.properties {
        if p.computed {
            return None;
        }
        let key = match &p.key {
            PropertyKey::StaticIdentifier(k) => k.name.to_string(),
            PropertyKey::StringLiteral(k) => k.value.to_string(),
            _ => return None,
        };
        let symbol = match &p.value.kind {
            BindingPatternKind::BindingIdentifier(id) => id.symbol_id.get()?,
            BindingPatternKind::AssignmentPattern(a) => match &a.left.kind {
                BindingPatternKind::BindingIdentifier(id) => id.symbol_id.get()?,
                _ => return None,
            },
            _ => return None,
        };
        out.push((key, symbol));
    }
    if let Some(rest) = &o.rest {
        if !matches!(rest.argument.kind, BindingPatternKind::BindingIdentifier(_)) {
            return None;
        }
    }
    Some(())
}

/// Children the server markup writes (`slot_marks`' count).
fn counted(tree: &crate::tree::Tree<'_>, children: &[JSXChild<'_>]) -> usize {
    children
        .iter()
        .filter(|child| match child {
            JSXChild::Text(text) => !jsx_text(tree.text_of(text.span)).is_empty(),
            JSXChild::ExpressionContainer(c) => c.expression.as_expression().is_some(),
            _ => true,
        })
        .count()
}

fn element_id(tree: &crate::tree::Tree<'_>, e: &Expression<'_>) -> Option<NodeId> {
    match e {
        Expression::JSXElement(el) => tree.id_of(&**el),
        Expression::ParenthesizedExpression(p) => element_id(tree, &p.expression),
        _ => None,
    }
}
