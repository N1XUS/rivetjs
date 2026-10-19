//! R-PLAN (server resume target, lane IMPL-RESUME 2026-10-09): resumable keyed `<For>` rows from a compiled row plan.
//!
//! `<For each by>{(row, index) => <native/>}</For>` whose row template holds only `_rOn` / `_rAttr` / `_rId` resume
//! sites (plus plain attributes and values) passes `$rows: [plan, write, env]` next to the authored `children`:
//!
//! - `plan` (module level): `_rRowPlan(fragments, entries, sites)` — the row template's list plan entries (`_rAttr` /
//!   `_rId` slots are attribute entries, `_rOn` slots child entries written null) and its resume sites in slot order:
//!   `[slot, 0]` `_rId`, `[slot, 1, type, symbol, shape, flags?]` `_rOn`, `[slot, 2, name, symbol, read, shape, ns?]`
//!   `_rAttr`; `shape` = per capture an env index, -1 the row item getter, -2 the index getter.
//! - `write(tape, base, row, index, env, site)` (module level): the row's slot values onto the tape, in slot order; a
//!   site slot is `site(k)` (the runtime evaluates `_rAttr` reads / reserves `_rId` ids); `env` = the enclosing
//!   function's locals the row reads, bound by name (`const selected = env[0]`).
//! - `env`: `[local, …]`, evaluated with the `For` props.
//!
//! The runtime (`server-resume.ts` `_onForRows`) writes rows that match the first row without per-row records and
//! renders every other case through `children`, so output and state equal the row-by-row path's. Eligible only when
//! the writer provably reads the same values: env locals are never written; the row / index params are only called
//! (`row()`, never stored: rows after the first share scratch getters); slot values hold no function, `this`,
//! `arguments`, `await` / `yield`, getter props or other resume calls; no twin flattening, no i18n variants.

use super::*;

impl<'t, 'a> Compiler<'t, 'a> {
    /// `(children, $rows)` for an eligible resumable `<For>`; `$rows` None when the lowered row template has a slot
    /// the plan cannot describe (the row renders through `children` alone, same output). None: not this shape.
    pub(super) fn resume_rows(&mut self, el: &'a JSXElement<'a>, rest: &[&'a JSXChild<'a>]) -> Option<(Expr, Option<Expr>)> {
        if !self.server || !self.resume_mode || !self.list_mounts || self.i18n || self.resumed.is_none() || rest.len() != el.children.len() {
            return None;
        }
        let JSXElementName::IdentifierReference(tag) = &el.opening_element.name else { return None };
        if self.imported_structural(tag) != Some("For") {
            return None;
        }
        if el.opening_element.attributes.iter().any(|a| match a {
            JSXAttributeItem::SpreadAttribute(_) => true,
            JSXAttributeItem::Attribute(attr) => matches!(attr_name(self.tree, attr), "children" | "$list" | "$rows") || attr_name(self.tree, attr) == slots::SLOT,
        }) {
            return None;
        }
        let mut content = el.children.iter().filter(|c| !matches!(c, JSXChild::Text(t) if jsx_text(self.tree.text_of(t.span)).is_empty()));
        let (Some(JSXChild::ExpressionContainer(c)), None) = (content.next(), content.next()) else { return None };
        let JSXExpression::ArrowFunctionExpression(callback) = &c.expression else { return None };
        let params = &callback.params;
        if callback.r#async || !callback.expression || !(1..=2).contains(&params.items.len()) || params.rest.is_some() {
            return None;
        }
        if params.items.iter().any(|p| !matches!(p.pattern.kind, BindingPatternKind::BindingIdentifier(_)) || p.pattern.optional) {
            return None;
        }
        // A row function that is itself a resume site (a symbol) keeps the authored lowering — except a lazy row (LAZY-T2,
        // 2026-10-19): the plan stays, `children` is registered as the row symbol (`_rFn(rowId, children, captures)`).
        let row_site = self.site_index(self.id(&**callback));
        if row_site.is_some() && self.lazy_rows(el).is_none() {
            return None;
        }
        let body = as_element(strip_parens(callback.get_expression()?))?;
        let body_id = self.id(body)?;
        if !self.native(body) || self.has_model(body_id) {
            return None;
        }
        let env = self.row_env(callback, body_id)?;
        let names: Vec<String> = params
            .items
            .iter()
            .map(|p| match &p.pattern.kind {
                BindingPatternKind::BindingIdentifier(i) => i.name.to_string(),
                _ => String::new(),
            })
            .collect();
        // Lowered once, sharing capture lists as the authored concise body would (`server_block_statement`).
        let outer_root = self.share_caps.replace(body_id);
        let outer_shared = std::mem::take(&mut self.shared_caps);
        let lowered = self.lower(Jsx::Element(body));
        let shared = std::mem::replace(&mut self.shared_caps, outer_shared);
        self.share_caps = outer_root;
        let rows = self.row_plan(&lowered, &names, &env);
        let children = if shared.is_empty() {
            Expr::Arrow(names, Box::new(lowered))
        } else {
            let mut statements = shared;
            statements.push(format!("return {};", lowered.print()));
            Expr::ArrowBlock(names, statements)
        };
        let children = match row_site {
            Some(site) => {
                let args = vec![self.site_str(site), children, self.capture_list(site)];
                self.r("fn", args)
            }
            None => children,
        };
        Some((children, rows))
    }

    /// The enclosing-function locals the row body reads (first-use order); None when the body reads `this` /
    /// `arguments` / `super` / `new.target`, one of them is ever written (the writer binds them once per list), or a row
    /// / index param is used other than called (`row()`) outside a nested function: rows after the first share scratch
    /// getters, valid only while their row is written (handlers capture the param itself; their captures are rebuilt).
    fn row_env(&self, callback: &ArrowFunctionExpression<'a>, body: NodeId) -> Option<Vec<String>> {
        let tree = self.tree;
        let span = callback.span;
        let params: Vec<Span> = callback
            .params
            .items
            .iter()
            .filter_map(|p| match &p.pattern.kind {
                BindingPatternKind::BindingIdentifier(i) => Some(i.span),
                _ => None,
            })
            .collect();
        let mut names: Vec<String> = Vec::new();
        let mut ok = true;
        tree.walk(body, &mut |n| {
            match tree.kind(n) {
                AstKind::ThisExpression(_) | AstKind::Super(_) | AstKind::MetaProperty(_) => ok = false,
                AstKind::IdentifierReference(i) if !tree.in_type_name(n) => {
                    if i.name == "arguments" {
                        ok = false;
                    } else if let Some(symbol) = tree.symbol_of_ref(i) {
                        let at = tree.binding_span(i).unwrap_or(i.span);
                        let own = at.start >= span.start && at.end <= span.end;
                        if own {
                            if params.contains(&at) && (tree.symbol_written(symbol) || !self.called_param(n, i.span, body)) {
                                ok = false;
                            }
                        } else if !tree.module_symbol(symbol) {
                            if tree.symbol_written(symbol) {
                                ok = false;
                            } else if !names.iter().any(|name| name == i.name.as_str()) {
                                names.push(i.name.to_string());
                            }
                        }
                    }
                }
                _ => {}
            }
            ok
        });
        ok.then_some(names)
    }

    /// A row / index param reference that is the callee of a zero-argument call, or sits in a nested function.
    fn called_param(&self, reference: NodeId, at: Span, body: NodeId) -> bool {
        let tree = self.tree;
        if let Some(AstKind::CallExpression(call)) = tree.parent_kind(reference) {
            if call.arguments.is_empty() && matches!(&call.callee, Expression::Identifier(c) if c.span == at) {
                return true;
            }
        }
        let mut node = reference;
        while let Some(parent) = tree.parent(node) {
            if parent == body {
                return false;
            }
            if tree.is_function(parent) {
                return true;
            }
            node = parent;
        }
        false
    }

    /// `[plan, write, env]` from the lowered row template, hoisting the plan and the writer; None when a slot is not
    /// a plain attribute / value or an `_rOn` / `_rAttr` / `_rId` site the plan describes.
    fn row_plan(&mut self, lowered: &Expr, params: &[String], env: &[String]) -> Option<Expr> {
        let Expr::Template { callee, fragments, slots } = lowered else { return None };
        if *callee != self.template_name {
            return None;
        }
        let local = |name: &str| self.resume_names.iter().find(|(n, _)| *n == name).map(|(_, l)| l.clone()).unwrap_or_default();
        let (on, attr, id) = (local("on"), local("attr"), local("id"));
        let site_fn = self.unique("__rivetSite");
        let mut entries = Vec::new();
        let mut specs: Vec<Expr> = Vec::new();
        let mut stores: Vec<Expr> = Vec::new();
        let site_call = |k: usize| Expr::call(&site_fn, vec![Expr::Num(k)]);
        for (n, slot) in slots.iter().enumerate() {
            let resume = match slot {
                Expr::Call(callee, args) => match &**callee {
                    Expr::Ident(c) if *c == id || *c == on || *c == attr => Some((c.clone(), args)),
                    _ => None,
                },
                _ => None,
            };
            match (slot, resume) {
                (_, Some((c, args))) if c == id => {
                    if !args.is_empty() {
                        return None;
                    }
                    entries.push(Expr::Array(vec![Expr::str("data-r"), Expr::str("html")]));
                    stores.push(site_call(specs.len()));
                    specs.push(Expr::Array(vec![Expr::Num(n), Expr::Num(0)]));
                }
                (_, Some((c, args))) if c == on => {
                    // `_rOn(type, symbol, captures, flags?)`; a 5th argument (`present`) records conditionally.
                    let [Expr::Str(event), Expr::Str(symbol), _, flags @ ..] = args.as_slice() else { return None };
                    if flags.len() > 1 || flags.first().is_some_and(|f| !matches!(f, Expr::Object(_))) {
                        return None;
                    }
                    let shape = self.row_shape(symbol, params, env)?;
                    let mut spec = vec![Expr::Num(n), Expr::Num(1), Expr::str(event), Expr::str(symbol), shape];
                    spec.extend(flags.iter().cloned());
                    entries.push(Expr::Null);
                    stores.push(Expr::Null);
                    specs.push(Expr::Array(spec));
                }
                (_, Some((_, args))) => {
                    // `_rAttr(name, symbol, read, captures, namespace?)` with a lifted (module-level) read.
                    let [Expr::Str(name), Expr::Str(symbol), Expr::Ident(read), _, namespace @ ..] = args.as_slice() else { return None };
                    let namespace = match namespace {
                        [] => "html".to_string(),
                        [Expr::Str(ns)] => ns.clone(),
                        _ => return None,
                    };
                    let shape = self.row_shape(symbol, params, env)?;
                    let mut spec = vec![Expr::Num(n), Expr::Num(2), Expr::str(name), Expr::str(symbol), Expr::ident(read), shape];
                    if namespace != "html" {
                        spec.push(Expr::str(&namespace));
                    }
                    entries.push(Expr::Array(vec![Expr::str(name), Expr::str(&namespace)]));
                    stores.push(site_call(specs.len()));
                    specs.push(Expr::Array(spec));
                }
                (Expr::Attr { callee, name, value, namespace }, None) if *callee == self.attribute_name => {
                    if !self.row_value(value) {
                        return None;
                    }
                    entries.push(Expr::Array(vec![Expr::str(name), Expr::str(namespace.as_deref().unwrap_or("html"))]));
                    stores.push((**value).clone());
                }
                (Expr::Attr { .. }, None) => return None,
                (value, None) => {
                    if !self.row_value(value) {
                        return None;
                    }
                    entries.push(Expr::Null);
                    stores.push(value.clone());
                }
            }
        }
        let plan = self.unique(&format!("__rivetRowPlan{}", self.hoists.len()));
        let call = self.r("rowPlan", vec![Expr::Ident(fragments.clone()), Expr::Array(entries), Expr::Array(specs)]);
        self.hoists.push(format!("const {plan} = /*#__PURE__*/ {};", call.print()));
        let writer = self.unique(&format!("__rivetRowTape{}", self.hoists.len()));
        let tape = self.unique("__rivetTape");
        let base = self.unique("__rivetBase");
        let env_name = self.unique("__rivetEnv");
        let index = match params.get(1) {
            Some(index) => index.clone(),
            None => self.unique("__rivetIndex"),
        };
        let mut text = format!("function {writer}({tape}, {base}, {}, {index}, {env_name}, {site_fn}) {{\n", params[0]);
        if !env.is_empty() {
            let locals: Vec<String> = env.iter().enumerate().map(|(i, name)| format!("{name} = {env_name}[{i}]")).collect();
            text.push_str(&format!("const {};\n", locals.join(", ")));
        }
        for (offset, value) in stores.into_iter().enumerate() {
            let target = Expr::Index(Box::new(Expr::ident(&tape)), Box::new(Self::at(&base, offset)));
            text.push_str(&Expr::Assign(Box::new(target), Box::new(value)).print());
            text.push_str(";\n");
        }
        text.push('}');
        self.hoists.push(text);
        Some(Expr::Array(vec![Expr::Ident(plan), Expr::Ident(writer), Expr::Array(env.iter().map(|name| Expr::ident(name)).collect())]))
    }

    /// A site's capture shape: per capture its env index, -1 (the row item getter) or -2 (the index getter).
    fn row_shape(&self, symbol: &str, params: &[String], env: &[String]) -> Option<Expr> {
        let site = self.resumed.as_ref()?.sites.iter().find(|s| s.id == symbol)?;
        if site.members.iter().any(Option::is_some) {
            return None;
        }
        // T8 review M1: a boxed `let` captured by value is not the env's cell.
        let cells = &self.resumed.as_ref()?.cells;
        if site.capture_kinds().iter().zip(site.capture_decls()).any(|(k, d)| *k == "value" && cells.contains(d)) {
            return None;
        }
        let mut shape = Vec::new();
        for capture in &site.captures {
            let code = if params.first() == Some(capture) {
                Expr::Raw("-1".into())
            } else if params.get(1) == Some(capture) {
                Expr::Raw("-2".into())
            } else {
                Expr::Num(env.iter().position(|name| name == capture)?)
            };
            shape.push(code);
        }
        Some(Expr::Array(shape))
    }

    /// A slot value the writer may evaluate in place: no function, getter prop, `this` / `arguments` / `super` /
    /// `await` / `yield` / `new.target`, no resume call (a conservative scan of the printed value; the row / index
    /// params are checked on the source, `row_env`).
    fn row_value(&self, value: &Expr) -> bool {
        if Self::defers(value) {
            return false;
        }
        let text = crate::map::unmarked(&value.print()).to_string();
        let ident = |c: Option<char>| c.is_some_and(|c| c.is_alphanumeric() || c == '_' || c == '$');
        let word = |w: &str| text.match_indices(w).any(|(at, _)| !ident(text[..at].chars().next_back()) && !ident(text[at + w.len()..].chars().next()));
        if text.contains("__rivetR_") || text.contains("=>") || text.contains("new.target") {
            return false;
        }
        !["function", "class", "this", "arguments", "super", "await", "yield"].iter().any(|w| word(*w))
    }

    /// Whether a lowered value holds a function or getter prop (evaluated later, after the row's getters moved on).
    fn defers(value: &Expr) -> bool {
        match value {
            Expr::Func(_) | Expr::Arrow(..) | Expr::ArrowBlock(..) | Expr::Stmts(_) => true,
            Expr::Component { callee, props, .. } => Self::defers(callee) || props.iter().any(|(key, v)| matches!(key, Key::Getter(_)) || Self::defers(v)),
            Expr::Object(props) => props.iter().any(|(key, v)| matches!(key, Key::Getter(_)) || Self::defers(v)),
            Expr::Call(callee, args) => Self::defers(callee) || args.iter().any(Self::defers),
            Expr::Array(items) => items.iter().any(Self::defers),
            Expr::Template { slots, .. } => slots.iter().any(Self::defers),
            Expr::Attr { value, .. } => Self::defers(value),
            Expr::Member(object, _) => Self::defers(object),
            Expr::Index(object, key) => Self::defers(object) || Self::defers(key),
            Expr::Assign(target, v) => Self::defers(target) || Self::defers(v),
            Expr::Raw(_) | Expr::Ident(_) | Expr::Str(_) | Expr::Num(_) | Expr::True | Expr::Null | Expr::VoidZero | Expr::Add(..) => false,
        }
    }
}
