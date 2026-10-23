//! Lane COND (2026-10-07): an expression directly among a user component's lazy children
//! (`<Box>{c() && <p/>}</Box>`, `<Box>{c() ? "on" : "off"}</Box>`, `<Box>{view()}</Box>`).
//!
//! - Server: the plain lowered value (the slot thunk evaluates it where the component renders the children).
//! - DOM: a "maybe nothing" conditional (`may_render_jsx`: a JSX operand of `&&` / `||` / `??` / `?:`) is
//!   `_scoped(() => value)` (`dom_v2.rs` `lazy_child_v2`, the fragment-child rule), so it stays live where the slot
//!   lands — also under `Show` / `Provider`, which call the slot once. Other expressions are unchanged. With a dynamic
//!   test it is `_scoped(_cond(() => test, mode, (v) => …))` (TERNARY-MEMO, `cond_v2`: the branch is rebuilt only when
//!   the picked branch changes).

use super::*;

impl<'t, 'a> Compiler<'t, 'a> {
    /// The lowered value of an expression among a component's lazy children.
    pub(super) fn lazy_child_expression(&mut self, _c: &'a JSXExpressionContainer<'a>, e: &'a Expression<'a>) -> Expr {
        if self.server {
            return self.expr(e);
        }
        // TERNARY-MEMO: the "maybe nothing" forms `lazy_child_v2` makes live get the condition memo
        // (`_scoped(_cond(…))`, `dom_v2.rs` `cond_v2`); other lazy children are unchanged.
        if let Some(value) = self.lazy_cond_v2(e) {
            return value;
        }
        let value = self.expr(e);
        self.lazy_child_v2(e, value)
    }
}
