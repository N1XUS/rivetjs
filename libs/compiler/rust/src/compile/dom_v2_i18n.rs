//! DOM v2 lowering of i18n static calls (`t()`, spec docs/design/specs/2026-10-06-dom-v2-only-design.md
//! §2.5, lane V2-I18N): element children, attributes (the DOM side of `compile.rs` `static_attribute`) and
//! the DOM branch of `case_template` (plural / select cases and value-position messages holding tags). Message lookup,
//! validation, diagnostics and formatter printing stay shared (`static_call`, `message`, `prefix_value`,
//! `message_value`, `message_in`, `formatter_js`).
//!
//! - Child position: static message text joins the parent template (`Child::Text`); params and
//!   plural / select / number / date parts are inserted values (`Child::Value`; an accessor when the
//!   expression can read state); a tag part (`<b>…</b>`, a `link: (c) => <a>{c}</a>` param) is inline
//!   markup (`Child::Markup`) whose inner values insert at `<!>` markers (sole / last children: no marker).
//! - Attribute: a static message is template attribute text; anything else one writer call (an effect
//!   when an argument can read state).
//! - Case / value templates: their own `_tpl` (one root element: flag 0; several nodes: flag 4, returned
//!   as a node array so the content can be inserted again, like a v1 range).

use super::*;

/// An inserted value's position while message markup is built (private use; `map.rs` owns U+E000 / U+E001).
/// The same character in message text or tag markup is written as a character reference (`safe`).
const HOLE: char = '\u{E002}';

/// `text` with any `HOLE` character as `&#xE002;` (parses back to the same character).
fn safe(text: &str) -> std::borrow::Cow<'_, str> {
    if text.contains(HOLE) { text.replace(HOLE, "&#xE002;").into() } else { text.into() }
}

/// Message markup under construction: escaped template HTML with a `HOLE` per inserted value.
#[derive(Default)]
struct Markup {
    html: String,
    /// Printed value, accessor (wrapped in a thunk, the insertion tracks it).
    values: Vec<(String, bool)>,
}

impl Markup {
    fn hole(&mut self, value: String, accessor: bool) {
        self.html.push(HOLE);
        self.values.push((value, accessor));
    }
}

fn push_text<'a>(items: &mut Vec<Child<'a>>, text: &str) {
    if text.is_empty() {
        return;
    }
    match items.last_mut() {
        Some(Child::Text(previous)) => previous.push_str(text),
        _ => items.push(Child::Text(text.to_string())),
    }
}

/// `x` / `(x)`: a parameter local or a plain reference (written once; a function value still binds as an accessor at runtime).
fn plain_reference(text: &str) -> bool {
    let mut inner = text.trim();
    while inner.starts_with('(') && inner.ends_with(')') {
        inner = inner[1..inner.len() - 1].trim();
    }
    let mut chars = inner.chars();
    matches!(chars.next(), Some(c) if c.is_ascii_alphabetic() || c == '_' || c == '$') && chars.all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '$')
}

impl<'t, 'a> Compiler<'t, 'a> {
    /// A static call (`t(…)` / `t.in(…)` through a static-call binding) none of whose arguments can read
    /// state: its value is fixed at creation, so fragments / component props need no accessor for it.
    pub(super) fn v2_static_message(&self, e: &Expression<'a>) -> bool {
        if !self.i18n {
            return false;
        }
        let Expression::CallExpression(call) = strip_parens(e) else { return false };
        let callee = match &call.callee {
            Expression::Identifier(i) => i,
            Expression::StaticMemberExpression(m) if m.property.name == "in" => match &m.object {
                Expression::Identifier(i) => i,
                _ => return false,
            },
            _ => return false,
        };
        self.tree.resolve(callee, false).is_some_and(|decl| self.static_bindings.contains_key(&decl))
            && call.arguments.iter().all(|a| a.as_expression().is_some_and(|e| !dynamic(e)))
    }

    /// `{t("k", params)}` / `` {t(`p.${x}`)} `` as a native element child: message items appended to
    /// `items`. False: not a static call (`t.in` included: an ordinary value).
    pub(super) fn v2_static_child(&mut self, e: &'a Expression<'a>, items: &mut Vec<Child<'a>>) -> bool {
        let Expression::CallExpression(call) = strip_parens(e) else { return false };
        let id = self.id(&**call);
        match self.static_call(call, id) {
            None | Some(Ok((_, Matched::In(..), _))) => false,
            Some(Err(())) => true,
            Some(Ok((index, Matched::Prefix(prefix, key), params))) => {
                let accessor = dynamic(key);
                let value = self.prefix_value(index, &prefix, key, params, id);
                items.push(Child::Value { value, accessor, scalar: true, source: None });
                true
            }
            Some(Ok((index, Matched::Key(key), params))) => {
                if let Some(message) = self.message(index, &key, params, id) {
                    self.v2_message(index, &message, items, id);
                }
                true
            }
        }
    }

    /// The compiled variant's parts as child items (v1 `dom_message` / `dom_parts`): each part reads its
    /// params where it is written, in the variant's order (locales may reorder).
    fn v2_message(&mut self, index: usize, message: &Message<'a>, items: &mut Vec<Child<'a>>, id: Option<NodeId>) {
        let v = self.variant.unwrap_or(0);
        if let Some(texts) = &message.texts {
            push_text(items, &texts[v]);
            return;
        }
        let args: Vec<(String, Expr, bool)> = message.params.iter().map(|(n, e)| (n.clone(), self.expr(e), dynamic(e))).collect();
        let arg = |name: &str| args.iter().find(|(n, _, _)| n == name).map(|(_, e, d)| (e.clone(), *d)).unwrap_or((Expr::VoidZero, false));
        let value = |name: &str| {
            let (e, d) = arg(name);
            (e.print(), d)
        };
        let param = |name: &str| format!("({})", arg(name).0.print());
        // A formatter (cases included) is an accessor when a param it reads can read state.
        let formatter = |part: &Part| {
            let mut usage = BTreeMap::new();
            i18n::usage(std::slice::from_ref(part), false, &mut usage);
            usage.iter().any(|(name, u)| !u.tag && arg(name).1)
        };
        let parts = message.variants[v].clone();
        let names = self.message_names(index, &[&parts]);
        for part in &parts {
            match part {
                Part::Text { t } => push_text(items, t),
                Part::Arg { a } => {
                    let (value, accessor) = arg(a);
                    items.push(Child::Value { value, accessor, scalar: false, source: None });
                }
                Part::Tag { .. } => {
                    let mut markup = Markup::default();
                    if let Err(tag) = self.v2_markup_parts(std::slice::from_ref(part), v, &value, &param, &formatter, &names, &message.tags, &mut markup) {
                        self.diag(format!("Message tag {tag} in \"{}\" cannot be lowered here", message.key), id);
                        return;
                    }
                    let (html, nodes, statements) = self.v2_markup(markup);
                    items.push(Child::Markup { html, nodes, statements });
                }
                _ => match self.formatter_js(part, v, &param, &names, &message.tags) {
                    // Plural / select cases holding tags evaluate to nodes (`case_template_v2`); others to strings.
                    Ok(text) => items.push(Child::Value { value: Expr::Raw(text), accessor: formatter(part), scalar: !i18n::part_has_tag(part), source: None }),
                    Err(tag) => {
                        self.diag(format!("Message tag {tag} in \"{}\" cannot be lowered here", message.key), id);
                        return;
                    }
                },
            }
        }
    }

    /// Parts into `markup`: text and tag markup as HTML, args (`value`: printed, accessor) and formatters
    /// (`formatter_accessor(part)`) as holes. Err: a tag that cannot be lowered (from `formatter_js`).
    #[allow(clippy::too_many_arguments)]
    fn v2_markup_parts(
        &mut self,
        parts: &[Part],
        v: usize,
        value: &dyn Fn(&str) -> (String, bool),
        param: &dyn Fn(&str) -> String,
        formatter_accessor: &dyn Fn(&Part) -> bool,
        names: &i18n::Names,
        tags: &FxHashMap<String, (String, String)>,
        markup: &mut Markup,
    ) -> Result<(), String> {
        for part in parts {
            match part {
                Part::Text { t } => markup.html.push_str(&safe(&escaped(t))),
                Part::Arg { a } => {
                    let (printed, accessor) = value(a);
                    markup.hole(printed, accessor);
                }
                Part::Tag { tag, c } => {
                    let (open, close) = tags.get(tag).cloned().unwrap_or_default();
                    markup.html.push_str(&safe(&open));
                    self.v2_markup_parts(c, v, value, param, formatter_accessor, names, tags, markup)?;
                    markup.html.push_str(&safe(&close));
                }
                _ => {
                    let js = self.formatter_js(part, v, param, names, tags)?;
                    markup.hole(js, formatter_accessor(part));
                }
            }
        }
        Ok(())
    }

    /// Template HTML, walk nodes and insert statements of `markup`. Its HTML is compiler output (tags from
    /// `static_markup` / `MESSAGE_TAGS`, escaped text and attribute values), so a scan for `<`, `</`, `>`
    /// and holes recovers the element structure. A hole that is its element's only child writes it like
    /// `walk_v2`'s sole child (`_fx` + `_t` / `_textValue`), its last child appends to it; any other hole
    /// gets a `<!>` marker (top-level holes insert relative to the marker alone).
    fn v2_markup(&mut self, markup: Markup) -> (String, Vec<VNode>, Vec<String>) {
        let mut html = String::new();
        let mut statements = Vec::new();
        let mut stack: Vec<(Vec<VNode>, Option<String>)> = vec![(Vec::new(), None)];
        let mut values = markup.values.into_iter();
        let src = markup.html.as_str();
        let mut at = 0;
        while at < src.len() {
            let rest = &src[at..];
            if rest.starts_with(HOLE) {
                at += HOLE.len_utf8();
                let (value, accessor) = values.next().unwrap_or_default();
                let nested = stack.len() > 1;
                // The element's only child (`<b>{name}</b>`): `walk_v2`'s sole-child writers (no marker, no slot).
                let sole = nested && stack.last().is_some_and(|(children, _)| children.is_empty()) && src[at..].starts_with("</");
                let printed = if accessor && !sole { format!("() => {value}") } else { value };
                let parent = if nested {
                    match stack.last().and_then(|(_, var)| var.clone()) {
                        Some(var) => var,
                        None => {
                            let var = self.v2_var();
                            if let Some((_, slot)) = stack.last_mut() {
                                *slot = Some(var.clone());
                            }
                            var
                        }
                    }
                } else {
                    "null".to_string()
                };
                if sole && accessor {
                    // A read that throws empties the element, then rethrows (as `walk_v2`).
                    let (fx, t) = (self.v2("_fx"), self.v2("_t"));
                    let error = self.unique("__rivetError");
                    statements.push(format!(
                        "{fx}(() => {{\ntry {{\n{t}({parent}, {printed});\n}} catch ({error}) {{\n{t}({parent}, null);\nthrow {error};\n}}\n}})"
                    ));
                } else if sole {
                    statements.push(format!("{}({parent}, {printed})", self.v2("_textValue")));
                } else if nested && src[at..].starts_with("</") {
                    statements.push(format!("{}({parent}, {printed}, null)", self.v2("_insert")));
                } else {
                    let insert = self.v2("_insert");
                    let marker = self.v2_var();
                    html.push_str("<!>");
                    if let Some((children, _)) = stack.last_mut() {
                        children.push(VNode::Marker { var: marker.clone() });
                    }
                    statements.push(format!("{insert}({parent}, {printed}, {marker})"));
                }
            } else if rest.starts_with('<') {
                let end = rest.find('>').map_or(rest.len(), |e| e + 1);
                html.push_str(&rest[..end]);
                at += end;
                if rest.starts_with("</") {
                    if stack.len() > 1 {
                        if let Some((children, var)) = stack.pop() {
                            if let Some((parent, _)) = stack.last_mut() {
                                parent.push(VNode::Element { children, var });
                            }
                        }
                    }
                    continue;
                }
                let name: String = rest[1..].chars().take_while(|c| !c.is_whitespace() && *c != '>' && *c != '/').collect();
                if VOID_TAGS.contains(&name.as_str()) {
                    if let Some((children, _)) = stack.last_mut() {
                        children.push(VNode::Element { children: Vec::new(), var: None });
                    }
                } else {
                    stack.push((Vec::new(), None));
                }
            } else {
                let end = rest.find(['<', HOLE]).unwrap_or(rest.len());
                html.push_str(&rest[..end]);
                at += end;
                if let Some((children, _)) = stack.last_mut() {
                    if !matches!(children.last(), Some(VNode::Text)) {
                        children.push(VNode::Text);
                    }
                }
            }
        }
        while stack.len() > 1 {
            if let Some((children, var)) = stack.pop() {
                if let Some((parent, _)) = stack.last_mut() {
                    parent.push(VNode::Element { children, var });
                }
            }
        }
        let nodes = stack.pop().map(|(children, _)| children).unwrap_or_default();
        (html, nodes, statements)
    }

    /// `case_template`'s DOM branch (`compile.rs` calls it on the DOM target): one plural /
    /// select case — or a value-position message — holding tags, as its own template. Params arrive as
    /// printed expressions (`param`); one that is not a plain reference binds as an accessor (v1 bound
    /// every part), a formatter when one of its params does. A lone formatter (the whole message is one
    /// plural / select) is its value itself, no template.
    pub(crate) fn case_template_v2(
        &mut self,
        parts: &[Part],
        v: usize,
        param: &dyn Fn(&str) -> String,
        names: &i18n::Names,
        tags: &FxHashMap<String, (String, String)>,
    ) -> Result<Expr, String> {
        let mut markup = Markup::default();
        let value = |name: &str| {
            let text = param(name);
            let accessor = !plain_reference(&text);
            (text, accessor)
        };
        let formatter = |part: &Part| {
            let mut usage = BTreeMap::new();
            i18n::usage(std::slice::from_ref(part), false, &mut usage);
            usage.iter().any(|(name, u)| !u.tag && !plain_reference(&param(name)))
        };
        self.v2_markup_parts(parts, v, &value, param, &formatter, names, tags, &mut markup)?;
        if markup.html.len() == HOLE.len_utf8() && markup.html.starts_with(HOLE) {
            let (value, accessor) = markup.values.pop().unwrap_or_default();
            return Ok(Expr::Raw(if accessor { format!("() => {value}") } else { value }));
        }
        let (mut html, mut nodes, statements) = self.v2_markup(markup);
        let svg = self.lexical_svg();
        let single = matches!(nodes.as_slice(), [VNode::Element { .. }]);
        let flags = match (single, svg) {
            (true, false) => 0,
            (true, true) => 1,
            (false, false) => 4,
            (false, true) => 5,
        };
        if flags == 0 {
            trim_closing(&mut html);
        }
        let (mut root, root_var) = if single {
            let mut node = nodes.pop().unwrap_or(VNode::Text);
            let var = match &mut node {
                VNode::Element { var, .. } => self.element_var(var),
                _ => self.v2_var(),
            };
            (node, var)
        } else {
            let var = self.v2_var();
            (VNode::Element { children: nodes, var: Some(var.clone()) }, var)
        };
        let name = self.unique(&format!("__rivetTpl{}", self.hoists.len()));
        let tpl = self.v2("_tpl");
        let flag_arg = if flags != 0 { format!(", {flags}") } else { String::new() };
        self.hoists.push(format!("const {name} = /*#__PURE__*/{tpl}({}{flag_arg});", quote(&html)));
        // Several nodes: an array of them (re-insertable like a v1 range; a DocumentFragment empties on insertion).
        let result = if single { root_var.clone() } else { format!("Array.from({root_var}.childNodes)") };
        if statements.is_empty() && !root.needed_below() {
            return Ok(if single { Expr::call(&name, Vec::new()) } else { Expr::Raw(format!("Array.from({name}().childNodes)")) });
        }
        let mut decls = vec![format!("{root_var} = {name}()")];
        self.walk_decls(&mut root, &root_var, &mut decls);
        let mut text = String::from("(() => {\nconst ");
        text.push_str(&decls.join(",\n  "));
        text.push_str(";\n");
        for statement in &statements {
            text.push_str(statement);
            text.push_str(";\n");
        }
        text.push_str("return ");
        text.push_str(&result);
        text.push_str(";\n})()");
        Ok(Expr::Raw(text))
    }

    /// `attr={t(…)}` on a native element (v1 `static_attribute`, DOM sink): a static message is template
    /// attribute text; params / prefix lookups / `t.in` one writer call, inside an effect when an argument
    /// can read state. False: not a static call.
    #[allow(clippy::too_many_arguments)]
    pub(super) fn v2_static_attribute(
        &mut self,
        attr: &'a JSXAttribute<'a>,
        html: &str,
        attr_ns: &'static str,
        attr_class: bool,
        either: bool,
        b: &mut Build,
        var: &mut Option<String>,
    ) -> bool {
        let Some(JSXAttributeValue::ExpressionContainer(c)) = &attr.value else { return false };
        let Some(e) = c.expression.as_expression() else { return false };
        let Expression::CallExpression(call) = strip_parens(e) else { return false };
        let id = self.id(&**call);
        let (index, matched, params) = match self.static_call(call, id) {
            None => return false,
            Some(Err(())) => return true,
            Some(Ok(found)) => found,
        };
        let is_dynamic = call.arguments.iter().any(|a| a.as_expression().is_some_and(dynamic));
        let value = match matched {
            Matched::Key(key) => {
                let Some(message) = self.message(index, &key, params, id) else { return true };
                if let Some(texts) = &message.texts {
                    let text = &texts[self.variant.unwrap_or(0)];
                    match encode_attribute(html, AttrValue::Text(text), attr_ns) {
                        Ok(text) => b.html.push_str(&unquoted(text)),
                        Err(message) => self.diag(message, id),
                    }
                    return true;
                }
                self.message_value(index, &message, Some("an attribute"), id)
            }
            Matched::Prefix(prefix, key) => self.prefix_value(index, &prefix, key, params, id),
            Matched::In(locale, key) => self.message_in(index, locale, &key, params, id),
        };
        let value = value.print();
        let target = self.element_var(var);
        // Writers as `walk_v2` picks them for an expression value (a message is always a string).
        let statement = if html == "class" && either {
            let set = if is_dynamic { self.v2("_attrSet") } else { self.v2("_setAttr") };
            let call = format!("{set}({target}, \"class\", ({value}) || null)");
            if is_dynamic { format!("{}(() => {call})", self.v2("_fx")) } else { call }
        } else if html == "class" && !attr_class {
            if is_dynamic {
                let (fx, cls) = (self.v2("_fx"), self.v2("_cls"));
                format!("{fx}(() => {cls}({target}, {value}))")
            } else {
                let class = self.v2("_className");
                format!("{class}({target}, {value})")
            }
        } else if plain_attribute(html) {
            if is_dynamic {
                let (fx, f) = (self.v2("_fx"), self.v2("_attrSet"));
                format!("{fx}(() => {f}({target}, {}, {value}))", quote(html))
            } else {
                let f = self.v2("_setAttr");
                format!("{f}({target}, {}, {value})", quote(html))
            }
        } else if is_dynamic {
            let (fx, f) = (self.v2("_fx"), self.v2("_attrWrite"));
            format!("{fx}(() => {f}({target}, {}, {value}))", quote(html))
        } else {
            let f = self.v2("_attrValue");
            format!("{f}({target}, {}, {value})", quote(html))
        };
        b.statements.push(statement);
        true
    }
}
