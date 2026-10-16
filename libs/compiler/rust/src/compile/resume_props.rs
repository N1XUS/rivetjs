//! Lane LIVE-PROPS P3 (2026-10-08, spec `docs/design/specs/2026-10-07-live-props-design.md` §5): live props on
//! the server resume target. A user component call with a `Props` site (`resume.rs` `scan_props`: props that
//! can read state) passes the DOM target's live props object (`dom_v2.rs` `live_props`: getters, `_spreadProps`
//! spreads) through `_rProps(id, props, captures[, 1])` instead of eager values, so the component's bindings
//! read the getters inside their own tracked reads (`_rAttr` / `_rSpread` record the signals behind
//! `props.x`) and the call site's enclosing region records nothing it only passed on. The recipe (symbol +
//! captures) serializes the object for the browser (`@rivetjs/runtime/server-resume` `_rProps`); flag `1`:
//! the symbol takes the server's lazy children slot as its last parameter. A component whose body reads a
//! prop eagerly (destructuring) still reads it inside the enclosing `_rBind` region: re-created on change.
//! Twins (FLATTEN-CMP inlined components) keep their eager props.

use super::dom_v2::member_chain;
use super::*;

impl<'t, 'a> Compiler<'t, 'a> {
    /// The Props site of a component element on the server resume target (not a twin call).
    pub(super) fn props_site(&self, el: &'a JSXElement<'a>) -> Option<usize> {
        if !self.server {
            return None;
        }
        let key = match &el.opening_element.name {
            JSXElementName::IdentifierReference(i) => self.id(&**i),
            JSXElementName::MemberExpression(m) => self.id(&**m),
            _ => None,
        };
        let site = self.site_index(key)?;
        if self.site_kind(Some(site)) != Some(SiteKind::Props) {
            return None;
        }
        // `mark_component`'s twin rule: a spread-free call of an inlinable component stays eager.
        let spread = el.opening_element.attributes.iter().any(|a| matches!(a, JSXAttributeItem::SpreadAttribute(_)));
        if !spread && self.resolve_tag(&el.opening_element.name).is_some_and(|d| self.twins.contains_key(&d)) {
            return None;
        }
        Some(site)
    }

    /// `<C {...p} />` (a lone spread of a member chain: no Props site, `props_dynamic`) on the resume server target:
    /// `C(p || {})`, the object itself, as the DOM target passes it (`live_props`). The plain lowering `C({ ...p })`
    /// read every getter of `p` (a `mergeProps` / `splitProps` result forwarding live props) inside the enclosing
    /// site's read: that region recorded the signals behind them and was re-created on their first change, instead
    /// of `C`'s own bindings updating in place (lane RESUME-BUGS #2, 2026-10-09).
    pub(super) fn lone_spread_call(&self, el: &'a JSXElement<'a>, callee: &Expr, props: &[(Key, Expr)]) -> Option<Expr> {
        if !self.server || self.resumed.is_none() {
            return None;
        }
        let [JSXAttributeItem::SpreadAttribute(spread)] = el.opening_element.attributes.as_slice() else { return None };
        let [(Key::Spread, value)] = props else { return None };
        if !member_chain(&spread.argument) {
            return None;
        }
        Some(Expr::Call(Box::new(callee.clone()), vec![Expr::Raw(format!("{} || {{}}", value.print()))]))
    }

    /// `Tag(_rProps(id, liveProps, captures[, 1]))`.
    pub(super) fn resume_props_call(&mut self, el: &'a JSXElement<'a>, callee: Expr, props: Vec<(Key, Expr)>, site: usize) -> Expr {
        let object = self.live_props(el, props);
        // A lone `{...props}` passes the object itself (`props || {}`): it keeps its own encoding.
        if matches!(object, Expr::Raw(_)) {
            return Expr::Call(Box::new(callee), vec![object]);
        }
        let mut args = vec![self.site_str(site), object, self.capture_list(site)];
        if self.resumed.as_ref().is_some_and(|r| r.sites[site].props_children) {
            args.push(Expr::Num(1));
        }
        let props = self.r("props", args);
        Expr::Call(Box::new(callee), vec![props])
    }
}
