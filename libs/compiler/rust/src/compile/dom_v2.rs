//! DOM v2 lowering (the DOM target): a native JSX tree becomes a hoisted `_tpl` clone walked with
//! generated `firstChild` / `nextSibling` chains. Expressions that can read reactive state (a call,
//! member access, `new`, tagged template or `await` outside nested functions) bind through effects;
//! other values are written once (identifiers keep a runtime accessor check). Components are plain
//! untracked calls; bubbling events are delegated. A tree `v2_supported` rejects is never lowered:
//! `report_dom` (`dom_v2_check.rs`) reports its diagnostics.

use super::*;

// Trailing spread attributes (IMPL-SPREAD F1): `_attrs` joins the v2 ABI imports (`compile.rs` chains this list).
#[path = "dom_v2_spread.rs"]
mod dom_v2_spread;
pub(super) const SPREAD_ABI: &[&str] = &["_attrs"];

#[path = "dom_v2_check.rs"]
mod dom_v2_check;
#[path = "dom_v2_controls.rs"]
mod dom_v2_controls;
#[path = "dom_v2_i18n.rs"]
mod dom_v2_i18n;
#[path = "dom_v2_lift.rs"]
mod dom_v2_lift;
#[path = "dom_v2_text.rs"]
mod dom_v2_text;

/// v2 runtime ABI (`@rivetjs/runtime/dom`), imported on use.
pub(super) const V2_ABI: &[&str] = &[
    "_tpl", "_c", "_textValue", "_setAttr", "_attrValue", "_className", "_on",
    "_listen", "_insert", "_for", "_fx", "_fx1", "_cls", "_t", "_attrSet", "_attrWrite", "_spread", "_ref", "_show",
    "_switch", "_match", "_setProp", "_select", "_model", "_rcdata", "_scoped", "_tplNs", "_cond", "_tx",
];

/// Bubbling events delegated to one document listener (dom-expressions' set).
const DELEGATED: &[&str] = &[
    "beforeinput", "click", "contextmenu", "dblclick", "focusin", "focusout", "input", "keydown", "keyup", "mousedown",
    "mousemove", "mouseout", "mouseover", "mouseup", "pointerdown", "pointermove", "pointerout", "pointerover", "pointerup",
    "touchend", "touchmove", "touchstart",
];
/// = `html.rs` `BOOLEAN_ATTRIBUTES` (one list: dynamic writes and static folds agree).
const BOOLEAN_NAMES: &[&str] = crate::html::BOOLEAN_ATTRIBUTES;
/// SVG element names HTML does not define (a superset of `SVG_TAGS`): a template rooted at one parses
/// inside `<svg>` (`_tpl` flag 1) and its subtree walks in the SVG namespace. `image` included: the
/// HTML parser rewrites it to `<img>`. `a` (also an HTML tag) roots an SVG template only when it holds
/// one of these outside a nested `<svg>` (`svg_root`); `script` / `style` are diagnostics (`report_dom`).
const SVG_ONLY: &[&str] = &[
    "animate", "animateMotion", "animateTransform", "circle", "clipPath", "defs", "desc", "ellipse", "feBlend",
    "feColorMatrix", "feComponentTransfer", "feComposite", "feConvolveMatrix", "feDiffuseLighting", "feDisplacementMap",
    "feDistantLight", "feDropShadow", "feFlood", "feFuncA", "feFuncB", "feFuncG", "feFuncR", "feGaussianBlur", "feImage",
    "feMerge", "feMergeNode", "feMorphology", "feOffset", "fePointLight", "feSpecularLighting", "feSpotLight", "feTile",
    "feTurbulence", "filter", "foreignObject", "g", "image", "line", "linearGradient", "marker", "mask", "metadata", "mpath",
    "path", "pattern", "polygon", "polyline", "radialGradient", "rect", "set", "stop", "switch", "symbol", "text",
    "textPath", "tspan", "use", "view",
];
/// Tags both HTML and SVG define: a template rooted at one parses in its lexical namespace (B3); with
/// none (a component's or a module-level root) flag 8: emitted as `_tplNs`, which picks it from the insertion parent.
const AMBIGUOUS: &[&str] = &["a", "font", "script", "style", "title"];

thread_local! {
    // Lexical namespace of the native element whose children are being lowered (B3): 0 none (not inside
    // a native tree), 1 HTML, 2 SVG. JSX in an expression / component child of `<svg>` lowers later, as
    // its own template root, so the walk records the namespace it is in for those nested `lower` calls.
    static LEXICAL: std::cell::Cell<u8> = const { std::cell::Cell::new(0) };
    // Set for the walk of a flag-8 root: its own class writes go through `setAttribute` (SVG-safe).
    static EITHER_ROOT: std::cell::Cell<bool> = const { std::cell::Cell::new(false) };
}

const URL_NAMES: &[&str] =
    &["href", "src", "action", "formaction", "poster", "data", "to", "from", "by", "ping", "srcset", "imagesrcset", "values"];

/// A node of the template, for walk generation: elements with children, text runs and markers.
enum VNode {
    Element { children: Vec<VNode>, var: Option<String> },
    Text,
    Marker { var: String },
}

impl VNode {
    fn needed(&self) -> bool {
        match self {
            VNode::Element { children, var } => var.is_some() || children.iter().any(VNode::needed),
            VNode::Text => false,
            VNode::Marker { .. } => true,
        }
    }
}

struct Build {
    html: String,
    statements: Vec<String>,
}

/// One classified child of a native element.
enum Child<'a> {
    Text(String),
    Native(&'a JSXElement<'a>),
    /// Inserted value; `accessor` wraps it in a thunk, `scalar` marks a template literal (a string);
    /// `source` = the child expression (OPT-D capture analysis), None for components / fragments.
    Value { value: Expr, accessor: bool, scalar: bool, source: Option<&'a Expression<'a>> },
    /// i18n message tag markup (`dom_v2_i18n.rs`): template HTML, its walk nodes and insert statements.
    Markup { html: String, nodes: Vec<VNode>, statements: Vec<String> },
}

/// `{...rest}` through parentheses / TS casts (LIVE-PROPS P4): an identifier spread argument, which may hold live
/// getter props (`splitProps` / `mergeProps` results, a component's props object).
fn identifier_spread(e: &Expression<'_>) -> bool {
    match e {
        Expression::Identifier(_) => true,
        Expression::ParenthesizedExpression(p) => identifier_spread(&p.expression),
        Expression::TSAsExpression(x) => identifier_spread(&x.expression),
        Expression::TSSatisfiesExpression(x) => identifier_spread(&x.expression),
        Expression::TSNonNullExpression(x) => identifier_spread(&x.expression),
        _ => false,
    }
}

/// Can evaluating `e` read reactive state? Nested functions are not evaluated; JSX inside is
/// lowered separately (its own bindings track).
pub(super) fn dynamic(e: &Expression<'_>) -> bool {
    match e {
        Expression::CallExpression(_)
        | Expression::NewExpression(_)
        | Expression::StaticMemberExpression(_)
        | Expression::ComputedMemberExpression(_)
        | Expression::PrivateFieldExpression(_)
        | Expression::TaggedTemplateExpression(_)
        | Expression::AwaitExpression(_)
        | Expression::YieldExpression(_)
        | Expression::ChainExpression(_)
        | Expression::ImportExpression(_)
        | Expression::Super(_) => true,
        Expression::ArrowFunctionExpression(_) | Expression::FunctionExpression(_) | Expression::ClassExpression(_) => false,
        Expression::BooleanLiteral(_)
        | Expression::NullLiteral(_)
        | Expression::NumericLiteral(_)
        | Expression::BigIntLiteral(_)
        | Expression::RegExpLiteral(_)
        | Expression::StringLiteral(_)
        | Expression::Identifier(_)
        | Expression::ThisExpression(_)
        | Expression::MetaProperty(_) => false,
        Expression::TemplateLiteral(t) => t.expressions.iter().any(dynamic),
        Expression::ParenthesizedExpression(p) => dynamic(&p.expression),
        Expression::UnaryExpression(u) => dynamic(&u.argument),
        Expression::BinaryExpression(b) => dynamic(&b.left) || dynamic(&b.right),
        Expression::LogicalExpression(l) => dynamic(&l.left) || dynamic(&l.right),
        Expression::ConditionalExpression(c) => dynamic(&c.test) || dynamic(&c.consequent) || dynamic(&c.alternate),
        Expression::SequenceExpression(s) => s.expressions.iter().any(dynamic),
        Expression::ArrayExpression(a) => a.elements.iter().any(|el| match el {
            ArrayExpressionElement::SpreadElement(s) => dynamic(&s.argument),
            ArrayExpressionElement::Elision(_) => false,
            other => other.as_expression().is_none_or(dynamic),
        }),
        Expression::ObjectExpression(o) => o.properties.iter().any(|p| match p {
            ObjectPropertyKind::ObjectProperty(p) => {
                (p.computed && p.key.as_expression().is_none_or(dynamic)) || dynamic(&p.value)
            }
            ObjectPropertyKind::SpreadProperty(s) => dynamic(&s.argument),
        }),
        Expression::JSXElement(_) | Expression::JSXFragment(_) => false,
        Expression::TSAsExpression(t) => dynamic(&t.expression),
        Expression::TSSatisfiesExpression(t) => dynamic(&t.expression),
        Expression::TSNonNullExpression(t) => dynamic(&t.expression),
        Expression::TSTypeAssertion(t) => dynamic(&t.expression),
        Expression::TSInstantiationExpression(t) => dynamic(&t.expression),
        // Assignments, updates and anything else: conservatively reactive (re-evaluated like v1 thunks).
        _ => true,
    }
}

/// Has `e` a JSX operand (`c ? <A/> : <B/>`, `c && <A/>`, nested / parenthesized / TS-wrapped)? Unlike
/// `may_render_jsx` both operands may be JSX (TERNARY-MEMO, `cond_v2`).
fn jsx_leaf(e: &Expression<'_>) -> bool {
    match e {
        Expression::JSXElement(_) | Expression::JSXFragment(_) => true,
        Expression::ConditionalExpression(c) => jsx_leaf(&c.consequent) || jsx_leaf(&c.alternate),
        Expression::LogicalExpression(l) => jsx_leaf(&l.left) || jsx_leaf(&l.right),
        Expression::ParenthesizedExpression(p) => jsx_leaf(&p.expression),
        Expression::TSAsExpression(t) => jsx_leaf(&t.expression),
        Expression::TSSatisfiesExpression(t) => jsx_leaf(&t.expression),
        Expression::TSNonNullExpression(t) => jsx_leaf(&t.expression),
        _ => false,
    }
}

/// C12: ` name="v"` → ` name=v` when `v` needs no quotes (no whitespace, quotes, `=`, `<`, `>`, `` ` `` or
/// character references). Any Unicode whitespace keeps the quotes: lax parsers (happy-dom) end an
/// unquoted value at `\u{a0}` too (cdk Select's empty `<option label=\u{a0}>`).
fn unquoted(attr: String) -> String {
    let Some(at) = attr.find("=\"") else { return attr };
    let value = &attr[at + 2..attr.len() - 1];
    // A trailing `/` before `>` reads as a self-closing slash in lax parsers (happy-dom): keep the quotes.
    if value.is_empty() || value.ends_with('/') || value.chars().any(|c| c.is_whitespace() || matches!(c, '"' | '\'' | '=' | '<' | '>' | '`' | '&')) {
        return attr;
    }
    format!("{}={value}", &attr[..at])
}

/// C12: drop the closing tags that end the template (the parser closes them at end of input), except
/// raw-text / RCDATA / template-like elements.
fn trim_closing(html: &mut String) {
    while html.ends_with('>') {
        let Some(open) = html.rfind("</") else { return };
        let tag = &html[open + 2..html.len() - 1];
        if !tag.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
            || matches!(tag, "textarea" | "title" | "script" | "style" | "template" | "noscript" | "iframe" | "noembed" | "noframes" | "xmp" | "plaintext")
        {
            return;
        }
        html.truncate(open);
    }
}

fn delegated(event: &str) -> bool {
    DELEGATED.contains(&event)
}

/// An attribute written with `setAttribute` as is: not boolean, URL-bearing, namespaced or a control property.
fn plain_attribute(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    !lower.contains(':')
        && !BOOLEAN_NAMES.contains(&lower.as_str())
        && !URL_NAMES.contains(&lower.as_str())
        && !matches!(lower.as_str(), "value" | "checked" | "selected" | "defaultvalue" | "defaultchecked" | "popover")
}

fn html_name(name: &str) -> &str {
    match name {
        "className" => "class",
        "htmlFor" => "for",
        other => other,
    }
}

impl<'t, 'a> Compiler<'t, 'a> {
    /// v2 local name of `name` (recorded for the import list).
    pub(super) fn v2(&mut self, name: &'static str) -> String {
        self.used_v2.insert(name);
        self.v2_names.iter().find(|(n, _)| *n == name).map(|(_, l)| l.clone()).unwrap_or_default()
    }

    /// Whether the native tree rooted at `el` lowers through v2 (every DOM compile: dev, i18n and resumed
    /// modules included). False for a tree with a diagnostic (`dom_v2_check.rs` holds the pure twins of
    /// `report_dom`'s checks): `script` / `style`, parser-repaired nesting (incl. `tr` directly in
    /// `table`, select / option content the parser drops), invalid attributes, events or controls.
    pub(super) fn v2_supported(&self, el: &'a JSXElement<'a>, ancestors: &mut Vec<&'a str>) -> bool {
        let tag = self.tag_of(el);
        if !native_tag_name(tag) || matches!(tag, "script" | "style") {
            return false;
        }
        // B2: the HTML parser's repair rules (html.rs, as the server): `report_dom` reports RV1005.
        if crate::html::parser_repaired(tag, ancestors) {
            return false;
        }
        ancestors.push(tag);
        let namespace = dom_v2_check::path_namespace(ancestors, if self.lexical_svg() { "svg" } else { "html" });
        ancestors.pop();
        let controls = match tag {
            "select" | "optgroup" | "option" => self.v2_select_ok(el, tag),
            "textarea" | "title" => self.v2_rcdata_ok(el),
            // Static content stays in the template HTML; bound content is inserted into `.content`.
            "template" => true,
            "table" => !self.implied_tbody_child(el).is_some(),
            _ => true,
        };
        // A textarea value is its content: one source of content only (RV1009, `report_dom`).
        if tag == "textarea"
            && el.children.iter().any(|c| !matches!(c, JSXChild::Text(t) if jsx_text(self.tree.text_of(t.span)).is_empty()))
            && Self::attrs(el).any(|a| matches!(attr_name(self.tree, a), "value" | "defaultValue"))
        {
            return false;
        }
        if !controls {
            return false;
        }
        // `{...spread}` arguments are arbitrary expressions (nothing to validate); plain attributes of a
        // spread element merge into the object, with `spread_object`'s own diagnostics.
        for item in &el.opening_element.attributes {
            let attr = match item {
                JSXAttributeItem::SpreadAttribute(_) => continue,
                JSXAttributeItem::Attribute(attr) => &**attr,
            };
            let name = attr_name(self.tree, attr);
            if name == slots::SLOT {
                // `report_dom`: "r:slot is only allowed on a direct child of a component element".
                if !self.id(el).is_some_and(|id| self.slot_children.contains(&id)) {
                    return false;
                }
                continue;
            }
            if let Some(global) = global_event(name) {
                if global.is_none() {
                    return false;
                }
                continue;
            }
            if name.starts_with("prop:") {
                if !self.v2_prop_ok(attr, name, tag, namespace) {
                    return false;
                }
                continue;
            }
            if name.starts_with("model:") {
                if self.v2_model_kind(el, attr).is_none() {
                    return false;
                }
                continue;
            }
            // Resume preload directive: validated, then dropped (nothing to preload without resume).
            if self.is_preload_directive(attr, tag) {
                continue;
            }
            if starts_with_on(name) {
                // A literal handler is reported by `report_dom` (round-2 C14).
                if event_info(name).is_none() || Self::literal_handler(attr) {
                    return false;
                }
                continue;
            }
            if name == "ref" || styling::directive(name) {
                continue;
            }
            if !safe_attribute_name(name) {
                return false;
            }
            if let Some(text) = attr_string(self.tree, attr) {
                let decoded = decode_html(text);
                if encode_attribute(html_name(name), AttrValue::Text(&decoded), attribute_namespace(tag, name, namespace)).is_err() {
                    return false;
                }
            }
        }
        let void = VOID_TAGS.contains(&tag) && namespace != "svg" && namespace != "mathml";
        for child in &el.children {
            match child {
                JSXChild::Spread(_) => return false,
                JSXChild::Text(text) => {
                    let content = jsx_text(self.tree.text_of(text.span));
                    if (void && !content.is_empty()) || (["table", "tbody", "thead", "tfoot", "tr"].contains(&tag) && !content.trim().is_empty()) {
                        return false;
                    }
                }
                JSXChild::Element(child) if self.native(child) => {
                    if void || (tag == "table" && self.tag_of(child) == "tr") {
                        return false;
                    }
                    ancestors.push(tag);
                    let ok = self.v2_supported(child, ancestors);
                    ancestors.pop();
                    if !ok {
                        return false;
                    }
                }
                JSXChild::ExpressionContainer(c) => {
                    if void && c.expression.as_expression().is_some() {
                        return false;
                    }
                }
                _ => {
                    if void {
                        return false;
                    }
                }
            }
        }
        true
    }

    /// A template root that is an SVG child (G4: component-returned `<path>` / `<image>` / `<a><text/></a>`
    /// built before it is inserted into its `<svg>`), so `_tpl` must parse it in the SVG namespace.
    fn svg_root(&self, el: &'a JSXElement<'a>, tag: &str) -> bool {
        SVG_ONLY.contains(&tag) || (tag == "a" && self.svg_descendant(&el.children))
    }

    /// An SVG-only element below `children`, not counting the subtree of a nested `<svg>`: an `<svg>` icon
    /// inside a link (`<a><svg><path/></svg><span/></a>`) opens its own namespace, so the `<a>` stays HTML
    /// (parsed inside `<svg>`, its HTML children after the icon would break out of the foreign content).
    fn svg_descendant(&self, children: &'a oxc_allocator::Vec<'a, JSXChild<'a>>) -> bool {
        children.iter().any(|child| match child {
            JSXChild::Element(child) => {
                let tag = self.tag_of(child);
                tag != "svg" && (SVG_ONLY.contains(&tag) || self.svg_descendant(&child.children))
            }
            JSXChild::Fragment(fragment) => self.svg_descendant(&fragment.children),
            _ => false,
        })
    }

    /// `_tpl` namespace flags of a template root (B3): 1 = SVG for SVG-only roots (`svg_root`) and for
    /// tags HTML shares with SVG lexically inside `<svg>`; 8 = an ambiguous root with no lexical
    /// namespace and no native element children (`<a>` returned by a component): emitted as `_tplNs`, which parses it in
    /// the insertion parent's namespace. Roots inside an HTML element stay HTML (0).
    fn root_flags(&self, el: &'a JSXElement<'a>, tag: &str) -> u32 {
        if self.svg_root(el, tag) {
            return 1;
        }
        // A MathML child element built before insertion into its `<math>` (`math` itself parses in HTML).
        if tag != "math" && MATH_TAGS.contains(&tag) {
            return 2;
        }
        if !AMBIGUOUS.contains(&tag) {
            return 0;
        }
        match LEXICAL.with(|l| l.get()) {
            2 => 1,
            0 if !el.children.iter().any(|c| matches!(c, JSXChild::Element(child) if self.native(child))) => 8,
            _ => 0,
        }
    }

    /// Whether JSX being lowered now sits lexically inside SVG content (B3): `v2_supported` can accept
    /// SVG-only roots such as `<title>` there.
    pub(super) fn lexical_svg(&self) -> bool {
        LEXICAL.with(|l| l.get()) == 2
    }

    /// CTX-1: a v2 template that is a `return` argument or a concise arrow body lowers to a block
    /// (declarations, bindings, `return root`) instead of an arrow IIFE: one frame and one closure less per
    /// component level. Element vars are unique per module, so the block scope never collides.
    pub(super) fn v2_block_statement(&mut self, id: NodeId) -> Option<Expr> {
        if self.server {
            return None;
        }
        let (argument, concise) = match self.tree.kind(id) {
            AstKind::ReturnStatement(r) => (r.argument.as_ref()?, false),
            AstKind::ExpressionStatement(s) if self.is_concise_body(id) => (&s.expression, true),
            _ => return None,
        };
        let el = as_element(strip_parens(argument))?;
        if !self.native(el) || !self.v2_supported(el, &mut Vec::new()) {
            return None;
        }
        const OPEN: &str = "(() => {\n";
        const CLOSE: &str = "})()";
        match self.lower_dom_v2(el) {
            Expr::Raw(text) if text.starts_with(OPEN) && text.ends_with(CLOSE) => {
                Some(Expr::Stmts(format!("{{\n{}}}", &text[OPEN.len()..text.len() - CLOSE.len()])))
            }
            other if concise => Some(Expr::Stmts(other.print())),
            other => Some(Expr::Stmts(format!("return {};", other.print()))),
        }
    }

    /// Lower a native tree: hoisted template, element walk, bindings; returns the root Node expression.
    pub(super) fn lower_dom_v2(&mut self, el: &'a JSXElement<'a>) -> Expr {
        let tag = self.tag_of(el);
        let flags = self.root_flags(el, tag);
        let mut b = Build { html: String::new(), statements: Vec::new() };
        let root_var = self.v2_var();
        EITHER_ROOT.with(|c| c.set(flags == 8));
        let namespace = match flags {
            1 => "svg",
            2 => "mathml",
            _ if tag == "svg" => "svg",
            _ if tag == "math" => "mathml",
            _ => "html",
        };
        let mut root = self.walk_v2(el, namespace, &mut b, Some(root_var.clone()));
        if flags == 0 {
            trim_closing(&mut b.html);
        }
        let name = self.unique(&format!("__rivetTpl{}", self.hoists.len()));
        // Flag 8 (namespace from the insertion parent) has its own ABI: `_tpl` stays free of the pick.
        let tpl = if flags == 8 { self.v2("_tplNs") } else { self.v2("_tpl") };
        let flag_arg = if flags != 0 && flags != 8 { format!(", {flags}") } else { String::new() };
        self.hoists.push(format!("const {name} = /*#__PURE__*/{tpl}({}{flag_arg});", quote(&b.html)));
        if b.statements.is_empty() && !root.needed_below() {
            return Expr::call(&name, Vec::new());
        }
        let mut decls = vec![format!("{root_var} = {name}()")];
        self.walk_decls(&mut root, &root_var, &mut decls);
        let mut text = String::from("(() => {\nconst ");
        text.push_str(&decls.join(",\n  "));
        text.push_str(";\n");
        for statement in &b.statements {
            text.push_str(statement);
            text.push_str(";\n");
        }
        text.push_str("return ");
        text.push_str(&root_var);
        text.push_str(";\n})()");
        Expr::Raw(text)
    }

    /// Declarations reaching every referenced node: from the parent, `firstChild` then `nextSibling`
    /// steps, continuing from the previous referenced sibling.
    fn walk_decls(&mut self, node: &mut VNode, var: &str, decls: &mut Vec<String>) {
        let VNode::Element { children, .. } = node else { return };
        let mut previous: Option<(String, usize)> = None;
        for (i, child) in children.iter_mut().enumerate() {
            if !child.needed() {
                continue;
            }
            let child_var = match child {
                VNode::Element { var, .. } => {
                    if var.is_none() {
                        *var = Some(self.v2_var());
                    }
                    var.clone().unwrap_or_default()
                }
                VNode::Marker { var } => var.clone(),
                VNode::Text => continue,
            };
            let path = match &previous {
                None => format!("{var}.firstChild{}", ".nextSibling".repeat(i)),
                Some((prev, at)) => format!("{prev}{}", ".nextSibling".repeat(i - at)),
            };
            decls.push(format!("{child_var} = {path}"));
            self.walk_decls(child, &child_var.clone(), decls);
            previous = Some((child_var, i));
        }
    }

    /// A fresh template-walk variable (`_el$N`).
    fn v2_var(&mut self) -> String {
        loop {
            self.v2_vars += 1;
            let name = format!("_el${}", self.v2_vars);
            if !self.names.contains(&name) {
                self.names.insert(name.clone());
                return name;
            }
        }
    }

    /// The element's variable, allocated on first reference.
    fn element_var(&mut self, var: &mut Option<String>) -> String {
        if let Some(name) = var {
            return name.clone();
        }
        let name = self.v2_var();
        *var = Some(name.clone());
        name
    }

    /// Class group (`dom_class` for v2): a literal base + toggles stay in the template and toggle with
    /// `_bindClass`; a dynamic base merges everything into one `_cls` effect.
    fn class_v2(&mut self, group: &styling::ClassGroup<'a>, b: &mut Build, var: &mut Option<String>, attr_class: bool) {
        if matches!(group.base, Some(styling::Base::Expr(_))) {
            let value = self.class_value(group).print();
            let target = self.element_var(var);
            let mut sources: Vec<&Expression<'a>> = Vec::new();
            if let Some(styling::Base::Expr(e)) = &group.base {
                sources.push(*e);
            }
            sources.extend(group.toggles.iter().filter_map(|toggle| match toggle.value {
                styling::Val::Expr(e) => Some(e),
                _ => None,
            }));
            let captures = self.fx_captures(&sources);
            let body = if attr_class {
                // `_cls` semantics (empty / false / nullish remove) through the attribute.
                let set = self.v2("_attrSet");
                format!("{set}({target}, \"class\", ({value}) || null)")
            } else {
                let cls = self.v2("_cls");
                format!("{cls}({target}, {value})")
            };
            let statement = self.fx_bind(&target, captures, &value, body);
            b.statements.push(statement);
            return;
        }
        let literal = styling::ClassGroup {
            first: group.first,
            base: match &group.base {
                Some(styling::Base::Static(text)) => Some(styling::Base::Static(text.clone())),
                _ => None,
            },
            toggles: group
                .toggles
                .iter()
                .filter_map(|toggle| match toggle.value {
                    styling::Val::Bool(on) => Some(styling::Toggle { name: toggle.name.clone(), value: styling::Val::Bool(on) }),
                    _ => None,
                })
                .collect(),
        };
        if let Some(Some(text)) = styling::static_class_value(&literal) {
            b.html.push_str(&unquoted(encode_attribute("class", AttrValue::Text(&text), "html").unwrap_or_default()));
        }
        for toggle in &group.toggles {
            let styling::Val::Expr(e) = toggle.value else { continue };
            let value = Expr::thunk(self.expr(e));
            let target = self.element_var(var);
            let callee = self.style_helper("_bindClass");
            b.statements.push(Expr::call(&callee, vec![Expr::Ident(target), Expr::Str(toggle.name.clone()), value]).print());
        }
    }

    /// Style group (`dom_style` for v2): every property through CSSOM (`_bindStyle`; literals set once).
    fn style_v2(&mut self, group: &styling::StyleGroup<'a>, b: &mut Build, var: &mut Option<String>) {
        let mut set: Vec<&str> = Vec::new();
        for entry in &group.entries {
            let (name, value) = match entry {
                styling::Entry::Prop(name, styling::Val::Bool(_)) => {
                    // Unset: only matters after an earlier value for the same property.
                    if !set.contains(&name.as_str()) {
                        continue;
                    }
                    (Expr::Str(name.clone()), Expr::Null)
                }
                styling::Entry::Prop(name, styling::Val::Expr(e)) => {
                    set.push(name);
                    (Expr::Str(name.clone()), Expr::thunk(self.expr(e)))
                }
                styling::Entry::Prop(name, value) => {
                    set.push(name);
                    (Expr::Str(name.clone()), self.style_val(value))
                }
                styling::Entry::Object(e) => (Expr::Null, Expr::thunk(self.expr(e))),
            };
            let target = self.element_var(var);
            let callee = self.style_helper("_bindStyle");
            b.statements.push(Expr::call(&callee, vec![Expr::Ident(target), name, value]).print());
        }
    }

    fn walk_v2(&mut self, el: &'a JSXElement<'a>, namespace: &'static str, b: &mut Build, mut var: Option<String>) -> VNode {
        let tag = self.tag_of(el);
        let namespace = dom_v2_check::element_namespace(tag, namespace);
        // `<select>` value bindings run after the children exist (v1 `deferred`).
        let mut deferred: Vec<String> = Vec::new();
        // SVG `className` is read-only (SVGAnimatedString): class writes there are attributes.
        let either = EITHER_ROOT.with(|c| c.replace(false));
        let attr_class = namespace == "svg" || either;
        b.html.push('<');
        b.html.push_str(tag);
        // Invalid values report RV1102 as in v1; a valid directive renders nothing here.
        self.preload_directive(el, tag);
        let spread = Self::has_spread(el);
        let groups = self.style_groups(el, spread);
        // A literal `<textarea value>` / `defaultValue`: the textarea's content (browsers ignore a
        // `value` attribute on it; the server renders it as content too, round-2 C3).
        let mut textarea_text: Option<String> = None;
        for (index, item) in el.opening_element.attributes.iter().enumerate() {
            let JSXAttributeItem::Attribute(attr) = item else { continue };
            let attr: &'a JSXAttribute<'a> = attr;
            let name = attr_name(self.tree, attr);
            if tag == "textarea" && namespace == "html" && !spread && matches!(name, "value" | "defaultValue") {
                if let Some(text) = self.literal_text(attr) {
                    textarea_text = Some(text);
                    continue;
                }
            }
            if self.is_preload_directive(attr, tag) {
                continue;
            }
            // Plain attributes of a spread element: carried by the merged object (emitted last).
            if spread && self.spread_plain(attr, tag) {
                continue;
            }
            // Class / style groups lower once, at their first member (spread elements: class toggles
            // merge into the object, `spread_with_class`).
            if let Some(groups) = groups.as_ref().filter(|g| g.members.contains(&index)) {
                if let Some(group) = groups.class.as_ref().filter(|g| !spread && g.first == index) {
                    self.class_v2(group, b, &mut var, attr_class);
                }
                if let Some(group) = groups.style.as_ref().filter(|g| !spread && g.first == index) {
                    self.style_v2(group, b, &mut var);
                }
                continue;
            }
            // exception: lane V2-Q4 (2026-10-07) — handlers bind once: RV1016 for bind-time state reads.
            if starts_with_on(name) || name.starts_with("window:") || name.starts_with("document:") {
                let id = self.id(attr);
                self.bind_once_handler(name, attr, id);
            }
            // select value / model / prop / global events / r:slot (`dom_v2_controls.rs`).
            if self.v2_control_attr(el, attr, tag, b, &mut var, &mut deferred) {
                continue;
            }
            if name == "ref" {
                let target = self.element_var(&mut var);
                let value = self.attr_value(attr).print();
                let f = self.v2("_ref");
                b.statements.push(format!("{f}({target}, {value})"));
                continue;
            }
            if starts_with_on(name) {
                let Some((event, capture)) = event_info(name) else { continue };
                let target = self.element_var(&mut var);
                let handler = self.attr_value(attr).print();
                if capture || !delegated(&event) || name.starts_with("on:") {
                    let listen = self.v2("_listen");
                    let options = if capture { ", { capture: true }" } else { "" };
                    b.statements.push(format!("{listen}({target}, {}, {handler}{options})", quote(&event)));
                } else {
                    let on = self.v2("_on");
                    b.statements.push(format!("{on}({target}, {}, {handler})", quote(&event)));
                }
                continue;
            }
            let html = html_name(name);
            let attr_ns = attribute_namespace(tag, name, namespace);
            // Static text (and css-folded values) belong to the template.
            if attr.value.is_none() || attr_string(self.tree, attr).is_some() {
                let decoded = attr_string(self.tree, attr).map(decode_html);
                let value = match &decoded {
                    None => AttrValue::True,
                    Some(text) => AttrValue::Text(text),
                };
                if let Ok(text) = encode_attribute(html, value, attr_ns) {
                    b.html.push_str(&unquoted(text));
                }
                continue;
            }
            if !self.css_blocks.is_empty() {
                if let Some(text) = self.folded_attribute(attr) {
                    if let Ok(text) = encode_attribute(html, AttrValue::Text(&text), attr_ns) {
                        b.html.push_str(&unquoted(text));
                    }
                    continue;
                }
            }
            // i18n `t()` values (`dom_v2_i18n.rs`): a static message is template text.
            if self.i18n && self.v2_static_attribute(attr, html, attr_ns, attr_class, either, b, &mut var) {
                continue;
            }
            let Some(JSXAttributeValue::ExpressionContainer(c)) = &attr.value else { continue };
            let Some(e) = c.expression.as_expression() else { continue };
            // Literal strings / numbers fold into the template.
            let literal = match strip_parens(e) {
                Expression::StringLiteral(s) => Some(s.value.to_string()),
                Expression::NumericLiteral(n) => Some(self.tree.text_of(n.span).to_string()).filter(|t| t.chars().all(|c| c.is_ascii_digit())),
                Expression::TemplateLiteral(t) if t.expressions.is_empty() => t.quasis.first().and_then(|q| q.value.cooked.as_ref()).map(|c| c.to_string()),
                _ => None,
            };
            // C1: a number on a boolean attribute is a truthiness test (server / v1 / runtime rule):
            // `hidden={0}` renders nothing, `hidden={1}` the bare attribute — never the text "0".
            let numeric = matches!(strip_parens(e), Expression::NumericLiteral(_));
            if let (Some(text), true) = (&literal, numeric && attr_ns != "svg" && attr_ns != "mathml" && BOOLEAN_NAMES.contains(&html.to_ascii_lowercase().as_str())) {
                if text.chars().any(|c| c != '0') {
                    b.html.push_str(&format!(" {}", html.to_ascii_lowercase()));
                }
                continue;
            }
            if let Some(text) = literal {
                if let Ok(text) = encode_attribute(html, AttrValue::Text(&text), attr_ns) {
                    b.html.push_str(&unquoted(text));
                    continue;
                }
            }
            let is_dynamic = dynamic(e);
            let value = self.attr_value(attr).print();
            let target = self.element_var(&mut var);
            // OPT-D: a dynamic binding over at most two never-reassigned locals → `_fx1` + hoisted writer.
            let captures = if is_dynamic { self.fx_captures(&[e]) } else { None };
            // Dynamic bindings: one effect closure that calls the writer (no runtime read wrapper).
            let statement = if html == "class" && either {
                // Flag-8 root (HTML or SVG at runtime): `_className` semantics through the attribute.
                let set = if is_dynamic { self.v2("_attrSet") } else { self.v2("_setAttr") };
                let call = format!("{set}({target}, \"class\", ({value}) || null)");
                if is_dynamic { self.fx_bind(&target, captures, &value, call) } else { call }
            } else if html == "class" && !attr_class {
                if is_dynamic {
                    let cls = self.v2("_cls");
                    self.fx_bind(&target, captures, &value, format!("{cls}({target}, {value})"))
                } else {
                    let class = self.v2("_className");
                    format!("{class}({target}, {value})")
                }
            } else if plain_attribute(html) {
                if is_dynamic {
                    let f = self.v2("_attrSet");
                    self.fx_bind(&target, captures, &value, format!("{f}({target}, {}, {value})", quote(html)))
                } else {
                    let f = self.v2("_setAttr");
                    format!("{f}({target}, {}, {value})", quote(html))
                }
            } else if is_dynamic {
                let f = self.v2("_attrWrite");
                self.fx_bind(&target, captures, &value, format!("{f}({target}, {}, {value})", quote(html)))
            } else {
                let f = self.v2("_attrValue");
                format!("{f}({target}, {}, {value})", quote(html))
            };
            b.statements.push(statement);
        }
        if spread {
            // After the element's own bindings: the merged object (source order, later keys win),
            // keys diffed per run by one effect when any part can read state.
            let target = self.element_var(&mut var);
            // F1 (`dom_v2_spread.rs`): plain attributes after the last spread lower on their own.
            let split = self.spread_split(el, tag, groups.as_ref());
            let is_dynamic = el.opening_element.attributes.iter().enumerate().any(|(index, item)| match item {
                JSXAttributeItem::SpreadAttribute(s) => dynamic(&s.argument),
                JSXAttributeItem::Attribute(attr) => {
                    split.map_or(true, |last| index < last || attr_name(self.tree, attr) == "children")
                        && self.spread_plain(attr, tag)
                        && match &attr.value {
                            Some(JSXAttributeValue::ExpressionContainer(c)) => c.expression.as_expression().is_some_and(dynamic),
                            _ => false,
                        }
                }
            }) || groups.as_ref().and_then(|g| g.class.as_ref()).is_some_and(|g| {
                g.toggles.iter().any(|t| matches!(t.value, styling::Val::Expr(e) if dynamic(e)))
            }) || groups.as_ref().and_then(|g| g.style.as_ref()).is_some_and(|g| {
                g.entries.iter().any(|entry| match entry {
                    styling::Entry::Prop(_, styling::Val::Expr(e)) | styling::Entry::Object(e) => dynamic(e),
                    styling::Entry::Prop(..) => false,
                })
            });
            // LIVE-PROPS P4 (gap 1): an identifier argument (`{...rest}`, a `splitProps` rest / the props object) may hold
            // live getters: never copied at creation. A lone one passes uncopied (`_spread(el, rest, 2)`: read inside the
            // spread effect, released when the run read nothing); with other parts the merged object is a thunk.
            let identifier = el
                .opening_element
                .attributes
                .iter()
                .any(|item| matches!(item, JSXAttributeItem::SpreadAttribute(s) if identifier_spread(&s.argument)));
            let toggles = groups.as_ref().and_then(|g| g.class.as_ref()).is_some_and(|g| !g.toggles.is_empty());
            let mut entries = self.spread_object(el, tag, namespace, groups.as_ref(), split);
            let mut flags = 0;
            let value = if identifier && !is_dynamic && !toggles && entries.len() == 1 && matches!(entries[0].0, Key::Spread) {
                flags |= 2;
                entries.pop().map_or(Expr::Null, |(_, value)| value)
            } else {
                let object = self.spread_with_class(Expr::Object(entries), groups.as_ref());
                if is_dynamic || identifier { Expr::thunk(object) } else { object }
            };
            // No JSX children: the helper renders the object's `children` as the content.
            if spread_content(self.tree, el, tag) {
                flags |= 1;
            }
            // Static trailing attributes join the template here (the tag is still open); the rest bind after the spread.
            let after = split.map(|last| self.spread_after(el, tag, namespace, last, &mut b.html));
            let mut args = vec![Expr::Ident(target.clone()), value];
            if let Some(after) = &after {
                args.extend([Expr::Num(flags), Expr::Null, Expr::Str(after.exclude.clone())]);
            } else if flags != 0 {
                args.push(Expr::Num(flags));
            }
            let f = self.v2("_spread");
            b.statements.push(Expr::call(&f, args).print());
            if let Some(dom_v2_spread::After { binding: Some((values, names)), .. }) = after {
                let f = self.v2("_attrs");
                b.statements.push(Expr::call(&f, vec![Expr::Ident(target), values, Expr::Str(names)]).print());
            }
        }
        // RCDATA content v1 binds (expressions, a leading textarea newline): `_rcdata`, empty template element.
        let rcdata = self.v2_rcdata(el, tag, b, &mut var);
        b.html.push('>');
        if VOID_TAGS.contains(&tag) && namespace != "svg" && namespace != "mathml" {
            return VNode::Element { children: Vec::new(), var };
        }
        if let Some(text) = textarea_text {
            if text.starts_with(['\n', '\r']) {
                // Parsers disagree on the leading newline of textarea content (happy-dom keeps it): bound,
                // like a leading-newline text child (`v2_rcdata`).
                let target = self.element_var(&mut var);
                let rcdata = self.v2("_rcdata");
                b.statements.push(Expr::call(&rcdata, vec![Expr::Ident(target), Expr::Array(vec![Expr::Str(text)])]).print());
            } else {
                b.html.push_str(&escaped(&text));
            }
            b.html.push_str("</textarea>");
            return VNode::Element { children: Vec::new(), var };
        }
        if tag == "template" && !self.v2_static_content(&el.children) {
            // Bound content: the template element is static, its content a fragment inserted into
            // `.content` (a DocumentFragment the `firstChild` walk never reaches), parsed as HTML.
            let lexical = LEXICAL.with(|l| l.replace(1));
            let value = self.fragment_v2(&el.children);
            LEXICAL.with(|l| l.set(lexical));
            let target = self.element_var(&mut var);
            let insert = self.v2("_insert");
            b.statements.push(format!("{insert}({target}.content, {}, null)", value.print()));
            b.html.push_str("</template>");
            return VNode::Element { children: Vec::new(), var };
        }
        if rcdata {
            b.html.push_str("</");
            b.html.push_str(tag);
            b.html.push('>');
            return VNode::Element { children: Vec::new(), var };
        }
        // Classify children: text runs, native elements, inserted values. JSX lowered here (expression and
        // component children) roots its templates in this element's child namespace (B3).
        let svg_children = namespace == "svg" && tag != "foreignObject";
        let lexical = LEXICAL.with(|l| l.replace(if svg_children { 2 } else { 1 }));
        let mut svg_component = false;
        let mut items: Vec<Child<'a>> = Vec::new();
        for child in &el.children {
            match child {
                JSXChild::Text(text) => {
                    let content = jsx_text(self.tree.text_of(text.span));
                    if !content.is_empty() {
                        match items.last_mut() {
                            Some(Child::Text(previous)) => previous.push_str(&content),
                            _ => items.push(Child::Text(content)),
                        }
                    }
                }
                JSXChild::Element(child) if self.native(child) => items.push(Child::Native(child)),
                JSXChild::Element(child) => {
                    let value = self.lower(Jsx::Element(child));
                    // Under SVG the component runs inside the insertion read, where `_tplNs` roots
                    // (a component's bare `<a>`) see their parent's namespace.
                    svg_component |= svg_children;
                    items.push(Child::Value { value, accessor: svg_children, scalar: false, source: None });
                }
                JSXChild::Fragment(f) => {
                    let value = self.fragment_v2(&f.children);
                    items.push(Child::Value { value, accessor: false, scalar: false, source: None });
                }
                JSXChild::ExpressionContainer(c) => {
                    let Some(e) = c.expression.as_expression() else { continue };
                    // i18n `t()` (`dom_v2_i18n.rs`): message text joins the template, params / formatters are values.
                    if self.i18n && self.v2_static_child(e, &mut items) {
                        continue;
                    }
                    let inner = strip_parens(e);
                    let literal = match inner {
                        Expression::StringLiteral(s) => Some(s.value.to_string()),
                        Expression::TemplateLiteral(t) if t.expressions.is_empty() => {
                            t.quasis.first().and_then(|q| q.value.cooked.as_ref()).map(|c| c.to_string())
                        }
                        _ => None,
                    };
                    if let Some(text) = literal {
                        if !text.is_empty() {
                            match items.last_mut() {
                                Some(Child::Text(previous)) => previous.push_str(&text),
                                _ => items.push(Child::Text(text)),
                            }
                        }
                        continue;
                    }
                    // TERNARY-MEMO: a conditional with a JSX operand is already an accessor (`_cond`).
                    if let Some(value) = self.cond_v2(e) {
                        items.push(Child::Value { value, accessor: false, scalar: false, source: None });
                        continue;
                    }
                    let scalar = matches!(inner, Expression::TemplateLiteral(_));
                    let accessor = dynamic(e) && !self.v2_static_message(e);
                    let value = self.expr(e);
                    items.push(Child::Value { value, accessor, scalar, source: Some(e) });
                }
                JSXChild::Spread(_) => {}
            }
        }
        LEXICAL.with(|l| l.set(lexical));
        let mut children: Vec<VNode> = Vec::new();
        if let [Child::Value { value, accessor, scalar, source }] = items.as_slice() {
            // Sole dynamic child: no marker, the element is the insertion parent.
            let target = self.element_var(&mut var);
            let printed = value.print();
            let statement = if svg_component {
                // A component under SVG: read inside the insertion (`_tplNs` sees the parent).
                format!("{}({target}, () => {printed}, null)", self.v2("_insert"))
            } else {
                match (scalar, accessor) {
                    // IMPL-DOM F2: a placeholder Text node in the template takes the writes (`_tx`, `dom_v2_text.rs`).
                    (_, true) if self.text_placeholder(tag, *source) => self.sole_text_v2(b, &mut children, &printed, *source),
                    // `_text` takes any value: scalars write text, the first node/array switches to insertion.
                    // A read that throws empties the element (v1 `_insert` clears its range), then rethrows;
                    // inline (one effect closure, no read thunk: `_textValue(el, () => …)` measured slower).
                    (_, true) => {
                        let t = self.v2("_t");
                        let error = self.unique("__rivetError");
                        // OPT-D: `_fx1` + hoisted writer when the read fits (`dom_v2_lift.rs`).
                        let captures = (*source).and_then(|e| self.fx_captures(&[e]));
                        let body = format!("{{\ntry {{\n{t}({target}, {printed});\n}} catch ({error}) {{\n{t}({target}, null);\nthrow {error};\n}}\n}}");
                        self.fx_bind(&target, captures, &printed, body)
                    }
                    (true, false) => format!("{target}.textContent = {printed}"),
                    (false, false) => format!("{}({target}, {printed})", self.v2("_textValue")),
                }
            };
            b.statements.push(statement);
        } else {
            let count = items.len();
            for (i, item) in items.into_iter().enumerate() {
                match item {
                    Child::Text(text) => {
                        b.html.push_str(&escaped(&text));
                        children.push(VNode::Text);
                    }
                    Child::Native(child) => {
                        let node = self.walk_v2(child, if tag == "foreignObject" { "html" } else { namespace }, b, None);
                        children.push(node);
                    }
                    Child::Value { value, accessor, .. } => {
                        let parent = self.element_var(&mut var);
                        let printed = if accessor { format!("() => {}", value.print()) } else { value.print() };
                        let insert = self.v2("_insert");
                        if i + 1 == count {
                            b.statements.push(format!("{insert}({parent}, {printed}, null)"));
                        } else {
                            let marker = self.v2_var();
                            b.html.push_str("<!>");
                            children.push(VNode::Marker { var: marker.clone() });
                            b.statements.push(format!("{insert}({parent}, {printed}, {marker})"));
                        }
                    }
                    Child::Markup { html, nodes, statements } => {
                        b.html.push_str(&html);
                        // Adjacent text parses as one node.
                        for node in nodes {
                            if !(matches!(node, VNode::Text) && matches!(children.last(), Some(VNode::Text))) {
                                children.push(node);
                            }
                        }
                        b.statements.extend(statements);
                    }
                }
            }
        }
        b.statements.extend(deferred);
        if tag == "template" {
            // Static content (checked): it lives in `.content`, never walked.
            children.clear();
        }
        b.html.push_str("</");
        b.html.push_str(tag);
        b.html.push('>');
        VNode::Element { children, var }
    }

    /// Fragment children as an array; dynamic expressions stay accessors (the insert tracks them).
    pub(super) fn fragment_v2(&mut self, children: &'a [JSXChild<'a>]) -> Expr {
        let mut values = Vec::new();
        for child in children {
            match child {
                JSXChild::Text(text) => {
                    let text = jsx_text(self.tree.text_of(text.span));
                    if !text.is_empty() {
                        values.push(Expr::Str(text));
                    }
                }
                JSXChild::ExpressionContainer(c) => {
                    if let Some(e) = c.expression.as_expression() {
                        // TERNARY-MEMO: `_scoped(_cond(…))` — the memo is created with the fragment, each read in its scope.
                        if let Some(value) = self.cond_v2(e) {
                            values.push(Expr::call(&self.v2("_scoped"), vec![value]));
                            continue;
                        }
                        let value = self.expr(e);
                        // Read later by the insertion: `_scoped` keeps the fragment's scope (context).
                        values.push(if dynamic(e) && !self.v2_static_message(e) { Expr::call(&self.v2("_scoped"), vec![Expr::thunk(value)]) } else { value });
                    }
                }
                JSXChild::Spread(s) => {
                    let id = self.id(&**s);
                    self.diag("Spread children are not supported: render the array as one child ({items}) or map it ({items.map((x) => <li>{x}</li>)} / <For each={items} by={…}>)", id);
                }
                JSXChild::Element(el) => values.push(self.lower(Jsx::Element(el))),
                JSXChild::Fragment(f) => values.push(self.fragment_v2(&f.children)),
            }
        }
        Expr::Array(values)
    }

    /// TERNARY-MEMO (2026-10-08): a conditional child with a JSX operand — `{c() ? <A/> : <B/>}`, `{c() && <A/>}`,
    /// `||`, `??`, nested in either branch — lowers to `_cond(() => test, mode, (v) => v ? A : B)` (runtime
    /// `dom-v2.ts`): Solid's condition memo. The test is read through a memo cut off on the branch it picks (mode 0
    /// `?:` truthiness; 1 `&&` / 2 `||` / 3 `??`: also the rendered test value), so a read inside the test that does
    /// not switch the branch no longer re-runs the insertion — which re-created the branch's JSX (CSS enter
    /// animations replayed, focus / input state lost: ui input-otp slot values on every keystroke). Branches stay in
    /// the render function (tracked by the insertion: a non-JSX branch still updates on its own reads); a nested
    /// conditional branch gets its own `_cond`. Not lowered (unchanged output): a test that cannot read state (no
    /// memo needed), no JSX operand, or `this` / `super` / `arguments` / `new.target` / `await` / `yield` anywhere
    /// (`getter_safe`: the parts move into arrows). DOM target only; the server output is unchanged.
    pub(super) fn cond_v2(&mut self, e: &'a Expression<'a>) -> Option<Expr> {
        if self.server || !self.getter_safe(e) {
            return None;
        }
        match strip_parens(e) {
            Expression::ConditionalExpression(c) if dynamic(&c.test) && (jsx_leaf(&c.consequent) || jsx_leaf(&c.alternate)) => {
                let test = self.expr(&c.test);
                let consequent = self.cond_branch(&c.consequent);
                let alternate = self.cond_branch(&c.alternate);
                let v = self.unique("__rivetCond");
                let body = format!("{v} ? ({}) : ({})", consequent.print(), alternate.print());
                Some(self.cond_call(test, 0, v, body))
            }
            Expression::LogicalExpression(l) if dynamic(&l.left) && jsx_leaf(&l.right) => {
                let (mode, op) = match l.operator {
                    LogicalOperator::And => (1, "&&"),
                    LogicalOperator::Or => (2, "||"),
                    _ => (3, "??"),
                };
                let test = self.expr(&l.left);
                let right = self.cond_branch(&l.right);
                let v = self.unique("__rivetCond");
                let body = format!("{v} {op} ({})", right.print());
                Some(self.cond_call(test, mode, v, body))
            }
            _ => None,
        }
    }

    /// A `cond_v2` operand: a nested conditional with a JSX operand memoizes too (its accessor binds nested).
    fn cond_branch(&mut self, e: &'a Expression<'a>) -> Expr {
        match self.cond_v2(e) {
            Some(value) => value,
            None => self.expr(e),
        }
    }

    /// Among a component's lazy children: the "maybe nothing" forms `lazy_child_v2` makes live, memoized
    /// (`_scoped(_cond(…))`); None for the rest (`lazy_binds.rs`).
    pub(super) fn lazy_cond_v2(&mut self, e: &'a Expression<'a>) -> Option<Expr> {
        if !may_render_jsx(e) || self.v2_static_message(e) {
            return None;
        }
        let value = self.cond_v2(e)?;
        Some(Expr::call(&self.v2("_scoped"), vec![value]))
    }

    /// TERNARY-MEMO on resumed pages: in a resume symbol module (`Options::symbols`), a binding symbol
    /// `export const S = (captures) => () => (cond)` (resume.rs Bind / Region bodies) whose conditional has a JSX
    /// operand becomes `(captures) => _cond(() => test, mode, (v) => …)`: the symbol returns the memo's accessor, which
    /// the resumed region (`dom-resume.ts` → `_region`) runs as its read — so after activation the region re-creates its
    /// content only when the rendered branch changes, as on a client mount. Only the outer arrow initializing a
    /// declarator, the inner arrow without parameters and with a concise body; anything else is unchanged.
    pub(super) fn symbol_cond_v2(&mut self, id: NodeId, outer: &'a ArrowFunctionExpression<'a>) -> Option<Expr> {
        if self.server || !outer.expression || !matches!(self.tree.parent_kind(id), Some(AstKind::VariableDeclarator(_))) {
            return None;
        }
        let Some(Statement::ExpressionStatement(body)) = outer.body.statements.first() else { return None };
        let Expression::ArrowFunctionExpression(inner) = strip_parens(&body.expression) else { return None };
        if !inner.expression || inner.r#async || !inner.params.items.is_empty() || inner.params.rest.is_some() {
            return None;
        }
        let Some(Statement::ExpressionStatement(read)) = inner.body.statements.first() else { return None };
        let value = self.cond_v2(&read.expression)?;
        let span = outer.span;
        let head = self.tree.text_of(Span::new(span.start, inner.span.start)).to_string();
        let tail = self.tree.text_of(Span::new(inner.span.end, span.end)).to_string();
        Some(Expr::Func(format!("{head}{}{tail}", value.print())))
    }

    fn cond_call(&mut self, test: Expr, mode: usize, v: String, body: String) -> Expr {
        let cond = self.v2("_cond");
        Expr::call(&cond, vec![Expr::thunk(test), Expr::Num(mode), Expr::Arrow(vec![v], Box::new(Expr::Raw(body)))])
    }

    /// Lane COND (2026-10-07): a "maybe nothing" conditional among a component's lazy children (`{c() && <p/>}`,
    /// `{c() ? <p/> : null}`, `||` / `??`, nested / parenthesized: `may_render_jsx`) is `_scoped(() => expr)` like a
    /// fragment child, so it updates on its own reads wherever the slot lands — also under `Show` / `Match` /
    /// `Provider`, which call the slot once, untracked (before: frozen on its first value). Only these forms:
    /// other expressions (cdk `place(useChildren(…))` content builders) are built once by the slot call as before.
    pub(super) fn lazy_child_v2(&mut self, e: &'a Expression<'a>, value: Expr) -> Expr {
        if may_render_jsx(e) && dynamic(e) && !self.v2_static_message(e) { Expr::call(&self.v2("_scoped"), vec![Expr::thunk(value)]) } else { value }
    }

    /// Component call (LIVE-PROPS, spec `docs/design/specs/2026-10-07-live-props-design.md`): `_c(C, props)`,
    /// one props object per call whose entries that can read reactive state are getters (`live_props`), so
    /// the component's bindings reading `props.x` track the caller's signals and the component never
    /// re-runs. `For` lowers to the v2 keyed list (its `each` a getter when dynamic: the list effect reads it);
    /// `Show` / `Switch` / `Match` call their v2 twins (`_show` / `_switch` / `_match`, same props) instead of
    /// the exported components.
    pub(super) fn component_v2(&mut self, el: &'a JSXElement<'a>, mut callee: Expr, props: Vec<(Key, Expr)>) -> Expr {
        let (structural, thunked) = match &el.opening_element.name {
            JSXElementName::IdentifierReference(i) => {
                (self.imported_structural(i), self.resolve_ref(i, true).and_then(|decl| self.thunked.get(&decl).copied()))
            }
            _ => (None, None),
        };
        // `<For each={xs()}>` / `<Show when={c()}>` are getters now: the list effect / branch memo reads them (RV1014 retired).
        let props = self.live_props(el, props);
        if structural == Some("For") {
            let f = self.v2("_for");
            return Expr::call(&f, vec![props]);
        }
        let twin = match thunked {
            Some("Show") => Some("_show"),
            Some("Switch") => Some("_switch"),
            Some("Match") => Some("_match"),
            _ => None,
        };
        if let Some(twin) = twin {
            callee = Expr::Ident(self.v2(twin));
        }
        let f = self.v2("_c");
        Expr::call(&f, vec![callee, props])
    }

    /// The live props object of a component element (`component_v2`). An entry is a getter when its source
    /// expression can read reactive state (`dynamic`; css``-folded classes and static i18n messages are
    /// values) and its lowered value is not already lazy (an arrow / function: slot thunks, handlers, `by`):
    /// attributes, a conditional `r:slot` whose test reads state, and non-lazy `children` (`{props.children}`).
    /// Spreads merge through `_spreadProps` (`@rivetjs/runtime/props`: object-spread semantics like the server's
    /// `{ ...a, b }`, keeps getters live); a spread whose argument is more than a member chain (`{...rest()}`) is
    /// a reactive source (`() => rest()`). A lone spread of a member chain (`<C {...props} />`) passes that
    /// object itself, `p || {}` (spreading `undefined` / `null` gives no props; Solid `createComponent`).
    /// No getter for a value reading `this` / `super` / `new.target` / `arguments` or holding `await` /
    /// `yield` (`getter_safe`: a getter body has the props object as `this` and is its own function).
    pub(super) fn live_props(&mut self, el: &'a JSXElement<'a>, props: Vec<(Key, Expr)>) -> Expr {
        let reads = |this: &Self, e: &'a Expression<'a>| dynamic(e) && !this.v2_static_message(e) && this.getter_safe(e);
        // One flag per attribute entry, in `lower`'s push order (`r:slot` attributes are not entries).
        let mut flags: Vec<bool> = Vec::new();
        // F3: per attribute entry, a live `local.name` value (`member_prop`).
        let mut members: Vec<Option<(String, String)>> = Vec::new();
        let mut spreads: Vec<&'a Expression<'a>> = Vec::new();
        for item in &el.opening_element.attributes {
            match item {
                JSXAttributeItem::SpreadAttribute(s) => {
                    spreads.push(&s.argument);
                    flags.push(false);
                    members.push(None);
                }
                JSXAttributeItem::Attribute(attr) => {
                    if attr_name(self.tree, attr) == slots::SLOT {
                        continue;
                    }
                    let value = match &attr.value {
                        Some(JSXAttributeValue::ExpressionContainer(c)) => c.expression.as_expression(),
                        _ => None,
                    };
                    let live = value.is_some_and(|e| reads(self, e)) && self.folded(attr).is_none();
                    flags.push(live);
                    members.push(value.filter(|_| live).and_then(|e| self.member_prop(e)));
                }
            }
        }
        // Conditional slots (`{c() && <x r:slot="a"/>}`) whose test reads state.
        let mut conditional: Vec<&'a str> = Vec::new();
        for child in &el.children {
            if let JSXChild::ExpressionContainer(c) = child {
                if let Some(usage) = c.expression.as_expression().and_then(|e| slots::conditional_usage(self.tree, e)) {
                    if let Ok(name) = usage.name {
                        if reads(self, usage.test) {
                            conditional.push(name);
                        }
                    }
                }
            }
        }
        let live_children = resume::lazy_children(self.tree, el).is_empty()
            && el.children.iter().any(|child| match child {
                JSXChild::ExpressionContainer(c) => c.expression.as_expression().is_some_and(|e| reads(self, e)),
                _ => false,
            });
        // F3: `{local.children}` as the only child.
        let member_children = if live_children { self.member_child(el) } else { None };
        let mut segments: Vec<Expr> = Vec::new();
        let mut current: Vec<(Key, Expr)> = Vec::new();
        let mut current_members: Vec<Option<(String, String)>> = Vec::new();
        let mut spread_args = spreads.into_iter();
        for (n, (key, value)) in props.into_iter().enumerate() {
            let lazy = matches!(value, Expr::Arrow(..) | Expr::ArrowBlock(..) | Expr::Func(_));
            let live = !lazy
                && match &key {
                    _ if n < flags.len() => flags[n],
                    Key::Str(name) => conditional.iter().any(|c| *c == name.as_str()),
                    Key::Ident(name) => name == "children" && live_children,
                    _ => false,
                };
            let member = match &key {
                _ if !live => None,
                _ if n < members.len() => members[n].clone(),
                Key::Ident(name) if name == "children" => member_children.clone(),
                _ => None,
            };
            match key {
                Key::Spread => {
                    if !current.is_empty() {
                        let object = self.props_object(std::mem::take(&mut current), std::mem::take(&mut current_members));
                        segments.push(object);
                    }
                    let source = spread_args.next().is_some_and(|arg| dynamic(arg) && !member_chain(arg));
                    segments.push(if source { Expr::thunk(value) } else { value });
                }
                Key::Str(name) | Key::Ident(name) if live => {
                    current.push((Key::Getter(name), value));
                    current_members.push(member);
                }
                key => {
                    current.push((key, value));
                    current_members.push(None);
                }
            }
        }
        if segments.is_empty() {
            return self.props_object(current, current_members);
        }
        if !current.is_empty() {
            let object = self.props_object(current, current_members);
            segments.push(object);
        }
        if segments.len() == 1 && !matches!(segments[0], Expr::Arrow(..) | Expr::Object(_)) {
            // `{...p}` of an undefined / null `p` spreads nothing: the component still gets an object.
            let text = segments.remove(0).print();
            let plain = text.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '$' || c == '.');
            return Expr::Raw(if plain { format!("{text} || {{}}") } else { format!("({text}) || {{}}") });
        }
        let merge = self.props_helper();
        Expr::call(&merge, segments)
    }

    /// One live props object literal (`live_props` entries in source order) as a fast-mode object (props-layout,
    /// 2026-10-08, `docs/benchmarks/2026-10-08-props-suite.md`): an object literal with `get` entries is a V8
    /// dictionary-mode object (fresh getter closures per evaluation, one runtime call per accessor: ~490 B, slow
    /// creation and reads). With a getter it becomes a call of a hoisted per-layout factory,
    /// `__rivetPropsN(($rivetKey) => $rivetKey === 0 ? (g0) : (g1), a0, …)`: `_p(env)` (`@rivetjs/runtime/props`) makes
    /// a plain `{}` carrying `env` in a hidden slot, data entries are assigned in source order (a literal value is
    /// inlined into the factory, any other is an argument: evaluated at the call, in source order), getter `i` is
    /// installed by `_pg(o, key, i)` (own, enumerable, configurable; one shared getter function per index → one
    /// shared map per layout). Getter bodies live in the env arrow (lexical `this` = the call site's; `getter_safe`
    /// already keeps `this` / `arguments` / `await` / `yield` out of getters) and re-run per read. No getter, or
    /// a key listed twice (a data entry after a getter of the same key must replace it; `o[k] = v` would throw in
    /// the strict factory): the literal as before.
    ///
    /// F3 (lane IMPL-SPREAD, 2026-10-09): a getter entry whose value is `local.name` (`members[i]`, `member_prop`)
    /// installs through `_pm(o, key, i, local, "name")` instead: a helper- / compiler-made props object's own data
    /// property is copied as a value at creation (props objects never change a value: `splitProps` / `mergeProps`
    /// copy data entries too), so a wrapper forwarding `slot={local.slot}` hands the inner component a plain value
    /// (its static paths, no `mergeProps` getter chain); an accessor, an inherited key or any other object keeps
    /// getter `i` (env), as before. ui Button 1000: −31% mount, −50% heap (`$S/perf/PERF-LIBS-findings.md` F3).
    fn props_object(&mut self, entries: Vec<(Key, Expr)>, members: Vec<Option<(String, String)>>) -> Expr {
        if !entries.iter().any(|(key, _)| matches!(key, Key::Getter(_))) {
            return Expr::Object(entries);
        }
        let distinct = {
            let mut seen: FxHashSet<&str> = FxHashSet::default();
            entries.iter().all(|(key, _)| !matches!(key, Key::Spread) && seen.insert(key.text()))
        };
        if !distinct {
            return Expr::Object(entries);
        }
        let mut layout = String::new();
        let mut body: Vec<String> = Vec::new();
        let mut params = vec!["e".to_string()];
        let mut args: Vec<Expr> = Vec::new();
        let mut getters: Vec<Expr> = Vec::new();
        let object = self.props_export("_p", "__rivetPropsObject");
        let getter = self.props_export("_pg", "__rivetPropsGetter");
        for ((key, value), member) in entries.into_iter().zip(members) {
            let name = quote(key.text());
            match key {
                Key::Getter(_) if member.is_some() => {
                    let (source, property) = member.unwrap_or_default();
                    let pm = self.props_export("_pm", "__rivetPropsMember");
                    let property = quote(&property);
                    let param = format!("a{}", args.len());
                    layout.push_str(&format!("m{name}={property}\u{0}"));
                    body.push(format!("{pm}(o, {name}, {}, {param}, {property});", getters.len()));
                    params.push(param);
                    args.push(Expr::Ident(source));
                    getters.push(value);
                }
                Key::Getter(_) => {
                    layout.push_str(&format!("g{name}\u{0}"));
                    body.push(format!("{getter}(o, {name}, {});", getters.len()));
                    getters.push(value);
                }
                _ => match value {
                    Expr::Str(_) | Expr::Num(_) | Expr::True | Expr::Null | Expr::VoidZero => {
                        let text = value.print();
                        layout.push_str(&format!("c{name}={text}\u{0}"));
                        body.push(format!("o[{name}] = {text};"));
                    }
                    value => {
                        let param = format!("a{}", args.len());
                        layout.push_str(&format!("a{name}\u{0}"));
                        body.push(format!("o[{name}] = {param};"));
                        params.push(param);
                        args.push(value);
                    }
                },
            }
        }
        let factory = match self.props_factories.get(&layout) {
            Some(name) => name.clone(),
            None => {
                let name = self.unique(&format!("__rivetProps{}", self.hoists.len()));
                self.hoists.push(format!("const {name} = ({}) => {{ const o = {object}(e); {} return o; }};", params.join(", "), body.join(" ")));
                self.props_factories.insert(layout, name.clone());
                name
            }
        };
        let env = if getters.len() == 1 {
            Expr::thunk(getters.remove(0))
        } else {
            let k = match &self.props_key {
                Some(k) => k.clone(),
                None => {
                    let k = self.unique("$rivetKey");
                    self.props_key = Some(k.clone());
                    k
                }
            };
            let last = getters.len() - 1;
            let mut chain = String::new();
            for (i, value) in getters.iter().enumerate() {
                if i < last {
                    chain.push_str(&format!("{k} === {i} ? ({}) : ", value.print()));
                } else {
                    chain.push_str(&format!("({})", value.print()));
                }
            }
            Expr::Arrow(vec![k], Box::new(Expr::Raw(chain)))
        };
        let mut call = vec![env];
        call.extend(args);
        Expr::call(&factory, call)
    }

    /// F3: `local.name` (a static, non-optional member of a never-reassigned enclosing-function local, declared
    /// before the expression: the `_fx1` capture rule) → `(local, name)`; the object is captured at the call.
    fn member_prop(&self, e: &'a Expression<'a>) -> Option<(String, String)> {
        // Not on resumed pages: passing `local` whole to the factory would turn the resume site's narrow member
        // capture (`local.name`) into a whole-object capture (unserializable functions, wider `needs`).
        if self.resume_mode || self.symbols {
            return None;
        }
        let Expression::StaticMemberExpression(m) = strip_parens(e) else { return None };
        if m.optional {
            return None;
        }
        let Expression::Identifier(object) = &m.object else { return None };
        let captures = self.fx_captures(&[e])?;
        (captures.len() == 1 && captures[0] == object.name.as_str()).then(|| (object.name.to_string(), m.property.name.to_string()))
    }

    /// F3: the element's only child, when it is `{local.children}`-shaped (`member_prop`).
    fn member_child(&self, el: &'a JSXElement<'a>) -> Option<(String, String)> {
        let mut only: Option<&'a Expression<'a>> = None;
        for child in &el.children {
            match child {
                JSXChild::Text(text) if jsx_text(self.tree.text_of(text.span)).is_empty() => {}
                JSXChild::ExpressionContainer(c) if c.expression.as_expression().is_none() => {}
                JSXChild::ExpressionContainer(c) if only.is_none() => only = c.expression.as_expression(),
                _ => return None,
            }
        }
        self.member_prop(only?)
    }

    /// A getter body runs with the props object as `this`, outside the enclosing function: a value reading
    /// `this` / `super` / `new.target` / `arguments` or holding `await` / `yield` (anywhere inside, also in
    /// nested functions — conservative) stays a plain value, evaluated once at the call (`_cp` snapshot
    /// semantics). Unknown node → not safe.
    pub(super) fn getter_safe(&self, e: &'a Expression<'a>) -> bool {
        let tree = self.tree;
        let Some(id) = tree.expr_id(e) else {
            return false;
        };
        let mut ok = true;
        tree.walk(id, &mut |n| {
            match tree.kind(n) {
                AstKind::ThisExpression(_)
                | AstKind::Super(_)
                | AstKind::MetaProperty(_)
                | AstKind::AwaitExpression(_)
                | AstKind::YieldExpression(_) => ok = false,
                AstKind::IdentifierReference(i) if i.name == "arguments" => ok = false,
                _ => {}
            }
            ok
        });
        ok
    }
}

/// An identifier / `this` / static member chain of one (`props`, `local.dom`): a spread source read as an
/// object (its own getters stay live); anything else in a spread is a reactive source (`live_props`).
pub(super) fn member_chain(e: &Expression<'_>) -> bool {
    match strip_parens(e) {
        Expression::Identifier(_) | Expression::ThisExpression(_) => true,
        Expression::StaticMemberExpression(m) => member_chain(&m.object),
        _ => false,
    }
}

impl VNode {
    /// Any referenced node below the root (the root itself is always declared).
    fn needed_below(&self) -> bool {
        match self {
            VNode::Element { children, .. } => children.iter().any(VNode::needed),
            _ => false,
        }
    }
}
