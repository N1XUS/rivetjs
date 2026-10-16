//! SRV-ROWFN (server resume target): fewer closures and arrays per rendered row.
//!
//! - `lifted_read`: a resumed attribute's read is a module-level arrow over the site's captures
//!   (`const __rivetRead0 = (__rivetCaps) => { const selected = __rivetCaps[0], row = __rivetCaps[1]; return (…); };`),
//!   called by the runtime as `read(captures)` (`_rAttr` / reactivity `_trackReads(fn, arg)`), instead of a
//!   thunk created per render / per row.
//! - `server_block_statement` + `share_captures`: equal capture lists written into one template's own
//!   `_rOn` / `_rAttr` slots become one `const __rivetCaps = [...]` per evaluation (the returned / concise
//!   body template lowers to a block), when no captured binding is ever written.
//! - `hoisted_key`: a closed `<For by>` key function is module-level.
//!
//! Server output (HTML + resume state) is unchanged: captures are read once, synchronously, by value.

use super::*;

impl<'t, 'a> Compiler<'t, 'a> {
    /// Server `_rAttr` read of a resumed attribute (see the module doc). Captures are every enclosing-function
    /// local the value reads (`resume::free_names`; `this` is RV-rejected) and `_rAttr` evaluates the read once,
    /// synchronously — so reading them from the captures array is the same read. Stays a thunk when the text
    /// may depend on the enclosing function itself (`arguments`, `await`, `yield`, `super`, `new.target`: a
    /// conservative token scan) or holds compiler temps / lowered helpers (`__rivet…`).
    pub(super) fn lifted_read(&mut self, site: usize, value: Expr) -> Expr {
        let Some(captures) = self.resumed.as_ref().map(|r| r.sites[site].captures.clone()) else { return Expr::thunk(value) };
        // A capture name that is not an identifier (a projection capture such as `globalDOMProps(props)`) cannot be
        // named by the hoisted read: keep the thunk.
        if captures.iter().any(|c| !c.chars().all(|ch| ch.is_alphanumeric() || ch == '_' || ch == '$')) {
            return Expr::thunk(value);
        }
        let text = value.print();
        let word = |w: &str| {
            text.match_indices(w).any(|(at, _)| {
                let ident = |c: Option<char>| c.is_some_and(|c| c.is_alphanumeric() || c == '_' || c == '$');
                !ident(text[..at].chars().next_back()) && !ident(text[at + w.len()..].chars().next())
            })
        };
        if text.contains("__rivet") || ["arguments", "await", "yield", "super"].iter().any(|&w| word(w)) || text.contains("new.target") {
            return Expr::thunk(value);
        }
        let name = self.unique(&format!("__rivetRead{}", self.hoists.len()));
        let read = if captures.is_empty() {
            Expr::thunk(value)
        } else {
            let locals: Vec<String> = captures.iter().enumerate().map(|(i, c)| format!("{c} = __rivetCaps[{i}]")).collect();
            Expr::ArrowBlock(
                vec!["__rivetCaps".to_string()],
                vec![format!("const {};", locals.join(", ")), format!("return ({});", value.print())],
            )
        };
        self.hoists.push(format!("const {name} = {};", read.print()));
        Expr::Ident(name)
    }

    /// A `return` argument / concise arrow body that is a native template whose own `_rOn` / `_rAttr` slots
    /// repeat a capture list: the statement becomes `{ const __rivetCaps = [...]; return <template>; }`.
    /// None (normal lowering) when no list repeats; lowered without a shared list, the statement keeps its
    /// exact text.
    pub(super) fn server_block_statement(&mut self, id: NodeId) -> Option<Expr> {
        if !self.server || self.resumed.is_none() {
            return None;
        }
        let argument = match self.tree.kind(id) {
            AstKind::ReturnStatement(r) => r.argument.as_ref()?,
            AstKind::ExpressionStatement(s) if self.is_concise_body(id) => &s.expression,
            _ => return None,
        };
        let el = as_element(strip_parens(argument))?;
        if !self.native(el) || !self.repeats_captures(el) {
            return None;
        }
        let root = self.id(el)?;
        let outer_root = self.share_caps.replace(root);
        let outer_shared = std::mem::take(&mut self.shared_caps);
        let reps = self.visit_children(id);
        let shared = std::mem::replace(&mut self.shared_caps, outer_shared);
        self.share_caps = outer_root;
        if shared.is_empty() {
            return Some(self.raw(id, &reps));
        }
        let mut text = String::from("{\n");
        for declaration in &shared {
            text.push_str(declaration);
            text.push('\n');
        }
        text.push_str("return ");
        text.push_str(&self.render(argument.span(), &reps));
        text.push_str(";\n}");
        Some(Expr::Stmts(text))
    }

    /// Pre-check for `server_block_statement`: two resumed handlers / attributes of the element's own
    /// template (native descendants, as `walk_server` writes them) with the same non-empty captures.
    fn repeats_captures(&self, el: &JSXElement<'a>) -> bool {
        let mut sites = Vec::new();
        self.template_sites(el, &mut sites);
        let Some(resumed) = self.resumed.as_ref() else { return false };
        sites.iter().enumerate().any(|(n, &a)| {
            let captures = &resumed.sites[a].captures;
            !captures.is_empty() && sites[n + 1..].iter().any(|&b| resumed.sites[b].captures == *captures)
        })
    }

    fn template_sites(&self, el: &JSXElement<'a>, out: &mut Vec<usize>) {
        for item in &el.opening_element.attributes {
            if let JSXAttributeItem::Attribute(attr) = item {
                let site = self.site_index(self.id(&**attr));
                if matches!(self.site_kind(site), Some(SiteKind::Event | SiteKind::Attr)) {
                    out.extend(site);
                }
            }
        }
        for child in &el.children {
            if let JSXChild::Element(child) = child {
                if self.native(child) {
                    self.template_sites(child, out);
                }
            }
        }
    }

    /// After `walk_server` of a statement's root template: equal capture lists of its `_rOn` / `_rAttr`
    /// slots (`t.caps`) → one declaration each (`shared_caps`), the slots take its name. Only when no captured
    /// binding has a write reference: the array is then evaluated before the slots with the same values.
    pub(super) fn share_captures(&mut self, t: &mut ServerTemplate) {
        let Some(resumed) = self.resumed.as_ref() else { return };
        let mut groups: Vec<(usize, Vec<(usize, usize)>)> = Vec::new();
        for &(slot, arg, site) in &t.caps {
            let captures = &resumed.sites[site].captures;
            if captures.is_empty() {
                continue;
            }
            match groups.iter_mut().find(|(first, _)| resumed.sites[*first].captures == *captures) {
                Some((_, members)) => members.push((slot, arg)),
                None => groups.push((site, vec![(slot, arg)])),
            }
        }
        for (first, members) in groups {
            if members.len() < 2 || self.captures_written(first) {
                continue;
            }
            let name = self.unique("__rivetCaps");
            let list = self.capture_list(first).print();
            self.shared_caps.push(format!("const {name} = {list};"));
            for (slot, arg) in members {
                if let Some(Expr::Call(_, args)) = t.slots.get_mut(slot) {
                    if let Some(value) = args.get_mut(arg) {
                        *value = Expr::Ident(name.clone());
                    }
                }
            }
        }
    }

    /// Whether a capture of the site may be reassigned (or its binding cannot be found).
    fn captures_written(&self, site: usize) -> bool {
        let Some(resumed) = self.resumed.as_ref() else { return true };
        let site = &resumed.sites[site];
        let decls = site.capture_decls();
        if decls.len() != site.captures.len() {
            return true;
        }
        let tree = self.tree;
        site.captures.iter().zip(decls).any(|(name, &decl)| {
            let mut symbol = None;
            tree.walk(decl, &mut |n| {
                if symbol.is_none() {
                    if let AstKind::BindingIdentifier(b) = tree.kind(n) {
                        if b.name == name.as_str() {
                            symbol = b.symbol_id.get();
                        }
                    }
                }
                symbol.is_none()
            });
            symbol.is_none_or(|symbol| tree.symbol_written(symbol))
        })
    }

    /// `<For by={(row) => row.id}>` on the server resume target: a key function reading nothing from enclosing
    /// functions (no `this` / `arguments` / `super` / `new.target`, no JSX) is hoisted to module level — one
    /// function per module instead of one per render.
    pub(super) fn hoisted_key(&mut self, el: &JSXElement<'a>, attr: &'a JSXAttribute<'a>, value: Expr) -> Expr {
        if !self.server || self.resumed.is_none() || !Self::function_value(attr, &value) {
            return value;
        }
        let is_for = matches!(&el.opening_element.name, JSXElementName::IdentifierReference(i) if self.imported_structural(i) == Some("For"));
        let function = match &attr.value {
            Some(JSXAttributeValue::ExpressionContainer(c)) => match &c.expression {
                JSXExpression::ArrowFunctionExpression(f) => self.id(&**f),
                JSXExpression::FunctionExpression(f) => self.id(&**f),
                _ => None,
            },
            _ => None,
        };
        if !function.is_some_and(|f| is_for && self.closed_function(f)) {
            return value;
        }
        let name = self.unique(&format!("__rivetBy{}", self.hoists.len()));
        self.hoists.push(format!("const {name} = {};", value.print()));
        Expr::Ident(name)
    }

    /// A function that refers only to its own bindings, module-scope bindings and globals.
    fn closed_function(&self, function: NodeId) -> bool {
        let tree = self.tree;
        let span = tree.span(function);
        let mut closed = true;
        tree.walk(function, &mut |n| {
            match tree.kind(n) {
                AstKind::ThisExpression(_)
                | AstKind::Super(_)
                | AstKind::MetaProperty(_)
                | AstKind::JSXElement(_)
                | AstKind::JSXFragment(_) => closed = false,
                AstKind::IdentifierReference(i) if !tree.in_type_name(n) => {
                    if i.name == "arguments" {
                        closed = false;
                    } else if let Some(symbol) = tree.symbol_of_ref(i) {
                        let at = tree.binding_span(i).unwrap_or(i.span);
                        let own = at.start >= span.start && at.end <= span.end;
                        if !own && !tree.module_symbol(symbol) {
                            closed = false;
                        }
                    }
                }
                _ => {}
            }
            closed
        });
        closed
    }
}
