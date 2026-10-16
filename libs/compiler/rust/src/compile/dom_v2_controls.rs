//! DOM v2 lowering of form controls and the other attribute kinds v1 handled alone (phase b of
//! docs/design/specs/2026-10-06-dom-v2-only-design.md): `<select value>` / `model:value` on a select
//! (`_select`, emitted after the select's children), `model:` (`_model`), `prop:` (`_setProp`, an
//! effect when the value can read state), `window:` / `document:` events (`clientEvent`), `r:slot`
//! (consumed by the slot lowering) and RCDATA content (`_rcdata`). Runtime: `libs/runtime/dom-v2-controls.ts`
//! (+ `_setProp` / `clientEvent` from `dom.ts`). Validity is checked up front (`dom_v2_check.rs`);
//! these only emit.

use super::*;

impl<'t, 'a> Compiler<'t, 'a> {
    /// Lower `attr` when it is one of the control / global / slot kinds; false = not ours.
    pub(super) fn v2_control_attr(
        &mut self,
        el: &'a JSXElement<'a>,
        attr: &'a JSXAttribute<'a>,
        tag: &str,
        b: &mut Build,
        var: &mut Option<String>,
        deferred: &mut Vec<String>,
    ) -> bool {
        let name = attr_name(self.tree, attr);
        if name == slots::SLOT {
            // Validated (a direct child of a component element): the slot lowering owns it, nothing renders.
            return true;
        }
        if let Some(global) = global_event(name) {
            let Some((target, event)) = global else { return true };
            self.used_abi.insert("clientEvent");
            let host = Expr::ident("globalThis");
            let host = if target == "window" { host } else { Expr::Member(Box::new(host), "document".into()) };
            let value = self.attr_value(attr);
            b.statements.push(Expr::call(&self.abi_name("clientEvent"), vec![host, Expr::Str(event), value]).print());
            return true;
        }
        if name.starts_with("prop:") {
            let Some(prop) = prop_name(name) else { return true };
            let reactive = match &attr.value {
                Some(JSXAttributeValue::ExpressionContainer(c)) => c.expression.as_expression().is_some_and(dynamic),
                _ => false,
            };
            let value = self.attr_value(attr).print();
            let target = self.element_var(var);
            let set = self.v2("_setProp");
            let call = format!("{set}({target}, {}, {value})", quote(prop));
            b.statements.push(if reactive { format!("{}(() => {call})", self.v2("_fx")) } else { call });
            return true;
        }
        if name.starts_with("model:") {
            let kind = self.v2_model_kind(el, attr).unwrap_or("value");
            let value = self.attr_value(attr).print();
            let target = self.element_var(var);
            if tag == "select" {
                let select = self.v2("_select");
                deferred.push(format!("{select}({target}, {value}, {value})"));
            } else {
                let model = self.v2("_model");
                b.statements.push(format!("{model}({target}, {}, {value})", quote(kind)));
            }
            return true;
        }
        if tag == "select" && name == "value" {
            let value = match &attr.value {
                Some(JSXAttributeValue::StringLiteral(_)) => Expr::Str(attr_string(self.tree, attr).map(decode_html).unwrap_or_default()),
                None => Expr::Str(String::new()),
                _ => self.attr_value(attr),
            };
            let target = self.element_var(var);
            let select = self.v2("_select");
            deferred.push(Expr::call(&select, vec![Expr::Ident(target), Expr::thunk(value)]).print());
            return true;
        }
        false
    }

    /// RCDATA content v1 binds (`bindRCData`): a `textarea` / `title` with expression children, or textarea
    /// text starting with a newline (the parser would drop it). Emits `_rcdata(el, parts)`; true = the
    /// children are consumed (the template element stays empty).
    pub(super) fn v2_rcdata(&mut self, el: &'a JSXElement<'a>, tag: &str, b: &mut Build, var: &mut Option<String>) -> bool {
        if !matches!(tag, "textarea" | "title") {
            return false;
        }
        let expressions = el.children.iter().any(|c| matches!(c, JSXChild::ExpressionContainer(e) if e.expression.as_expression().is_some()));
        let text: String = el
            .children
            .iter()
            .filter_map(|c| match c {
                JSXChild::Text(t) => Some(jsx_text(self.tree.text_of(t.span))),
                _ => None,
            })
            .collect();
        if !expressions && !(tag == "textarea" && text.starts_with(['\n', '\r'])) {
            return false;
        }
        let mut parts = Vec::new();
        for child in &el.children {
            match child {
                JSXChild::Text(t) => {
                    let text = jsx_text(self.tree.text_of(t.span));
                    if !text.is_empty() {
                        parts.push(Expr::Str(text));
                    }
                }
                JSXChild::ExpressionContainer(c) => {
                    if let Some(e) = c.expression.as_expression() {
                        let value = self.expr(e);
                        parts.push(Expr::thunk(value));
                    }
                }
                _ => {}
            }
        }
        let target = self.element_var(var);
        let rcdata = self.v2("_rcdata");
        b.statements.push(Expr::call(&rcdata, vec![Expr::Ident(target), Expr::Array(parts)]).print());
        true
    }
}
