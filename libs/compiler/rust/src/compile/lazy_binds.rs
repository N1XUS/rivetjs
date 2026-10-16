//! Lane COND (2026-10-07): an expression directly among a user component's lazy children
//! (`<Box>{c() && <p/>}</Box>`, `<Box>{c() ? "on" : "off"}</Box>`, `<Box>{view()}</Box>`).
//!
//! - Server, resume: a child binding site (`resume.rs` `lazy_child_bind`), like the same expression under a
//!   native element — `_rBind(id, () => value, captures[, 1])` inside the slot thunk, so its reads record a
//!   text site or a region where the component renders the children (a JSX branch keeps the region while the
//!   value is null / false: flag `1`, `may_render_jsx`). Before, the slot ran outside any site: on a resumed
//!   page the expression never updated (its reads attributed to no region at the page root).
//! - DOM: a "maybe nothing" conditional (`may_render_jsx`: a JSX operand of `&&` / `||` / `??` / `?:`) is
//!   `_scoped(() => value)` (`dom_v2.rs` `lazy_child_v2`, the fragment-child rule), so it stays live where the slot
//!   lands — also under `Show` / `Provider`, which call the slot once. Other expressions are unchanged. With a dynamic
//!   test it is `_scoped(_cond(() => test, mode, (v) => …))` (TERNARY-MEMO, `cond_v2`: the branch is rebuilt only when
//!   the picked branch changes).

use super::*;

impl<'t, 'a> Compiler<'t, 'a> {
    /// The lowered value of an expression among a component's lazy children.
    pub(super) fn lazy_child_expression(&mut self, c: &'a JSXExpressionContainer<'a>, e: &'a Expression<'a>) -> Expr {
        if !self.server {
            // TERNARY-MEMO: the "maybe nothing" forms `lazy_child_v2` makes live get the condition memo
            // (`_scoped(_cond(…))`, `dom_v2.rs` `cond_v2`); other lazy children are unchanged.
            if let Some(value) = self.lazy_cond_v2(e) {
                return value;
            }
            let value = self.expr(e);
            return self.lazy_child_v2(e, value);
        }
        let value = self.expr(e);
        let site = self.site_index(self.id(c));
        let (Some(SiteKind::Bind), Some(site)) = (self.site_kind(site), site) else { return value };
        let id = self.site_str(site);
        let captures = self.capture_list(site);
        let mut args = vec![id, Expr::thunk(value), captures];
        if may_render_jsx(e) {
            args.push(Expr::Num(1));
        }
        self.r("bind", args)
    }
}
