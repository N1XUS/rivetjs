//! Derived resume model (plan `docs/design/plans/2026-10-18-derived-client.md` M2 C1 / C2, spec
//! `docs/design/specs/2026-10-18-structural-resume-design.md` §3.3): per module-level component the boundary facts
//! (`moduleFacts` `boundaries`, closed over the module graph by `libs/compiler/facts-fixpoint.ts`) and the server
//! target's plan under `resume: { model: "derived" }` — which functions are boundaries (flags, props), which returns
//! go through `_rBOut`, which root elements carry `_rBAttr`, which `signal()` / `createStore()` calls are keyed — plus
//! RV2103 (non-deterministic render, error) and RV2104 (keyed state in a loop, warning). Reads the serialized
//! analysis' sites (`Resumed`) only to tell interactive components and browser-only closures apart.

use oxc_ast::{AstKind, ast::*};
use oxc_semantic::NodeId;
use oxc_span::{GetSpan, Span};
use rustc_hash::{FxHashMap, FxHashSet};

use super::{Resumed, SiteKind, import_source, unwrap};
use crate::compile::{Diags, is_native};
use crate::tree::Tree;

/// Boundary flag: every input is data (props object passed to `_rB`).
pub const INDEPENDENT: u32 = 1;
/// Boundary flag: every return is one native element, which carries `_rBAttr` (`data-b`) instead of comment markers.
pub const ATTR: u32 = 2;

/// Module-level facts of one component (`ModuleFacts.boundaries`).
pub struct Component {
    pub name: String,
    pub function: NodeId,
    /// Own subtree holds a resume site (not counting component-child regions, live props and lazy children).
    pub own: bool,
    /// Calls `useContext` / a `use…Context` helper.
    pub context: bool,
    /// `none` | `object` | `destructured`.
    pub params: &'static str,
    /// The props parameter's name (`params == "object"`).
    pub props: Option<String>,
    /// Component tags rendered (PascalCase / `ns.Tag`), first appearance order.
    pub renders: Vec<String>,
    /// Every component element rendered: tag, data-only call site.
    pub calls: Vec<(String, bool)>,
}

/// Build verdicts (`resume.boundaries` / `resume.independent`); absent lists fall back to the module-local closure.
#[derive(Clone, Default)]
pub struct Verdicts {
    pub boundaries: Option<Vec<String>>,
    pub independent: Option<Vec<String>>,
}

/// The derived server target's plan for one module.
#[derive(Default)]
pub struct Plan {
    /// Boundary function → (emitted name: its export name, `export_name`; flags; props parameter).
    pub boundaries: FxHashMap<NodeId, (String, u32, Option<String>)>,
    /// Return statements (with an argument) of boundary bodies: `return _rBOut(B, value)`.
    pub returns: FxHashSet<NodeId>,
    /// Concise arrow boundaries: their body expression is the returned value.
    pub concise: FxHashSet<NodeId>,
    /// Root native elements of ATTR boundaries (`_rBAttr(B)` last in the start tag).
    pub attr_roots: FxHashSet<NodeId>,
    /// Keyed state calls → (key, createStore).
    pub keyed: FxHashMap<NodeId, (String, bool)>,
    /// Boundary names (export names) in source order.
    pub names: Vec<String>,
}

fn pascal(name: &str) -> bool {
    name.starts_with(|c: char| c.is_ascii_uppercase())
}

/// Module-level components: PascalCase function declarations / `const X = () => …` (exported or not), an anonymous
/// default-exported function or arrow ("default").
fn module_components(tree: &Tree<'_>) -> Vec<(String, NodeId)> {
    let mut out = Vec::new();
    let function = |out: &mut Vec<(String, NodeId)>, f: &Function<'_>, fallback: Option<&str>| {
        let name = match (&f.id, fallback) {
            (Some(id), _) if pascal(&id.name) => id.name.to_string(),
            (None, Some(fallback)) => fallback.to_string(),
            _ => return,
        };
        if let Some(id) = tree.id_of(f) {
            out.push((name, id));
        }
    };
    let declarators = |out: &mut Vec<(String, NodeId)>, v: &VariableDeclaration<'_>| {
        for d in &v.declarations {
            let (BindingPatternKind::BindingIdentifier(name), Some(init)) = (&d.id.kind, &d.init) else { continue };
            if !pascal(&name.name) {
                continue;
            }
            let id = match unwrap(init) {
                Expression::ArrowFunctionExpression(a) => tree.id_of(&**a),
                Expression::FunctionExpression(f) => tree.id_of(&**f),
                _ => None,
            };
            if let Some(id) = id {
                out.push((name.name.to_string(), id));
            }
        }
    };
    for statement in &tree.program.body {
        match statement {
            Statement::FunctionDeclaration(f) => function(&mut out, f, None),
            Statement::VariableDeclaration(v) => declarators(&mut out, v),
            Statement::ExportNamedDeclaration(e) => match &e.declaration {
                Some(Declaration::FunctionDeclaration(f)) => function(&mut out, f, None),
                Some(Declaration::VariableDeclaration(v)) => declarators(&mut out, v),
                _ => {}
            },
            Statement::ExportDefaultDeclaration(e) => match &e.declaration {
                ExportDefaultDeclarationKind::FunctionDeclaration(f) => function(&mut out, f, Some("default")),
                ExportDefaultDeclarationKind::ArrowFunctionExpression(a) => {
                    if let Some(id) = tree.id_of(&**a) {
                        out.push(("default".into(), id));
                    }
                }
                _ => {}
            },
            _ => {}
        }
    }
    out
}

/// The outermost function enclosing `node` (`node` included).
fn outermost_function(tree: &Tree<'_>, node: NodeId) -> Option<NodeId> {
    let mut top = None;
    let mut n = Some(node);
    while let Some(id) = n {
        if matches!(tree.kind(id), AstKind::Program(_)) {
            break;
        }
        if tree.is_function(id) {
            top = Some(id);
        }
        n = tree.raw_parent(id);
    }
    top
}

fn params_of<'b, 'a>(tree: &Tree<'a>, function: NodeId) -> Option<&'b FormalParameters<'a>>
where
    'a: 'b,
{
    match tree.kind(function) {
        AstKind::Function(f) => Some(&f.params),
        AstKind::ArrowFunctionExpression(a) => Some(&a.params),
        _ => None,
    }
}

fn params(tree: &Tree<'_>, function: NodeId) -> (&'static str, Option<String>) {
    let Some(params) = params_of(tree, function) else { return ("none", None) };
    if params.rest.is_some() {
        return ("destructured", None);
    }
    let Some(first) = params.items.first() else { return ("none", None) };
    match &first.pattern.kind {
        BindingPatternKind::BindingIdentifier(id) => ("object", Some(id.name.to_string())),
        _ => ("destructured", None),
    }
}

/// A browser-only closure's node: handlers, effects, client events (and their targets), element effects, refs, local
/// functions and `equals` options never run while rendering on the server.
fn browser_closures(tree: &Tree<'_>, resumed: &Resumed) -> FxHashSet<NodeId> {
    let mut closures = FxHashSet::default();
    for (_, index) in resumed.map.iter() {
        let site = &resumed.sites[index];
        let browser = matches!(
            site.kind,
            SiteKind::Event | SiteKind::Effect | SiteKind::ClientEvent | SiteKind::Element | SiteKind::Ref | SiteKind::Model | SiteKind::Fn | SiteKind::Equals
        );
        if !browser {
            continue;
        }
        if let Some(closure) = site.closure {
            closures.insert(closure);
        }
        if site.kind == SiteKind::ClientEvent {
            if let Some(AstKind::CallExpression(c)) = site.call.map(|call| tree.kind(call)) {
                if let Some(id) = c.arguments.first().and_then(|a| a.as_expression()).and_then(|e| tree.expr_id(e)) {
                    closures.insert(id);
                }
            }
        }
    }
    closures
}

/// A JSON-like literal: strings, numbers, booleans, null, expression-free templates, arrays / objects of those, a
/// module-level `const` bound to one.
fn data_literal<'a>(tree: &Tree<'a>, e: &Expression<'a>, depth: u32) -> bool {
    if depth > 8 {
        return false;
    }
    match unwrap(e) {
        Expression::StringLiteral(_) | Expression::NumericLiteral(_) | Expression::BooleanLiteral(_) | Expression::NullLiteral(_) => true,
        Expression::TemplateLiteral(t) => t.expressions.is_empty(),
        Expression::UnaryExpression(u) => {
            matches!(u.operator, UnaryOperator::UnaryNegation | UnaryOperator::UnaryPlus) && matches!(unwrap(&u.argument), Expression::NumericLiteral(_))
        }
        Expression::ArrayExpression(a) => a.elements.iter().all(|el| el.as_expression().is_some_and(|e| data_literal(tree, e, depth + 1))),
        Expression::ObjectExpression(o) => o.properties.iter().all(|p| match p {
            ObjectPropertyKind::ObjectProperty(p) => {
                p.kind == PropertyKind::Init
                    && !p.method
                    && !p.computed
                    && !p.shorthand
                    && matches!(p.key, PropertyKey::StaticIdentifier(_) | PropertyKey::StringLiteral(_) | PropertyKey::NumericLiteral(_))
                    && data_literal(tree, &p.value, depth + 1)
            }
            ObjectPropertyKind::SpreadProperty(_) => false,
        }),
        Expression::Identifier(ident) => {
            let Some(decl) = tree.resolve(ident, false) else { return false };
            let AstKind::VariableDeclarator(d) = tree.kind(decl) else { return false };
            let Some(declaration) = tree.raw_parent(decl) else { return false };
            let AstKind::VariableDeclaration(v) = tree.kind(declaration) else { return false };
            let top = match tree.raw_parent(declaration).map(|p| (p, tree.kind(p))) {
                Some((_, AstKind::Program(_))) => true,
                Some((p, AstKind::ExportNamedDeclaration(_))) => matches!(tree.raw_parent(p).map(|g| tree.kind(g)), Some(AstKind::Program(_))),
                _ => false,
            };
            top && v.kind == VariableDeclarationKind::Const && d.init.as_ref().is_some_and(|init| data_literal(tree, init, depth + 1))
        }
        _ => false,
    }
}

fn data_attributes<'a>(tree: &Tree<'a>, el: &JSXElement<'a>) -> bool {
    el.opening_element.attributes.iter().all(|item| match item {
        JSXAttributeItem::SpreadAttribute(_) => false,
        JSXAttributeItem::Attribute(attr) => match &attr.value {
            None | Some(JSXAttributeValue::StringLiteral(_)) => true,
            Some(JSXAttributeValue::ExpressionContainer(c)) => c.expression.as_expression().is_some_and(|e| data_literal(tree, e, 0)),
            Some(_) => false,
        },
    })
}

/// Children a data-only call site may pass: text, literal expressions, site-free static native elements.
fn data_children<'a>(tree: &Tree<'a>, resumed: &Resumed, children: &[JSXChild<'a>]) -> bool {
    children.iter().all(|child| match child {
        JSXChild::Text(_) => true,
        JSXChild::ExpressionContainer(c) => match c.expression.as_expression() {
            None => true,
            Some(e) => data_literal(tree, e, 0),
        },
        JSXChild::Element(el) => {
            is_native(tree, el) && !resumed.has_site_within(tree, el.span) && data_attributes(tree, el) && data_children(tree, resumed, &el.children)
        }
        JSXChild::Fragment(_) | JSXChild::Spread(_) => false,
    })
}

/// Whether a component element passes data only (no spread, literal / data attributes, static children).
fn data_call<'a>(tree: &Tree<'a>, resumed: &Resumed, el: &JSXElement<'a>) -> bool {
    data_attributes(tree, el) && data_children(tree, resumed, &el.children)
}

fn component_tag<'a>(tree: &Tree<'a>, el: &JSXElement<'a>) -> Option<&'a str> {
    match &el.opening_element.name {
        JSXElementName::IdentifierReference(i) if pascal(&i.name) => Some(tree.text_of(i.span)),
        JSXElementName::MemberExpression(m) => Some(tree.text_of(m.span)),
        _ => None,
    }
}

fn context_call(e: &CallExpression<'_>) -> bool {
    match unwrap(&e.callee) {
        Expression::Identifier(i) => {
            let name = i.name.as_str();
            name == "useContext" || (name.len() > "useContext".len() && name.starts_with("use") && name.ends_with("Context"))
        }
        _ => false,
    }
}

/// A returned value that cannot be a render value: an object literal or a class (leaves of `?:` / `&&` / `||` / `??` /
/// sequences; parentheses and TS wrappers peeled). A PascalCase factory returning one (`VirtualizerRenderer(link)` →
/// `{ CollectionRoot, … }`) is not a component. A returned function stays a render value (an accessor component).
fn non_render<'a>(e: &Expression<'a>) -> bool {
    match unwrap(e) {
        Expression::ObjectExpression(_) | Expression::ClassExpression(_) => true,
        Expression::ConditionalExpression(c) => non_render(&c.consequent) && non_render(&c.alternate),
        Expression::LogicalExpression(l) => non_render(&l.left) && non_render(&l.right),
        Expression::SequenceExpression(s) => s.expressions.last().is_some_and(non_render),
        _ => false,
    }
}

/// Boundary eligibility: a module-level function is a component unless every value it returns is a non-render value
/// (`non_render`). JSX, `null`, arrays, children, accessors and calls (another component, a render helper) stay eligible.
fn renders(tree: &Tree<'_>, function: NodeId) -> bool {
    let (values, _) = returned(tree, function, &mut Vec::new());
    values.is_empty() || !values.iter().all(|v| non_render(v))
}

/// Per module-level component facts (source order).
pub fn components(tree: &Tree<'_>, resumed: &Resumed) -> Vec<Component> {
    let list: Vec<(String, NodeId)> = module_components(tree).into_iter().filter(|&(_, function)| renders(tree, function)).collect();
    let index: FxHashMap<NodeId, usize> = list.iter().enumerate().map(|(i, (_, id))| (*id, i)).collect();
    let mut own = vec![false; list.len()];
    for (node, site) in resumed.map.iter() {
        let site = &resumed.sites[site];
        if matches!(site.kind, SiteKind::Region | SiteKind::Props) || (site.kind == SiteKind::Slot && site.lazy_children) {
            continue;
        }
        if let Some(&i) = outermost_function(tree, node).and_then(|f| index.get(&f)) {
            own[i] = true;
        }
    }
    list.into_iter()
        .zip(own)
        .map(|((name, function), own)| {
            let (params, props) = params(tree, function);
            let mut context = false;
            let mut renders: Vec<String> = Vec::new();
            let mut calls = Vec::new();
            tree.walk(function, &mut |n| {
                match tree.kind(n) {
                    AstKind::CallExpression(c) if context_call(c) => context = true,
                    AstKind::JSXElement(el) => {
                        if let Some(tag) = component_tag(tree, el) {
                            if !renders.iter().any(|r| r == tag) {
                                renders.push(tag.to_string());
                            }
                            calls.push((tag.to_string(), data_call(tree, resumed, el)));
                        }
                    }
                    _ => {}
                }
                true
            });
            Component { name, function, own, context, params, props, renders, calls }
        })
        .collect()
}

/// Keyed state callee: `signal` from `@rivetjs/reactivity` (false) / `createStore` from `@rivetjs/reactivity/store` (true).
fn keyed_callee<'a>(tree: &Tree<'a>, call: &CallExpression<'a>) -> Option<bool> {
    let Expression::Identifier(ident) = &call.callee else { return None };
    let decl = tree.resolve(ident, false)?;
    let AstKind::ImportSpecifier(s) = tree.kind(decl) else { return None };
    let from = import_source(tree, decl)?;
    match s.imported.name().as_str() {
        "signal" if from == "@rivetjs/reactivity" => Some(false),
        "createStore" if from == "@rivetjs/reactivity/store" || from == "@rivetjs/reactivity" => Some(true),
        _ => None,
    }
}

/// Five base-36 digits of FNV-1a (32-bit) over the module id: the keyed-state key prefix.
pub fn key_prefix(module: &str) -> String {
    let mut hash: u32 = 0x811c_9dc5;
    for byte in module.bytes() {
        hash ^= u32::from(byte);
        hash = hash.wrapping_mul(0x0100_0193);
    }
    let mut n = hash % 60_466_176; // 36^5
    let mut digits = [b'0'; 5];
    for slot in digits.iter_mut().rev() {
        *slot = b"0123456789abcdefghijklmnopqrstuvwxyz"[(n % 36) as usize];
        n /= 36;
    }
    String::from_utf8_lossy(&digits).into_owned()
}

/// `Date.now()` / `Math.random()` / `performance.now()` / `crypto.randomUUID()` / `crypto.getRandomValues()` / `Date()`
/// calls and `new Date()` without arguments on the unshadowed globals: the call's text.
fn nondeterministic<'a>(tree: &Tree<'a>, kind: AstKind<'a>) -> Option<String> {
    match kind {
        AstKind::CallExpression(c) => super::rows::nondeterministic_call(tree, &c.callee),
        AstKind::NewExpression(n) if n.arguments.is_empty() => match unwrap(&n.callee) {
            Expression::Identifier(i) if i.name == "Date" && tree.symbol_of_ref(i).is_none() => Some("new Date()".into()),
            _ => None,
        },
        _ => None,
    }
}

/// RV2104: a loop between a keyed call and its function. Keys are per site, so a call under an `if` / `?:` / logical /
/// `switch` / `try` adopts its own value or none (a render that skips it skips the key, never shifts another); only a
/// site's repeated creations pair by order (`#2`, `#3`, … per boundary), which a loop makes data-dependent.
fn loop_context(tree: &Tree<'_>, call: NodeId) -> bool {
    let within = |inner: Span, outer: Span| outer.start <= inner.start && inner.end <= outer.end;
    let mut child = tree.span(call);
    let mut n = tree.raw_parent(call);
    while let Some(id) = n {
        if tree.is_function(id) {
            return false;
        }
        let found = match tree.kind(id) {
            AstKind::ForStatement(f) => !f.init.as_ref().is_some_and(|init| within(child, init.span())),
            AstKind::ForInStatement(f) => !within(child, f.right.span()),
            AstKind::ForOfStatement(f) => !within(child, f.right.span()),
            AstKind::WhileStatement(_) | AstKind::DoWhileStatement(_) => true,
            _ => false,
        };
        if found {
            return true;
        }
        child = tree.span(id);
        n = tree.raw_parent(id);
    }
    false
}

/// The values a boundary returns (return arguments of its own body — nested functions own theirs — or a concise
/// body) and whether every exit returns a value (a bare `return;` or falling off the end clears ATTR).
fn returned<'a>(tree: &Tree<'a>, function: NodeId, returns: &mut Vec<NodeId>) -> (Vec<&'a Expression<'a>>, bool) {
    match tree.kind(function) {
        AstKind::ArrowFunctionExpression(a) if a.expression => {
            return match a.body.statements.first() {
                Some(Statement::ExpressionStatement(s)) => (vec![&s.expression], true),
                _ => (Vec::new(), false),
            };
        }
        _ => {}
    }
    let mut values = Vec::new();
    let mut every = true;
    tree.walk(function, &mut |n| {
        if n != function && tree.is_function(n) {
            return false;
        }
        if let AstKind::ReturnStatement(r) = tree.kind(n) {
            match &r.argument {
                Some(argument) => {
                    returns.push(n);
                    values.push(argument);
                }
                None => every = false,
            }
        }
        true
    });
    (values, every)
}

/// A boundary's emitted name (after `<module>#`): the name its module exports it under — the runtime reads the component
/// from its chunk by it (`export function X` / `export { X }` → `X`, `export default function X` / `export default X` →
/// `default`, `export { X as Y }` → `Y`); a component the module does not export keeps its local name (it can only be
/// adopted as part of its parent's run).
fn export_name(tree: &Tree<'_>, local: &str) -> String {
    if local == "default" {
        return local.to_string();
    }
    let names = super::refs::own_exports(tree, local);
    if names.is_empty() || names.iter().any(|n| n == local) {
        local.to_string()
    } else if names.iter().any(|n| n == "default") {
        "default".to_string()
    } else {
        names[0].clone()
    }
}

/// The derived server target's plan, RV2103 / RV2104 into `diags` (errors first, then warnings).
pub fn plan(tree: &Tree<'_>, resumed: &Resumed, module: &str, verdicts: &Verdicts, diags: &mut Diags) -> Plan {
    let components = components(tree, resumed);
    let by_name: FxHashMap<&str, usize> = components.iter().enumerate().map(|(i, c)| (c.name.as_str(), i)).collect();
    // Interactive: the build's verdict, else own sites closed over locally rendered components.
    let interactive: Vec<bool> = match &verdicts.boundaries {
        Some(list) => components.iter().map(|c| list.iter().any(|n| n == &c.name)).collect(),
        None => {
            let mut interactive: Vec<bool> = components.iter().map(|c| c.own).collect();
            let mut changed = true;
            while changed {
                changed = false;
                for (i, c) in components.iter().enumerate() {
                    if !interactive[i] && c.renders.iter().any(|t| by_name.get(t.as_str()).is_some_and(|&j| interactive[j])) {
                        interactive[i] = true;
                        changed = true;
                    }
                }
            }
            interactive
        }
    };
    // Independent: the build's verdict, else a props object, no context, and every call site in the module data-only.
    let independent: Vec<bool> = match &verdicts.independent {
        Some(list) => components.iter().map(|c| list.iter().any(|n| n == &c.name)).collect(),
        None => components
            .iter()
            .map(|c| {
                let mut sites = components.iter().flat_map(|o| o.calls.iter()).filter(|(tag, _)| tag == &c.name).peekable();
                c.params == "object" && !c.context && sites.peek().is_some() && sites.all(|(_, data)| *data)
            })
            .collect(),
    };
    let mut plan = Plan::default();
    let mut boundary_of: FxHashMap<NodeId, usize> = FxHashMap::default();
    for (i, c) in components.iter().enumerate() {
        if !interactive[i] {
            continue;
        }
        let mut returns = Vec::new();
        let (values, every) = returned(tree, c.function, &mut returns);
        let roots: Vec<Option<NodeId>> = values
            .iter()
            .map(|v| match unwrap(v) {
                Expression::JSXElement(el) if is_native(tree, el) => tree.id_of(&**el),
                _ => None,
            })
            .collect();
        let attr = every && !roots.is_empty() && roots.iter().all(Option::is_some);
        let mut flags = 0;
        if independent[i] {
            flags |= INDEPENDENT;
        }
        if attr {
            flags |= ATTR;
            plan.attr_roots.extend(roots.into_iter().flatten());
        }
        plan.returns.extend(returns);
        if matches!(tree.kind(c.function), AstKind::ArrowFunctionExpression(a) if a.expression) {
            plan.concise.insert(c.function);
        }
        let props = if independent[i] { c.props.clone() } else { None };
        let name = export_name(tree, &c.name);
        plan.boundaries.insert(c.function, (name.clone(), flags, props));
        plan.names.push(name);
        boundary_of.insert(c.function, i);
    }
    // Keyed state (source order, inside functions, outside browser-only closures) and RV2103 in boundary bodies.
    let closures = browser_closures(tree, resumed);
    let prefix = key_prefix(module);
    let mut errors: Vec<(String, NodeId)> = Vec::new();
    let mut warnings: Vec<(String, NodeId)> = Vec::new();
    // (node, enclosing function?, enclosing boundary, inside a keyed call's arguments)
    let mut stack = vec![(tree.root(), false, None::<usize>, false)];
    while let Some((n, in_function, boundary, in_keyed)) = stack.pop() {
        if closures.contains(&n) {
            continue;
        }
        let kind = tree.kind(n);
        let mut keyed_here = in_keyed;
        if let AstKind::CallExpression(call) = kind {
            if let (true, Some(store)) = (in_function, keyed_callee(tree, call)) {
                let key = format!("{prefix}-{}", plan.keyed.len());
                plan.keyed.insert(n, (key, store));
                keyed_here = true;
                if loop_context(tree, n) {
                    let callee = if store { "createStore()" } else { "signal()" };
                    warnings.push((
                        format!(
                            "Keyed state `{callee}` is created inside a loop: the browser pairs a site's repeated creations with the server's by order, so a loop that runs a different number of times in the adopt run adopts the wrong values; give each iteration its own component (a `<For>` row) or create the state once outside the loop"
                        ),
                        n,
                    ));
                }
            }
        }
        if let (Some(b), false) = (boundary, in_keyed) {
            if let Some(call) = nondeterministic(tree, kind) {
                let name = &components[b].name;
                errors.push((
                    format!("Render is not deterministic: `{call}` runs while rendering `{name}`; move it into a keyed signal (its value is shipped) or a clientEffect"),
                    n,
                ));
            }
        }
        let function = in_function || tree.is_function(n);
        let boundary = boundary.or_else(|| boundary_of.get(&n).copied());
        for &child in tree.children(n).iter().rev() {
            stack.push((child, function, boundary, keyed_here));
        }
    }
    for (message, node) in errors {
        diags.add(message, Some(node));
    }
    for (message, node) in warnings {
        diags.warn(message, Some(node));
    }
    plan
}

/// `moduleFacts(…, { boundaries: true })`: `[[name, { interactive, context, params, renders, calls: [[tag, data]] }]]`.
pub fn facts_json(tree: &Tree<'_>, resumed: &Resumed) -> serde_json::Value {
    let list: Vec<serde_json::Value> = components(tree, resumed)
        .into_iter()
        .map(|c| {
            let calls: Vec<serde_json::Value> = c.calls.iter().map(|(tag, data)| serde_json::json!([tag, data])).collect();
            serde_json::json!([c.name, { "interactive": c.own, "context": c.context, "params": c.params, "renders": c.renders, "calls": calls }])
        })
        .collect();
    serde_json::Value::Array(list)
}
