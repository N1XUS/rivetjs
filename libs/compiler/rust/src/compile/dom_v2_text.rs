//! IMPL-DOM F2 (DOM v2 target): a sole dynamic text child binds its template's placeholder Text node. The template
//! holds one space (`<a> </a>`), the walk declares the Text node (`_el$N = el.firstChild`) and the binding writes it
//! through `_tx(text, value)`: scalars set `data` — no `$$t` expando on the element, no `firstChild` walk per update
//! (`_t` read + wrote the expando: dom-bench update100 1k rows 2.68 → 2.00 ms, Solid 1.9 3.51). A node / array /
//! accessor value switches the binding to insertion semantics at runtime (`_tx`, the emptied placeholder as marker),
//! so the lowering stays correct for any value; the choice below is a perf heuristic only.

use super::*;

/// Parents whose sole child keeps `_t`: table sections / rows (a text placeholder is foster-parented or dropped
/// by the parser), `select` / `optgroup` content, raw-text / RCDATA / opaque content handled elsewhere.
const NO_PLACEHOLDER: &[&str] = &[
    "table", "thead", "tbody", "tfoot", "tr", "colgroup", "select", "optgroup", "datalist", "script", "style", "template",
    "textarea", "title", "noscript", "iframe", "xmp", "noembed", "noframes", "plaintext", "head", "html", "frameset",
];

impl<'t, 'a> Compiler<'t, 'a> {
    /// Whether the sole dynamic child of `tag` binds a placeholder Text (`_tx`) rather than the element (`_t`):
    /// not under `NO_PLACEHOLDER` parents, not slot content (`{children}` / `{props.children}`), and no JSX inside
    /// the expression (`{rows().map((r) => <Row/>)}`, `{ok() ? <A/> : "-"}`): those render nodes and would switch
    /// to insertion on the first run (correct, but an extra empty Text + slot per binding).
    pub(super) fn text_placeholder(&self, tag: &str, source: Option<&Expression<'a>>) -> bool {
        if NO_PLACEHOLDER.contains(&tag) {
            return false;
        }
        let Some(e) = source else { return false };
        let slot = match strip_parens(e) {
            Expression::Identifier(i) => i.name == "children",
            Expression::StaticMemberExpression(m) => m.property.name == "children",
            _ => false,
        };
        if slot {
            return false;
        }
        let tree = self.tree;
        let Some(id) = tree.expr_id(e) else { return false };
        let mut jsx = false;
        tree.walk(id, &mut |n| {
            jsx |= matches!(tree.kind(n), AstKind::JSXElement(_) | AstKind::JSXFragment(_));
            !jsx
        });
        !jsx
    }

    /// The `_tx` binding of a sole dynamic child: `" "` joins the template, the placeholder Text gets a walk
    /// variable, and the binding (`_fx1` when its read fits, `dom_v2_lift.rs`) writes it; a throwing read empties it.
    pub(super) fn sole_text_v2(&mut self, b: &mut Build, children: &mut Vec<VNode>, printed: &str, source: Option<&Expression<'a>>) -> String {
        let text = self.v2_var();
        b.html.push(' ');
        children.push(VNode::Marker { var: text.clone() });
        let tx = self.v2("_tx");
        let error = self.unique("__rivetError");
        let captures = source.and_then(|e| self.fx_captures(&[e]));
        let body = format!("{{\ntry {{\n{tx}({text}, {printed});\n}} catch ({error}) {{\n{tx}({text}, null);\nthrow {error};\n}}\n}}");
        self.fx_bind(&text, captures, printed, body)
    }
}
