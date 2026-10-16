//! OPT-D closure-free bindings (DOM v2 target): a binding effect `_fx(() => writer(el, value))` whose
//! value reads at most two enclosing-function locals becomes `_fx1(__rivetFxN, el, a, b)` with the writer
//! hoisted to module level (`const __rivetFxN = (el, a, b) => writer(el, value);`). No closure + context
//! per binding instance (Chromium −32…−40 B per binding, reactivity `_bindingEffect1`); the effect's
//! lifetime, tracking, release rule and error handling are `_fx`'s.
//!
//! Captures are passed by value when the binding is created, so they must be bindings that are never
//! reassigned (`Tree::symbol_written`) and are declared before the expression (no TDZ read the closure
//! would have deferred). Mirrors SRV-ROWFN `lifted_read` (`server_rows.rs`) on the server target.

use super::*;

/// `_fx1` takes the element plus at most this many value captures.
const MAX_CAPTURES: usize = 2;

impl<'t, 'a> Compiler<'t, 'a> {
    /// Enclosing-function locals the binding's source expressions read, in first-read order; None when the
    /// binding must stay a closure: `this` / `super` / `new.target` / `arguments` / `await` / `yield`, JSX
    /// (lowered separately, may declare locals), a reassigned or later-declared capture, or more than
    /// `MAX_CAPTURES` locals. Module bindings and globals are not captures (the hoisted writer sees them).
    pub(super) fn fx_captures(&self, sources: &[&Expression<'a>]) -> Option<Vec<String>> {
        let tree = self.tree;
        let mut names: Vec<String> = Vec::new();
        for &e in sources {
            let id = tree.expr_id(e)?;
            let span = tree.span(id);
            let mut ok = true;
            tree.walk(id, &mut |n| {
                match tree.kind(n) {
                    AstKind::ThisExpression(_)
                    | AstKind::Super(_)
                    | AstKind::MetaProperty(_)
                    | AstKind::AwaitExpression(_)
                    | AstKind::YieldExpression(_)
                    | AstKind::JSXElement(_)
                    | AstKind::JSXFragment(_) => ok = false,
                    AstKind::IdentifierReference(i) if !tree.in_type_name(n) => {
                        if i.name == "arguments" {
                            ok = false;
                        } else if let Some(symbol) = tree.symbol_of_ref(i) {
                            let at = tree.binding_span(i).unwrap_or(i.span);
                            let own = at.start >= span.start && at.end <= span.end;
                            if !own && !tree.module_symbol(symbol) {
                                if tree.symbol_written(symbol) || at.start > span.start {
                                    ok = false;
                                } else if !names.iter().any(|name| name == i.name.as_str()) {
                                    names.push(i.name.to_string());
                                }
                            }
                        }
                    }
                    _ => {}
                }
                ok && names.len() <= MAX_CAPTURES
            });
            if !ok || names.len() > MAX_CAPTURES {
                return None;
            }
        }
        Some(names)
    }

    /// One binding effect over `body` (an expression, or a `{ … }` block): `_fx1` + a hoisted writer when
    /// `captures` fit and every compiler-generated name in the lowered value text is module-level
    /// (`generated_names_module_level`), else today's `_fx(() => body)`. `target` is the element variable (`_el$N`, unique per module), reused
    /// as the writer's first parameter name.
    pub(super) fn fx_bind(&mut self, target: &str, captures: Option<Vec<String>>, value: &str, body: String) -> String {
        let Some(captures) = captures.filter(|c| c.len() <= MAX_CAPTURES && self.generated_names_module_level(value)) else {
            return format!("{}(() => {body})", self.v2("_fx"));
        };
        let mut params = vec![target.to_string()];
        params.extend(captures);
        let name = self.unique(&format!("__rivetFx{}", self.hoists.len()));
        self.hoists.push(format!("const {name} = ({}) => {body};", params.join(", ")));
        format!("{}({name}, {})", self.v2("_fx1"), params.join(", "))
    }

    /// Whether every compiler-generated identifier in `text` (`__rivet…` / `__i18n…` / `_el$…`) names a
    /// module-level binding: a helper import or a hoist. Lowered locals (`__rivetP`, `__rivetItem`, element
    /// variables, …) are not in scope of a hoisted writer, so their presence keeps the closure. A token scan
    /// over the whole text (string contents included) — conservative.
    fn generated_names_module_level(&self, text: &str) -> bool {
        let ident = |c: char| c.is_alphanumeric() || c == '_' || c == '$';
        let mut rest = text;
        while let Some(start) = rest.find(|c: char| ident(c)) {
            let tail = &rest[start..];
            let end = tail.find(|c: char| !ident(c)).unwrap_or(tail.len());
            let token = &tail[..end];
            let generated = token.starts_with("__rivet") || token.starts_with("__i18n") || token.starts_with("_el$");
            let preceded_by_ident = rest[..start].chars().next_back().is_some_and(ident);
            if generated && !preceded_by_ident && !self.module_level(token) {
                return false;
            }
            rest = &tail[end..];
        }
        true
    }

    /// A module-level compiler name: helper import locals or a hoisted `const`.
    fn module_level(&self, name: &str) -> bool {
        self.v2_names.iter().any(|(_, local)| local == name)
            || self.abi.iter().any(|(_, local)| local == name)
            || self.style_imports.iter().any(|(_, local)| local == name)
            || self.i18n_imports.iter().any(|(_, _, local)| local == name)
            || self.slot_import.as_deref() == Some(name)
            || self.props_imports.iter().any(|(_, local)| local == name)
            || [&self.template_name, &self.attribute_name, &self.list_name, &self.list_plan_name].iter().any(|n| n.as_str() == name)
            || self.hoists.iter().any(|h| h.strip_prefix("const ").and_then(|h| h.strip_prefix(name)).is_some_and(|h| h.starts_with(" =")))
    }
}
