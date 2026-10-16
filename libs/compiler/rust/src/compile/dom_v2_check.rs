//! DOM v2 validation: `v2_supported` asks the pure checks below before lowering a tree; a tree it rejects
//! goes to `report_dom`, which walks it once more and reports the diagnostics (the checks of the former
//! v1 `walk_dom`, same messages / spans / order, plus the nesting v1 repaired with parse wrappers).

use super::*;

/// Namespace of the last element of `path` (outermost first), as `walk_v2` derives it: `svg` / SVG-only
/// tags switch to SVG, `math` / MathML tags to MathML, children of `foreignObject` are HTML again;
/// `start` = the root's lexical namespace.
pub(super) fn path_namespace(path: &[&str], start: &'static str) -> &'static str {
    let mut namespace = start;
    let mut parent = "";
    for &tag in path {
        let inherited = if parent == "foreignObject" { "html" } else { namespace };
        namespace = element_namespace(tag, inherited);
        parent = tag;
    }
    namespace
}

/// An element's own namespace given the namespace it is created in.
pub(super) fn element_namespace(tag: &str, inherited: &'static str) -> &'static str {
    if tag == "svg" || SVG_ONLY.contains(&tag) {
        "svg"
    } else if tag == "math" || MATH_TAGS.contains(&tag) {
        "mathml"
    } else {
        inherited
    }
}

impl<'t, 'a> Compiler<'t, 'a> {
    /// C5: a statically visible list / branch directly in `<table>` (`<For>`, `<Show>`, `xs.map(…)`):
    /// its rows get an implied `<tbody>` from the HTML parser, which splits the server's marker pair
    /// across two parents (resume drift) and misplaces DOM paths. The child's node (RV1005 on every
    /// target; wrap the rows in `<tbody>`). Components and `{children}` stay legal (not visible here).
    pub(crate) fn implied_tbody_child(&self, el: &'a JSXElement<'a>) -> Option<NodeId> {
        el.children.iter().find_map(|child| match child {
            JSXChild::ExpressionContainer(c) => {
                let e = strip_parens(c.expression.as_expression()?);
                let call = match e {
                    Expression::CallExpression(call) => Some(&**call),
                    Expression::ChainExpression(chain) => match &chain.expression {
                        ChainElement::CallExpression(call) => Some(&**call),
                        _ => None,
                    },
                    _ => None,
                }?;
                let map = match &call.callee {
                    Expression::StaticMemberExpression(m) => m.property.name == "map",
                    _ => false,
                };
                if map { self.id(&**c) } else { None }
            }
            JSXChild::Element(child) => {
                let JSXElementName::IdentifierReference(i) = &child.opening_element.name else { return None };
                let structural = self.imported_structural(i).or_else(|| self.resolve_ref(i, true).and_then(|d| self.thunked.get(&d).copied()));
                matches!(structural, Some("For" | "Show")).then(|| self.id(&**child)).flatten()
            }
            _ => None,
        })
    }

    /// A literal attribute value as text (`a`, `a="x"`, `a={"x"}`, `` a={`x`} ``, `a={1}`): None when
    /// it is an expression (bare `a` is `""`, the server's textarea rule).
    pub(crate) fn literal_text(&self, attr: &'a JSXAttribute<'a>) -> Option<String> {
        match &attr.value {
            None => Some(String::new()),
            Some(JSXAttributeValue::StringLiteral(_)) => Some(attr_string(self.tree, attr).map(decode_html).unwrap_or_default()),
            Some(JSXAttributeValue::ExpressionContainer(c)) => match strip_parens(c.expression.as_expression()?) {
                Expression::StringLiteral(l) => Some(l.value.to_string()),
                Expression::TemplateLiteral(t) if t.expressions.is_empty() => t.quasis.first().and_then(|q| q.value.cooked.as_ref()).map(|c| c.to_string()),
                Expression::NumericLiteral(n) => Some(self.tree.text_of(n.span).to_string()).filter(|t| t.chars().all(|c| c.is_ascii_digit())),
                _ => None,
            },
            _ => None,
        }
    }

    /// Pure twin of `validate_model` (compile.rs): the bound property, or None where v1 reports
    /// "Unsupported model binding".
    pub(super) fn v2_model_kind(&self, el: &'a JSXElement<'a>, attr: &'a JSXAttribute<'a>) -> Option<&'static str> {
        let name = attr_name(self.tree, attr);
        let kind = name.get(6..).unwrap_or("");
        let tag = self.tag_of(el);
        let value = match &attr.value {
            Some(JSXAttributeValue::ExpressionContainer(c)) => c.expression.as_expression(),
            _ => None,
        };
        let type_attr = Self::attrs(el).find(|a| attr_name(self.tree, a) == "type");
        let type_value = type_attr.and_then(|a| attr_string(self.tree, a)).unwrap_or("text");
        let dynamic_type = type_attr.is_some_and(|a| a.value.is_some() && attr_string(self.tree, a).is_none());
        let reference = match value {
            Some(Expression::Identifier(_) | Expression::StaticMemberExpression(_) | Expression::PrivateFieldExpression(_)) => true,
            Some(Expression::ChainExpression(c)) => {
                matches!(c.expression, ChainElement::StaticMemberExpression(_) | ChainElement::PrivateFieldExpression(_))
            }
            _ => false,
        };
        let allowed = match kind {
            "value" => {
                tag == "textarea"
                    || tag == "select"
                    || (tag == "input" && ["text", "search", "email", "url", "tel", "password"].contains(&type_value))
            }
            "checked" => tag == "input" && type_value == "checkbox",
            _ => false,
        };
        (!dynamic_type && reference && allowed).then_some(if kind == "value" { "value" } else { "checked" })
    }

    /// Pure twin of the v1 `prop:` checks (`prop_name` + `prop_literal_ok`): a valid property name and,
    /// for a literal string, a safe URL value.
    pub(super) fn v2_prop_ok(&self, attr: &'a JSXAttribute<'a>, name: &str, tag: &str, namespace: &'static str) -> bool {
        let Some(prop) = prop_name(name) else { return false };
        let text = match &attr.value {
            Some(JSXAttributeValue::StringLiteral(_)) => attr_string(self.tree, attr).map(decode_html),
            Some(JSXAttributeValue::ExpressionContainer(c)) => match c.expression.as_expression().map(strip_parens) {
                Some(Expression::StringLiteral(l)) => Some(l.value.to_string()),
                _ => None,
            },
            _ => None,
        };
        let Some(text) = text else { return true };
        let lower = prop.to_ascii_lowercase();
        encode_attribute(&lower, AttrValue::Text(&text), attribute_namespace(tag, &lower, namespace)).is_ok()
    }

    /// `<template>` content v2 can put in the template HTML as is: text and native elements whose
    /// attributes are all literal (no bindings, events, refs, directives, spreads), recursively. Its
    /// content lives in `.content`, out of reach of the `firstChild` walk, so nothing inside may bind.
    pub(crate) fn v2_static_content(&self, children: &'a oxc_allocator::Vec<'a, JSXChild<'a>>) -> bool {
        children.iter().all(|child| match child {
            JSXChild::Text(_) => true,
            JSXChild::ExpressionContainer(c) => c.expression.as_expression().is_none(),
            JSXChild::Element(el) if self.native(el) => {
                let tag = self.tag_of(el);
                !matches!(tag, "textarea" | "title" | "select")
                    && el.opening_element.attributes.iter().all(|item| match item {
                        JSXAttributeItem::SpreadAttribute(_) => false,
                        JSXAttributeItem::Attribute(attr) => {
                            let name = attr_name(self.tree, attr);
                            (attr.value.is_none() || attr_string(self.tree, attr).is_some())
                                && !name.contains(':')
                                && !starts_with_on(name)
                                && !matches!(name, "ref" | "style" | "preload")
                        }
                    })
                    && self.v2_static_content(&el.children)
            }
            _ => false,
        })
    }

    /// Children of `textarea` / `title` (RCDATA in v1, any namespace): text and scalar expressions only
    /// (v1: "Textarea/title children must be scalar…", "Spread children are not supported"); a model
    /// textarea has no content ("Textarea model cannot also have children").
    pub(super) fn v2_rcdata_ok(&self, el: &'a JSXElement<'a>) -> bool {
        let scalar = el.children.iter().all(|child| matches!(child, JSXChild::Text(_) | JSXChild::ExpressionContainer(_)));
        let content = el.children.iter().any(|child| match child {
            JSXChild::Text(text) => !jsx_text(self.tree.text_of(text.span)).is_empty(),
            _ => true,
        });
        scalar && !(content && self.has_attribute(el, "model:value"))
    }

    /// `select` / `optgroup` / `option` children the HTML parser keeps as written ("in select" mode drops
    /// other tags): options (and option groups in a select), blank text, inserted values (expressions,
    /// components, fragments); option content is text and inserted values only.
    pub(super) fn v2_select_ok(&self, el: &'a JSXElement<'a>, tag: &str) -> bool {
        let tree = self.tree;
        el.children.iter().all(|child| match child {
            JSXChild::Text(text) => tag == "option" || jsx_text(tree.text_of(text.span)).trim().is_empty(),
            JSXChild::ExpressionContainer(_) => true,
            JSXChild::Element(child) if self.native(child) => {
                let inner = self.tag_of(child);
                tag != "option" && (inner == "option" || (tag == "select" && inner == "optgroup"))
            }
            // Components / fragments are inserted values (`<For>` of options, an option's text).
            JSXChild::Element(_) | JSXChild::Fragment(_) => true,
            JSXChild::Spread(_) => false,
        })
    }

    /// A native tree `v2_supported` rejects: its diagnostics (nothing is lowered — any diagnostic empties
    /// the module's code). Every rejected tree reports at least one; a rejection without a known
    /// reason is an internal error (RV9001) rather than silently wrong output.
    pub(crate) fn report_dom(&mut self, el: &'a JSXElement<'a>) -> Expr {
        let before = self.diags.list.len();
        self.check_dom(el, "inherit", &mut Vec::new());
        if self.diags.list.len() == before {
            let id = self.id(el);
            let tag = self.tag_of(el);
            self.diag(format!("Internal error: <{tag}> has no DOM lowering"), id);
        }
        Expr::Null
    }

    /// The former v1 `walk_dom` minus code generation: the same checks in the same order, expressions
    /// lowered for their own diagnostics (nested JSX), native children walked with their ancestors.
    fn check_dom(&mut self, el: &'a JSXElement<'a>, namespace: &'static str, ancestors: &mut Vec<&'a str>) {
        let mut namespace = namespace;
        let tag = self.tag_of(el);
        let el_id = self.id(el);
        if tag == "script" || tag == "style" {
            self.diag(
                if self.styles.is_some() {
                    "Script/style JSX content is not supported; use css`` from @rivetjs/runtime/css or build-time assets"
                } else {
                    "Script/style JSX content is not supported; use build-time assets"
                },
                el_id,
            );
            return;
        }
        if !native_tag_name(tag) {
            self.diag(
                format!("Unsupported native tag <{tag}>: use an HTML / SVG / MathML tag, a custom element with a hyphen (<my-el>) or a capitalized component (<MyEl />)"),
                el_id,
            );
            return;
        }
        // exception: user ruling 2026-10-06 (round-2 C6) — HTML parser rules (html.rs `parser_repaired`).
        if crate::html::parser_repaired(tag, ancestors) {
            self.diag(format!("Unsupported parser-repaired native nesting: {tag}"), el_id);
        }
        // exception: user ruling 2026-10-06 (round-2 C5) — rows directly in <table> (implied <tbody>).
        if tag == "table" {
            if let Some(id) = self.implied_tbody_child(el) {
                self.diag(IMPLIED_TBODY, Some(id));
            }
        }
        if tag == "svg" || SVG_TAGS.contains(&tag) {
            namespace = "svg";
        } else if tag == "math" || MATH_TAGS.contains(&tag) {
            namespace = "mathml";
        }
        self.preload_directive(el, tag);
        let spread = Self::has_spread(el);
        let groups = self.style_groups(el, spread);
        for (index, item) in el.opening_element.attributes.iter().enumerate() {
            let attr = match item {
                JSXAttributeItem::SpreadAttribute(_) => continue,
                JSXAttributeItem::Attribute(attr) => &**attr,
            };
            if self.is_preload_directive(attr, tag) || (spread && self.spread_plain(attr, tag)) {
                continue;
            }
            if let Some(groups) = groups.as_ref().filter(|g| g.members.contains(&index)) {
                if let Some(group) = groups.class.as_ref().filter(|g| !spread && g.first == index) {
                    self.class_value(group);
                }
                if let Some(group) = groups.style.as_ref().filter(|g| !spread && g.first == index) {
                    self.style_value(group);
                }
                continue;
            }
            if tag == "select" && attr_name(self.tree, attr) == "value" {
                if !matches!(&attr.value, None | Some(JSXAttributeValue::StringLiteral(_))) {
                    self.attr_value(attr);
                }
                continue;
            }
            let attr_id = self.id(attr);
            let name = attr_name(self.tree, attr);
            let namespace = attribute_namespace(tag, name, namespace);
            if name == slots::SLOT {
                self.slot_attr(el, attr);
                continue;
            }
            // exception: user ruling 2026-10-06 (round-2 C14) — literal event handlers.
            if starts_with_on(name) && Self::literal_handler(attr) {
                self.diag(format!("Event handler {name} must be a function"), attr_id);
                continue;
            }
            // exception: lane V2-Q4 (2026-10-07) — handlers bind once: RV1016 for bind-time state reads.
            self.bind_once_handler(name, attr, attr_id);
            match global_event(name) {
                Some(None) => self.diag(format!("Unsupported global event attribute: {name} (write window:onX / document:onX with a capitalized event name: window:onResize={{…}})"), attr_id),
                Some(Some(_)) => {
                    self.attr_value(attr);
                }
                None if name == "ref" => {
                    self.attr_value(attr);
                }
                None if starts_with_on(name) => match event_info(name) {
                    None => self.diag(format!("Unknown native event: {name} (a DOM event like onClick / onInput, or on:my-event={{…}} for a custom event)"), attr_id),
                    Some(_) => {
                        self.attr_value(attr);
                    }
                },
                None if name.starts_with("prop:") => match prop_name(name) {
                    None => self.diag(format!("Unsafe or unsupported native attribute: {name}"), attr_id),
                    Some(prop) => {
                        if self.prop_literal_ok(attr, prop, tag, namespace) {
                            self.attr_value(attr);
                        }
                    }
                },
                None if name.starts_with("model:") => {
                    if self.validate_model(el, attr).is_some() {
                        self.attr_value(attr);
                    }
                }
                None if !safe_attribute_name(name) => {
                    self.diag(format!("Unsafe or unsupported native attribute: {name}"), attr_id)
                }
                None if attr.value.is_none() || attr_string(self.tree, attr).is_some() => {
                    let decoded = attr_string(self.tree, attr).map(decode_html);
                    let value = match &decoded {
                        None => AttrValue::True,
                        Some(text) => AttrValue::Text(text),
                    };
                    let html_name = match name {
                        "className" => "class",
                        "htmlFor" => "for",
                        other => other,
                    };
                    if let Err(message) = encode_attribute(html_name, value, namespace) {
                        self.diag(message, attr_id);
                    }
                }
                None => {
                    if !self.static_attribute(attr, name, namespace, AttrSink::Check) {
                        self.attr_value(attr);
                    }
                }
            }
        }
        if spread {
            let object = Expr::Object(self.spread_object(el, tag, namespace, groups.as_ref(), None));
            self.spread_with_class(object, groups.as_ref());
        }
        let is_rcdata = tag == "textarea" || tag == "title";
        let text_of = |this: &Self, c: &JSXChild| match c {
            JSXChild::Text(text) => Some(jsx_text(this.tree.text_of(text.span))),
            _ => None,
        };
        let dynamic_rcdata = is_rcdata
            && el.children.iter().any(|c| matches!(c, JSXChild::ExpressionContainer(e) if e.expression.as_expression().is_some()));
        let bound_rcdata = dynamic_rcdata
            || (tag == "textarea" && el.children.iter().any(|c| text_of(self, c).is_some_and(|s| !s.is_empty())));
        let has_content =
            |this: &Self| el.children.iter().any(|c| text_of(this, c).is_none_or(|s| !s.is_empty()));
        if is_rcdata && self.has_attribute(el, "model:value") && has_content(self) {
            self.diag("Textarea model cannot also have children", el_id);
        }
        if is_rcdata {
            self.rcdata_parts(el, true);
        }
        // A textarea `value` / `defaultValue` is its content (server: the same diagnostic): one source only.
        if tag == "textarea" && Self::attrs(el).any(|a| matches!(attr_name(self.tree, a), "value" | "defaultValue")) && has_content(self) {
            self.diag("Textarea model cannot also have children", el_id);
        }
        if tag == "template" && !self.v2_static_content(&el.children) {
            // Bound `<template>` content: lowered for its own diagnostics.
            self.fragment_v2(&el.children);
            return;
        }
        if VOID_TAGS.contains(&tag) && namespace != "svg" && namespace != "mathml" {
            if has_content(self) {
                self.diag(format!("Void elements cannot have children: self-close <{tag} /> and drop its children"), el_id);
            }
            return;
        }
        if bound_rcdata {
            return;
        }
        // `select` / `optgroup` / `option` content the HTML parser drops or moves (`v2_select_ok`).
        let select = matches!(tag, "select" | "optgroup" | "option");
        for child in &el.children {
            match child {
                JSXChild::Text(text) => {
                    let content = jsx_text(self.tree.text_of(text.span));
                    if ["table", "tbody", "thead", "tfoot", "tr"].contains(&tag) && !content.trim().is_empty() {
                        let id = self.id(&**text);
                        self.diag("Text is not supported directly in table structure", id);
                    }
                    if matches!(tag, "select" | "optgroup") && !content.trim().is_empty() {
                        let id = self.id(&**text);
                        self.diag(format!("Unsupported parser-repaired native nesting: text in <{tag}>"), id);
                    }
                }
                JSXChild::Element(child) if self.native(child) => {
                    let inner = self.tag_of(child);
                    let parsed = if select {
                        tag != "option" && (inner == "option" || (tag == "select" && inner == "optgroup"))
                    } else {
                        // The parser wraps a `tr` in an implied `<tbody>` (C5).
                        !(tag == "table" && inner == "tr")
                    };
                    if !parsed {
                        let id = self.id(&**child);
                        self.diag(format!("Unsupported parser-repaired native nesting: {inner} in <{tag}>"), id);
                    }
                    ancestors.push(tag);
                    self.check_dom(child, if tag == "foreignObject" { "html" } else { namespace }, ancestors);
                    ancestors.pop();
                }
                JSXChild::ExpressionContainer(c) => {
                    let Some(e) = c.expression.as_expression() else { continue };
                    if self.i18n && self.v2_static_child(e, &mut Vec::new()) {
                        continue;
                    }
                    self.expr(e);
                }
                JSXChild::Spread(s) => {
                    let id = self.id(&**s);
                    self.diag("Spread children are not supported: render the array as one child ({items}) or map it ({items.map((x) => <li>{x}</li>)} / <For each={items} by={…}>)", id);
                    self.expr(&s.expression);
                }
                JSXChild::Element(c) => {
                    self.lower(Jsx::Element(c));
                }
                JSXChild::Fragment(f) => {
                    self.lower(Jsx::Fragment(f));
                }
            }
        }
    }
}
