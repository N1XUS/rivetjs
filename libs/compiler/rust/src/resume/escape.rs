//! Function Bridge C4 / T4 (2026-10-11, spec `docs/design/specs/2026-10-09-function-bridge-design.md` §3.2 "local
//! function in any value position", §9 risk 3 fallback): escape analysis into captured holders.
//!
//! A local function literal (arrow / function expression) stored in a value a resumed site captures cannot serialize as
//! itself ("function is not serializable"). It becomes an Fn site (`_rFn(id, f, caps)` where it is created, symbol + its
//! own captures) when it sits in an escape position of a captured holder:
//! - the holder: a local `const` / `let` declarator in the capture list of any site (the captures fixpoint, so a holder
//!   reached only through another holder's function is found too);
//! - escape positions: the right side of an assignment to the holder or to a member chain rooted at it (`api.inc = f`,
//!   `h = f`, `h.x ??= f`, `h.fns = [f]`; assignments outside site closures; a call there stores its result, not its
//!   arguments), and inside the holder's initializer every argument of a call / `new` (`signal(f)`,
//!   `new Map([["k", f]])`, `track([f])`) and every array element, recursively, through conditional / logical / sequence
//!   branches. A `let` holder's initializer function itself is one too (a `const` function is a recipe of its own).
//!
//! T4b (2026-10-11): stores by name. An identifier in a stored position that resolves to a local function (declaration,
//! or `const f = <function literal>`) gets one recipe at its declaration (`named_site`: `const f = _rFn(id, () => …, caps)`,
//! a declaration stamped right after itself), never per store; one resolving to another local binding makes that binding
//! a holder too (`const outer = { inner }`, `x = holder`: holders through data, same worklist). Object literal property
//! values and store calls on a holder (`STORE_METHODS`: `list.push(f)`, `m.set(k, f)`, `s.add(f)`) are stored positions.
//!
//! Consumed callbacks stay plain (the call runs or schedules them, its result does not hold them): the arguments of
//! member calls named in `CONSUMED_METHODS` (`xs.map(f)`, `Array.from(xs, f)`, `p.then(f)`, `el.addEventListener(t, f)`),
//! of the globals in `CONSUMED_GLOBALS` (`setTimeout(f)`, `requestAnimationFrame(f)`) and of the `@rivetjs/reactivity`
//! imports in `CONSUMED_REACTIVITY` (`untrack`, `batch`, `runWithOwner`, `effect`, `createRoot`,
//! `onCleanup`); nothing below such a call is searched. Object literal values are R2 sites already (`escaping`). Holder sites are
//! opportunistic (no compile-time capture diagnostics: they are analysed in the quiet phase of the fixpoint).

use oxc_ast::{AstKind, ast::*};
use oxc_semantic::NodeId;

use rustc_hash::FxHashSet;

use super::{Analysis, Site, SiteKind, unwrap, value_positions};
use crate::tree::DeclKind;

/// Member calls whose callback argument runs during the call and is not kept.
const CONSUMED_METHODS: &[&str] = &[
    "map",
    "filter",
    "forEach",
    "reduce",
    "reduceRight",
    "some",
    "every",
    "find",
    "findIndex",
    "findLast",
    "findLastIndex",
    "flatMap",
    "sort",
    "toSorted",
    "replace",
    "replaceAll",
    // T4 measurement (cdk): callbacks a member call runs or schedules without returning them.
    "from",
    "then",
    "catch",
    "finally",
    "addEventListener",
    "removeEventListener",
    "setTimeout",
    "setInterval",
    "requestAnimationFrame",
    "requestIdleCallback",
    "queueMicrotask",
];

/// Global functions (unresolved identifiers) that schedule their callback: the result (a handle) does not hold it.
const CONSUMED_GLOBALS: &[&str] = &["setTimeout", "setInterval", "requestAnimationFrame", "requestIdleCallback", "queueMicrotask"];

/// T4b: member calls that store their arguments into the receiver (`list.push(f)`, `m.set(k, f)`, `s.add(f)`, a signal's
/// `.set(f)`): recorded like assignments into the receiver's root binding.
const STORE_METHODS: &[&str] = &["push", "unshift", "splice", "fill", "set", "add"];

/// What a captured holder may store (`holder_stores`): function literals (Fn sites in place), local functions referenced
/// by name (T4b: one recipe at their declaration), and other local bindings it may hold (T4b: holders through data).
#[derive(Default)]
pub(super) struct Stored {
    pub(super) functions: Vec<NodeId>,
    pub(super) named: Vec<NodeId>,
    pub(super) holders: Vec<NodeId>,
}

/// `@rivetjs/reactivity` calls whose result does not hold their callback (run once in place, or kept by the owner).
const CONSUMED_REACTIVITY: &[&str] = &["untrack", "batch", "runWithOwner", "effect", "createRoot", "onCleanup"];

/// The identifier a member chain (`a.b[c].#d`, parentheses / TS wrappers unwrapped) is rooted at.
fn member_root<'b, 'a>(e: &'b Expression<'a>) -> Option<&'b IdentifierReference<'a>> {
    match unwrap(e) {
        Expression::Identifier(ident) => Some(&**ident),
        Expression::StaticMemberExpression(m) => member_root(&m.object),
        Expression::ComputedMemberExpression(m) => member_root(&m.object),
        Expression::PrivateFieldExpression(m) => member_root(&m.object),
        _ => None,
    }
}

impl<'t, 'a> Analysis<'t, 'a> {
    /// Scan hook (outside site closures): a plain or logical assignment to a local binding or to a member chain rooted at
    /// one records its right side as a possible store into that holder (`holder_stores`).
    pub(super) fn scan_holder_write(&mut self, kind: AstKind<'a>) {
        // T4b: `list.push(f)` / `m.set(k, f)` / `s.add(f)` store their arguments into the receiver.
        if let AstKind::CallExpression(call) = kind {
            let Expression::StaticMemberExpression(m) = unwrap(&call.callee) else { return };
            if !STORE_METHODS.contains(&m.property.name.as_str()) {
                return;
            }
            let Some(decl) = member_root(&m.object).and_then(|ident| self.declaration_of(ident)) else { return };
            if self.module_scoped(decl) {
                return;
            }
            let writes = self.holder_writes.entry(decl).or_default();
            for argument in &call.arguments {
                // T4b review L1 (T8): `list.push(...fns)` stores the spread source's elements.
                match argument {
                    Argument::SpreadElement(spread) => writes.push(&spread.argument),
                    _ => writes.extend(argument.as_expression()),
                }
            }
            return;
        }
        let AstKind::AssignmentExpression(assign) = kind else { return };
        if !matches!(
            assign.operator,
            AssignmentOperator::Assign | AssignmentOperator::LogicalOr | AssignmentOperator::LogicalAnd | AssignmentOperator::LogicalNullish
        ) {
            return;
        }
        let root = match &assign.left {
            AssignmentTarget::AssignmentTargetIdentifier(ident) => Some(&**ident),
            AssignmentTarget::StaticMemberExpression(m) => member_root(&m.object),
            AssignmentTarget::ComputedMemberExpression(m) => member_root(&m.object),
            AssignmentTarget::PrivateFieldExpression(m) => member_root(&m.object),
            _ => None,
        };
        let Some(decl) = root.and_then(|ident| self.declaration_of(ident)) else { return };
        if self.module_scoped(decl) {
            return;
        }
        self.holder_writes.entry(decl).or_default().push(&assign.right);
    }

    /// What the captured holder `decl` may store (module docs): its initializer's call / `new` arguments, array elements
    /// and object property values, and the right sides of assignments / store calls into it. `recipe`: the holder is an Fn
    /// recipe itself (`fn_closure`), so a function initializer is its own closure, not a stored value.
    pub(super) fn holder_stores(&self, decl: NodeId, recipe: bool) -> Stored {
        let mut out = Stored::default();
        let AstKind::VariableDeclarator(d) = self.tree.kind(decl) else { return out };
        if let Some(init) = &d.init {
            self.stored_functions(init, !recipe, true, &mut out);
        }
        if let Some(writes) = self.holder_writes.get(&decl) {
            for &right in writes {
                self.stored_functions(right, true, false, &mut out);
            }
        }
        out
    }

    /// Function literals among `e`'s stored values; `direct`: `e` itself (or one of its branches) may be one; `calls`: the
    /// arguments of calls / `new` at this level are searched (initializers; an assignment stores a call's result).
    /// T4b: identifiers of local bindings — functions (`named`) or other values (`holders`) — and object property values.
    fn stored_functions(&self, e: &'a Expression<'a>, direct: bool, calls: bool, out: &mut Stored) {
        let mut values = Vec::new();
        value_positions(e, &mut values);
        for value in values {
            match value {
                Expression::ArrowFunctionExpression(_) | Expression::FunctionExpression(_) => {
                    if direct {
                        if let Some(function) = self.tree.expr_id(value) {
                            out.functions.push(function);
                        }
                    }
                }
                Expression::Identifier(ident) => {
                    if let Some(decl) = self.declaration_of(ident) {
                        if !self.module_scoped(decl) {
                            // T10 fix 1 (F2): a bind const stored by name (`[inc]`) is a named store too (`bind_chain`).
                            if self.local_function(decl) || self.bind_call(decl) {
                                out.named.push(decl);
                            } else if matches!(self.tree.kind(decl), AstKind::VariableDeclarator(_)) {
                                out.holders.push(decl);
                            }
                        }
                    }
                }
                // Function literal values are R2 sites already (`escaping`); identifiers in them are stores.
                Expression::ObjectExpression(object) => {
                    for property in &object.properties {
                        match property {
                            ObjectPropertyKind::ObjectProperty(p) => {
                                if p.kind == PropertyKind::Init && !p.method {
                                    self.stored_functions(&p.value, true, calls, out);
                                }
                            }
                            // T4b review L1 (T8): `{ ...inner }` copies inner's values: its source is searched too.
                            ObjectPropertyKind::SpreadProperty(spread) => self.stored_functions(&spread.argument, true, calls, out),
                        }
                    }
                }
                Expression::ArrayExpression(array) => {
                    for element in &array.elements {
                        match element {
                            // T4b review L1 (T8): `[...handlers]` copies the source's elements.
                            ArrayExpressionElement::SpreadElement(spread) => self.stored_functions(&spread.argument, true, calls, out),
                            _ => {
                                if let Some(element) = element.as_expression() {
                                    self.stored_functions(element, true, calls, out);
                                }
                            }
                        }
                    }
                }
                Expression::CallExpression(call) if calls => {
                    if !self.consumed(&call.callee) {
                        self.stored_arguments(&call.arguments, out);
                    }
                }
                Expression::ChainExpression(chain) if calls => {
                    if let ChainElement::CallExpression(call) = &chain.expression {
                        if !self.consumed(&call.callee) {
                            self.stored_arguments(&call.arguments, out);
                        }
                    }
                }
                Expression::NewExpression(call) if calls => self.stored_arguments(&call.arguments, out),
                _ => {}
            }
        }
    }

    fn stored_arguments(&self, arguments: &'a [Argument<'a>], out: &mut Stored) {
        for argument in arguments {
            match argument {
                // T4b review L1 (T8): `new Map(...entries)`, `signal(...xs)`: the spread source is stored.
                Argument::SpreadElement(spread) => self.stored_functions(&spread.argument, true, true, out),
                _ => {
                    if let Some(value) = argument.as_expression() {
                        self.stored_functions(value, true, true, out);
                    }
                }
            }
        }
    }

    /// A callee that consumes its callback arguments (`CONSUMED_METHODS` member calls, `CONSUMED_GLOBALS`,
    /// `CONSUMED_REACTIVITY` imports).
    fn consumed(&self, callee: &'a Expression<'a>) -> bool {
        match unwrap(callee) {
            Expression::StaticMemberExpression(m) => CONSUMED_METHODS.contains(&m.property.name.as_str()),
            Expression::Identifier(ident) if CONSUMED_GLOBALS.contains(&ident.name.as_str()) && self.tree.resolve(ident, false).is_none() => true,
            callee => self
                .import_of(callee)
                .is_some_and(|(name, from)| from == "@rivetjs/reactivity" && CONSUMED_REACTIVITY.contains(&name.as_str())),
        }
    }

    /// An opportunistic Fn site for a stored function literal (`holder_stores`); `None` when it is already a site's closure,
    /// lies inside a non-render site closure (that code runs in the browser only), uses `this`, or has no component.
    /// Fix round 1 (M1): also `None` when a capture is still in its TDZ where the function is created (the server's
    /// capture list is read eagerly there): the holder itself in its own initializer (`let retry = () => setTimeout(retry)`),
    /// or a `let` / `const` / class declared later (`api.close = () => stop(); const stop = …`). The function stays plain,
    /// as before T4 (it fails only if the holder is actually encoded).
    pub(super) fn holder_site(&mut self, function: NodeId) -> Option<usize> {
        // T4b review L3 (T8): "already a site's closure" through a lazily extended set, not a scan of every site.
        for site in &self.sites[self.closures_indexed..] {
            self.closures.extend(site.closure);
        }
        self.closures_indexed = self.sites.len();
        if self.rejected.contains(&function) || self.claimed.contains(&function) || self.closures.contains(&function) || self.inside_site(function) {
            return None;
        }
        let (captures, _, uses_this, _, _) = self.free_names(function);
        if uses_this || captures.iter().any(|&(_, decl)| self.uninitialized_at(decl, function)) {
            // T4b review L2 (T8): the verdict never changes; later stores skip the analysis.
            self.rejected.insert(function);
            return None;
        }
        let component = self.component_of(function)?;
        let mut site = Site::new(SiteKind::Fn);
        site.closure = Some(function);
        site.value = Some(function);
        site.component = component;
        site.opportunistic = true;
        self.sites.push(site);
        self.claimed.insert(function);
        Some(self.sites.len() - 1)
    }

    /// T4b: a local function declaration, or a `const` initialized with a function literal.
    pub(super) fn local_function(&self, decl: NodeId) -> bool {
        let tree = self.tree;
        tree.decl_kind(decl) == DeclKind::FunctionDeclaration
            || matches!(tree.kind(decl), AstKind::VariableDeclarator(d)
                if d.kind == VariableDeclarationKind::Const
                    && matches!(d.init.as_ref().map(unwrap), Some(Expression::ArrowFunctionExpression(_) | Expression::FunctionExpression(_))))
    }

    /// T4b: an opportunistic Fn site for a local function stored by name (`api.open = open`, `list.push(open)`), keyed on
    /// its declaration like a captured local function: `const open = _rFn(id, () => …, caps)`; a function declaration is
    /// registered at the top of its statement list with thunk captures (T6: `_rFn(id, open, () => [caps]);`, compile
    /// `resume_hoist.rs`) — one id per function, whatever the number of stores. `None` when it is already a site
    /// (`fn_sites`), uses `this`, lies inside a non-render site closure, or a capture other than itself is still in its TDZ
    /// there (fix round 1 rule; not for a hoisted declaration since T6: its thunk reads the captures at the first encode).
    pub(super) fn named_site(&mut self, decl: NodeId, fn_sites: &mut FxHashSet<NodeId>) -> Option<usize> {
        if fn_sites.contains(&decl) || self.rejected.contains(&decl) {
            return None;
        }
        let function = self.fn_closure(decl)?;
        if self.inside_site(function) {
            return None;
        }
        let (captures, _, uses_this, _, _) = self.free_names(function);
        // T6: a hoisted declaration's registration reads its captures late (thunk), so no TDZ rule applies to it.
        let hoisted = self.tree.decl_kind(function) == DeclKind::FunctionDeclaration && super::hoist_container(self.tree, function).is_some();
        if uses_this || (!hoisted && captures.iter().any(|&(_, capture)| capture != decl && self.uninitialized_at(capture, function))) {
            // T4b review L2 (T8): memoized — each further holder storing this function by name skips `free_names`.
            self.rejected.insert(decl);
            return None;
        }
        let component = self.component_of(function)?;
        let mut site = Site::new(SiteKind::Fn);
        site.closure = Some(function);
        site.declaration = Some(decl);
        site.component = component;
        site.opportunistic = true;
        self.sites.push(site);
        fn_sites.insert(decl);
        Some(self.sites.len() - 1)
    }

    /// Whether `decl` (a `let` / `const` / `using` binding, or a class declaration) may not be initialized yet where
    /// `function` is created (its eager capture list is read there):
    /// - source order: the function starts before the end of the declarator (inside the initializer, or earlier);
    /// - fix 3 (review M1b): the function sits inside a function declaration nested in the binding's scope (hoisted: it may
    ///   be called before the declarator, `setup(); const stop = …; function setup() { api.close = () => stop(); }`);
    /// - fix 3 (L1): the binding is declared in one `case` of a `switch` and the function in another (a jump skips it).
    ///
    /// `var`, parameters, catch parameters and function declarations never are.
    fn uninitialized_at(&self, decl: NodeId, function: NodeId) -> bool {
        let tree = self.tree;
        let start = tree.span(function).start;
        // The declaration statement (`let` / `const` declaration, class declaration) of `decl`.
        let mut n = Some(decl);
        let declaration = loop {
            let Some(id) = n else { return false };
            match tree.kind(id) {
                AstKind::VariableDeclarator(d) => {
                    if d.kind == VariableDeclarationKind::Var {
                        return false;
                    }
                    if start < tree.span(id).end {
                        return true;
                    }
                    break tree.raw_parent(id).unwrap_or(id);
                }
                AstKind::Class(c) => {
                    if c.r#type != ClassType::ClassDeclaration {
                        return false;
                    }
                    if start < tree.span(id).end {
                        return true;
                    }
                    break id;
                }
                // A destructured binding: up to its declarator (stop at a parameter, catch clause or function).
                AstKind::FormalParameter(_) | AstKind::CatchClause(_) | AstKind::Program(_) => return false,
                _ if tree.is_function(id) => return false,
                _ => n = tree.raw_parent(id),
            }
        };
        let Some(container) = tree.raw_parent(declaration) else { return false };
        // A `case` clause scopes nothing: the switch is the binding's scope, the clause the one that initializes it.
        let (scope, clause) = match tree.kind(container) {
            AstKind::SwitchCase(_) => match tree.raw_parent(container) {
                Some(switch) => (switch, Some(container)),
                None => return false,
            },
            _ => (container, None),
        };
        let mut n = tree.raw_parent(function);
        let mut last = function;
        while let Some(id) = n {
            if id == scope {
                return clause.is_some_and(|clause| last != clause);
            }
            if matches!(tree.kind(id), AstKind::Function(f) if f.r#type == FunctionType::FunctionDeclaration) {
                return true;
            }
            last = id;
            n = tree.raw_parent(id);
        }
        false
    }

    fn inside_site(&self, node: NodeId) -> bool {
        let mut n = self.tree.raw_parent(node);
        while let Some(id) = n {
            if self.site_closures.contains(&id) {
                return true;
            }
            n = self.tree.raw_parent(id);
        }
        false
    }
}
