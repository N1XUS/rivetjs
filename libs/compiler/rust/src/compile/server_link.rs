//! Bare server `<Link>` (lane IMPL-RESUME 2026-10-09, PERF-SSR finding 3): on the server target, a router `<Link>`
//! (`@rivetjs/router/link` / `@rivetjs/router/client`) with only a `to` attribute (plus an optional string-literal
//! `class`) and static text children is written into the enclosing native template as the anchor its bare path
//! renders: `<a[ class="…"] href={_linkHref(to)}>text</a>` — no component call, props object or nested record per
//! link (rows stay one template). `_linkHref` (router) is the bare path's href (`withBase` + trailing-slash policy),
//! so the markup is byte-identical. Client targets keep the component.

use super::*;

impl<'t, 'a> Compiler<'t, 'a> {
    /// Writes a bare router `<Link>` child into `t` and returns true; false (nothing written) for any other element.
    pub(super) fn server_link(&mut self, el: &'a JSXElement<'a>, t: &mut ServerTemplate) -> bool {
        if !self.server || self.i18n {
            return false;
        }
        let JSXElementName::IdentifierReference(ident) = &el.opening_element.name else { return false };
        let Some(decl) = self.resolve_ref(ident, false) else { return false };
        let AstKind::ImportSpecifier(spec) = self.tree.kind(decl) else { return false };
        if spec.imported.name() != "Link"
            || !resume::import_source(self.tree, decl).is_some_and(|from| from == "@rivetjs/router/link" || from == "@rivetjs/router/client")
        {
            return false;
        }
        let mut to = None;
        let mut class = None;
        for item in &el.opening_element.attributes {
            let JSXAttributeItem::Attribute(attr) = item else { return false };
            match attr_name(self.tree, attr) {
                "to" if to.is_none() && attr.value.is_some() => to = Some(&**attr),
                "class" if class.is_none() && matches!(attr.value, Some(JSXAttributeValue::StringLiteral(_))) => class = Some(&**attr),
                _ => return false,
            }
        }
        let Some(to) = to else { return false };
        let mut text = String::new();
        for child in &el.children {
            let JSXChild::Text(part) = child else { return false };
            text.push_str(&jsx_text(self.tree.text_of(part.span)));
        }
        let mut open = String::from("<a");
        if let Some(class) = class {
            let value = attr_string(self.tree, class).map(decode_html).unwrap_or_default();
            match encode_attribute("class", AttrValue::Text(&value), "html") {
                Ok(encoded) => open.push_str(&encoded),
                Err(_) => return false,
            }
        }
        let value = self.attr_value(to);
        let href = self.i18n_name("@rivetjs/router/link", "_linkHref");
        t.append(&open);
        t.slot(Expr::Attr { callee: self.attribute_name.clone(), name: "href".into(), value: Box::new(Expr::call(&href, vec![value])), namespace: None });
        t.append(">");
        t.append(&escaped(&text));
        t.append("</a>");
        true
    }
}
