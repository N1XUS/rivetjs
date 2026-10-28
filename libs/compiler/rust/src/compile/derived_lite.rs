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
//! - handlers `on<Type>` of a delegated bubbling type (submit / change / reset too), referring to keyed / never-written
//!   signals, module scope, globals and their own bindings only.
//!
//! Lite v2 (RT-DIET 2026-10-26, runtime `dom-lite-attr.ts` / `-write.ts` / `-list.ts` / `-model.ts` leaves):
//! - `computed(arrow)` over closed-world reads → `_lc(arrow)`; local arrow / function declarations copied verbatim when
//!   their bodies are closed world (`Local::Fn`); declarations emitted only when referenced;
//! - live `class` / `className` → `_lk`; a plain attribute (`dom_v2::plain_attribute`) → `_lq`; a boolean attribute
//!   (not `hidden`) → `_lb`; others `_la`; `style` / `key` stay ineligible;
//! - `model:value` (text input / textarea) and `model:checked` (checkbox) over a keyed signal → `_lm` (ineligible with
//!   an own onInput / onChange);
//! - `<For each={keyed | computed} by={closed-world fn}>{(item, i) => <native row>}</For>` → `_lf(at, each, by, row,
//!   spec)`: `spec` = the row's template as data (`lite_spec`: tag, decoded literal attrs, text runs, `0, 1` = marker
//!   pair of a non-sole dynamic child), rows adopt `<!--r[-->` / `<!--]-->` server rows; row bodies allow only
//!   literal / live attributes and children (a static non-literal → ineligible); a static component child
//!   (`derived_lite_static.rs`, RT-DIET2) makes `spec` `0`: the browser's rows are copies of the first server row.
//!
//! JS-DIET-2 (2026-10-28, runtime `dom-lite-cond.ts`, `LiteRec.p`):
//! - live bindings, computeds, list `each` / `by` and handlers may read the props parameter (`props.data`) and the
//!   props-rooted locals (`const { a } = props`): an `INDEPENDENT` record holds its props as data, so the residual
//!   declares `const <param> = <rec>.p;` (+ the used props locals' declarators, verbatim) before its state; a destructured
//!   parameter stays ineligible (`props pattern`). The server keeps a `DEMOTED` record whose residual reads props off the
//!   lite path (manifest `lite.props`: the entry's `$a` functions that read `<rec>.p`);
//! - `<select>` (not `multiple`) whose children are only native `<option>`s with literal attributes and literal text:
//!   its options are static (never walked); a live `value` of it or of an `<input>` → `_lv` (property + attribute, the
//!   `dom-attr.ts` `write` rules for that name; written after the options exist);
//! - `{test ? <native element> : null}` (not the sole child; `undefined` alternate too; a live test) →
//!   `_lo(opener, () => (test), (n) => { branch bindings }, spec)`: the branch binds like a list row (literal or live
//!   values only, its markup as `lite_spec` data), nested conditionals allowed, lists / components inside not;
//! - `<For each={() => …}>`: a closed-world live arrow as the list source (besides a keyed / computed local).
//!
//! Node paths mirror the server markup (`compile.rs` `walk_server` + `derived.rs` `slot_marks`): adjacent JSX text and
//! folded literal children are one Text node; a dynamic child among others sits between `<!--[-->` / `<!--]-->` (path
//! step `h` jumps from the opener to its closer); a sole dynamic child has no markers (its element is the target).

use oxc_ast::{AstKind, ast::*};
use oxc_semantic::{NodeId, SymbolId};
use oxc_span::{GetSpan, Span};
use rustc_hash::FxHashMap;

use super::{Compiler, OPAQUE_CONTENT, attr_name, attr_string, dom_v2, event_info, is_function_child, is_native, jsx_text, literal_child, may_render_jsx, starts_with_on, strip_parens};
use crate::entities::decode_html;
use crate::ir::quote;
use crate::resume::derived::{ATTR, INDEPENDENT, data_literal, never_written};

#[derive(Clone, Copy, PartialEq)]
enum Local {
    Keyed,
    /// A keyed signal nothing writes (RT-DIET): its reads render what the server rendered (static), a handler reads its
    /// recorded value.
    KeyedStill,
    Frozen,
    /// Bound from the props parameter (`const { a } = props`, `const a = props.a`): recorded data, static.
    Props,
    /// `const x = computed(fn)` over the closed world (RT-DIET lite v2): `_lc(fn)`, live.
    Computed,
    /// A local function (`const f = (…) => …`) over the closed world, copied; `true`: its body reads live state.
    Fn(bool),
    /// A `For` row's item / index accessor (RT-DIET lite v2): live.
    Row,
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
    /// Keyed signals live code or a handler refers to (RT-DIET: only those are declared; an unread one costs nothing).
    keyed_used: Vec<SymbolId>,
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
    /// Inside a `For` row (RT-DIET lite v2): a new row is built from a static spec, so every non-literal value binds.
    row: bool,
    /// `lite_refs`' last verdict read live state (a local function's body).
    last_live: bool,
    /// JS-DIET-2: the props parameter's name (`function C(props)`), None without one or for a pattern.
    props_name: Option<String>,
    /// JS-DIET-2: live code / a handler reads the props parameter (the residual declares it from the record).
    props_used: bool,
    /// JS-DIET-2: props-rooted locals (`const { a } = props`) → their declarator's start and text.
    props_texts: FxHashMap<SymbolId, (u32, &'s str)>,
    /// JS-DIET-2: props-rooted locals live code / a handler reads (their declarators are copied).
    props_locals_used: Vec<SymbolId>,
}

pub(super) struct Names {
    pub ls: String,
    pub le: String,
    pub lt: String,
    pub lw: String,
    pub la: String,
    pub lc: String,
    pub lf: String,
    pub lk: String,
    pub lm: String,
    pub lq: String,
    pub lb: String,
    /// JS-DIET-2: conditional subtree (`dom-lite-cond.ts`).
    pub lo: String,
    /// JS-DIET-2: `<input>` / `<select>` `value` (`dom-lite-attr.ts`).
    pub lv: String,
}

pub(super) type Fail = &'static str;

/// Bubbling types `_le` handles through one document listener (`dom-events.ts` `_on`): the delegated set, plus the
/// bubbling form events the ordinary DOM lowering listens to on the element (RT-DIET lite v2).
fn delegated(event: &str) -> bool {
    dom_v2::delegated(event) || matches!(event, "submit" | "change" | "reset")
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
        let names = Names {
            ls: "__rivetL_s".into(),
            le: "__rivetL_e".into(),
            lt: "__rivetL_t".into(),
            lw: "__rivetL_w".into(),
            la: "__rivetL_a".into(),
            lc: "__rivetL_c".into(),
            lf: "__rivetL_f".into(),
            lk: "__rivetL_k".into(),
            lm: "__rivetL_m".into(),
            lq: "__rivetL_q".into(),
            lb: "__rivetL_b".into(),
            lo: "__rivetL_o".into(),
            lv: "__rivetL_v".into(),
        };
        let (node, rec) = ("__rivetLn".to_string(), "__rivetLr".to_string());
        let mut code = String::new();
        let mut used = [false; 13];
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
            for (i, local) in [&names.ls, &names.le, &names.lt, &names.lw, &names.la, &names.lc, &names.lf, &names.lk, &names.lm, &names.lq, &names.lb, &names.lo, &names.lv].iter().enumerate() {
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
        let exports = ["_ls", "_le", "_lt", "_lw", "_la", "_lc", "_lf", "_lk", "_lm", "_lq", "_lb", "_lo", "_lv"];
        let locals = [&names.ls, &names.le, &names.lt, &names.lw, &names.la, &names.lc, &names.lf, &names.lk, &names.lm, &names.lq, &names.lb, &names.lo, &names.lv];
        let specifiers: Vec<String> = (0..13).filter(|&i| used[i]).map(|i| format!("{} as {}", exports[i], locals[i])).collect();
        let mut out = format!("import {{ {} }} from \"@rivetjs/runtime/dom-lite\";\n", specifiers.join(", "));
        // A never-written signal a handler reads: the lite world's `signal` (RT-DIET: residual state never meets
        // `@rivetjs/reactivity`, so a lite page ships none of it).
        if let Some(local) = signal_local {
            let spec = if local == "signal" { local } else { format!("signal as {local}") };
            out.push_str(&format!("import {{ {spec} }} from \"@rivetjs/runtime/dom-lite\";\n"));
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
            keyed_used: Vec::new(),
            frozen_text: FxHashMap::default(),
            signal_local: None,
            module_used: Vec::new(),
            node: node.to_string(),
            rec: rec.to_string(),
            names,
            vars: 0,
            row: false,
            last_live: false,
            props_name: match &params.items[..] {
                [only] if params.rest.is_none() => match &only.pattern.kind {
                    BindingPatternKind::BindingIdentifier(id) => Some(id.name.to_string()),
                    _ => None,
                },
                _ => None,
            },
            props_used: false,
            props_texts: FxHashMap::default(),
            props_locals_used: Vec::new(),
        };
        let mut decls: Vec<String> = Vec::new();
        // Keyed declarations in source order, emitted after the walk for the ones live code reads (RT-DIET).
        let mut keyed: Vec<(SymbolId, String)> = Vec::new();
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
                        let text = (declarator.span.start, tree.text_of(declarator.span));
                        bindings(&declarator.id, &mut |symbol| {
                            match symbol {
                                Some(symbol) => {
                                    unit.locals.insert(symbol, Local::Props);
                                    unit.props_texts.insert(symbol, text);
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
                    // RT-DIET lite v2: a local function over the closed world (copied as written; live when its body
                    // reads live state).
                    if let Some(init @ (Expression::ArrowFunctionExpression(_) | Expression::FunctionExpression(_))) = declarator.init.as_ref().map(strip_parens) {
                        if matches!(init, Expression::ArrowFunctionExpression(a) if a.r#async) || matches!(init, Expression::FunctionExpression(f) if f.r#async || f.generator) {
                            return Err("async local function");
                        }
                        self.lite_refs(init, &mut unit, true)?;
                        unit.locals.insert(symbol, Local::Fn(unit.last_live));
                        keyed.push((symbol, format!("const {} = {};", id.name, tree.text_of(init.span()))));
                        continue;
                    }
                    let Some(Expression::CallExpression(call)) = declarator.init.as_ref().map(strip_parens) else { return Err("declaration") };
                    // RT-DIET lite v2: `computed(fn)` over the closed world: `_lc(fn)`.
                    if is_reactivity(tree, call, "computed") {
                        let [arg] = &call.arguments[..] else { return Err("computed options") };
                        let arg = arg.as_expression().ok_or("spread argument")?;
                        if !matches!(strip_parens(arg), Expression::ArrowFunctionExpression(a) if !a.r#async) {
                            return Err("computed argument");
                        }
                        self.lite_refs(arg, &mut unit, false)?;
                        unit.locals.insert(symbol, Local::Computed);
                        keyed.push((symbol, format!("const {} = {}({});", id.name, names.lc, tree.text_of(arg.span()))));
                        continue;
                    }
                    let call_id = tree.id_of(&**call).ok_or("call")?;
                    if let Some((key, store)) = d.plan.keyed.get(&call_id) {
                        if *store || call.arguments.len() > 1 {
                            return Err("store / signal options");
                        }
                        let init = match call.arguments.first() {
                            Some(a) => {
                                let a = a.as_expression().ok_or("spread argument")?;
                                // The init runs again in the browser only when it is a data literal (what the ordinary `_sig`
                                // would run too, and what the server leaves off the record while unchanged). Any other init:
                                // the server always records the value (RT-DIET) — no init argument, the record must have it.
                                if data_literal(tree, a, 0) { format!(", {}", tree.text_of(a.span())) } else { String::new() }
                            }
                            None => ", undefined".to_string(),
                        };
                        unit.locals.insert(symbol, if never_written(tree, call_id) { Local::KeyedStill } else { Local::Keyed });
                        keyed.push((symbol, format!("const {} = {}({rec}, {}{init});", id.name, names.ls, quote(key))));
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
        for (symbol, text) in keyed {
            if unit.keyed_used.contains(&symbol) {
                decls.push(text);
            }
        }
        for symbol in &unit.frozen_used {
            if let Some(text) = unit.frozen_text.get(symbol) {
                decls.push(format!("const {text};"));
            }
        }
        let signal = if unit.frozen_used.is_empty() { None } else { unit.signal_local.clone() };
        // JS-DIET-2: the recorded props first (state inits / computeds may read them), then the props locals they read.
        if unit.props_used {
            let mut pre = vec![format!("const {} = {rec}.p;", unit.props_name.as_deref().ok_or("props pattern")?)];
            let mut texts: Vec<(u32, &str)> = unit.props_locals_used.iter().filter_map(|s| unit.props_texts.get(s).copied()).collect();
            texts.sort_by_key(|(start, _)| *start);
            texts.dedup();
            pre.extend(texts.into_iter().map(|(_, text)| format!("const {text};")));
            let _ = decls.splice(0..0, pre);
        }
        decls.extend(unit.out);
        Ok((format!("export function {name}$a({node}, {rec}) {{\n  {}\n}}\n", decls.join("\n  ")), unit.module_used, signal))
    }

    fn lite_element(&self, el: &'a JSXElement<'a>, path: &str, unit: &mut Unit<'_>) -> Result<(), Fail> {
        let tree = self.tree;
        let tag = tree.text_of(el.opening_element.name.span());
        // JS-DIET-2: a `<select>` with static options only (its options are never walked: nothing in them binds).
        let static_select = tag == "select" && self.lite_static_select(el);
        if OPAQUE_CONTENT.contains(&tag) || (!static_select && matches!(tag, "select" | "option" | "optgroup")) || matches!(tag, "script" | "style" | "svg" | "math") {
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
            // `model:value` / `model:checked` over a keyed signal (RT-DIET lite v2): `_lm`.
            if let Some(kind) = name.strip_prefix("model:") {
                let text_input = tag == "textarea"
                    || (tag == "input"
                        && el.opening_element.attributes.iter().all(|a| match a {
                            JSXAttributeItem::Attribute(t) if attr_name(tree, t) == "type" => {
                                attr_string(tree, t).is_some_and(|v| matches!(v, "text" | "search" | "email" | "url" | "tel" | "password"))
                            }
                            _ => true,
                        }));
                let checkbox = tag == "input"
                    && el.opening_element.attributes.iter().any(|a| matches!(a, JSXAttributeItem::Attribute(t) if attr_name(tree, t) == "type" && attr_string(tree, t) == Some("checkbox")));
                if !((kind == "value" && text_input) || (kind == "checked" && checkbox)) {
                    return Err("model");
                }
                let event = if kind == "value" { "onInput" } else { "onChange" };
                if el.opening_element.attributes.iter().any(|a| matches!(a, JSXAttributeItem::Attribute(t) if attr_name(tree, t) == event)) {
                    return Err("model with handler");
                }
                let Some(JSXAttributeValue::ExpressionContainer(c)) = &attr.value else { return Err("model") };
                let Some(Expression::Identifier(state)) = c.expression.as_expression().map(strip_parens) else { return Err("model") };
                let symbol = tree.symbol_of_ref(state).ok_or("model")?;
                if unit.locals.get(&symbol) != Some(&Local::Keyed) {
                    return Err("model signal");
                }
                if !unit.keyed_used.contains(&symbol) {
                    unit.keyed_used.push(symbol);
                }
                let at = target(&mut *unit);
                unit.out.push(format!("{}({at}, {}, {});", unit.names.lm, quote(kind), state.name));
                continue;
            }
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
                // A row built in the browser has no server text for it (its spec holds literals only).
                Class::Static if unit.row => return Err("row static attribute"),
                Class::Static => {}
                Class::Live => {
                    if matches!(name, "style" | "key") {
                        return Err("live attribute");
                    }
                    let at = target(&mut *unit);
                    // `class`: `_className` semantics (null / false / "" remove it), RT-DIET lite v2.
                    if matches!(name, "class" | "className") {
                        unit.out.push(format!("{}({at}, () => ({}));", unit.names.lk, tree.text_of(e.span())));
                        continue;
                    }
                    let html = if name == "htmlFor" { "for" } else { name };
                    let lower = html.to_ascii_lowercase();
                    // JS-DIET-2: an `<input>` / `<select>` `value`: property + attribute (`_lv`, no `dom-attr.ts`).
                    if lower == "value" && matches!(tag, "input" | "select") {
                        unit.out.push(format!("{}({at}, () => ({}));", unit.names.lv, tree.text_of(e.span())));
                        continue;
                    }
                    // The lightest writer with the client's semantics for this name (RT-DIET): plain `setAttribute`,
                    // a boolean attribute (+ its property), else the full rules (`_la`: URLs, enumerated, form values).
                    if dom_v2::plain_attribute(html) {
                        unit.out.push(format!("{}({at}, {}, () => ({}));", unit.names.lq, quote(html), tree.text_of(e.span())));
                    } else if lower != "hidden" && crate::html::BOOLEAN_ATTRIBUTES.contains(&lower.as_str()) {
                        unit.out.push(format!("{}({at}, {}, () => ({}));", unit.names.lb, quote(&lower), tree.text_of(e.span())));
                    } else {
                        unit.out.push(format!("{}({at}, {}, () => ({}));", unit.names.la, quote(html), tree.text_of(e.span())));
                    }
                }
            }
        }
        if static_select {
            return Ok(());
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
            /// A `For` (RT-DIET lite v2): always between `<!--[-->` / `<!--]-->`, rows `<!--r[-->el<!--]-->`.
            List(&'b JSXElement<'b>),
            /// A static component child (RT-DIET2, `derived_lite_static.rs`): between `<!--[-->` / `<!--]-->`, nothing to bind.
            Static,
            /// JS-DIET-2: `{test ? <native element> : null}` between `<!--[-->` / `<!--]-->` (the element when the test held).
            Cond(&'b Expression<'b>, &'b JSXElement<'b>),
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
                    if let Some((test, branch)) = lite_conditional(tree, e) {
                        if sole {
                            return Err("sole conditional");
                        }
                        if !run.is_empty() {
                            items.push(Item::Text);
                            run.clear();
                        }
                        items.push(Item::Cond(test, branch));
                        continue;
                    }
                    if may_render_jsx(e) || is_function_child(e) {
                        return Err("structural child");
                    }
                    let class = self.lite_refs(e, unit, false)?;
                    if unit.row && class == Class::Static {
                        return Err("row static child");
                    }
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
                JSXChild::Element(child) if !unit.row && self.lite_is_for(child) => {
                    if !run.is_empty() {
                        items.push(Item::Text);
                        run.clear();
                    }
                    items.push(Item::List(child));
                }
                JSXChild::Element(child) if !self.lite_is_for(child) => {
                    self.lite_static_component(child, &mut |e| self.lite_refs(e, unit, false).map(|class| class == Class::Live))?;
                    if !run.is_empty() {
                        items.push(Item::Text);
                        run.clear();
                    }
                    items.push(Item::Static);
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
                Item::List(list) => {
                    self.lite_list(list, &at, unit)?;
                    at.push_str("hn");
                }
                Item::Static => at.push_str("hn"),
                Item::Cond(test, branch) => {
                    self.lite_cond(test, branch, &at, unit)?;
                    at.push_str("hn");
                }
            }
        }
        Ok(())
    }

    /// `<For>` imported from the runtime (structural), no spread.
    fn lite_is_for(&self, el: &'a JSXElement<'a>) -> bool {
        let JSXElementName::IdentifierReference(tag) = &el.opening_element.name else { return false };
        self.imported_structural(tag) == Some("For")
    }

    /// RT-DIET lite v2: `<For each={s} by={fn}>{(x, i) => <native/>}</For>` over the server rows:
    /// `_lf(opener, each, by, (n, x, i) => { row bindings }, spec)`. `each` is a keyed / computed local, `by` and the
    /// row closed-world code; the row's markup (`spec`: literals only) builds rows the server did not render.
    fn lite_list(&self, el: &'a JSXElement<'a>, at: &str, unit: &mut Unit<'_>) -> Result<(), Fail> {
        let tree = self.tree;
        let (mut each, mut by) = (None, None);
        for item in &el.opening_element.attributes {
            let JSXAttributeItem::Attribute(attr) = item else { return Err("list spread") };
            let Some(JSXAttributeValue::ExpressionContainer(c)) = &attr.value else { return Err("list attribute") };
            let e = c.expression.as_expression().ok_or("list attribute")?;
            match attr_name(tree, attr) {
                "each" => each = Some(e),
                "by" => by = Some(e),
                _ => return Err("list attribute"),
            }
        }
        let (Some(each), Some(by)) = (each, by) else { return Err("list without each / by") };
        match strip_parens(each) {
            Expression::Identifier(source) => {
                let symbol = tree.symbol_of_ref(source).ok_or("list each")?;
                if !matches!(unit.locals.get(&symbol), Some(Local::Keyed | Local::KeyedStill | Local::Computed)) {
                    return Err("list each");
                }
                if !unit.keyed_used.contains(&symbol) {
                    unit.keyed_used.push(symbol);
                }
            }
            // JS-DIET-2: `each={() => visible()}` — a closed-world live arrow (`_lf` calls it).
            Expression::ArrowFunctionExpression(a) if !a.r#async && a.params.items.is_empty() && a.params.rest.is_none() => {
                if self.lite_refs(each, unit, false)? != Class::Live {
                    return Err("list each");
                }
            }
            _ => return Err("list each"),
        }
        self.lite_refs(by, unit, true)?;
        let mut content = el.children.iter().filter(|c| !matches!(c, JSXChild::Text(t) if jsx_text(tree.text_of(t.span)).is_empty()));
        let (Some(JSXChild::ExpressionContainer(c)), None) = (content.next(), content.next()) else { return Err("list children") };
        let JSXExpression::ArrowFunctionExpression(callback) = &c.expression else { return Err("list children") };
        let params = &callback.params;
        if callback.r#async || !(1..=2).contains(&params.items.len()) || params.rest.is_some() {
            return Err("list row function");
        }
        let mut names: Vec<String> = Vec::new();
        for p in &params.items {
            let BindingPatternKind::BindingIdentifier(id) = &p.pattern.kind else { return Err("list row parameter") };
            unit.locals.insert(id.symbol_id.get().ok_or("symbol")?, Local::Row);
            names.push(id.name.to_string());
        }
        let row: &JSXElement = if callback.expression {
            let Some(Statement::ExpressionStatement(s)) = callback.body.statements.first() else { return Err("list row") };
            as_jsx(&s.expression).ok_or("list row")?
        } else {
            let [Statement::ReturnStatement(r)] = &callback.body.statements[..] else { return Err("list row body") };
            as_jsx(r.argument.as_ref().ok_or("list row")?).ok_or("list row")?
        };
        if !is_native(tree, row) {
            return Err("list row root");
        }
        // A row with a static component child (`\0` in its spec, RT-DIET2): `0` — the browser builds its rows as copies of
        // the first server row (`dom-lite-list.ts` `_lf`).
        let spec = self.lite_spec(row)?;
        let spec = if spec.contains('\0') { "0".to_string() } else { spec };
        let node = format!("__rivetLn{}", unit.vars);
        unit.vars += 1;
        let (outer_node, outer_out) = (std::mem::replace(&mut unit.node, node.clone()), std::mem::take(&mut unit.out));
        unit.row = true;
        let done = self.lite_element(row, "", unit);
        unit.row = false;
        let body = std::mem::replace(&mut unit.out, outer_out);
        unit.node = outer_node;
        done?;
        if names.len() == 1 {
            names.push("__rivetLi".into());
        }
        let list = format!("{}({}, {})", unit.names.lw, unit.node, quote(at));
        unit.out.push(format!(
            "{}({list}, {}, {}, ({node}, {}) => {{\n    {}\n  }}, {spec});",
            unit.names.lf,
            tree.text_of(each.span()),
            tree.text_of(by.span()),
            names.join(", "),
            body.join("\n    ")
        ));
        Ok(())
    }

    /// JS-DIET-2: `{test ? <branch/> : null}` at content opener `at`: `_lo(opener, () => (test), (n) => { … }, spec)`.
    /// The test must be live (a static one never changes what the server rendered: ineligible); the branch binds as a
    /// list row does (built from `spec` when it appears: literal or live values only), conditionals nest.
    fn lite_cond(&self, test: &'a Expression<'a>, branch: &'a JSXElement<'a>, at: &str, unit: &mut Unit<'_>) -> Result<(), Fail> {
        let tree = self.tree;
        if self.lite_refs(test, unit, false)? != Class::Live {
            return Err("static conditional");
        }
        let spec = self.lite_spec(branch)?;
        if spec.contains('\0') {
            return Err("conditional component child");
        }
        let node = format!("__rivetLn{}", unit.vars);
        unit.vars += 1;
        let (outer_node, outer_out) = (std::mem::replace(&mut unit.node, node.clone()), std::mem::take(&mut unit.out));
        let was = unit.row;
        unit.row = true;
        let done = self.lite_element(branch, "", unit);
        unit.row = was;
        let body = std::mem::replace(&mut unit.out, outer_out);
        unit.node = outer_node;
        done?;
        let slot = format!("{}({}, {})", unit.names.lw, unit.node, quote(at));
        unit.out.push(format!("{}({slot}, () => ({}), ({node}) => {{\n    {}\n  }}, {spec});", unit.names.lo, tree.text_of(test.span()), body.join("\n    ")));
        Ok(())
    }

    /// JS-DIET-2: a `<select>` (no `multiple`) whose children are only native `<option>`s with literal attributes and
    /// literal / text content (its server options never change; a live `value` writes the selection).
    fn lite_static_select(&self, el: &'a JSXElement<'a>) -> bool {
        let tree = self.tree;
        let literal_attrs = |el: &JSXElement<'a>| {
            el.opening_element.attributes.iter().all(|item| match item {
                JSXAttributeItem::Attribute(attr) => !attr_name(tree, attr).contains(':') && (attr.value.is_none() || attr_string(tree, attr).is_some()),
                JSXAttributeItem::SpreadAttribute(_) => false,
            })
        };
        if el.opening_element.attributes.iter().any(|item| matches!(item, JSXAttributeItem::Attribute(attr) if attr_name(tree, attr) == "multiple")) {
            return false;
        }
        el.children.iter().all(|child| match child {
            JSXChild::Text(text) => jsx_text(tree.text_of(text.span)).is_empty(),
            JSXChild::Element(option) => {
                is_native(tree, option)
                    && tree.text_of(option.opening_element.name.span()) == "option"
                    && literal_attrs(option)
                    && option.children.iter().all(|c| match c {
                        JSXChild::Text(_) => true,
                        JSXChild::ExpressionContainer(c) => c.expression.as_expression().map_or(true, |e| literal_child(tree, e).is_some()),
                        _ => false,
                    })
            }
            _ => false,
        })
    }

    /// The static markup of a row element as the server renders it with every binding empty (RT-DIET lite v2):
    /// `[tag, { literal attributes }, …children]`, children a Text's data, `0` / `1` for `<!--[-->` / `<!--]-->`
    /// around a dynamic child that is not the sole child, or an element spec.
    fn lite_spec(&self, el: &'a JSXElement<'a>) -> Result<String, Fail> {
        let tree = self.tree;
        let tag = tree.text_of(el.opening_element.name.span());
        let mut attrs: Vec<String> = Vec::new();
        for item in &el.opening_element.attributes {
            let JSXAttributeItem::Attribute(attr) = item else { return Err("spread") };
            let name = attr_name(tree, attr);
            let html = match name {
                "className" => "class",
                "htmlFor" => "for",
                n => n,
            };
            match &attr.value {
                None => attrs.push(format!("{}: \"\"", quote(html))),
                Some(JSXAttributeValue::StringLiteral(_)) => attrs.push(format!("{}: {}", quote(html), quote(&decode_html(attr_string(tree, attr).unwrap_or_default())))),
                _ => {}
            }
        }
        let count = el
            .children
            .iter()
            .filter(|child| match child {
                JSXChild::Text(text) => !jsx_text(tree.text_of(text.span)).is_empty(),
                JSXChild::ExpressionContainer(c) => c.expression.as_expression().is_some(),
                _ => true,
            })
            .count();
        let mut parts: Vec<String> = vec![quote(tag), format!("{{ {} }}", attrs.join(", "))];
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
                    if !run.is_empty() {
                        parts.push(quote(&run));
                        run.clear();
                    }
                    if count != 1 {
                        parts.push("0, 1".into());
                    }
                }
                JSXChild::Element(child) if is_native(tree, child) => {
                    if !run.is_empty() {
                        parts.push(quote(&run));
                        run.clear();
                    }
                    parts.push(self.lite_spec(child)?);
                }
                // A static component child (checked by `lite_element`): the row is a copy of a server row (`lite_list`).
                JSXChild::Element(child) if !self.lite_is_for(child) => parts.push("\0".into()),
                _ => return Err("row child"),
            }
        }
        if !run.is_empty() {
            parts.push(quote(&run));
        }
        Ok(format!("[{}]", parts.join(", ")))
    }

    /// Classify the references of `e`: live (reads a keyed signal), static (props members / literals only), else an
    /// error. Handlers (`handler`): keyed / never-written signals, module scope, globals and own bindings.
    fn lite_refs(&self, e: &Expression<'a>, unit: &mut Unit<'_>, handler: bool) -> Result<Class, Fail> {
        let tree = self.tree;
        let span = e.span();
        let function = tree.span(unit.function);
        let id = tree.expr_id(e).ok_or("expression")?;
        let (mut live, mut props, mut module, mut call, mut other) = (false, false, false, false, false);
        // JS-DIET-2: the props parameter / props locals read (declared from the record when live code reads them).
        let mut props_locals: Vec<SymbolId> = Vec::new();
        let mut frozen: Vec<SymbolId> = Vec::new();
        let mut keyed: Vec<SymbolId> = Vec::new();
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
                                    Local::Keyed => {
                                        live = true;
                                        keyed.push(symbol);
                                    }
                                    Local::KeyedStill => keyed.push(symbol),
                                    Local::Frozen => frozen.push(symbol),
                                    Local::Props => {
                                        props = true;
                                        props_locals.push(symbol);
                                    }
                                    Local::Computed | Local::Row | Local::Fn(true) => {
                                        live = true;
                                        keyed.push(symbol);
                                    }
                                    Local::Fn(false) => keyed.push(symbol),
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
                        && matches!(&c.callee, Expression::Identifier(i) if tree.symbol_of_ref(i).is_some_and(|s| matches!(unit.locals.get(&s), Some(&Local::Frozen | &Local::KeyedStill))));
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
        unit.last_live = live;
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
        let mark = |unit: &mut Unit<'_>, keyed: Vec<SymbolId>| {
            for symbol in keyed {
                if !unit.keyed_used.contains(&symbol) {
                    unit.keyed_used.push(symbol);
                }
            }
        };
        // JS-DIET-2: live code reading props declares them from the record (`const props = <rec>.p`).
        let props_live = |unit: &mut Unit<'_>| -> Result<(), Fail> {
            if !props {
                return Ok(());
            }
            if unit.props_name.is_none() {
                return Err("props pattern");
            }
            unit.props_used = true;
            for symbol in props_locals {
                if !unit.props_locals_used.contains(&symbol) {
                    unit.props_locals_used.push(symbol);
                }
            }
            Ok(())
        };
        if handler {
            props_live(unit)?;
            copy(unit, constants)?;
            mark(unit, keyed);
            for symbol in frozen {
                if !unit.frozen_used.contains(&symbol) {
                    unit.frozen_used.push(symbol);
                }
            }
            return Ok(Class::Live);
        }
        if live {
            props_live(unit)?;
            copy(unit, constants)?;
            mark(unit, keyed);
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

/// JS-DIET-2: `test ? <native element> : null` (or `: undefined`, the global) → (test, element).
fn lite_conditional<'b, 'a>(tree: &crate::tree::Tree<'a>, e: &'b Expression<'a>) -> Option<(&'b Expression<'a>, &'b JSXElement<'a>)> {
    let Expression::ConditionalExpression(c) = strip_parens(e) else { return None };
    let branch = as_jsx(&c.consequent)?;
    let empty = match strip_parens(&c.alternate) {
        Expression::NullLiteral(_) => true,
        Expression::Identifier(ident) => ident.name == "undefined" && tree.symbol_of_ref(ident).is_none(),
        _ => false,
    };
    (empty && is_native(tree, branch)).then_some((&c.test, branch))
}

fn as_jsx<'b, 'a>(e: &'b Expression<'a>) -> Option<&'b JSXElement<'a>> {
    match strip_parens(e) {
        Expression::JSXElement(el) => Some(el),
        _ => None,
    }
}

/// `signal(…)` imported from `@rivetjs/reactivity`.
fn is_signal<'a>(tree: &crate::tree::Tree<'a>, call: &CallExpression<'a>) -> bool {
    is_reactivity(tree, call, "signal")
}

/// `<name>(…)` imported from `@rivetjs/reactivity`.
fn is_reactivity<'a>(tree: &crate::tree::Tree<'a>, call: &CallExpression<'a>, name: &str) -> bool {
    let Expression::Identifier(ident) = &call.callee else { return false };
    let Some(decl) = tree.resolve(ident, false) else { return false };
    let AstKind::ImportSpecifier(s) = tree.kind(decl) else { return false };
    s.imported.name() == name && crate::resume::import_source(tree, decl).is_some_and(|from| from == "@rivetjs/reactivity")
}
