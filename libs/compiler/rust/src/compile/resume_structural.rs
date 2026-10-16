//! Lane RT-PRELOAD (2026-10-08): on the server resume target, `<For each={xs()}>` and `<Show|Match when={c()}>` pass
//! `each` / `when` as getters (`{ get "each"() { return xs(); } }`) instead of eager values, so the runtime `For` / `Show` /
//! `Switch` read them inside their resume hooks (`server-resume.ts` `_onForEach` / `_onBranch` pick) like an accessor:
//! the enclosing site's read no longer counts them as steering reads, so a region mixing an eager `For each` with Shows
//! keeps its branch keys (adoptable; 57904e92 concern 2). Same getter rule as the DOM target's `live_props` (`dynamic` +
//! `getter_safe`); a lazy lowered value (arrow / function) stays a value. Non-resume server output is unchanged.

use super::dom_v2::dynamic;
use super::*;

impl<'t, 'a> Compiler<'t, 'a> {
    /// Turn the `each` (For) / `when` (Show, Match) entry of a runtime structural component call into a getter.
    pub(super) fn structural_getters(&self, el: &'a JSXElement<'a>, props: &mut [(Key, Expr)]) {
        if !self.server || self.resumed.is_none() {
            return;
        }
        self.lazy_fallback(el, props);
        let JSXElementName::IdentifierReference(tag) = &el.opening_element.name else { return };
        let name = if self.imported_structural(tag) == Some("For") {
            "each"
        } else {
            match self.resolve_ref(tag, true).and_then(|decl| self.thunked.get(&decl).copied()) {
                Some("Show" | "Match") => "when",
                _ => return,
            }
        };
        let live = el.opening_element.attributes.iter().any(|item| match item {
            JSXAttributeItem::Attribute(attr) if attr_name(self.tree, attr) == name => match &attr.value {
                Some(JSXAttributeValue::ExpressionContainer(c)) => c.expression.as_expression().is_some_and(|e| dynamic(e) && self.getter_safe(e)),
                _ => false,
            },
            _ => false,
        });
        if !live {
            return;
        }
        for (key, value) in props.iter_mut() {
            let plain = matches!(key, Key::Str(k) | Key::Ident(k) if k == name);
            if plain && !matches!(value, Expr::Arrow(..) | Expr::ArrowBlock(..) | Expr::Func(_)) {
                *key = Key::Getter(name.to_string());
            }
        }
    }

    /// RESUME-BUGS (2026-10-09): a JSX `fallback` (element / fragment) of a runtime `Show` / `Switch` lowers to a thunk on the
    /// resume server target. Evaluated eagerly with the props, an unrendered fallback recorded its bindings and handlers for
    /// elements the page never received: the first change of a signal it read threw "Missing resumable text N" in the browser.
    /// The server `Show` / `Switch` (`server-structural.ts` `branches`) calls function content only for the picked branch, so
    /// a rendered fallback records inside its branch as before. DOM target / non-resume server output unchanged.
    fn lazy_fallback(&self, el: &'a JSXElement<'a>, props: &mut [(Key, Expr)]) {
        let JSXElementName::IdentifierReference(tag) = &el.opening_element.name else { return };
        if !matches!(self.resolve_ref(tag, true).and_then(|decl| self.thunked.get(&decl).copied()), Some("Show" | "Switch")) {
            return;
        }
        let jsx = el.opening_element.attributes.iter().any(|item| match item {
            JSXAttributeItem::Attribute(attr) if attr_name(self.tree, attr) == "fallback" => match &attr.value {
                Some(JSXAttributeValue::ExpressionContainer(c)) => c
                    .expression
                    .as_expression()
                    .is_some_and(|e| matches!(e.without_parentheses(), Expression::JSXElement(_) | Expression::JSXFragment(_))),
                Some(JSXAttributeValue::Element(_) | JSXAttributeValue::Fragment(_)) => true,
                _ => false,
            },
            _ => false,
        });
        if !jsx {
            return;
        }
        for (key, value) in props.iter_mut() {
            if matches!(key, Key::Str(k) | Key::Ident(k) if k == "fallback") {
                let eager = std::mem::replace(value, Expr::Null);
                *value = Expr::thunk(eager);
            }
        }
    }
}
