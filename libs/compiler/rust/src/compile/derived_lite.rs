//! ZERO C1 (2026-10-25, ownership §3.1): lite residuals. The derived DOM target returns, next to the module, a lite
//! entry (`compile()` result `lite: { code, map, names }`) holding per eligible independent boundary
//! `export function <Name>$a(n, r)` — the boundary's keyed state (`_ls`), its handlers (`_le`) and its live text /
//! attribute bindings (`_lt` / `_la`) written over the server nodes by path (`_lw`), against
//! `@rivetjs/runtime/dom-lite` — and `export const <Name>$c = () => import("<module>")` (the ordinary component, for a
//! fallback). The entry never imports the module statically: module-level `const`s it refers to are data literals
//! (≤ 200 B) copied in. No template, no probe: the full runtime (R5) and the lite runtime adopt a standalone boundary
//! through it; a throw (`LiteMiss`) falls back to the ordinary component.
//!
//! Eligible (slice 1, everything else keeps the ordinary adopt — `lite_because` names the first construct):
//! - an independent boundary (`INDEPENDENT`: its props are recorded data, so nothing the server rendered from them
//!   changes after adoption) whose body is `const` declarations of keyed `signal(init)` (no options) or never-written
//!   `signal(<data literal>)`, then one `return <native element>` (or a concise arrow returning one);
//! - native elements only (no component, fragment, spread, `ref`, directive, `class` / `style` binding, opaque or
//!   form-select content), i18n off;
//! - an expression child or attribute value either reads a keyed signal (live: props / other locals not allowed; module
//!   scope and globals allowed) or is static (props members and literals only: no call, no module reference);
//! - handlers `on<Type>` of a delegated bubbling type, referring to keyed / never-written signals, module scope,
//!   globals and their own bindings only.
//!
//! Node paths mirror the server markup (`compile.rs` `walk_server` + `derived.rs` `slot_marks`): adjacent JSX text and
//! folded literal children are one Text node; a dynamic child among others sits between `<!--[-->` / `<!--]-->` (path
//! step `h` jumps from the opener to its closer); a sole dynamic child has no markers (its element is the target).

use oxc_ast::{AstKind, ast::*};
use oxc_semantic::{NodeId, SymbolId};
use oxc_span::{GetSpan, Span};
use rustc_hash::FxHashMap;

use super::{Compiler, OPAQUE_CONTENT, attr_name, attr_string, dom_v2, event_info, is_function_child, is_native, jsx_text, literal_child, may_render_jsx, starts_with_on, strip_parens};
use crate::ir::quote;
use crate::resume::derived::{ATTR, INDEPENDENT, data_literal, never_written};

#[derive(Clone, Copy, PartialEq)]
enum Local {
    Keyed,
    Frozen,
    /// Bound from the props parameter (`const { a } = props`, `const a = props.a`): recorded data, static.
    Props,
}

#[derive(PartialEq)]
enum Class {
    Live,
    Static,
}

struct Unit<'s> {
    function: NodeId,
    params: Span,
    locals: FxHashMap<SymbolId, Local>,
    /// Statements of the residual body (after the declarations).
    out: Vec<String>,
    /// Never-written signals a handler refers to (re-declared from their source text).
    frozen_used: Vec<SymbolId>,
    frozen_text: FxHashMap<SymbolId, &'s str>,
    /// The local name of `signal` (a never-written signal re-declared in the entry needs its import).
    signal_local: Option<String>,
    /// Module-level `const` data literals live code refers to (copied into the entry).
    module_used: Vec<SymbolId>,
    node: String,
    rec: String,
    names: &'s Names,
    /// Element locals declared so far (`const __rivetLeN = _lw(n, path)`).
    vars: usize,
}

pub(super) struct Names {
    pub ls: String,
    pub le: String,
    pub lt: String,
    pub lw: String,
    pub la: String,
}

type Fail = &'static str;

/// Delegated bubbling types `_le` (`dom-events.ts` `_on`) handles.
fn delegated(event: &str) -> bool {
    dom_v2::delegated(event)
}

impl<'t, 'a> Compiler<'t, 'a> {
    /// The lite entry of this DOM module (`<Name>$a` / `<Name>$c` exports, their `dom-lite` import, copied module
    /// constants) and the boundary names it covers; `None` when no boundary is eligible.
    pub(super) fn lite_residuals(&mut self, filename: &str) -> Option<(String, Vec<String>)> {
        if self.server || self.i18n {
            return None;
        }
        let d = self.derived.as_ref()?;
        // B1 census: why each boundary has no residual (`dependent` when not INDEPENDENT).
        let dependent: Vec<(String, String)> =
            d.plan.boundaries.values().filter(|(_, flags, _)| flags & INDEPENDENT == 0).map(|(name, _, _)| (name.clone(), "dependent".to_string())).collect();
        let mut list: Vec<(NodeId, String, u32)> =
            d.plan.boundaries.iter().filter(|(_, (_, flags, _))| flags & INDEPENDENT != 0).map(|(id, (name, flags, _))| (*id, name.clone(), *flags)).collect();
        self.lite_because.extend(dependent);
        if list.is_empty() {
            return None;
        }
        list.sort_by_key(|(id, _, _)| self.tree.span(*id).start);
        let names = Names { ls: "__rivetL_s".into(), le: "__rivetL_e".into(), lt: "__rivetL_t".into(), lw: "__rivetL_w".into(), la: "__rivetL_a".into() };
        let (node, rec) = ("__rivetLn".to_string(), "__rivetLr".to_string());
        let mut code = String::new();
        let mut used = [false; 5];
        let mut covered: Vec<String> = Vec::new();
        let mut constants: Vec<SymbolId> = Vec::new();
        let mut signal_local: Option<String> = None;
        for (function, name, flags) in list {
            let (text, module_used, signal) = match self.residual(function, &name, flags, &names, &node, &rec) {
                Ok(done) => done,
                Err(why) => {
                    self.lite_because.push((name, why.into()));
                    continue;
                }
            };
            for (i, local) in [&names.ls, &names.le, &names.lt, &names.lw, &names.la].iter().enumerate() {
                used[i] |= text.contains(local.as_str());
            }
            for symbol in module_used {
                if !constants.contains(&symbol) {
                    constants.push(symbol);
                }
            }
            signal_local = signal_local.or(signal);
            code.push_str(&text);
            covered.push(name);
        }
        if covered.is_empty() {
            return None;
        }
        let exports = ["_ls", "_le", "_lt", "_lw", "_la"];
        let locals = [&names.ls, &names.le, &names.lt, &names.lw, &names.la];
        let specifiers: Vec<String> = (0..5).filter(|&i| used[i]).map(|i| format!("{} as {}", exports[i], locals[i])).collect();
        let mut out = format!("import {{ {} }} from \"@rivetjs/runtime/dom-lite\";\n", specifiers.join(", "));
        if let Some(local) = signal_local {
            let spec = if local == "signal" { local } else { format!("signal as {local}") };
            out.push_str(&format!("import {{ {spec} }} from \"@rivetjs/reactivity\";\n"));
        }
        constants.sort_by_key(|s| self.tree.span(self.tree.decl_of_symbol(*s)).start);
        for symbol in constants {
            out.push_str(&format!("const {};\n", self.tree.text_of(self.tree.span(self.tree.decl_of_symbol(symbol)))));
        }
        out.push_str(&code);
        for export in &covered {
            out.push_str(&format!("export const {export}$c = () => import({});\n", quote(filename)));
        }
        let qualified: Vec<String> = self.derived_boundaries().into_iter().filter(|q| covered.iter().any(|n| q.rsplit('#').next() == Some(n.as_str()))).collect();
        Some((out, qualified))
    }

    /// Why `function` (a boundary) has no residual, or its `export function <Name>$a(n, r) { … }` text.
    fn residual(&self, function: NodeId, name: &str, flags: u32, names: &Names, node: &str, rec: &str) -> Result<(String, Vec<SymbolId>, Option<String>), Fail> {
        let tree = self.tree;
        let d = self.derived.as_ref().ok_or("no plan")?;
        let (params, body, concise) = match tree.kind(function) {
            AstKind::Function(f) if !f.generator && !f.r#async => (&*f.params, f.body.as_deref().ok_or("no body")?, false),
            AstKind::ArrowFunctionExpression(a) if !a.r#async => (&*a.params, &*a.body, a.expression),
            _ => return Err("function kind"),
        };
        let mut unit = Unit {
            function,
            params: params.span,
            locals: FxHashMap::default(),
            out: Vec::new(),
            frozen_used: Vec::new(),
            frozen_text: FxHashMap::default(),
            signal_local: None,
            module_used: Vec::new(),
            node: node.to_string(),
            rec: rec.to_string(),
            names,
            vars: 0,
        };
        let mut decls: Vec<String> = Vec::new();
        let root: &JSXElement = if concise {
            let Some(Statement::ExpressionStatement(s)) = body.statements.first() else { return Err("concise body") };
            as_jsx(&s.expression).ok_or("root not an element")?
        } else {
            let (last, before) = body.statements.split_last().ok_or("empty body")?;
            for statement in before {
                let Statement::VariableDeclaration(v) = statement else { return Err("statement") };
                if v.kind != VariableDeclarationKind::Const {
                    return Err("let / var");
                }
                for declarator in &v.declarations {
                    // `const { a, b: c } = props` / `const a = props.a`: props-derived locals (static, like props).
                    if declarator.init.as_ref().is_some_and(|init| props_rooted(tree, init, params.span)) {
                        let mut ok = true;
                        bindings(&declarator.id, &mut |symbol| {
                            match symbol {
                                Some(symbol) => {
                                    unit.locals.insert(symbol, Local::Props);
                                }
                                None => ok = false,
                            };
                        });
                        if !ok {
                            return Err("props pattern");
                        }
                        continue;
                    }
                    let BindingPatternKind::BindingIdentifier(id) = &declarator.id.kind else { return Err("pattern declaration") };
                    let symbol = id.symbol_id.get().ok_or("symbol")?;
                    let Some(Expression::CallExpression(call)) = declarator.init.as_ref().map(strip_parens) else { return Err("declaration") };
                    let call_id = tree.id_of(&**call).ok_or("call")?;
                    if let Some((key, store)) = d.plan.keyed.get(&call_id) {
                        if *store || call.arguments.len() > 1 {
                            return Err("store / signal options");
                        }
                        let init = match call.arguments.first() {
                            Some(a) => tree.text_of(a.as_expression().ok_or("spread argument")?.span()),
                            None => "undefined",
                        };
                        if let Some(a) = call.arguments.first().and_then(|a| a.as_expression()) {
                            // The init runs again in the browser: only what the ordinary `_sig` would run too.
                            if !data_literal(tree, a, 0) {
                                return Err("keyed init");
                            }
                        }
                        unit.locals.insert(symbol, Local::Keyed);
                        decls.push(format!("const {} = {}({rec}, {}, {init});", id.name, names.ls, quote(key)));
                    } else if is_signal(tree, call) && call.arguments.len() <= 1 && never_written(tree, call_id) {
                        if let Some(a) = call.arguments.first() {
                            if !a.as_expression().is_some_and(|e| data_literal(tree, e, 0)) {
                                return Err("frozen init");
                            }
                        }
                        unit.locals.insert(symbol, Local::Frozen);
                        unit.frozen_text.insert(symbol, tree.text_of(declarator.span));
                        if let Expression::Identifier(callee) = &call.callee {
                            unit.signal_local = Some(callee.name.to_string());
                        }
                    } else {
                        return Err("declaration");
                    }
                }
            }
            let Statement::ReturnStatement(r) = last else { return Err("last statement") };
            as_jsx(r.argument.as_ref().ok_or("bare return")?).ok_or("root not an element")?
        };
        if !is_native(tree, root) {
            return Err("component root");
        }
        let start = if flags & ATTR != 0 { String::new() } else { "n".to_string() };
        self.lite_element(root, &start, &mut unit)?;
        if unit.out.is_empty() {
            return Err("nothing live");
        }
        for symbol in &unit.frozen_used {
            if let Some(text) = unit.frozen_text.get(symbol) {
                decls.push(format!("const {text};"));
            }
        }
        let signal = if unit.frozen_used.is_empty() { None } else { unit.signal_local.clone() };
        decls.extend(unit.out);
        Ok((format!("export function {name}$a({node}, {rec}) {{\n  {}\n}}\n", decls.join("\n  ")), unit.module_used, signal))
    }

    fn lite_element(&self, el: &'a JSXElement<'a>, path: &str, unit: &mut Unit<'_>) -> Result<(), Fail> {
        let tree = self.tree;
        let tag = tree.text_of(el.opening_element.name.span());
        if OPAQUE_CONTENT.contains(&tag) || matches!(tag, "select" | "option" | "optgroup" | "script" | "style" | "svg" | "math") {
            return Err("element kind");
        }
        // The element's node: `n` itself, else one `const __rivetLeN = _lw(n, path)` on first use.
        let mut var: Option<String> = None;
        let mut target = |unit: &mut Unit<'_>| -> String {
            if path.is_empty() {
                return unit.node.clone();
            }
            if let Some(v) = &var {
                return v.clone();
            }
            let v = format!("__rivetLe{}", unit.vars);
            unit.vars += 1;
            unit.out.push(format!("const {v} = {}({}, {});", unit.names.lw, unit.node, quote(path)));
            var = Some(v.clone());
            v
        };
        for item in &el.opening_element.attributes {
            let JSXAttributeItem::Attribute(attr) = item else { return Err("spread") };
            let name = attr_name(tree, attr);
            if name.contains(':') || matches!(name, "ref" | "children" | "innerHTML" | "textContent" | "dangerouslySetInnerHTML") {
                return Err("directive");
            }
            if attr.value.is_none() || attr_string(tree, attr).is_some() {
                continue;
            }
            let Some(JSXAttributeValue::ExpressionContainer(c)) = &attr.value else { return Err("attribute value") };
            let e = c.expression.as_expression().ok_or("empty attribute")?;
            if starts_with_on(name) {
                let (event, capture) = event_info(name).ok_or("event")?;
                if capture || !delegated(&event) {
                    return Err("event type");
                }
                self.lite_refs(e, unit, true)?;
                let at = target(&mut *unit);
                unit.out.push(format!("{}({}, {at}, {}, {});", unit.names.le, unit.rec, quote(&event), tree.text_of(e.span())));
                continue;
            }
            match self.lite_refs(e, unit, false)? {
                Class::Static => {}
                Class::Live => {
                    if matches!(name, "class" | "className" | "style" | "value" | "checked" | "selected" | "key") {
                        return Err("live attribute");
                    }
                    let html = if name == "htmlFor" { "for" } else { name };
                    let at = target(&mut *unit);
                    unit.out.push(format!("{}({at}, {}, () => ({}));", unit.names.la, quote(html), tree.text_of(e.span())));
                }
            }
        }
        // `slot_marks`: a dynamic child is delimited unless it is the element's only child.
        let count = el
            .children
            .iter()
            .filter(|child| match child {
                JSXChild::Text(text) => !jsx_text(tree.text_of(text.span)).is_empty(),
                JSXChild::ExpressionContainer(c) => c.expression.as_expression().is_some(),
                _ => true,
            })
            .count();
        let sole = count == 1;
        // Server child nodes in order: (step to pass it, element to descend into / live slot to bind).
        enum Item<'b> {
            Text,
            Slot(Option<&'b Expression<'b>>),
            Element(&'b JSXElement<'b>),
        }
        let mut items: Vec<Item<'a>> = Vec::new();
        let mut run = String::new();
        for child in &el.children {
            match child {
                JSXChild::Text(text) => run.push_str(&jsx_text(tree.text_of(text.span))),
                JSXChild::ExpressionContainer(c) => {
                    let Some(e) = c.expression.as_expression() else { continue };
                    if let Some(text) = literal_child(tree, e) {
                        run.push_str(&text);
                        continue;
                    }
                    if may_render_jsx(e) || is_function_child(e) {
                        return Err("structural child");
                    }
                    let class = self.lite_refs(e, unit, false)?;
                    if sole {
                        if class == Class::Live {
                            let at = target(&mut *unit);
                            unit.out.push(format!("{}({at}, () => ({}));", unit.names.lt, tree.text_of(e.span())));
                        }
                        continue;
                    }
                    if !run.is_empty() {
                        items.push(Item::Text);
                        run.clear();
                    }
                    items.push(Item::Slot((class == Class::Live).then_some(e)));
                }
                JSXChild::Element(child) if is_native(tree, child) => {
                    if !run.is_empty() {
                        items.push(Item::Text);
                        run.clear();
                    }
                    items.push(Item::Element(child));
                }
                _ => return Err("component / fragment child"),
            }
        }
        let mut at = format!("{path}f");
        for item in items {
            match item {
                Item::Text => at.push('n'),
                Item::Element(child) => {
                    self.lite_element(child, &at, unit)?;
                    at.push('n');
                }
                Item::Slot(live) => {
                    if let Some(e) = live {
                        unit.out.push(format!("{}({}({}, {}), () => ({}));", unit.names.lt, unit.names.lw, unit.node, quote(&at), tree.text_of(e.span())));
                    }
                    at.push_str("hn");
                }
            }
        }
        Ok(())
    }

    /// Classify the references of `e`: live (reads a keyed signal), static (props members / literals only), else an
    /// error. Handlers (`handler`): keyed / never-written signals, module scope, globals and own bindings.
    fn lite_refs(&self, e: &Expression<'a>, unit: &mut Unit<'_>, handler: bool) -> Result<Class, Fail> {
        let tree = self.tree;
        let span = e.span();
        let function = tree.span(unit.function);
        let id = tree.expr_id(e).ok_or("expression")?;
        let (mut live, mut props, mut module, mut call, mut other) = (false, false, false, false, false);
        let mut frozen: Vec<SymbolId> = Vec::new();
        let mut constants: Vec<SymbolId> = Vec::new();
        tree.walk(id, &mut |n| {
            match tree.kind(n) {
                AstKind::IdentifierReference(ident) => {
                    if tree.in_type_name(n) {
                        return true;
                    }
                    match tree.symbol_of_ref(ident) {
                        None => module = true,
                        Some(symbol) => {
                            let decl = tree.span(tree.decl_of_symbol(symbol));
                            if decl.start >= span.start && decl.end <= span.end {
                                // own binding (parameter / local of a nested function)
                            } else if let Some(local) = unit.locals.get(&symbol) {
                                match local {
                                    Local::Keyed => live = true,
                                    Local::Frozen => frozen.push(symbol),
                                    Local::Props => props = true,
                                }
                            } else if decl.start >= unit.params.start && decl.end <= unit.params.end {
                                props = true;
                            } else if decl.start >= function.start && decl.end <= function.end {
                                other = true;
                            } else {
                                module = true;
                                constants.push(symbol);
                            }
                        }
                    }
                }
                AstKind::CallExpression(c) => {
                    // `x()` over a never-written signal is its init (rendered by the server already).
                    let frozen_read = c.arguments.is_empty()
                        && matches!(&c.callee, Expression::Identifier(i) if tree.symbol_of_ref(i).is_some_and(|s| unit.locals.get(&s) == Some(&Local::Frozen)));
                    if !frozen_read {
                        call = true;
                    }
                }
                AstKind::NewExpression(_) | AstKind::TaggedTemplateExpression(_) | AstKind::AwaitExpression(_) | AstKind::YieldExpression(_) => call = true,
                AstKind::AssignmentExpression(_) | AstKind::UpdateExpression(_) => other |= !handler,
                AstKind::JSXElement(_) | AstKind::JSXFragment(_) => other = true,
                _ => {}
            }
            true
        });
        if other {
            return Err("component local");
        }
        // Code that runs in the entry: each module binding it reads must be a copyable constant.
        let copy = |unit: &mut Unit<'_>, constants: Vec<SymbolId>| -> Result<(), Fail> {
            for symbol in constants {
                if !self.lite_constant(symbol) {
                    return Err("module binding");
                }
                if !unit.module_used.contains(&symbol) {
                    unit.module_used.push(symbol);
                }
            }
            Ok(())
        };
        if handler {
            if props {
                return Err("handler reads props");
            }
            copy(unit, constants)?;
            for symbol in frozen {
                if !unit.frozen_used.contains(&symbol) {
                    unit.frozen_used.push(symbol);
                }
            }
            return Ok(Class::Live);
        }
        if live {
            if props {
                return Err("live binding reads props");
            }
            copy(unit, constants)?;
            for symbol in frozen {
                if !unit.frozen_used.contains(&symbol) {
                    unit.frozen_used.push(symbol);
                }
            }
            return Ok(Class::Live);
        }
        // Static (rendered by the server, nothing to bind): module bindings read without a call never change it.
        let _ = module;
        if call {
            return Err("unknown expression");
        }
        Ok(Class::Static)
    }

    /// A module-level `const NAME = <data literal>` (≤ 200 B of source) the lite entry can copy.
    fn lite_constant(&self, symbol: SymbolId) -> bool {
        let tree = self.tree;
        let decl = tree.decl_of_symbol(symbol);
        let AstKind::VariableDeclarator(declarator) = tree.kind(decl) else { return false };
        let Some(parent) = tree.parent(decl) else { return false };
        let AstKind::VariableDeclaration(v) = tree.kind(parent) else { return false };
        if v.kind != VariableDeclarationKind::Const || v.declare {
            return false;
        }
        let top = tree.parent(parent).is_some_and(|p| match tree.kind(p) {
            AstKind::Program(_) => true,
            AstKind::ExportNamedDeclaration(_) => tree.parent(p).is_some_and(|q| matches!(tree.kind(q), AstKind::Program(_))),
            _ => false,
        });
        top && matches!(declarator.id.kind, BindingPatternKind::BindingIdentifier(_))
            && declarator.span.size() <= 200
            && declarator.init.as_ref().is_some_and(|e| data_literal(tree, e, 0))
    }
}

/// `init` is the props parameter or a member chain on it (`props`, `props.a.b`), the parameter declared in `params`.
fn props_rooted<'a>(tree: &crate::tree::Tree<'a>, init: &Expression<'a>, params: Span) -> bool {
    match strip_parens(init) {
        Expression::Identifier(ident) => tree.resolve(ident, false).is_some_and(|decl| {
            let at = tree.span(decl);
            at.start >= params.start && at.end <= params.end
        }),
        Expression::StaticMemberExpression(m) => !m.optional && props_rooted(tree, &m.object, params),
        _ => false,
    }
}

/// Each binding of a pattern (`None` for a default value or a computed key: not plain props data).
fn bindings(pattern: &BindingPattern<'_>, f: &mut dyn FnMut(Option<SymbolId>)) {
    match &pattern.kind {
        BindingPatternKind::BindingIdentifier(id) => f(id.symbol_id.get()),
        BindingPatternKind::ObjectPattern(o) => {
            for p in &o.properties {
                if p.computed {
                    f(None);
                }
                bindings(&p.value, f);
            }
            if let Some(rest) = &o.rest {
                bindings(&rest.argument, f);
            }
        }
        BindingPatternKind::ArrayPattern(_) | BindingPatternKind::AssignmentPattern(_) => f(None),
    }
}

fn as_jsx<'b, 'a>(e: &'b Expression<'a>) -> Option<&'b JSXElement<'a>> {
    match strip_parens(e) {
        Expression::JSXElement(el) => Some(el),
        _ => None,
    }
}

/// `signal(…)` imported from `@rivetjs/reactivity`.
fn is_signal<'a>(tree: &crate::tree::Tree<'a>, call: &CallExpression<'a>) -> bool {
    let Expression::Identifier(ident) = &call.callee else { return false };
    let Some(decl) = tree.resolve(ident, false) else { return false };
    let AstKind::ImportSpecifier(s) = tree.kind(decl) else { return false };
    s.imported.name() == "signal" && crate::resume::import_source(tree, decl).is_some_and(|from| from == "@rivetjs/reactivity")
}
