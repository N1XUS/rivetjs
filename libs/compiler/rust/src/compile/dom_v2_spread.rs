//! Trailing spread attributes (lane IMPL-SPREAD F1, 2026-10-09, DOM v2 target): on `<el {...a} x="s" y={v}>` the plain
//! attributes after the LAST spread no longer ride the merged spread object (one generic per-key diff over ~30 keys on
//! cdk parts). Static ones are template text; the others are one `_attrs(el, [v…] | () => [v…], "names")` binding
//! (per-index diff, names validated here, accessor / `class` / `style` rules of a spread key). One binding, not one
//! effect per attribute: 23 per-attribute effects on the cdk Button measured slower than the merged spread. The
//! spread itself gets their normalized names as `exclude` (`_spread(el, v, flags, null, "names")`), so an explicit
//! attribute after it still wins over its keys, also while unset (`x={undefined}` keeps a spread `x` off). Attributes
//! before a spread stay in the object (the spread wins); several spreads merge as before. Emitted after the `_spread`:
//! the first run writes spread keys then the trailing attributes, the merged object's source order.
//! Not split (unchanged lowering): `select` / `textarea` (control lowering), `class:` / `style:` directives (they merge
//! into the spread object), no plain attribute after the last spread. Server output and resume spread sites
//! (`resume.rs`, one binding over the server markup) are unchanged; a `children` attribute stays the spread content.

use super::*;

/// The lowered trailing attributes of a split spread element.
pub(super) struct After {
    /// The spread's `exclude` (space separated; `className` / `htmlFor` as `class` / `for`, HTML lowercase twins, and
    /// `ref` for an explicit ref after the spread).
    pub exclude: String,
    /// `_attrs` values (array, or its thunk when any value can read state) and names; None: only template text.
    pub binding: Option<(Expr, String)>,
}

impl<'t, 'a> Compiler<'t, 'a> {
    /// The index of the element's last spread when the plain attributes after it lower on their own (some plain
    /// attribute other than `children` follows it; not `select` / `textarea`; no `class:` / `style:` directive).
    pub(super) fn spread_split(&self, el: &'a JSXElement<'a>, tag: &str, groups: Option<&styling::Groups<'a>>) -> Option<usize> {
        if matches!(tag, "select" | "textarea") || groups.is_some_and(|g| g.class.is_some() || g.style.is_some()) {
            return None;
        }
        let attributes = &el.opening_element.attributes;
        let last = attributes.iter().rposition(|a| matches!(a, JSXAttributeItem::SpreadAttribute(_)))?;
        attributes
            .iter()
            .skip(last + 1)
            .any(|a| matches!(a, JSXAttributeItem::Attribute(attr) if self.spread_plain(attr, tag) && attr_name(self.tree, attr) != "children"))
            .then_some(last)
    }

    /// Lower the plain attributes after the spread at `last`: static text into `html` (the open tag), the rest into
    /// one `_attrs` binding; checks / diagnostics are the spread object's (`spread_entry`).
    pub(super) fn spread_after(&mut self, el: &'a JSXElement<'a>, tag: &str, namespace: &'static str, last: usize, html: &mut String) -> After {
        let mut items: Vec<(String, &'a JSXAttribute<'a>, Expr)> = Vec::new();
        for item in el.opening_element.attributes.iter().skip(last + 1) {
            let JSXAttributeItem::Attribute(attr) = item else { continue };
            let attr: &'a JSXAttribute<'a> = attr;
            if attr_name(self.tree, attr) == "children" {
                continue;
            }
            let Some((_, value)) = self.spread_entry(attr, tag, namespace) else { continue };
            let name = html_name(attr_name(self.tree, attr)).to_string();
            // A repeated name: the last one wins, as in the object (HTML names are case-insensitive).
            items.retain(|(n, _, _)| if namespace == "html" { !n.eq_ignore_ascii_case(&name) } else { *n != name });
            items.push((name, attr, value));
        }
        let mut exclude: Vec<String> = Vec::new();
        let (mut names, mut values, mut reads) = (Vec::new(), Vec::new(), false);
        for (name, attr, value) in items {
            let lower = name.to_ascii_lowercase();
            if lower != name {
                exclude.push(lower);
            }
            exclude.push(name.clone());
            // Static text (no value / a string literal, checked by `spread_entry`): the template's.
            if attr.value.is_none() || attr_string(self.tree, attr).is_some() {
                let decoded = attr_string(self.tree, attr).map(decode_html);
                let text = match &decoded {
                    None => AttrValue::True,
                    Some(text) => AttrValue::Text(text),
                };
                if let Ok(text) = encode_attribute(&name, text, attribute_namespace(tag, attr_name(self.tree, attr), namespace)) {
                    html.push_str(&unquoted(text));
                }
                continue;
            }
            reads |= matches!(&attr.value, Some(JSXAttributeValue::ExpressionContainer(c)) if c.expression.as_expression().is_some_and(dynamic));
            names.push(name);
            values.push(value);
        }
        if ref_after_spread(self.tree, el) {
            exclude.push("ref".into());
        }
        let binding = (!values.is_empty()).then(|| {
            let array = Expr::Array(values);
            (if reads { Expr::thunk(array) } else { array }, names.join(" "))
        });
        After { exclude: exclude.join(" "), binding }
    }
}
