//! RT-DIET2 (2026-10-26): static component children inside lite residuals (`derived_lite.rs`). A component child of a
//! native element whose props are all static closed-world values (literals, props members, module bindings / imports
//! read without a call; no function, no JSX, no children) renders the same nodes on both sides and never changes after
//! adoption: the server wraps it in `<!--[-->` / `<!--]-->` (`compile.rs` `walk_server`: a component child is always
//! marked under the derived model), so the residual skips it with a path step `h` and binds nothing in it. A `For` row
//! holding one: its spec is `0`, and the lite list (`dom-lite-list.ts` `_lf`) clones the first server row for the rows
//! it builds (no server row, or that row holds a boundary marker: `LiteMiss`). The child's own records, if it is a
//! boundary, adopt on their own (the server's lite pick requires a residual for every live record).
//!
//! Typical case: lucide `Icon` in a button (docs computed-total).

use oxc_ast::{AstKind, ast::*};

use super::{Compiler, attr_name, attr_string, jsx_text};
use super::derived_lite::Fail;

impl<'t, 'a> Compiler<'t, 'a> {
    /// `el` (a component element) qualifies as a static child: no spread, no children, every attribute a string, a
    /// bare boolean or an expression without a function, a call or JSX whose references `static_value` accepts.
    pub(super) fn lite_static_component(&self, el: &'a JSXElement<'a>, classify: &mut dyn FnMut(&Expression<'a>) -> Result<bool, Fail>) -> Result<(), Fail> {
        let tree = self.tree;
        // An identifier tag (no member / namespace tag) that is not a runtime structural component and not imported from
        // the router or the runtime (`<Link>` renders a bare `<a>` on the server: no marker pair).
        let JSXElementName::IdentifierReference(tag) = &el.opening_element.name else { return Err("component tag") };
        if self.imported_structural(tag).is_some() {
            return Err("structural child");
        }
        if let Some(decl) = tree.resolve(tag, false) {
            if crate::resume::import_source(tree, decl).is_some_and(|from| from.starts_with("@rivetjs/router") || from.starts_with("@rivetjs/runtime")) {
                return Err("framework component child");
            }
        }
        if el.children.iter().any(|child| match child {
            JSXChild::Text(text) => !jsx_text(tree.text_of(text.span)).is_empty(),
            JSXChild::ExpressionContainer(c) => c.expression.as_expression().is_some(),
            _ => true,
        }) {
            return Err("component children");
        }
        for item in &el.opening_element.attributes {
            let JSXAttributeItem::Attribute(attr) = item else { return Err("component spread") };
            let name = attr_name(tree, attr);
            if name.contains(':') || matches!(name, "ref" | "children") {
                return Err("component directive");
            }
            if attr.value.is_none() || attr_string(tree, attr).is_some() {
                continue;
            }
            let Some(JSXAttributeValue::ExpressionContainer(c)) = &attr.value else { return Err("component attribute") };
            let e = c.expression.as_expression().ok_or("component attribute")?;
            let id = tree.expr_id(e).ok_or("expression")?;
            let mut opaque = false;
            tree.walk(id, &mut |n| {
                if matches!(
                    tree.kind(n),
                    AstKind::ArrowFunctionExpression(_) | AstKind::Function(_) | AstKind::Class(_) | AstKind::JSXElement(_) | AstKind::JSXFragment(_)
                ) {
                    opaque = true;
                }
                !opaque
            });
            if opaque {
                return Err("component function prop");
            }
            // `true`: the value reads live state (a keyed signal, a row) — the child would change after adoption.
            if classify(e)? {
                return Err("component live prop");
            }
        }
        Ok(())
    }
}
