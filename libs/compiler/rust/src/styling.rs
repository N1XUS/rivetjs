//! `class:` / `style:` directives, class objects / arrays and style objects (G10): the element's
//! class and style groups, literal folding and the CSS value rule shared with
//! libs/runtime/style.ts (same property shapes, same refused values, same merge order).

use oxc_ast::AstKind;
use oxc_ast::ast::*;

use crate::compile::{attr_name, attr_string};
use crate::entities::decode_html;
use crate::tree::Tree;

/// A directive / object value: a literal known at compile time, or an expression.
pub enum Val<'a> {
    Bool(bool),
    Str(String),
    /// A plain decimal number literal, as JavaScript prints it.
    Num(String),
    Expr(&'a Expression<'a>),
}

/// `class:name={value}` (or a static key of a class object literal).
pub struct Toggle<'a> {
    pub name: String,
    pub value: Val<'a>,
}

pub enum Base<'a> {
    /// A literal class list (strings, literal arrays / objects joined at compile time).
    Static(String),
    /// Normalized at runtime (`_class`): a dynamic string, an array, an object with dynamic keys.
    Expr(&'a Expression<'a>),
}

pub struct ClassGroup<'a> {
    /// Attribute index of the first member.
    pub first: usize,
    pub base: Option<Base<'a>>,
    pub toggles: Vec<Toggle<'a>>,
}

pub enum Entry<'a> {
    /// One property (CSS name, kebab-case or `--custom`).
    Prop(String, Val<'a>),
    /// A style object read at runtime (dynamic keys, spreads, a non-literal expression).
    Object(&'a Expression<'a>),
}

pub struct StyleGroup<'a> {
    pub first: usize,
    pub entries: Vec<Entry<'a>>,
}

pub struct Groups<'a> {
    pub class: Option<ClassGroup<'a>>,
    pub style: Option<StyleGroup<'a>>,
    /// Attribute indices owned by a group (not lowered as plain attributes).
    pub members: Vec<usize>,
    /// (message, attribute index).
    pub errors: Vec<(String, usize)>,
}

pub const STYLE_STRING: &str = "style strings are not supported: use a style object (style={{ color: c, \"--x\": v }}) or style:color={c}";
pub const CLASS_TWICE: &str = "Use one class attribute (class or className) per element";

pub fn unsafe_message(property: &str) -> String {
    format!(
        "Unsafe style value for {property}: url(), src(), image-set(), expression(), javascript: and \\ ; {{ }} /* are not allowed in style values"
    )
}

/// `class:` / `style:` directive or a `style` attribute: never a plain attribute.
pub fn directive(name: &str) -> bool {
    name.starts_with("class:") || name.starts_with("style:") || name == "style"
}

/// On a spread element, an attribute kept out of the spread object: `class:` / `style:` directives,
/// and `style` only next to `style:` directives (grouped with them); a lone `style` object merges into
/// the spread object (later keys win, one `style` attribute).
pub fn spread_directive<'a>(tree: &Tree<'a>, attr: &JSXAttribute<'a>) -> bool {
    let name = attr_name(tree, attr);
    name.starts_with("class:") || name.starts_with("style:") || (name == "style" && !lone_style(tree, attr))
}

/// A `style` attribute of an element with no `style:` directive.
fn lone_style<'a>(tree: &Tree<'a>, attr: &JSXAttribute<'a>) -> bool {
    let mut id = tree.id_of(attr);
    while let Some(node) = id {
        if let AstKind::JSXOpeningElement(opening) = tree.kind(node) {
            return !opening.attributes.iter().any(|item| {
                matches!(item, JSXAttributeItem::Attribute(a) if attr_name(tree, a).starts_with("style:"))
            });
        }
        id = tree.raw_parent(node);
    }
    false
}

fn strip<'b, 'a>(mut e: &'b Expression<'a>) -> &'b Expression<'a> {
    while let Expression::ParenthesizedExpression(p) = e {
        e = &p.expression;
    }
    e
}

fn container<'a>(attr: &'a JSXAttribute<'a>) -> Option<&'a Expression<'a>> {
    match &attr.value {
        Some(JSXAttributeValue::ExpressionContainer(c)) => c.expression.as_expression().map(strip),
        _ => None,
    }
}

/// A class object / array literal: normalized like `cx()`.
pub fn class_literal(e: &Expression) -> bool {
    matches!(strip(e), Expression::ObjectExpression(_) | Expression::ArrayExpression(_))
}

/// Whether the element has a class / style group (cheap pre-check; `spread`: a `class` value merges
/// into the spread object instead). Two class attributes (`class` + `className`) also group, so
/// `analyze` reports `CLASS_TWICE` (C15: the server kept the first, DOM v2 applied the last).
pub fn active<'a>(tree: &Tree<'a>, el: &'a JSXElement<'a>, spread: bool) -> bool {
    el.opening_element.attributes.iter().any(|item| match item {
        JSXAttributeItem::Attribute(attr) => {
            let name = attr_name(tree, attr);
            directive(name)
                || (!spread && (name == "class" || name == "className") && container(attr).is_some_and(class_literal))
        }
        JSXAttributeItem::SpreadAttribute(_) => false,
    }) || (!spread && class_count(tree, el) > 1)
}

fn class_count<'a>(tree: &Tree<'a>, el: &'a JSXElement<'a>) -> usize {
    el.opening_element
        .attributes
        .iter()
        .filter(|item| matches!(item, JSXAttributeItem::Attribute(attr) if matches!(attr_name(tree, attr), "class" | "className")))
        .count()
}

/// C14: a number on a property outside React's unitless list gets `px` (0 and `--custom` stay as
/// written). Same list as libs/runtime/style.ts `UNITLESS` (vendor prefixes stripped first).
const UNITLESS: &[&str] = &[
    "animation-iteration-count", "aspect-ratio", "border-image-outset", "border-image-slice", "border-image-width", "box-flex",
    "box-flex-group", "box-ordinal-group", "column-count", "columns", "flex", "flex-grow", "flex-positive", "flex-shrink",
    "flex-negative", "flex-order", "grid-area", "grid-row", "grid-row-end", "grid-row-span", "grid-row-start", "grid-column",
    "grid-column-end", "grid-column-span", "grid-column-start", "font-weight", "line-clamp", "line-height", "opacity", "order",
    "orphans", "scale", "tab-size", "widows", "z-index", "zoom", "fill-opacity", "flood-opacity", "stop-opacity",
    "stroke-dasharray", "stroke-dashoffset", "stroke-miterlimit", "stroke-opacity", "stroke-width",
];

/// The CSS text of a number literal on `property` (`_styleValue` rule).
pub fn number_value(property: &str, number: &str) -> String {
    let bare = ["-webkit-", "-moz-", "-ms-", "-o-"].iter().find_map(|p| property.strip_prefix(p)).unwrap_or(property);
    if number == "0" || property.starts_with("--") || UNITLESS.contains(&bare) {
        number.to_string()
    } else {
        format!("{number}px")
    }
}

/// A style entry's value: number literals get their unit (`number_value`).
fn style_entry<'a>(property: String, value: Val<'a>) -> Entry<'a> {
    match value {
        Val::Num(n) => {
            let text = number_value(&property, &n);
            Entry::Prop(property, Val::Num(text))
        }
        value => Entry::Prop(property, value),
    }
}

/// Number literal as JavaScript prints it (plain decimals only).
fn number_text(tree: &Tree, n: &NumericLiteral) -> Option<String> {
    let raw = tree.text_of(n.span);
    let digits = |s: &str| !s.is_empty() && s.bytes().all(|b| b.is_ascii_digit());
    let plain = match raw.split_once('.') {
        None => digits(raw) && (raw == "0" || !raw.starts_with('0')),
        Some((int, frac)) => digits(int) && (int == "0" || !int.starts_with('0')) && digits(frac) && !frac.ends_with('0'),
    };
    plain.then(|| raw.to_string())
}

fn literal<'a>(tree: &Tree<'a>, e: &'a Expression<'a>) -> Val<'a> {
    match strip(e) {
        Expression::StringLiteral(s) => Val::Str(s.value.to_string()),
        Expression::BooleanLiteral(b) => Val::Bool(b.value),
        Expression::NullLiteral(_) => Val::Bool(false),
        Expression::Identifier(i) if i.name == "undefined" => Val::Bool(false),
        Expression::NumericLiteral(n) => match number_text(tree, n) {
            Some(text) => Val::Num(text),
            None => Val::Expr(e),
        },
        _ => Val::Expr(e),
    }
}

fn truthy(v: &Val) -> Option<bool> {
    match v {
        Val::Bool(b) => Some(*b),
        Val::Str(s) => Some(!s.is_empty()),
        Val::Num(n) => Some(n != "0"),
        Val::Expr(_) => None,
    }
}

/// A static object key (identifier / string), as written.
fn static_key<'a>(p: &'a ObjectProperty<'a>) -> Option<String> {
    if p.computed || p.method || p.kind != PropertyKind::Init {
        return None;
    }
    match &p.key {
        PropertyKey::StaticIdentifier(i) => Some(i.name.to_string()),
        PropertyKey::StringLiteral(s) => Some(s.value.to_string()),
        _ => None,
    }
}

/// Static object properties (key, value) or None when any key is dynamic / a spread / a method.
fn static_props<'a>(object: &'a ObjectExpression<'a>) -> Option<Vec<(String, &'a Expression<'a>)>> {
    object
        .properties
        .iter()
        .map(|p| match p {
            ObjectPropertyKind::ObjectProperty(p) => static_key(p).map(|k| (k, &p.value)),
            ObjectPropertyKind::SpreadProperty(_) => None,
        })
        .collect()
}

/// A class value made of literals only, joined like the runtime (`_class` without toggles).
fn static_class<'a>(tree: &Tree<'a>, e: &'a Expression<'a>, out: &mut Vec<String>) -> bool {
    match strip(e) {
        Expression::ArrayExpression(a) => a.elements.iter().all(|item| match item {
            ArrayExpressionElement::SpreadElement(_) | ArrayExpressionElement::Elision(_) => false,
            item => item.as_expression().is_some_and(|e| static_class(tree, e, out)),
        }),
        Expression::ObjectExpression(o) => match static_props(o) {
            None => false,
            Some(props) => props.into_iter().all(|(key, value)| match truthy(&literal(tree, value)) {
                Some(on) => {
                    if on {
                        out.push(key);
                    }
                    true
                }
                None => false,
            }),
        },
        e => match literal(tree, e) {
            value @ (Val::Str(_) | Val::Num(_)) => {
                if truthy(&value) == Some(true) {
                    let (Val::Str(s) | Val::Num(s)) = value else { unreachable!() };
                    out.push(s);
                }
                true
            }
            Val::Bool(_) => true,
            Val::Expr(_) => false,
        },
    }
}

/// CSS property of a style key: `--custom` as written, camelCase → kebab-case; None when invalid.
pub fn css_property(key: &str) -> Option<String> {
    let name = if key.starts_with("--") {
        key.to_string()
    } else {
        let mut out = String::with_capacity(key.len() + 2);
        for c in key.chars() {
            if c.is_ascii_uppercase() {
                out.push('-');
                out.push(c.to_ascii_lowercase());
            } else {
                out.push(c);
            }
        }
        out
    };
    let valid = if let Some(rest) = name.strip_prefix("--") {
        !rest.is_empty() && rest.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
    } else {
        let body = name.strip_prefix('-').unwrap_or(&name);
        body.starts_with(|c: char| c.is_ascii_lowercase()) && body.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
    };
    valid.then_some(name)
}

/// Same rule as `unsafeStyle` (libs/runtime/style.ts): ignoring case, whitespace and controls, no
/// `\ ; { } /*`, `url(`, `src(`, `image-set(`, `expression(` or `javascript:`.
pub fn unsafe_style(value: &str) -> bool {
    let compact: String = value.chars().filter(|c| !c.is_whitespace() && *c > '\u{1f}').collect::<String>().to_lowercase();
    compact.contains(['\\', ';', '{', '}'])
        || ["/*", "url(", "src(", "image-set(", "expression(", "javascript:"].iter().any(|p| compact.contains(p))
}

fn attribute_value<'a>(tree: &Tree<'a>, attr: &'a JSXAttribute<'a>) -> Option<Val<'a>> {
    match &attr.value {
        None => None,
        Some(JSXAttributeValue::StringLiteral(_)) => Some(Val::Str(attr_string(tree, attr).map(decode_html).unwrap_or_default())),
        Some(JSXAttributeValue::ExpressionContainer(c)) => match c.expression.as_expression() {
            Some(e) => Some(literal(tree, e)),
            None => Some(Val::Bool(false)),
        },
        Some(_) => Some(Val::Bool(false)),
    }
}

/// The element's class and style groups; None when it has neither (output unchanged).
pub fn analyze<'a>(tree: &Tree<'a>, el: &'a JSXElement<'a>, spread: bool, fold: &dyn Fn(&'a JSXAttribute<'a>) -> Option<String>) -> Option<Groups<'a>> {
    if !active(tree, el, spread) {
        return None;
    }
    let mut groups = Groups { class: None, style: None, members: Vec::new(), errors: Vec::new() };
    let class_active = el.opening_element.attributes.iter().any(|item| match item {
        JSXAttributeItem::Attribute(attr) => {
            let name = attr_name(tree, attr);
            name.starts_with("class:") || (!spread && (name == "class" || name == "className") && container(attr).is_some_and(class_literal))
        }
        JSXAttributeItem::SpreadAttribute(_) => false,
    }) || (!spread && class_count(tree, el) > 1);
    let mut bases = 0;
    for (index, item) in el.opening_element.attributes.iter().enumerate() {
        let JSXAttributeItem::Attribute(attr) = item else { continue };
        let attr: &'a JSXAttribute<'a> = attr;
        let name = attr_name(tree, attr);
        if let Some(class) = name.strip_prefix("class:") {
            let value = match attribute_value(tree, attr) {
                None => Val::Bool(true),
                Some(value) => match truthy(&value) {
                    Some(on) => Val::Bool(on),
                    None => value,
                },
            };
            let group = groups.class.get_or_insert(ClassGroup { first: index, base: None, toggles: Vec::new() });
            group.toggles.push(Toggle { name: class.to_string(), value });
            groups.members.push(index);
        } else if class_active && !spread && (name == "class" || name == "className") {
            bases += 1;
            if bases > 1 {
                groups.errors.push((CLASS_TWICE.into(), index));
            }
            let group = groups.class.get_or_insert(ClassGroup { first: index, base: None, toggles: Vec::new() });
            groups.members.push(index);
            if let Some(text) = fold(attr) {
                group.base = Some(Base::Static(text));
                continue;
            }
            match (&attr.value, container(attr)) {
                (None, _) => group.base = Some(Base::Static(String::new())),
                (Some(JSXAttributeValue::StringLiteral(_)), _) => {
                    group.base = Some(Base::Static(attr_string(tree, attr).map(decode_html).unwrap_or_default()))
                }
                (_, Some(e)) => {
                    let mut names = Vec::new();
                    let toggles = match e {
                        Expression::ObjectExpression(o) => {
                            static_props(o).filter(|props| props.iter().all(|(k, _)| !k.is_empty() && !k.contains(char::is_whitespace)))
                        }
                        _ => None,
                    };
                    if let Some(props) = toggles {
                        for (key, value) in props {
                            let value = literal(tree, value);
                            let value = match truthy(&value) {
                                Some(on) => Val::Bool(on),
                                None => value,
                            };
                            group.toggles.push(Toggle { name: key, value });
                        }
                    } else if static_class(tree, e, &mut names) {
                        group.base = Some(Base::Static(names.join(" ")));
                    } else {
                        group.base = Some(Base::Expr(e));
                    }
                }
                _ => {}
            }
        } else if let Some(key) = name.strip_prefix("style:") {
            groups.members.push(index);
            let group = groups.style.get_or_insert(StyleGroup { first: index, entries: Vec::new() });
            let Some(property) = css_property(key) else {
                groups.errors.push((format!("Invalid style property: {key}"), index));
                continue;
            };
            match attribute_value(tree, attr) {
                None => groups.errors.push((format!("style:{key} needs a value"), index)),
                Some(Val::Str(text)) if unsafe_style(&text) => groups.errors.push((unsafe_message(&property), index)),
                Some(value) => group.entries.push(style_entry(property, value)),
            }
        } else if name == "style" {
            // Spread element without `style:` directives: `style` merges into the spread object
            // (compile.rs `spread_object`), so it is checked here but not grouped.
            let mut merged = StyleGroup { first: index, entries: Vec::new() };
            let group = if spread && lone_style(tree, attr) {
                &mut merged
            } else {
                groups.members.push(index);
                groups.style.get_or_insert(StyleGroup { first: index, entries: Vec::new() })
            };
            let Some(e) = container(attr) else {
                groups.errors.push((STYLE_STRING.into(), index));
                continue;
            };
            match e {
                Expression::StringLiteral(_) | Expression::TemplateLiteral(_) => groups.errors.push((STYLE_STRING.into(), index)),
                Expression::ObjectExpression(o) => match static_props(o) {
                    Some(props) => {
                        for (key, value) in props {
                            let Some(property) = css_property(&key) else {
                                groups.errors.push((format!("Invalid style property: {key}"), index));
                                continue;
                            };
                            match literal(tree, value) {
                                Val::Str(text) if unsafe_style(&text) => groups.errors.push((unsafe_message(&property), index)),
                                value => group.entries.push(style_entry(property, value)),
                            }
                        }
                    }
                    None => group.entries.push(Entry::Object(e)),
                },
                e => group.entries.push(Entry::Object(e)),
            }
        }
    }
    Some(groups)
}

/// Class tokens of `_class(base, toggles)` when every part is literal; None: dynamic. The inner
/// Option is the attribute value (None: no attribute).
pub fn static_class_value(group: &ClassGroup) -> Option<Option<String>> {
    let base = match &group.base {
        None => String::new(),
        Some(Base::Static(text)) => text.clone(),
        Some(Base::Expr(_)) => return None,
    };
    let mut toggles: Vec<(&str, bool)> = Vec::new();
    for toggle in &group.toggles {
        let Val::Bool(on) = toggle.value else { return None };
        match toggles.iter_mut().find(|(n, _)| *n == toggle.name) {
            Some(entry) => entry.1 = on,
            None => toggles.push((&toggle.name, on)),
        }
    }
    if toggles.is_empty() {
        return Some((!base.is_empty()).then_some(base));
    }
    let mut tokens: Vec<String> = base.split(['\t', '\n', '\u{c}', '\r', ' ']).filter(|t| !t.is_empty()).map(str::to_string).collect();
    for (name, on) in toggles {
        if on {
            if !tokens.iter().any(|t| t == name) {
                tokens.push(name.to_string());
            }
        } else {
            tokens.retain(|t| t != name);
        }
    }
    Some((!tokens.is_empty()).then(|| tokens.join(" ")))
}

/// The `style` attribute value when every entry is literal (`_style` order: a property sits at its
/// last write); None: dynamic. Inner None: no property set.
pub fn static_style_value(group: &StyleGroup) -> Option<Option<String>> {
    let mut seen: Vec<(&str, String)> = Vec::new();
    for entry in &group.entries {
        let Entry::Prop(name, value) = entry else { return None };
        let text = match value {
            Val::Str(text) | Val::Num(text) if !text.is_empty() => Some(text.clone()),
            Val::Str(_) | Val::Num(_) | Val::Bool(_) => None,
            Val::Expr(_) => return None,
        };
        seen.retain(|(n, _)| n != name);
        if let Some(text) = text {
            seen.push((name, text));
        }
    }
    let out: Vec<String> = seen.into_iter().map(|(n, v)| format!("{n}:{v}")).collect();
    Some((!out.is_empty()).then(|| out.join(";")))
}
