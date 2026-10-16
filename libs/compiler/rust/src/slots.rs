//! Web-component style slot syntax, lowered to lazy slot props.
//!
//! Component side: `<slot />` renders the default slot (`children`); `<slot r:name="x">fallback</slot>`
//! renders prop `x`, or the fallback when it is absent; `r:args={[a, b]}` calls a scoped slot. The prop
//! comes from the component's first parameter (`props.x`, or the destructured local `x`).
//! Usage side: a direct child of a component element with `r:slot="x"` becomes the lazy prop
//! `x: () => <child/>` (see `Compiler::lower`). `<slot>` stays native inside `<template>` (declarative
//! shadow DOM) and with a plain `name` attribute.

use oxc_ast::{AstKind, ast::*};
use oxc_semantic::NodeId;
use oxc_span::{GetSpan, Span};

use crate::compile::{attr_name, attr_string};
use crate::tree::Tree;

pub const NAME: &str = "r:name";
pub const ARGS: &str = "r:args";
pub const SLOT: &str = "r:slot";

fn attribute<'b, 'a>(tree: &Tree<'a>, el: &'b JSXElement<'a>, name: &str) -> Option<&'b JSXAttribute<'a>> {
    el.opening_element.attributes.iter().find_map(|item| match item {
        JSXAttributeItem::Attribute(attr) if attr_name(tree, attr) == name => Some(&**attr),
        _ => None,
    })
}

/// A Rivet `<slot>` element (not the native one).
pub fn is_slot<'a>(tree: &Tree<'a>, id: Option<NodeId>, el: &JSXElement<'a>) -> bool {
    if !matches!(&el.opening_element.name, JSXElementName::Identifier(i) if i.name == "slot") {
        return false;
    }
    if attribute(tree, el, "name").is_some() {
        return false;
    }
    let mut n = id.and_then(|id| tree.raw_parent(id));
    while let Some(p) = n {
        match tree.kind(p) {
            AstKind::JSXElement(e) if matches!(&e.opening_element.name, JSXElementName::Identifier(i) if i.name == "template") => {
                return false;
            }
            AstKind::Program(_) => break,
            _ => {}
        }
        n = tree.raw_parent(p);
    }
    true
}

/// `r:slot="name"` of a usage element: None without the attribute, Some(Err) when not a literal.
pub fn usage_name<'a>(tree: &Tree<'a>, el: &JSXElement<'a>) -> Option<Result<&'a str, &'static str>> {
    let attr = attribute(tree, el, SLOT)?;
    Some(attr_string(tree, attr).filter(|s| !s.is_empty()).ok_or("r:slot must be a string literal"))
}

/// A conditional `r:slot` child of a component element: `{cond && <el r:slot="x"/>}` or
/// `{cond ? <el r:slot="x"/> : null}` (either or both branches; the other `null` / `undefined` /
/// `false`). Lowered to the prop `x: cond ? () => <el/> : undefined`.
pub struct CondUsage<'a> {
    pub test: &'a Expression<'a>,
    /// Consequent and alternate slot elements (`None`: absent).
    pub branches: [Option<&'a JSXElement<'a>>; 2],
    pub name: Result<&'a str, &'static str>,
}

fn unparen<'b, 'a>(mut e: &'b Expression<'a>) -> &'b Expression<'a> {
    while let Expression::ParenthesizedExpression(p) = e {
        e = &p.expression;
    }
    e
}

pub fn conditional_usage<'a>(tree: &Tree<'a>, e: &'a Expression<'a>) -> Option<CondUsage<'a>> {
    let slot = |e: &'a Expression<'a>| match unparen(e) {
        Expression::JSXElement(el) => usage_name(tree, el).map(|name| (&**el, name)),
        _ => None,
    };
    let empty = |e: &Expression<'a>| match unparen(e) {
        Expression::NullLiteral(_) => true,
        Expression::BooleanLiteral(b) => !b.value,
        Expression::Identifier(i) => i.name == "undefined" && tree.resolve(i, false).is_none(),
        _ => false,
    };
    let (test, branches) = match unparen(e) {
        Expression::LogicalExpression(l) if l.operator == LogicalOperator::And => (&l.left, [slot(&l.right)?.into(), None]),
        Expression::ConditionalExpression(c) => {
            let (a, b) = (slot(&c.consequent), slot(&c.alternate));
            if (a.is_none() && !empty(&c.consequent)) || (b.is_none() && !empty(&c.alternate)) || (a.is_none() && b.is_none()) {
                return None;
            }
            (&c.test, [a, b])
        }
        _ => return None,
    };
    let mut name: Option<Result<&'a str, &'static str>> = None;
    for (_, n) in branches.iter().flatten() {
        name = Some(match (name, *n) {
            (None, n) => n,
            (Some(Err(m)), _) | (_, Err(m)) => Err(m),
            (Some(Ok(a)), Ok(b)) if a == b => Ok(a),
            (Some(Ok(_)), Ok(_)) => Err("conditional r:slot branches must name the same slot"),
        });
    }
    Some(CondUsage { test, branches: branches.map(|b| b.map(|(el, _)| el)), name: name? })
}

/// The `r:slot` attribute span (for removal from symbol text).
pub fn usage_attr_span<'a>(tree: &Tree<'a>, el: &JSXElement<'a>) -> Option<Span> {
    attribute(tree, el, SLOT).map(|a| a.span)
}

/// Where a `<slot>` reads its content from.
pub struct SlotRef {
    /// Expression text: `props.header` or `header`.
    pub text: String,
    /// The binding read (capture name, declaration).
    pub binding: (String, NodeId),
}

fn outer_function(tree: &Tree, id: NodeId) -> Option<NodeId> {
    let mut top = None;
    let mut n = tree.raw_parent(id);
    while let Some(p) = n {
        if matches!(tree.kind(p), AstKind::Program(_)) {
            break;
        }
        if tree.is_function(p) {
            top = Some(p);
        }
        n = tree.raw_parent(p);
    }
    top
}

fn component_name(tree: &Tree, function: NodeId) -> String {
    if let AstKind::Function(f) = tree.kind(function) {
        if let Some(id) = &f.id {
            return id.name.to_string();
        }
    }
    let mut n = tree.raw_parent(function);
    while let Some(p) = n {
        match tree.kind(p) {
            AstKind::VariableDeclarator(d) => {
                if let BindingPatternKind::BindingIdentifier(i) = &d.id.kind {
                    return i.name.to_string();
                }
                break;
            }
            AstKind::Program(_) | AstKind::ExpressionStatement(_) => break,
            _ => {}
        }
        n = tree.raw_parent(p);
    }
    "the component".into()
}

fn binding(tree: &Tree, ident: &BindingIdentifier) -> Option<(String, NodeId)> {
    let symbol = ident.symbol_id.get()?;
    Some((ident.name.to_string(), tree.decl_of_symbol(symbol)))
}

/// The slot's prop name (`children` for the default slot).
pub fn slot_name<'a>(tree: &Tree<'a>, el: &JSXElement<'a>) -> Result<&'a str, String> {
    match attribute(tree, el, NAME) {
        None => Ok("children"),
        Some(attr) => match attr_string(tree, attr) {
            Some(name) if is_identifier(name) => Ok(name),
            _ => Err("r:name must be a string literal naming a prop (an identifier)".into()),
        },
    }
}

fn is_identifier(name: &str) -> bool {
    let mut chars = name.chars();
    matches!(chars.next(), Some(c) if c == '_' || c == '$' || c.is_ascii_alphabetic())
        && chars.all(|c| c == '_' || c == '$' || c.is_ascii_alphanumeric())
}

/// Resolve a `<slot>` element to the prop it renders.
pub fn slot_ref<'a>(tree: &Tree<'a>, id: NodeId, el: &JSXElement<'a>) -> Result<SlotRef, String> {
    let name = slot_name(tree, el)?;
    let Some(function) = outer_function(tree, id) else {
        return Err("<slot> must be used inside a component function".into());
    };
    let params = match tree.kind(function) {
        AstKind::Function(f) => &f.params,
        AstKind::ArrowFunctionExpression(a) => &a.params,
        _ => return Err("<slot> must be used inside a component function".into()),
    };
    let component = component_name(tree, function);
    let missing = || format!("<slot> needs the component's props parameter: function {component}(props) or function {component}({{ {name} }})");
    let Some(first) = params.items.first() else { return Err(missing()) };
    let mut pattern = &first.pattern;
    if let BindingPatternKind::AssignmentPattern(a) = &pattern.kind {
        pattern = &a.left;
    }
    match &pattern.kind {
        BindingPatternKind::BindingIdentifier(ident) => {
            let binding = binding(tree, ident).ok_or_else(missing)?;
            Ok(SlotRef { text: format!("{}.{name}", ident.name), binding })
        }
        BindingPatternKind::ObjectPattern(object) => {
            for property in &object.properties {
                if property.computed || property.key.static_name().as_deref() != Some(name) {
                    continue;
                }
                let mut value = &property.value;
                if let BindingPatternKind::AssignmentPattern(a) = &value.kind {
                    value = &a.left;
                }
                if let BindingPatternKind::BindingIdentifier(ident) = &value.kind {
                    let binding = binding(tree, ident).ok_or_else(missing)?;
                    return Ok(SlotRef { text: ident.name.to_string(), binding });
                }
            }
            if let Some(rest) = &object.rest {
                if let BindingPatternKind::BindingIdentifier(ident) = &rest.argument.kind {
                    let binding = binding(tree, ident).ok_or_else(missing)?;
                    return Ok(SlotRef { text: format!("{}.{name}", ident.name), binding });
                }
            }
            Err(format!("<slot r:name=\"{name}\">: add `{name}` to the destructured props of {component}"))
        }
        _ => Err(missing()),
    }
}

/// `r:args={[a, b]}` elements; None without the attribute.
pub fn slot_args<'b, 'a>(tree: &Tree<'a>, el: &'b JSXElement<'a>) -> Option<Result<Vec<&'b Expression<'a>>, &'static str>> {
    let attr = attribute(tree, el, ARGS)?;
    let error = "r:args must be an array literal: r:args={[item, index]}";
    let Some(JSXAttributeValue::ExpressionContainer(c)) = &attr.value else { return Some(Err(error)) };
    let Some(Expression::ArrayExpression(array)) = c.expression.as_expression() else { return Some(Err(error)) };
    let mut out = Vec::new();
    for element in &array.elements {
        match element.as_expression() {
            Some(e) => out.push(e),
            None => return Some(Err(error)),
        }
    }
    Some(Ok(out))
}

/// The lowered form of a slot as source text: `p`, `p ?? (fallback)`, `p != null ? p(args) : (fallback)`.
pub fn lowered(prop: &str, args: Option<&[String]>, fallback: Option<&str>) -> String {
    match (args, fallback) {
        (Some(args), fallback) => format!("{prop} != null ? {prop}({}) : ({})", args.join(", "), fallback.unwrap_or("null")),
        (None, Some(fallback)) => format!("{prop} ?? ({fallback})"),
        (None, None) => prop.to_string(),
    }
}

/// Source text of `root` with every Rivet `<slot>` inside replaced by its lowered form (and, for a
/// usage element, its own `r:slot` attribute removed). None when nothing changes.
pub fn rewrite(tree: &Tree, root: NodeId, strip_usage: bool) -> Option<String> {
    rewrite_edits(tree, root, strip_usage, &[])
}

/// `rewrite` plus `extra` span edits (Function Bridge T8: cell references `x` → `x.v`); `None` when nothing changes.
/// An extra edit inside a lowered `<slot>` element is dropped (`resume/cells.rs` never boxes such a binding).
pub fn rewrite_edits(tree: &Tree, root: NodeId, strip_usage: bool, extra: &[(Span, String)]) -> Option<String> {
    if let AstKind::JSXElement(el) = tree.kind(root) {
        if is_slot(tree, Some(root), el) {
            return slot_text(tree, root, el, true);
        }
    }
    let mut edits: Vec<(Span, String)> = extra.to_vec();
    if strip_usage {
        if let AstKind::JSXElement(el) = tree.kind(root) {
            if let Some(span) = usage_attr_span(tree, el) {
                edits.push((span, String::new()));
            }
        }
    }
    collect(tree, root, &mut edits);
    if edits.is_empty() {
        return None;
    }
    edits.sort_by_key(|(span, _)| span.start);
    Some(splice(tree, tree.span(root), &edits))
}

/// Source text spanning sibling JSX children `members` (first start to last end) wrapped in a
/// fragment, with every Rivet `<slot>` inside replaced by its lowered form: the body of a lazy
/// children slot symbol (`() => (<>…</>)`).
/// T8: plus `extra` span edits (cell references).
pub fn rewrite_fragment_edits(tree: &Tree, members: &[NodeId], extra: &[(Span, String)]) -> String {
    let mut edits: Vec<(Span, String)> = extra.to_vec();
    for &member in members {
        collect(tree, member, &mut edits);
    }
    edits.sort_by_key(|(span, _)| span.start);
    let span = Span::new(tree.span(members[0]).start, tree.span(members[members.len() - 1]).end);
    format!("<>{}</>", splice(tree, span, &edits))
}

/// Source text of `span` with sorted, non-overlapping `edits` applied (T8 cell references in an expression child).
pub fn splice_edits(tree: &Tree, span: Span, edits: &[(Span, String)]) -> String {
    splice(tree, span, edits)
}

fn splice(tree: &Tree, span: Span, edits: &[(Span, String)]) -> String {
    let mut out = String::new();
    let mut pos = span.start;
    for (edit, text) in edits {
        if edit.start < pos || edit.end > span.end {
            continue;
        }
        out.push_str(tree.text_of(Span::new(pos, edit.start)));
        out.push_str(text);
        pos = edit.end;
    }
    out.push_str(tree.text_of(Span::new(pos, span.end)));
    out
}

/// Outermost slot elements under `id` (fallbacks are rewritten recursively).
fn collect(tree: &Tree, id: NodeId, edits: &mut Vec<(Span, String)>) {
    tree.walk(id, &mut |n| {
        let AstKind::JSXElement(el) = tree.kind(n) else { return true };
        if !is_slot(tree, Some(n), el) {
            return true;
        }
        if let Some(text) = slot_text(tree, n, el, false) {
            edits.push((tree.span(n), text));
        }
        false
    });
}

fn slot_text<'a>(tree: &Tree<'a>, id: NodeId, el: &JSXElement<'a>, force_expression: bool) -> Option<String> {
    let reference = slot_ref(tree, id, el).ok()?;
    let args: Option<Vec<String>> = match slot_args(tree, el) {
        None => None,
        Some(Ok(list)) => Some(list.iter().map(|e| tree.text_of(e.span()).to_string()).collect()),
        Some(Err(_)) => return None,
    };
    let fallback = el.closing_element.as_ref().map(|closing| {
        let inner = Span::new(el.opening_element.span.end, closing.span.start);
        let mut edits = Vec::new();
        for &child in tree.children(id) {
            if tree.span(child).start >= inner.start && tree.span(child).end <= inner.end {
                collect(tree, child, &mut edits);
            }
        }
        edits.sort_by_key(|(span, _)| span.start);
        splice(tree, inner, &edits)
    });
    let fallback = fallback.filter(|f| !f.trim().is_empty()).map(|f| format!("<>{f}</>"));
    let expression = lowered(&reference.text, args.as_deref(), fallback.as_deref());
    let child = !force_expression && matches!(tree.parent_kind(id), Some(AstKind::JSXElement(_) | AstKind::JSXFragment(_)));
    Some(if child { format!("{{{expression}}}") } else { format!("({expression})") })
}
