//! Shell cache H-holes eligibility (PPR-T6, spec docs/design/specs/2026-10-20-ppr-shell-design.md D4): per streamed
//! boundary element (`<Async>` / `<Suspense>` imported from `@rivetjs/runtime*`), whether a stored shell may keep its
//! content thunk and re-run only it on a hit. Eligible: an `<Async>` whose `load` / `children` / `error` (and function
//! child) capture only data — module-level bindings, globals, parameters, `const`s initialised by data (literals,
//! object / array literals, member reads, operators over those) — and whose component creates no reactive state
//! (`signal` / `computed` / `createStore` / `_regionState` from `@rivetjs/reactivity*`) outside the thunks. The server
//! target marks eligible elements with a `$hole: 1` prop (the runtime retains only those, `server-shell.ts`); the facts
//! (`moduleFacts(…, { holes: true })`) list every boundary with the first reason it is not eligible.

use oxc_ast::{AstKind, ast::*};
use oxc_semantic::NodeId;
use rustc_hash::FxHashSet;
use serde_json::{Value, json};

use crate::compile::attr_name;
use crate::tree::Tree;

/// One streamed boundary element of a module.
pub struct HoleFact {
    /// The module-level component it is in (None: module scope / anonymous).
    pub component: Option<String>,
    /// Source offset of the element (its `<`).
    pub at: u32,
    pub tag: &'static str,
    /// The first reason it is not eligible (None: eligible).
    pub because: Option<String>,
}

const STATE: [&str; 4] = ["signal", "computed", "createStore", "_regionState"];

fn runtime(from: &str) -> bool {
    from == "@rivetjs/runtime" || from.starts_with("@rivetjs/runtime/")
}
fn reactivity(from: &str) -> bool {
    from == "@rivetjs/reactivity" || from.starts_with("@rivetjs/reactivity/")
}

/// The imported name of a reference resolving to an import specifier of a module matching `of`.
fn imported<'a>(tree: &Tree<'a>, ident: &IdentifierReference<'a>, of: fn(&str) -> bool) -> Option<String> {
    let decl = tree.resolve(ident, false)?;
    let AstKind::ImportSpecifier(spec) = tree.kind(decl) else { return None };
    let from = crate::resume::import_source(tree, decl)?;
    if !of(from) {
        return None;
    }
    Some(spec.imported.name().to_string())
}

fn boundary_tag<'a>(tree: &Tree<'a>, el: &JSXElement<'a>) -> Option<&'static str> {
    let JSXElementName::IdentifierReference(ident) = &el.opening_element.name else { return None };
    match imported(tree, ident, runtime)?.as_str() {
        "Async" => Some("Async"),
        "Suspense" => Some("Suspense"),
        _ => None,
    }
}

fn is_function(kind: &AstKind) -> bool {
    matches!(kind, AstKind::Function(_) | AstKind::ArrowFunctionExpression(_))
}

/// The outermost function around `id` and its name (a declaration's / a `const` declarator's).
fn component_of(tree: &Tree<'_>, id: NodeId) -> Option<(NodeId, Option<String>)> {
    let mut outer = None;
    let mut n = tree.raw_parent(id);
    while let Some(p) = n {
        if is_function(&tree.kind(p)) {
            outer = Some(p);
        }
        n = tree.raw_parent(p);
    }
    let outer = outer?;
    let name = match tree.kind(outer) {
        AstKind::Function(f) if f.id.is_some() => f.id.as_ref().map(|i| i.name.to_string()),
        _ => {
            let mut n = tree.raw_parent(outer);
            let mut name = None;
            while let Some(p) = n {
                match tree.kind(p) {
                    AstKind::VariableDeclarator(d) => {
                        if let BindingPatternKind::BindingIdentifier(b) = &d.id.kind {
                            name = Some(b.name.to_string());
                        }
                        break;
                    }
                    AstKind::ParenthesizedExpression(_) | AstKind::CallExpression(_) => n = tree.raw_parent(p),
                    _ => break,
                }
            }
            name
        }
    };
    Some((outer, name))
}

fn within(outer: oxc_span::Span, at: u32) -> bool {
    at >= outer.start && at < outer.end
}

struct Check<'t, 'a> {
    tree: &'t Tree<'a>,
    /// The thunks' spans: bindings declared inside them are their own.
    thunks: Vec<oxc_span::Span>,
}

impl<'t, 'a> Check<'t, 'a> {
    fn own(&self, at: u32) -> bool {
        self.thunks.iter().any(|s| within(*s, at))
    }

    /// Why a reference is not data (None: it is).
    fn reference(&self, ident: &IdentifierReference<'a>, depth: u32) -> Option<String> {
        let tree = self.tree;
        let Some(symbol) = tree.symbol_of_ref(ident) else { return None }; // a global
        if tree.module_symbol(symbol) {
            return None;
        }
        let decl = tree.decl_of_symbol(symbol);
        if self.own(tree.span(decl).start) {
            return None;
        }
        let name = ident.name.as_str();
        if tree.symbol_written(symbol) {
            return Some(format!("captures `{name}`, which is reassigned"));
        }
        let mut n = Some(decl);
        while let Some(id) = n {
            match tree.kind(id) {
                AstKind::FormalParameter(_) | AstKind::FormalParameters(_) | AstKind::BindingRestElement(_) => return None,
                AstKind::VariableDeclarator(d) => {
                    let constant = matches!(tree.raw_parent(id).map(|p| tree.kind(p)), Some(AstKind::VariableDeclaration(v)) if v.kind == VariableDeclarationKind::Const);
                    if !constant {
                        return Some(format!("captures `{name}`, a `let` / `var`"));
                    }
                    return match &d.init {
                        Some(init) if depth < 8 && self.data(init, depth + 1) => None,
                        Some(_) => Some(format!("captures `{name}`, a `const` not initialised by data (a call, a function, a signal)")),
                        None => Some(format!("captures `{name}`, a `const` without a value")),
                    };
                }
                AstKind::Function(_) | AstKind::ArrowFunctionExpression(_) | AstKind::Class(_) => {
                    return Some(format!("captures the local function / class `{name}`"));
                }
                AstKind::CatchParameter(_) => return Some(format!("captures the caught error `{name}`")),
                _ => n = tree.raw_parent(id),
            }
        }
        Some(format!("captures `{name}`"))
    }

    /// A data initialiser: literals, object / array literals, member reads and operators over data references.
    fn data(&self, e: &Expression<'a>, depth: u32) -> bool {
        match crate::resume::unwrap(e) {
            Expression::StringLiteral(_)
            | Expression::NumericLiteral(_)
            | Expression::BooleanLiteral(_)
            | Expression::NullLiteral(_)
            | Expression::BigIntLiteral(_) => true,
            Expression::TemplateLiteral(t) => t.expressions.iter().all(|x| self.data(x, depth)),
            Expression::Identifier(r) => self.reference(r, depth).is_none(),
            Expression::StaticMemberExpression(m) => self.data(&m.object, depth),
            Expression::ComputedMemberExpression(m) => self.data(&m.object, depth) && self.data(&m.expression, depth),
            Expression::ObjectExpression(o) => o.properties.iter().all(|p| match p {
                ObjectPropertyKind::ObjectProperty(p) => {
                    !p.method && p.kind == PropertyKind::Init && (!p.computed || p.key.as_expression().is_some_and(|k| self.data(k, depth))) && self.data(&p.value, depth)
                }
                ObjectPropertyKind::SpreadProperty(s) => self.data(&s.argument, depth),
            }),
            Expression::ArrayExpression(a) => a.elements.iter().all(|x| match x {
                ArrayExpressionElement::SpreadElement(s) => self.data(&s.argument, depth),
                ArrayExpressionElement::Elision(_) => true,
                other => other.as_expression().is_some_and(|x| self.data(x, depth)),
            }),
            Expression::UnaryExpression(u) => self.data(&u.argument, depth),
            Expression::BinaryExpression(b) => self.data(&b.left, depth) && self.data(&b.right, depth),
            Expression::LogicalExpression(l) => self.data(&l.left, depth) && self.data(&l.right, depth),
            Expression::ConditionalExpression(c) => self.data(&c.test, depth) && self.data(&c.consequent, depth) && self.data(&c.alternate, depth),
            _ => false,
        }
    }

    /// The first non-data capture of the thunk at `node`.
    fn thunk(&self, node: NodeId) -> Option<String> {
        let tree = self.tree;
        let mut why = None;
        tree.walk(node, &mut |n| {
            if why.is_some() {
                return false;
            }
            if let AstKind::IdentifierReference(r) = tree.kind(n) {
                if !tree.in_type_name(n) {
                    why = self.reference(r, 0);
                }
            }
            true
        });
        why
    }
}

/// Reactive state created on the path to the element (the first callee name): a call in `component` whose nearest
/// function encloses the element (the component body, a render callback around it) — not in a thunk, a handler or a
/// sibling subtree's callback.
fn creates_state(tree: &Tree<'_>, component: NodeId, at: u32) -> Option<&'static str> {
    let mut found = None;
    tree.walk(component, &mut |n| {
        if found.is_some() {
            return false;
        }
        if let AstKind::CallExpression(call) = tree.kind(n) {
            if let Expression::Identifier(callee) = crate::resume::unwrap(&call.callee) {
                if let Some(name) = imported(tree, callee, reactivity) {
                    let mut f = tree.raw_parent(n);
                    while let Some(p) = f {
                        if is_function(&tree.kind(p)) {
                            break;
                        }
                        f = tree.raw_parent(p);
                    }
                    if f.is_some_and(|f| within(tree.span(f), at)) {
                        found = STATE.iter().copied().find(|s| *s == name.as_str());
                    }
                }
            }
        }
        true
    });
    found
}

fn fact<'a>(tree: &Tree<'a>, id: NodeId, el: &JSXElement<'a>, tag: &'static str) -> HoleFact {
    let at = el.span.start;
    let component = component_of(tree, id);
    let name = component.as_ref().and_then(|(_, n)| n.clone());
    let done = |because: Option<String>| HoleFact { component: name.clone(), at, tag, because };
    if tag == "Suspense" {
        return done(Some("a `<Suspense>` boundary (H-holes re-run `<Async>` boundaries only)".into()));
    }
    let mut thunks: Vec<NodeId> = Vec::new();
    let mut fallback = false;
    for item in &el.opening_element.attributes {
        let JSXAttributeItem::Attribute(attr) = item else {
            return done(Some("spread props".into()));
        };
        let name = attr_name(tree, attr);
        if name == "fallback" {
            fallback = true;
        }
        if !matches!(name, "load" | "children" | "error") {
            continue;
        }
        if let Some(JSXAttributeValue::ExpressionContainer(c)) = &attr.value {
            if let Some(e) = c.expression.as_expression() {
                if let Some(node) = tree.expr_id(e) {
                    thunks.push(node);
                }
            }
        }
    }
    if !fallback {
        return done(Some("no `fallback` (the boundary does not stream)".into()));
    }
    for child in &el.children {
        match child {
            JSXChild::ExpressionContainer(c) => {
                if let Some(e) = c.expression.as_expression() {
                    if let Some(node) = tree.expr_id(e) {
                        thunks.push(node);
                    }
                }
            }
            JSXChild::Text(t) if tree.text_of(t.span).trim().is_empty() => {}
            _ => return done(Some("children other than a render function".into())),
        }
    }
    let spans: Vec<oxc_span::Span> = thunks.iter().map(|n| tree.span(*n)).collect();
    let check = Check { tree, thunks: spans };
    for node in &thunks {
        if let Some(why) = check.thunk(*node) {
            return done(Some(why));
        }
    }
    if let Some((outer, _)) = component {
        if let Some(callee) = creates_state(tree, outer, at) {
            return done(Some(format!("its component creates reactive state (`{callee}`) its context frame may hold")));
        }
    }
    done(None)
}

/// Every streamed boundary element of the module, in source order.
pub fn holes(tree: &Tree<'_>) -> Vec<HoleFact> {
    let mut out = Vec::new();
    tree.walk(tree.root(), &mut |n| {
        if let AstKind::JSXElement(el) = tree.kind(n) {
            if let Some(tag) = boundary_tag(tree, el) {
                out.push(fact(tree, n, el, tag));
            }
        }
        true
    });
    out
}

/// Source offsets of the eligible elements (server target: `$hole: 1`).
pub fn eligible(tree: &Tree<'_>) -> FxHashSet<u32> {
    holes(tree).into_iter().filter(|h| h.because.is_none()).map(|h| h.at).collect()
}

/// `moduleFacts(…, { holes: true })` → `holes`.
pub fn facts_json(tree: &Tree<'_>) -> Value {
    Value::Array(
        holes(tree)
            .into_iter()
            .map(|h| {
                let (line, column) = tree.line_col(h.at);
                json!({ "component": h.component, "tag": h.tag, "at": h.at, "line": line, "column": column, "eligible": h.because.is_none(), "because": h.because })
            })
            .collect(),
    )
}
