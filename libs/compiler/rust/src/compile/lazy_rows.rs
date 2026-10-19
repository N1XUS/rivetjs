//! LAZY-ROWS T2 (2026-10-19, spec `docs/design/specs/2026-10-19-lazy-collection-rows-design.md` §3.3): server resume target,
//! a lazy-eligible keyed `<For>` (verdict: `resume/rows.rs`) passes the compiler-private prop
//! `"$lazy": [flags]` / `[flags, "key.path"]` next to its `children` (already `_rFn(rowId, row, captures)`: the row
//! function's Slot / Fn site, emitted by `resume_node` or `resume_rows`):
//!
//! - `flags` 1: the row function reads its index parameter; 2: `by` is a function with a recipe (`_rFn(byId, by, caps)`).
//! - `key` (string, present iff `by` is a key path arrow): `by(item)` = the item's value at the dotted path (`""` = the
//!   item itself); `by` itself stays the authored (hoisted) function, so server keying is unchanged.
//!
//! The runtime ignores `$lazy` until LAZY-ROWS T4 (server `R` record) reads it; recorded Fors get no prop (unchanged bytes).

use super::*;

impl<'t, 'a> Compiler<'t, 'a> {
    /// `[flags, key?]` for a lazy-eligible `<For>` element on the server resume target.
    pub(super) fn lazy_rows(&self, el: &'a JSXElement<'a>) -> Option<Expr> {
        if !self.server {
            return None;
        }
        let element = self.id(el)?;
        let entry = self.resumed.as_ref()?.for_rows.iter().find(|e| e.element == element)?;
        if entry.reason.is_some() {
            return None;
        }
        let flags = u8::from(entry.index) | (u8::from(entry.by.is_some()) << 1);
        Some(Expr::Raw(match &entry.key {
            Some(key) => format!("[{flags}, {}]", quote(key)),
            None => format!("[{flags}]"),
        }))
    }
}
