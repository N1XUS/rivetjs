//! Incremental server lists (lane INCR2, opt-in compile option `incr`, server target, resume on): a `<For>` whose row
//! render is proven a pure function of the row item's read fields (plus keyed row signals at their literal init) gets a
//! hoisted fact `"$incr": _incrSite({ i, v, c, s, x })` (`@rivetjs/runtime/server-incr`: freezes it and installs the
//! runtime's list hooks in the bundle that holds the module) the runtime list cache reuses row bytes with:
//! - `i`: site id `<module>#<n>` (n-th proven list of the module);
//! - `v(item)`: the item's read field values (row + key paths), `c(item, values)`: `===` per value;
//! - `s`: keyed signals each row makes, `[key, init, …]` (registered for reused rows at their init, LIT);
//! - `x`: 1 when rows read their index.
//!
//! The proof (anything else: no fact, the list renders as before):
//! - `<For each by [fallback]>` from the structural `For`, no spread; `by` = `(p) => p.a.b` (a static member path of its
//!   parameter, or the parameter itself);
//! - the sole child is a non-async arrow with 1–2 identifier params; its body is an element, or a block of
//!   `const x = signal(<primitive literal>?)` declarations (`signal` from `@rivetjs/reactivity`) then `return <element>`;
//! - the element tree: native elements only (no components, slots, structural children, fragments, spreads, `model:` /
//!   namespaced / `$` attributes, `ref`, raw content attributes), not text-content or form-value elements
//!   (`textarea` / `select` / `option` / `script` / `style` / `svg` / `math` / opaque content);
//! - handlers (`onX`) are function literals that are neither conditional (`_rHandler`) nor orphan (`_rListens`) sites: the
//!   server never runs them;
//! - every other value is a pure expression: literals, `undefined`, templates, `!` / `-` / `+` / `~` / `typeof` / `void`,
//!   binary (not `/` / `%` / `**` — they tell `-0` from `0` — `in`, `instanceof`), logical and conditional expressions over
//!   `row().a.b` (static member paths, `?.` kept), `index()`, and reads `x()` of the row's local signals. No other
//!   identifier, call or member access. Leaves are scalars at runtime (the cache checks), so `===` per read path decides
//!   the row's bytes.
use oxc_ast::ast::*;
use oxc_semantic::SymbolId;
use oxc_span::GetSpan;

use super::{Compiler, OPAQUE_CONTENT, attr_name, is_native};
use crate::ir::{Expr, quote};
use crate::resume;

/// Elements whose server output is not "start tag + attributes + children" (text content, form values, other namespaces).
const SPECIAL: &[&str] = &["textarea", "select", "option", "optgroup", "script", "style", "svg", "math"];
/// Attributes the server lowers into content or ignores in ways a cached row could not reproduce.
const RAW: &[&str] = &["ref", "children", "innerHTML", "textContent", "innerText", "dangerouslySetInnerHTML", "key"];

#[derive(Default)]
struct Proof {
    /// Read paths (`.a.b` / `?.a`, empty: the item itself), deduplicated, in first-read order.
    paths: Vec<String>,
    /// Keyed row signals: (key, init source).
    state: Vec<(String, String)>,
    index: bool,
}

/// Symbols the row may read.
struct Scope {
    row: Option<SymbolId>,
    index: Option<SymbolId>,
    locals: Vec<SymbolId>,
}

enum Root {
    Row,
    Index,
    Local,
}

fn binding_symbol(p: &FormalParameter<'_>) -> Option<SymbolId> {
    match &p.pattern.kind {
        BindingPatternKind::BindingIdentifier(id) if !p.pattern.optional => id.symbol_id.get(),
        _ => None,
    }
}

fn peel<'b, 'a>(mut e: &'b Expression<'a>) -> &'b Expression<'a> {
    loop {
        e = match e {
            Expression::ParenthesizedExpression(p) => &p.expression,
            Expression::TSAsExpression(t) => &t.expression,
            Expression::TSSatisfiesExpression(t) => &t.expression,
            Expression::TSNonNullExpression(t) => &t.expression,
            _ => return e,
        };
    }
}

/// A primitive literal (`"x"`, `1`, `-1`, `true`, `null`): its value is its source.
fn primitive_literal(e: &Expression<'_>) -> bool {
    match peel(e) {
        Expression::StringLiteral(_) | Expression::NumericLiteral(_) | Expression::BooleanLiteral(_) | Expression::NullLiteral(_) => true,
        Expression::UnaryExpression(u) => u.operator == UnaryOperator::UnaryNegation && matches!(peel(&u.argument), Expression::NumericLiteral(_)),
        _ => false,
    }
}

impl<'t, 'a> Compiler<'t, 'a> {
    /// The hoisted `$incr` fact of a proven `<For>` (see the module docs), or None.
    pub(super) fn incr_fact(&mut self, el: &'a JSXElement<'a>) -> Option<Expr> {
        if !self.incr || !self.server {
            return None;
        }
        let module = self.derived_module()?;
        let JSXElementName::IdentifierReference(tag) = &el.opening_element.name else { return None };
        if self.imported_structural(tag) != Some("For") {
            return None;
        }
        let mut by = None;
        for attr in &el.opening_element.attributes {
            let JSXAttributeItem::Attribute(attr) = attr else { return None };
            match attr_name(self.tree, attr) {
                "each" | "fallback" => {}
                "by" => by = Some(attr),
                _ => return None,
            }
        }
        let mut proof = Proof::default();
        // Key: `(p) => p.a.b`.
        let Some(JSXAttributeValue::ExpressionContainer(c)) = &by?.value else { return None };
        let JSXExpression::ArrowFunctionExpression(key) = &c.expression else { return None };
        if key.r#async || !key.expression || key.params.items.len() != 1 || key.params.rest.is_some() {
            return None;
        }
        let param = binding_symbol(&key.params.items[0])?;
        let mut path = String::new();
        if !self.incr_key_path(key.get_expression()?, param, &mut path) {
            return None;
        }
        let key_path = path;
        // Row callback.
        let mut content = el.children.iter().filter(|c| !matches!(c, JSXChild::Text(t) if super::jsx_text(self.tree.text_of(t.span)).is_empty()));
        let (Some(JSXChild::ExpressionContainer(c)), None) = (content.next(), content.next()) else { return None };
        let JSXExpression::ArrowFunctionExpression(callback) = &c.expression else { return None };
        let params = &callback.params;
        if callback.r#async || !(1..=2).contains(&params.items.len()) || params.rest.is_some() {
            return None;
        }
        let mut scope = Scope { row: Some(binding_symbol(&params.items[0])?), index: None, locals: Vec::new() };
        if let Some(p) = params.items.get(1) {
            scope.index = Some(binding_symbol(p)?);
        }
        let body = if callback.expression {
            callback.get_expression()?
        } else {
            let statements = &callback.body.statements;
            let (last, decls) = statements.split_last()?;
            for statement in decls {
                let Statement::VariableDeclaration(v) = statement else { return None };
                if v.kind != VariableDeclarationKind::Const {
                    return None;
                }
                for d in &v.declarations {
                    let BindingPatternKind::BindingIdentifier(id) = &d.id.kind else { return None };
                    let Some(Expression::CallExpression(call)) = d.init.as_ref().map(peel) else { return None };
                    if call.optional || resume::derived::keyed_callee(self.tree, call) != Some(false) || call.arguments.len() > 1 {
                        return None;
                    }
                    let init = match call.arguments.first() {
                        None => "undefined".to_string(),
                        Some(a) => {
                            let e = a.as_expression()?;
                            if !primitive_literal(e) {
                                return None;
                            }
                            self.tree.text_of(peel(e).span()).to_string()
                        }
                    };
                    let id_node = self.id(&**call)?;
                    if let Some((key, store)) = self.derived.as_ref()?.plan.keyed.get(&id_node) {
                        if *store {
                            return None;
                        }
                        proof.state.push((key.clone(), init));
                    }
                    scope.locals.push(id.symbol_id.get()?);
                }
            }
            let Statement::ReturnStatement(r) = last else { return None };
            r.argument.as_ref()?
        };
        let Expression::JSXElement(root) = peel(body) else { return None };
        if !self.incr_element(root, &scope, &mut proof) {
            return None;
        }
        if !proof.paths.contains(&key_path) {
            proof.paths.push(key_path);
        }
        let site = format!("{module}#{}", self.incr_sites);
        self.incr_sites += 1;
        let values: Vec<String> = proof.paths.iter().map(|p| format!("a{p}")).collect();
        let compare = if values.is_empty() {
            "true".to_string()
        } else {
            values.iter().enumerate().map(|(i, v)| format!("{v} === s[{i}]")).collect::<Vec<_>>().join(" && ")
        };
        let state: Vec<String> = proof.state.iter().flat_map(|(k, init)| [quote(k), init.clone()]).collect();
        let site_fn = match &self.incr_site {
            Some(local) => local.clone(),
            None => {
                let local = self.unique("__rivetIncrSite");
                self.incr_site = Some(local.clone());
                local
            }
        };
        let name = self.unique(&format!("__rivetIncr{}", self.hoists.len()));
        self.hoists.push(format!(
            "const {name} = /*#__PURE__*/ {site_fn}({{ i: {}, v: (a) => [{}], c: (a, s) => {compare}, s: [{}], x: {} }});",
            quote(&site),
            values.join(", "),
            state.join(", "),
            u8::from(proof.index)
        ));
        Some(Expr::Ident(name))
    }

    /// `p`, `p.a`, `p?.a.b` rooted at the key parameter: the path text (`""`, `.a`, `?.a.b`).
    fn incr_key_path(&self, e: &Expression<'a>, param: SymbolId, out: &mut String) -> bool {
        match peel(e) {
            Expression::Identifier(ident) => self.tree.symbol_of_ref(ident) == Some(param),
            Expression::StaticMemberExpression(m) => {
                if !self.incr_key_path(&m.object, param, out) {
                    return false;
                }
                out.push_str(if m.optional { "?." } else { "." });
                out.push_str(&m.property.name);
                true
            }
            Expression::ChainExpression(c) => match &c.expression {
                ChainElement::StaticMemberExpression(m) => {
                    if !self.incr_key_path(&m.object, param, out) {
                        return false;
                    }
                    out.push_str(if m.optional { "?." } else { "." });
                    out.push_str(&m.property.name);
                    true
                }
                _ => false,
            },
            _ => false,
        }
    }

    fn incr_element(&self, el: &'a JSXElement<'a>, scope: &Scope, proof: &mut Proof) -> bool {
        if !is_native(self.tree, el) || !self.native(el) || !matches!(el.opening_element.name, JSXElementName::Identifier(_)) {
            return false;
        }
        let tag = self.tree.text_of(el.opening_element.name.span());
        if SPECIAL.contains(&tag) || OPAQUE_CONTENT.contains(&tag) || tag.contains('-') {
            return false;
        }
        let Some(id) = self.id(el) else { return false };
        if self.has_model(id) || self.derived.as_ref().is_some_and(|d| d.plan.attr_roots.contains(&id)) {
            return false;
        }
        for attr in &el.opening_element.attributes {
            let JSXAttributeItem::Attribute(attr) = attr else { return false };
            let JSXAttributeName::Identifier(_) = &attr.name else { return false };
            let name = attr_name(self.tree, attr);
            if name.contains('$') || RAW.contains(&name) {
                return false;
            }
            let handler = name.len() > 2 && name.starts_with("on") && name.as_bytes()[2].is_ascii_uppercase();
            if handler {
                let Some(attr_id) = self.id(&**attr) else { return false };
                if self.derived.as_ref().is_some_and(|d| d.plan.listen.contains_key(&attr_id) || d.plan.orphan_on.contains_key(&attr_id)) {
                    return false;
                }
                let Some(JSXAttributeValue::ExpressionContainer(c)) = &attr.value else { return false };
                if !matches!(c.expression, JSXExpression::ArrowFunctionExpression(_) | JSXExpression::FunctionExpression(_)) {
                    return false;
                }
                continue;
            }
            match &attr.value {
                None | Some(JSXAttributeValue::StringLiteral(_)) => {}
                Some(JSXAttributeValue::ExpressionContainer(c)) => {
                    let Some(e) = c.expression.as_expression() else { return false };
                    if !self.incr_pure(e, scope, proof) {
                        return false;
                    }
                }
                _ => return false,
            }
        }
        for child in &el.children {
            let ok = match child {
                JSXChild::Text(_) => true,
                JSXChild::Element(child) => self.incr_element(child, scope, proof),
                JSXChild::ExpressionContainer(c) => match &c.expression {
                    JSXExpression::EmptyExpression(_) => true,
                    e => e.as_expression().is_some_and(|e| self.incr_pure(e, scope, proof)),
                },
                _ => false,
            };
            if !ok {
                return false;
            }
        }
        true
    }

    fn incr_pure(&self, e: &Expression<'a>, scope: &Scope, proof: &mut Proof) -> bool {
        match peel(e) {
            Expression::StringLiteral(_) | Expression::NumericLiteral(_) | Expression::BooleanLiteral(_) | Expression::NullLiteral(_) => true,
            Expression::Identifier(ident) => ident.name == "undefined" && self.tree.resolve(ident, false).is_none() && self.tree.symbol_of_ref(ident).is_none(),
            Expression::TemplateLiteral(t) => t.expressions.iter().all(|e| self.incr_pure(e, scope, proof)),
            Expression::UnaryExpression(u) => u.operator != UnaryOperator::Delete && self.incr_pure(&u.argument, scope, proof),
            Expression::BinaryExpression(b) => {
                !matches!(
                    b.operator,
                    BinaryOperator::Division | BinaryOperator::Remainder | BinaryOperator::Exponential | BinaryOperator::In | BinaryOperator::Instanceof
                ) && self.incr_pure(&b.left, scope, proof)
                    && self.incr_pure(&b.right, scope, proof)
            }
            Expression::LogicalExpression(l) => self.incr_pure(&l.left, scope, proof) && self.incr_pure(&l.right, scope, proof),
            Expression::ConditionalExpression(c) => {
                self.incr_pure(&c.test, scope, proof) && self.incr_pure(&c.consequent, scope, proof) && self.incr_pure(&c.alternate, scope, proof)
            }
            e @ (Expression::CallExpression(_) | Expression::StaticMemberExpression(_) | Expression::ChainExpression(_)) => {
                let mut path = String::new();
                match self.incr_path(e, scope, &mut path) {
                    Some(Root::Row) => {
                        if !proof.paths.contains(&path) {
                            proof.paths.push(path);
                        }
                        true
                    }
                    Some(Root::Index) => {
                        proof.index = true;
                        path.is_empty()
                    }
                    Some(Root::Local) => path.is_empty(),
                    None => false,
                }
            }
            _ => false,
        }
    }

    /// `row()` / `index()` / `local()` (zero-argument calls of the row's names), then static members.
    fn incr_path(&self, e: &Expression<'a>, scope: &Scope, out: &mut String) -> Option<Root> {
        match peel(e) {
            Expression::CallExpression(call) => self.incr_call(call, scope),
            Expression::StaticMemberExpression(m) => self.incr_member(m, scope, out),
            Expression::ChainExpression(c) => match &c.expression {
                ChainElement::StaticMemberExpression(m) => self.incr_member(m, scope, out),
                ChainElement::CallExpression(call) => self.incr_call(call, scope),
                _ => None,
            },
            _ => None,
        }
    }

    fn incr_member(&self, m: &StaticMemberExpression<'a>, scope: &Scope, out: &mut String) -> Option<Root> {
        let root = self.incr_path(&m.object, scope, out)?;
        if !matches!(root, Root::Row) {
            return None;
        }
        out.push_str(if m.optional { "?." } else { "." });
        out.push_str(&m.property.name);
        Some(root)
    }

    fn incr_call(&self, call: &CallExpression<'a>, scope: &Scope) -> Option<Root> {
        if call.optional || !call.arguments.is_empty() {
            return None;
        }
        let Expression::Identifier(ident) = peel(&call.callee) else { return None };
        let symbol = self.tree.symbol_of_ref(ident)?;
        if scope.row == Some(symbol) {
            Some(Root::Row)
        } else if scope.index == Some(symbol) {
            Some(Root::Index)
        } else if scope.locals.contains(&symbol) {
            Some(Root::Local)
        } else {
            None
        }
    }
}
