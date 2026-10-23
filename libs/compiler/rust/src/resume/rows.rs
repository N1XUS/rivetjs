//! LAZY-ROWS T2 (2026-10-19, spec `docs/design/specs/2026-10-19-lazy-collection-rows-design.md` §3.3, ruling R3): per
//! keyed `<For>` (structural `For` from `@rivetjs/runtime/dom` / `/server`) one decision — **lazy** (the row function is a
//! resumable symbol the browser can run per row) or **recorded** (today's per-row records, output unchanged).
//!
//! Lazy when, statically:
//! - the row child is one inline function literal (sole expression child or `children={…}`), not async / generator, with
//!   plain identifier parameters (`(row, index) => …`), reading no `this` / `arguments` / `super` / `new.target` (reason
//!   `row`); the For has no spread props (`spread`);
//! - `by` is absent, a key path arrow (`(r) => r.id`, `(r) => r.a.b`, `(r) => r["k"]`, `(r) => r` — `key`), or another
//!   inline function literal (an Fn site: `by` gets a recipe) (`by`);
//! - the row's render path (the row function minus browser-only closures: `on*` / `on:` / `window:` / `document:` / `ref`
//!   attribute values, `onX` object-literal values, arguments of `effect` / `clientEffect` / `onMount` / timers …) reads
//!   no `Date.now()` / `Math.random()` / `performance.now()` / `crypto.randomUUID()` / `crypto.getRandomValues()` /
//!   `Date()` / `new Date()` (`nondeterministic`, RV2105 warning);
//! - the row holds no site an adopt run cannot replay: `clientOnly(…)` or an element of a `const X = clientOnly(…)` component
//!   (`clientOnly`), `<Async>` (`async`), a `<Portal>`
//!   element (`portal`), `ref={x}` / `ref={(el) => (x = el)}` into a local declared outside the row (`ref`) (RV2106
//!   warning);
//! - the row captures no JSX content: a `children` binding / `props.children` of the enclosing component, or a local
//!   initialised with JSX (`capture`; facts only, no diagnostic).
//!
//! Lazy → `scan_for_rows` adds the row function's site (Slot when it renders JSX, else Fn; opportunistic: no capture
//! diagnostics, a capture that cannot serialize is the recorder's fallback, T4) and, for a function `by`, an Fn site.
//! The server lowering wraps both in `_rFn` and passes the compiler-private `$lazy` prop (`compile/lazy_rows.rs`).
//! Recorded → no site, no prop: byte-identical output.

use oxc_ast::{AstKind, ast::*};
use oxc_semantic::NodeId;
use oxc_span::GetSpan;

use super::{Analysis, Site, SiteKind, import_source, unwrap};
use crate::compile::{attr_name, jsx_text, starts_with_on};
use crate::tree::Tree;

/// One keyed `<For>` of the module and its lazy-rows verdict.
pub struct ForRow {
    /// The row function literal (None when the row child is not one).
    pub row: Option<NodeId>,
    /// `by` key path (`"id"`, `"a.b"`, `""` = the item itself); None for a function `by` or no `by`.
    pub key: Option<String>,
    /// `by` is a function literal with its own Fn site (the server passes its recipe).
    pub by: Option<NodeId>,
    /// The row function reads its index parameter.
    pub index: bool,
    /// None: lazy. Else the reason the For stays recorded (`row`, `spread`, `by`, `nondeterministic`, `clientOnly`, `async`,
    /// `portal`, `ref`, `capture`).
    pub reason: Option<&'static str>,
    /// Node a diagnostic points at, and its text (`Date.now()`, `clientOnly(…)`, the ref target).
    pub at: Option<(NodeId, String)>,
}

/// Calls whose function arguments run in the browser only (never while rendering on the server).
const BROWSER_CALLS: &[&str] = &[
    "effect",
    "clientEffect",
    "clientEvent",
    "createEffect",
    "onMount",
    "onCleanup",
    "setTimeout",
    "setInterval",
    "queueMicrotask",
    "requestAnimationFrame",
    "requestIdleCallback",
];

/// `<object>.<method>()` reads that differ between the server render and an adopt run.
const NONDETERMINISTIC: &[(&str, &str)] =
    &[("Date", "now"), ("Math", "random"), ("performance", "now"), ("crypto", "randomUUID"), ("crypto", "getRandomValues")];

/// `For` imported from the runtime's structural helpers (same rule as `for_accessors`).
pub(super) fn structural_for<'a>(tree: &Tree<'a>, el: &JSXElement<'a>) -> bool {
    let JSXElementName::IdentifierReference(tag) = &el.opening_element.name else { return false };
    let Some(decl) = tree.resolve(tag, false) else { return false };
    let AstKind::ImportSpecifier(s) = tree.kind(decl) else { return false };
    s.imported.name() == "For" && matches!(import_source(tree, decl), Some("@rivetjs/runtime/dom" | "@rivetjs/runtime/server"))
}

/// `(r) => r.id` / `(r) => r.a.b` / `(r) => r["k"]` / `(r) => r`: the key path (segments joined by `.`).
fn key_path(e: &Expression<'_>) -> Option<String> {
    let Expression::ArrowFunctionExpression(a) = unwrap(e) else { return None };
    if a.r#async || !a.expression || a.params.items.len() != 1 || a.params.rest.is_some() {
        return None;
    }
    let BindingPatternKind::BindingIdentifier(param) = &a.params.items[0].pattern.kind else { return None };
    let mut segments: Vec<String> = Vec::new();
    let mut e = unwrap(a.get_expression()?);
    loop {
        match e {
            Expression::Identifier(i) if i.name == param.name => break,
            Expression::StaticMemberExpression(m) if !m.optional => {
                segments.push(m.property.name.to_string());
                e = unwrap(&m.object);
            }
            Expression::ComputedMemberExpression(m) if !m.optional => {
                let Expression::StringLiteral(s) = unwrap(&m.expression) else { return None };
                if s.value.contains('.') || s.value.is_empty() {
                    return None;
                }
                segments.push(s.value.to_string());
                e = unwrap(&m.object);
            }
            _ => return None,
        }
    }
    segments.reverse();
    Some(segments.join("."))
}

impl<'t, 'a> Analysis<'t, 'a> {
    /// LAZY-ROWS T2: the lazy-rows verdict of one structural `<For>` (pass 1, before `scan_component`'s framework return).
    pub(super) fn scan_for_rows(&mut self, el: &'a JSXElement<'a>) {
        let tree = self.tree;
        if self.id(el).is_none() {
            return;
        }
        let mut entry = ForRow { row: None, key: None, by: None, index: false, reason: None, at: None };
        let mut row: Option<&'a Expression<'a>> = None;
        let mut by: Option<&'a Expression<'a>> = None;
        for item in &el.opening_element.attributes {
            match item {
                JSXAttributeItem::SpreadAttribute(_) => entry.reason = entry.reason.or(Some("spread")),
                JSXAttributeItem::Attribute(attr) => {
                    let value = match &attr.value {
                        Some(JSXAttributeValue::ExpressionContainer(c)) => c.expression.as_expression(),
                        _ => None,
                    };
                    match attr_name(tree, attr) {
                        "children" => row = value,
                        "by" => {
                            by = value;
                            if value.is_none() {
                                entry.reason = entry.reason.or(Some("by"));
                            }
                        }
                        _ => {}
                    }
                }
            }
        }
        let mut content = el.children.iter().filter(|c| !matches!(c, JSXChild::Text(t) if jsx_text(tree.text_of(t.span)).is_empty()));
        match (content.next(), content.next()) {
            (None, _) => {}
            (Some(JSXChild::ExpressionContainer(c)), None) if row.is_none() => row = c.expression.as_expression(),
            _ => entry.reason = entry.reason.or(Some("row")),
        }
        let row = row.map(unwrap);
        let function = row.and_then(|e| match e {
            Expression::ArrowFunctionExpression(a) if !a.r#async => Some((tree.expr_id(e), &a.params)),
            Expression::FunctionExpression(f) if !f.r#async && !f.generator => Some((tree.expr_id(e), &f.params)),
            _ => None,
        });
        let Some((Some(function), params)) = function else {
            entry.reason = entry.reason.or(Some("row"));
            self.for_rows.push(entry);
            return;
        };
        entry.row = Some(function);
        if params.rest.is_some() || params.items.iter().any(|p| !matches!(p.pattern.kind, BindingPatternKind::BindingIdentifier(_))) {
            entry.reason = entry.reason.or(Some("row"));
        }
        let index_param = params.items.get(1).and_then(|p| match &p.pattern.kind {
            BindingPatternKind::BindingIdentifier(i) => Some(i.span),
            _ => None,
        });
        if let Some(by) = by {
            match key_path(by) {
                Some(path) => entry.key = Some(path),
                None if matches!(unwrap(by), Expression::ArrowFunctionExpression(_) | Expression::FunctionExpression(_)) => {
                    entry.by = tree.expr_id(unwrap(by));
                    if entry.by.is_some_and(|f| self.free_names(f).2) {
                        entry.reason = entry.reason.or(Some("by"));
                    }
                }
                None => entry.reason = entry.reason.or(Some("by")),
            }
        }
        let (reason, at, index) = self.row_body(function, index_param);
        entry.index = index;
        if entry.reason.is_none() {
            entry.reason = reason;
            entry.at = at;
        }
        if entry.reason.is_none() && self.claimed.contains(&function) {
            entry.reason = Some("row");
        }
        if entry.reason.is_none() {
            let kind = if row.and_then(|e| self.jsx_function(e)).is_some() { SiteKind::Slot } else { SiteKind::Fn };
            let mut site = Site::new(kind);
            site.value = Some(function);
            site.opportunistic = true;
            if self.add(site, function).is_none() {
                entry.reason = Some("row");
            } else if kind == SiteKind::Fn {
                // A non-JSX row (`(k) => itemOf(k, …)`) runs on the server too: its own `computed(…)` / handler / `equals`
                // sites must register as before T2 (fix 2026-10-19: `add` marked the Fn closure a site closure, so the scan
                // skipped the row body and a `computed` created in it was "not created in a resume-compiled component" at
                // encode — cdk Masonry rows). A Slot row is a render kind and is scanned inside already.
                self.site_closures.remove(&function);
            }
            if entry.reason.is_none() && entry.by.is_some() {
                if let Some(by) = by {
                    self.escaping(by);
                }
            }
        }
        if entry.reason.is_some() {
            entry.by = None;
            entry.key = None;
        }
        self.for_rows.push(entry);
    }

    /// The row function's first ineligibility (reason, node + text) and whether it reads its index parameter.
    fn row_body(&self, function: NodeId, index_param: Option<oxc_span::Span>) -> (Option<&'static str>, Option<(NodeId, String)>, bool) {
        let tree = self.tree;
        let row = tree.span(function);
        let outer = |decl: NodeId| {
            let span = tree.span(decl);
            !(span.start >= row.start && span.end <= row.end) && !self.module_scoped(decl)
        };
        let mut found: Option<(&'static str, NodeId, String)> = None;
        let mut index = false;
        // (node, render path, own `this` scope)
        let mut stack: Vec<(NodeId, bool, bool)> = tree.children(function).iter().rev().map(|&c| (c, true, true)).collect();
        while let Some((n, render, own)) = stack.pop() {
            let mut render = render;
            let mut own = own;
            let mut hit = |reason: &'static str, text: String| {
                if found.is_none() {
                    found = Some((reason, n, text));
                }
            };
            match tree.kind(n) {
                AstKind::ThisExpression(_) | AstKind::Super(_) if own => hit("row", tree.text(n).to_string()),
                AstKind::MetaProperty(m) if own && m.meta.name == "new" => hit("row", "new.target".into()),
                AstKind::Function(_) => {
                    own = false;
                    render = render && self.render_function(n);
                }
                AstKind::ArrowFunctionExpression(_) => render = render && self.render_function(n),
                AstKind::IdentifierReference(i) if !tree.in_type_name(n) => {
                    if i.name == "arguments" && own && tree.symbol_of_ref(i).is_none() {
                        hit("row", "arguments".into());
                    }
                    if let (Some(param), Some(at)) = (index_param, tree.binding_span(i)) {
                        if at == param {
                            index = true;
                        }
                    }
                    if let Some(decl) = tree.resolve(i, true) {
                        if outer(decl) {
                            let jsx = matches!(tree.kind(decl), AstKind::VariableDeclarator(d)
                                if matches!(d.init.as_ref().map(unwrap), Some(Expression::JSXElement(_) | Expression::JSXFragment(_))));
                            if i.name == "children" || jsx {
                                hit("capture", i.name.to_string());
                            }
                        }
                    }
                }
                AstKind::StaticMemberExpression(m) if m.property.name == "children" => {
                    if let Expression::Identifier(object) = unwrap(&m.object) {
                        if tree.resolve(object, true).is_some_and(outer) {
                            hit("capture", tree.text(n).to_string());
                        }
                    }
                }
                AstKind::CallExpression(call) if render => {
                    if let Some(text) = nondeterministic_call(tree, &call.callee) {
                        hit("nondeterministic", text);
                    } else if self.import_of(&call.callee).is_some_and(|(name, from)| name == "clientOnly" && from.starts_with("@rivetjs/runtime")) {
                        hit("clientOnly", "`clientOnly(…)`".into());
                    }
                }
                AstKind::NewExpression(new) if render && new.arguments.is_empty() => {
                    if matches!(unwrap(&new.callee), Expression::Identifier(c) if c.name == "Date" && tree.symbol_of_ref(c).is_none()) {
                        hit("nondeterministic", "new Date()".into());
                    }
                }
                AstKind::JSXOpeningElement(open) if render => match &open.name {
                    JSXElementName::IdentifierReference(tag) => {
                        let import = self.import_of_ident(tag);
                        let client_only = tree.resolve(tag, false).is_some_and(|decl| {
                            matches!(tree.kind(decl), AstKind::VariableDeclarator(d) if matches!(d.init.as_ref().map(unwrap), Some(Expression::CallExpression(c))
                                if self.import_of(&c.callee).is_some_and(|(name, from)| name == "clientOnly" && from.starts_with("@rivetjs/runtime"))))
                        });
                        if client_only {
                            hit("clientOnly", format!("`<{}>` (a `clientOnly` component)", tag.name));
                        } else if import.as_ref().is_some_and(|(name, from)| name == "Async" && from.starts_with("@rivetjs/runtime")) {
                            hit("async", "`<Async>`".into());
                        } else if tag.name == "Portal" || import.is_some_and(|(name, _)| name == "Portal") {
                            hit("portal", format!("`<{}>`", tag.name));
                        }
                    }
                    JSXElementName::MemberExpression(m) if m.property.name == "Portal" => hit("portal", format!("`<{}>`", tree.text_of(m.span()))),
                    _ => {}
                },
                AstKind::JSXAttribute(attr) if attr_name(tree, attr) == "ref" => {
                    if let Some(target) = self.ref_outer(attr, &outer) {
                        hit("ref", target);
                    }
                }
                _ => {}
            }
            for &child in tree.children(n).iter().rev() {
                stack.push((child, render, own));
            }
        }
        match found {
            Some((reason, node, text)) => (Some(reason), Some((node, text)), index),
            None => (None, None, index),
        }
    }

    /// A function nested in a row runs while rendering unless it is a browser-only closure: a handler / ref attribute
    /// value, an `onX` object-literal value, or an argument of a browser-only call (`BROWSER_CALLS`).
    fn render_function(&self, function: NodeId) -> bool {
        let tree = self.tree;
        let mut child = function;
        let mut parent = tree.raw_parent(function);
        while let Some(p) = parent {
            match tree.kind(p) {
                AstKind::ParenthesizedExpression(_) | AstKind::TSAsExpression(_) | AstKind::TSSatisfiesExpression(_) | AstKind::TSNonNullExpression(_) | AstKind::Argument(_) | AstKind::JSXExpressionContainer(_) => {
                    child = p;
                    parent = tree.raw_parent(p);
                }
                _ => break,
            }
        }
        let Some(parent) = parent else { return true };
        match tree.kind(parent) {
            AstKind::JSXAttribute(attr) => {
                let name = attr_name(tree, attr);
                !(name == "ref" || browser_attribute(name))
            }
            AstKind::ObjectProperty(p) => !matches!(&p.key, PropertyKey::StaticIdentifier(k) if browser_attribute(&k.name)) || tree.span(child) != p.value.span(),
            AstKind::CallExpression(call) => {
                let name = match unwrap(&call.callee) {
                    Expression::Identifier(i) => Some(i.name.as_str()),
                    Expression::StaticMemberExpression(m) => Some(m.property.name.as_str()),
                    _ => None,
                };
                !(name.is_some_and(|n| BROWSER_CALLS.contains(&n)) && tree.span(child) != call.callee.span())
            }
            _ => true,
        }
    }

    /// `ref={x}` / `ref={(el) => (x = el)}` / `ref={(el) => { x = el; }}` where `x` is declared outside the row (not module
    /// scope): the target's name.
    fn ref_outer(&self, attr: &'a JSXAttribute<'a>, outer: &dyn Fn(NodeId) -> bool) -> Option<String> {
        let tree = self.tree;
        let Some(JSXAttributeValue::ExpressionContainer(c)) = &attr.value else { return None };
        let value = unwrap(c.expression.as_expression()?);
        if let Expression::Identifier(i) = value {
            return tree.resolve(i, true).filter(|&d| outer(d)).map(|_| i.name.to_string());
        }
        if !matches!(value, Expression::ArrowFunctionExpression(_) | Expression::FunctionExpression(_)) {
            return None;
        }
        let mut target = None;
        tree.walk(tree.expr_id(value)?, &mut |n| {
            if let AstKind::AssignmentExpression(assign) = tree.kind(n) {
                if let AssignmentTarget::AssignmentTargetIdentifier(left) = &assign.left {
                    if tree.resolve(left, false).is_some_and(outer) {
                        target = target.take().or(Some(left.name.to_string()));
                    }
                }
            }
            target.is_none()
        });
        target
    }
}

/// `onX` (X uppercase), `on:x`, `window:x`, `document:x`: a browser-only handler attribute / props key.
fn browser_attribute(name: &str) -> bool {
    (starts_with_on(name) && name.len() > 2 && name[2..].starts_with(|c: char| c.is_ascii_uppercase()))
        || name.starts_with("on:")
        || name.starts_with("window:")
        || name.starts_with("document:")
}

/// `Date.now()` / `Math.random()` / `performance.now()` / `crypto.randomUUID()` / `crypto.getRandomValues()` / `Date()` on
/// the unshadowed globals: the call's text.
pub(super) fn nondeterministic_call<'a>(tree: &Tree<'a>, callee: &Expression<'a>) -> Option<String> {
    match unwrap(callee) {
        Expression::Identifier(i) if i.name == "Date" && tree.symbol_of_ref(i).is_none() => Some("Date()".into()),
        Expression::StaticMemberExpression(m) => {
            let Expression::Identifier(object) = unwrap(&m.object) else { return None };
            let global = tree.symbol_of_ref(object).is_none();
            (global && NONDETERMINISTIC.contains(&(object.name.as_str(), m.property.name.as_str()))).then(|| format!("{}.{}()", object.name, m.property.name))
        }
        _ => None,
    }
}

