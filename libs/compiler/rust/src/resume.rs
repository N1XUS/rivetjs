//! Resume extraction: find closures that must run in the browser on a resumed page, compute their
//! explicit captures, and name them as module-level symbols. Server and DOM compiles run the same
//! analysis over the same source, so symbol names and ids agree between targets.

use oxc_allocator::GetAddress;
use oxc_ast::{AstKind, ast::*};
use oxc_semantic::NodeId;
use oxc_span::{GetSpan, Span};
use rustc_hash::{FxHashMap, FxHashSet};
use serde::Serialize;
use std::cell::OnceCell;

use crate::compile::{Diags, attr_name, attr_string, event_info, global_event, is_native, jsx_text, prop_name, starts_with_on};
use crate::entities::decode_html;
use crate::ir::quote;
use crate::slots;
use crate::styling;
use crate::tree::{DeclKind, Tree};

// Function Bridge C3 / T3: module references (`_rMod` stamps + `$ref` symbols).
mod refs;
// List eligibility: O(log n) subtree containment over site / ref-cell spans.
mod bounds;
// Function Bridge C4 / T4: functions stored into captured holders become Fn sites.
mod escape;
// Function Bridge C6 / T8: captured mutable `let`s become shared cells (`_rCell`, `.v`).
mod cells;
// Function Bridge C8 / T10: mutually recursive local functions become one group symbol (`_rGroup`).
mod groups;
// Function Bridge C11 / T13: captured stores marked with their literal paths (`_rStorePaths`).
mod stores;
// Function Bridge C12 / T24: module data classes register (`_rClass`); class-field arrows capture `this`; RV2102.
mod classes;
pub use classes::ClassReg;
// LAZY-ROWS T2 (2026-10-19): per keyed `<For>` lazy-rows eligibility; eligible row functions become symbols.
mod rows;
// RESOURCE-COMPILER (2026-10-20): every captured `const r = resource(…)` is a recipe; RV2016 for the forms that are not.
mod resources;
// Derived model (M2 C1 / C2): boundary facts, the derived server target's plan, RV2103 / RV2104.
pub mod derived;
pub use rows::{ForRow, ForRowFact, for_row_facts, for_row_warnings};
pub(crate) use groups::{early_exit, split_group_message};

/// Local module components (function components whose bodies read nothing outside their own sites)
/// as site-less static component elements. Off: it changes symbol ids of existing resume modules
/// (oracle corpus cases); only `@rivetjs/*` component imports are treated as static for now.
const STATIC_LOCAL_COMPONENTS: bool = false;

/// Framework components that read no signals and claim no client-only / async scope while rendering
/// constant props (structural `For` / `Async` / `Router` and form components are not listed).
fn static_framework_component(from: &str, name: &str) -> bool {
    let package = |p: &str| from == p || from.strip_prefix(p).is_some_and(|rest| rest.starts_with('/'));
    (package("@rivetjs/runtime") && matches!(name, "Picture" | "ImagePreload" | "ChunkGroup" | "Provider"))
        || (package("@rivetjs/kit")
            && matches!(name, "Picture" | "Image" | "Font" | "Head" | "Title" | "Meta" | "HeadLink" | "Script" | "JsonLd" | "ThemeScript"))
        // `@rivetjs/router/client` re-exports the same `Link` (client/index.ts).
        || (matches!(from, "@rivetjs/router/link" | "@rivetjs/router/client") && name == "Link")
}

const BROWSER_GLOBALS: &[&str] = &["window", "document", "navigator", "localStorage", "sessionStorage", "location"];

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum SiteKind {
    Event,
    Attr,
    Bind,
    Region,
    Model,
    Ref,
    Effect,
    ClientEvent,
    Computed,
    Equals,
    Fn,
    /// Slot content passed to a component: a JSX-returning function prop / child, or `r:slot` children.
    Slot,
    /// `{...x}` on a native element: the merged attribute object (spreads + plain attributes).
    Spread,
    /// A browser-only effect bound to its element (`prop:x`, `model:value` on `<select>`): the
    /// symbol takes the element first and calls a `@rivetjs/runtime/dom` helper.
    Element,
    /// `class:` / `style:` directives, class / style objects (G10): one element binding (recorded
    /// like a spread binding) whose symbol binds `classList` / CSSOM on the element.
    Styled,
    /// LIVE-PROPS P3: the live props object of a user component call whose props can read state. The server
    /// passes it through `_rProps(id, props, captures[, 1])` (a recipe, never serialized by value); the symbol
    /// rebuilds it in the browser from the same JSX (`props_text`), so resumed bindings reading `props.x` stay live.
    Props,
}

impl SiteKind {
    fn render(self) -> bool {
        matches!(self, SiteKind::Bind | SiteKind::Region | SiteKind::Slot | SiteKind::Props)
    }

    fn label(self) -> &'static str {
        match self {
            SiteKind::Event => "event",
            SiteKind::Attr => "attr",
            SiteKind::Bind => "bind",
            SiteKind::Region => "region",
            SiteKind::Model => "model",
            SiteKind::Ref => "ref",
            SiteKind::Effect => "effect",
            SiteKind::ClientEvent => "clientEvent",
            SiteKind::Computed => "computed",
            SiteKind::Equals => "equals",
            SiteKind::Fn => "fn",
            SiteKind::Slot => "slot",
            SiteKind::Spread => "spread",
            SiteKind::Element => "effect",
            SiteKind::Styled => "attr",
            SiteKind::Props => "props",
        }
    }
}

pub struct Site {
    pub kind: SiteKind,
    pub closure: Option<NodeId>,
    pub component: String,
    attr: Option<NodeId>,
    child: Option<NodeId>,
    pub call: Option<NodeId>,
    value: Option<NodeId>,
    pub declaration: Option<NodeId>,
    pub event_type: String,
    /// Event sites: a capture-phase handler (`onXCapture`), recorded as `_rOn(…, { capture: 1 })`.
    pub capture: bool,
    /// Event sites: the handler is `test ? f : undefined` / `test ? undefined : f` / `test && f` with a
    /// side-effect-free test — its boolean text (`!!onReset`, `!onReset`) is the server's `present` argument.
    pub present: Option<String>,
    /// Fn sites of a const whose function refers to itself: the symbol binds the name around it.
    self_ref: bool,
    /// Computed sites of `reconstruct(() => …)` (Function Bridge T27, C14): the server call gets `{ equals: false }`.
    pub reconstruct: bool,
    /// Function Bridge T6 (C5): Fn sites of a function declaration (`hoist_container` found): the server registers them at
    /// the top of the declaration's statement list with thunk captures (`_rFn(id, f, () => [caps])`), not after it.
    pub hoisted: bool,
    pub target: String,
    /// Ref sites: the bound local's name.
    pub ref_name: String,
    /// Ref sites: `ref={expr}` with a ref object (`ref()`, a forwarded prop): the server records the
    /// value itself (`_rRef(expr)`), no ref cell.
    pub ref_object: bool,
    /// Ref sites: (attribute, callback), for editor sites only.
    ref_callback: Option<(NodeId, NodeId)>,
    pub captures: Vec<String>,
    /// Slot sites: the `r:slot` elements of one slot name (the closure is the first), or the lazy
    /// children members (`lazy_children`).
    group: Vec<NodeId>,
    /// Slot sites: the plain children of a user component (branded `_slot` thunk).
    lazy_children: bool,
    /// Binding spans of `captures` (same order).
    capture_spans: Vec<Span>,
    /// Capture kinds (same order): "ref" (ref-bound local), "fn" (captured local function symbol), "cell" (boxed `let`,
    /// Function Bridge T8), "value".
    capture_kinds: Vec<&'static str>,
    capture_decls: Vec<NodeId>,
    /// Spread / styled sites with member-read captures (`props.a`, `globalDOMProps(props)`): the
    /// symbol's parameter names (same order as `captures`) and the prologue rebuilding the objects.
    params: Vec<String>,
    prologue: String,
    /// Member-read captures (same order as `captures`): `(object, key literal)` for `props.a` /
    /// `props["x-y"]` — the server wraps them in `_rMember(props, "a")` (live props: a forward box,
    /// LIVE-PROPS P3) and the prologue rebuilds the object through `_members` (boxes → getters).
    pub members: Vec<Option<(String, String)>>,
    /// Function Bridge C8 / T10 group sites (`groups.rs`): member names (source order = the runtime's member index), their
    /// closures, the statement list holding them, and the last `const` member's declaration statement (the server
    /// registers the group after it; None: every member is a function declaration, registered at the list's top).
    pub group_names: Vec<String>,
    group_closures: Vec<NodeId>,
    pub group_container: Option<NodeId>,
    pub group_after: Option<NodeId>,
    /// The symbol prologue calls `__rivetMembers` (import `_members`): props-like member captures (T11: a plain
    /// object literal's prologue is a plain object; a T8 mixed snapshot capture is a member read of the cell).
    members_helper: bool,
    scope: Vec<String>,
    scope_decls: Vec<(String, NodeId)>,
    pub name: String,
    pub id: String,
    /// Spread sites: the merged object's entries (symbol text, source order).
    spread_parts: Vec<String>,
    /// Spread sites: the object's `children` is the element's content (no JSX children).
    spread_content: bool,
    /// Spread sites: the `class:` toggles object text (`_spreadClass`). Styled sites: the symbol's
    /// statements are `spread_parts`.
    spread_class: Option<String>,
    /// Spread / styled sites: runtime helpers (local, export) the symbol uses: `_attrValue` from
    /// `@rivetjs/runtime/dom`, the others from `@rivetjs/runtime/style`.
    dom_helpers: Vec<(&'static str, &'static str)>,
    /// Element sites: dom helper export, its leading arguments after the element, and a literal value
    /// (string / bare attribute) in place of the closure text.
    element_helper: (&'static str, String, Option<String>),
    /// Fn sites extracted opportunistically (R2: function expressions in object literals, `return`
    /// values and component props): no compile-time capture diagnostics (serialization reports them).
    opportunistic: bool,
    /// Props sites: the call's lazy children are the symbol's last parameter (`__rivetChildren`, the server's
    /// slot passed by `_rProps(…, 1)`) instead of a second compiled copy in the symbol.
    pub props_children: bool,
}

impl Site {
    /// Binding span of capture `index` (its declaration, or the member read), for source maps (T9).
    pub fn capture_span(&self, index: usize) -> Option<Span> {
        self.capture_spans.get(index).copied()
    }

    /// Declarations of `captures` (same order).
    pub fn capture_decls(&self) -> &[NodeId] {
        &self.capture_decls
    }
    /// Capture kinds (same order as `captures`; Function Bridge T8: `"value"` for a boxed `let` captured by value).
    pub fn capture_kinds(&self) -> &[&'static str] {
        &self.capture_kinds
    }

    fn new(kind: SiteKind) -> Site {
        Site {
            kind,
            closure: None,
            component: String::new(),
            attr: None,
            child: None,
            call: None,
            value: None,
            declaration: None,
            event_type: String::new(),
            capture: false,
            present: None,
            self_ref: false,
            reconstruct: false,
            hoisted: false,
            target: String::new(),
            ref_name: String::new(),
            ref_object: false,
            ref_callback: None,
            captures: Vec::new(),
            group: Vec::new(),
            lazy_children: false,
            capture_spans: Vec::new(),
            capture_kinds: Vec::new(),
            capture_decls: Vec::new(),
            params: Vec::new(),
            prologue: String::new(),
            members: Vec::new(),
            group_names: Vec::new(),
            group_closures: Vec::new(),
            group_container: None,
            group_after: None,
            members_helper: false,
            scope: Vec::new(),
            scope_decls: Vec::new(),
            name: String::new(),
            id: String::new(),
            spread_parts: Vec::new(),
            spread_content: false,
            spread_class: None,
            dom_helpers: Vec::new(),
            element_helper: ("", String::new(), None),
            opportunistic: false,
            props_children: false,
        }
    }
}

#[derive(Serialize, Clone)]
pub struct Import {
    pub local: String,
    pub imported: String,
    pub from: String,
}

#[derive(Serialize, Clone)]
pub struct Symbol {
    pub name: String,
    pub id: String,
    pub kind: &'static str,
    pub component: String,
    pub captures: Vec<String>,
    /// Function Bridge T19 fix 1: the user-facing name of each capture, as written (`o.a` for the member-narrowed
    /// parameter `o$a`), aligned with `captures`; absent when every label equals its capture name. Dev error messages
    /// and the dev overlay name captures by these.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub labels: Vec<String>,
    pub scope: Vec<String>,
    pub imports: Vec<Import>,
    pub locals: Vec<String>,
    pub source: String,
    /// Module references only (Function Bridge T3 fix round 2): every component using the value, in source order, when
    /// more than one does (absent otherwise) — the bundler gives such a reference its own chunk.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub uses: Vec<String>,
    /// Own module references only (fix round 3, L2): the other names the module exports the value under (the id uses the
    /// smallest) — importers of an alias stamp `<unit>#<alias>…`; the bundler maps those to this symbol.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub aliases: Vec<String>,
}

/// Function Bridge T6 (C5): the statement list a local function declaration belongs to — a function body, block, class
/// static block or `case` clause (block-scoped in modules: a registration hoisted further would not see the name). The
/// server registers the declaration's Fn site at the top of it, before any statement (directives stay first).
pub fn hoist_container(tree: &Tree<'_>, decl: NodeId) -> Option<NodeId> {
    let container = tree.raw_parent(decl)?;
    matches!(tree.kind(container), AstKind::FunctionBody(_) | AstKind::BlockStatement(_) | AstKind::StaticBlock(_) | AstKind::SwitchCase(_))
        .then_some(container)
}

/// Insertion-ordered node → site map (JS `Map` semantics: `set` keeps the original position).
#[derive(Default)]
struct SiteMap {
    entries: Vec<Option<(NodeId, usize)>>,
    index: FxHashMap<NodeId, usize>,
}

impl SiteMap {
    fn set(&mut self, key: NodeId, site: usize) {
        if let Some(&slot) = self.index.get(&key) {
            self.entries[slot] = Some((key, site));
        } else {
            self.index.insert(key, self.entries.len());
            self.entries.push(Some((key, site)));
        }
    }
    fn get(&self, key: NodeId) -> Option<usize> {
        self.index.get(&key).and_then(|&slot| self.entries[slot]).map(|(_, site)| site)
    }
    fn delete(&mut self, key: NodeId) {
        if let Some(slot) = self.index.remove(&key) {
            self.entries[slot] = None;
        }
    }
    fn iter(&self) -> impl Iterator<Item = (NodeId, usize)> + '_ {
        self.entries.iter().flatten().copied()
    }
}

pub struct Resumed {
    pub sites: Vec<Site>,
    /// RESUME-ACCESSOR-ROW: `return` / concise-body statements of components returning an accessor: the server wraps the
    /// returned value in `_rChild` (a symbol function → its own child site).
    pub child_returns: FxHashSet<NodeId>,
    map: SiteMap,
    /// Lazy containment index for `has_site_within` (`bounds.rs`); `Resumed` is immutable after `analyze`.
    bounds: OnceCell<Vec<(u32, u32)>>,
    pub ref_cells: FxHashSet<NodeId>,
    pub symbols: Vec<Symbol>,
    /// Module-scope value names referenced by symbols, in first-use order.
    pub scope: Vec<String>,
    /// Function Bridge C3: module references the server stamps at module load (`_rMod`), first use first.
    pub module_refs: Vec<ModuleRef>,
    /// Function Bridge C6 / T8: boxed `let` declarators (server `const x = _rCell(init)`, `cells.rs`).
    pub cells: FxHashSet<NodeId>,
    /// Function Bridge T8: every reference of a boxed `let` → its server text (`x.v`, `(0, x.v)`, `x: x.v`).
    pub cell_refs: FxHashMap<NodeId, String>,
    /// Function Bridge C9 / T10: `f.bind(t, ...args)` calls (bound `const` initializers a site captures, through
    /// bound-of-bound chains) the server rewrites to `_rBound(f, t, [args])`.
    pub bound: FxHashSet<NodeId>,
    /// Function Bridge C8 / T10: group sites registered after a `const` member's declaration statement (statement → sites,
    /// source order; fix 1 F5: two groups may end in one multi-declarator statement).
    pub group_after: FxHashMap<NodeId, Vec<usize>>,
    /// Function Bridge C8 / T10: member declaration → its group site.
    pub group_of: FxHashMap<NodeId, usize>,
    /// Function Bridge C11 / T13: captured store declarators → their literal paths (server
    /// `const s = _rStorePaths(createStore(…), [paths])`, `stores.rs`).
    pub store_paths: FxHashMap<NodeId, Vec<String>>,
    /// DIET-STATE 1c: captured pure-literal component `const`s → their hoisted module name (`const x = __rivetData0_x`,
    /// hoist `const __rivetData0_x = <literal>;`, both targets; `refs.rs` `local_data`).
    pub local_data: FxHashMap<NodeId, String>,
    /// Function Bridge C12 / T24: data classes the server registers at module end (`_rClass(Cls, id)`, `classes.rs`).
    pub classes: Vec<ClassReg>,
    /// Function Bridge C12 / T24: class-field arrows of registered classes → symbol id (server `_rFn(id, arrow, [this])`).
    pub class_arrows: FxHashMap<NodeId, String>,
    /// LAZY-ROWS T2: every structural `<For>` (source order) with its lazy-rows verdict (`rows.rs`).
    pub for_rows: Vec<ForRow>,
}

/// Function Bridge C3: a module reference stamped by the server epilogue: `_rMod(() => value, "id"[, 1])` (1 = an import).
pub struct ModuleRef {
    /// Server expression of the value (`inc`, `ns.member`).
    pub value: String,
    pub id: String,
    pub imported: bool,
    /// DIET-STATE 1: module static data (stamp flag `2`: nested objects stamped with their key paths).
    pub data: bool,
}


impl Resumed {
    pub fn site_at(&self, node: NodeId) -> Option<usize> {
        self.map.get(node)
    }

    /// Any site (or ref cell) keyed inside `span` (FLATTEN-CMP-2: list-mount rows must record nothing).
    /// Props sites do not count (LIVE-PROPS P3): `_rProps` records nothing, it only registers its recipe.
    pub fn has_site_within(&self, tree: &Tree, span: Span) -> bool {
        let bounds = self.bounds.get_or_init(|| bounds::build(self, tree));
        let at = bounds.partition_point(|&(start, _)| start < span.start);
        bounds.get(at).is_some_and(|&(_, end)| end <= span.end)
    }
}

struct Analysis<'t, 'a> {
    /// RESUME-ACCESSOR-ROW fix 1: `return` statements / concise-body statements whose value the server wraps in `_rChild`.
    child_returns: FxHashSet<NodeId>,
    tree: &'t Tree<'a>,
    sites: Vec<Site>,
    map: SiteMap,
    candidates: Vec<usize>,
    site_closures: FxHashSet<NodeId>,
    ref_assignments: Vec<(NodeId, usize)>,
    all_assignments: FxHashMap<NodeId, usize>,
    /// Import specifiers of static-call bindings (i18n `t`): their calls resolve at compile time.
    statics: &'t FxHashSet<NodeId>,
    /// `@rivetjs/*` packages compiled like application code (source packages, e.g. `@rivetjs/aria`):
    /// their components are user components.
    source_packages: &'t [String],
    /// Closures of every site (a node is at most one site's closure).
    claimed: FxHashSet<NodeId>,
    /// Local declarations passed as component props / object literal values / return values: Fn
    /// symbols when eligible (captured locals are promoted the same way), even when no site captures them.
    seeds: Vec<NodeId>,
    /// Row getter parameters of `<For>` children (`(row, index) => …`, `For` from `@rivetjs/runtime/dom` /
    /// `/server`), never reassigned: constant per row on the server (`ConstantGetter`) and for an adopted row
    /// in the browser (the browser For re-creates a row whose item identity or read index changed), so
    /// `row()` / `index()` read no signals (FLATTEN-CMP-1).
    accessors: FxHashSet<NodeId>,
    /// Function Bridge C3: value uses of module references, first use per binding (+ member).
    refs: Vec<refs::RefUse>,
    /// Function Bridge T3: import specifier → resolved module id (`resolvedImports`), the unit of import reference ids.
    resolved: &'t FxHashMap<String, String>,
    /// Function Bridge T4: right sides of assignments into a local binding or a member chain rooted at it (`escape.rs`).
    holder_writes: FxHashMap<NodeId, Vec<&'a Expression<'a>>>,
    /// T4b review L2 (T8): declarations / function literals `named_site` / `holder_site` rejected once (never re-analysed).
    rejected: FxHashSet<NodeId>,
    /// T4b review L3 (T8): closures of `sites[..closures_indexed]` (`holder_site`'s "already a site" test, extended lazily).
    closures: FxHashSet<NodeId>,
    closures_indexed: usize,
    /// LAZY-ROWS T2: structural `<For>` verdicts (`rows.rs`).
    for_rows: Vec<ForRow>,
}

/// Function-like node TypeScript names `isFunction` here (methods and accessors included via
/// their function values).
fn is_function(tree: &Tree, id: NodeId) -> bool {
    tree.is_function(id)
}

impl<'t, 'a> Analysis<'t, 'a> {
    fn id<T>(&self, node: &T) -> Option<NodeId> {
        self.tree.id_of(node)
    }

    /// The top-level function (component or helper) a node belongs to.
    fn component_of(&self, node: NodeId) -> Option<String> {
        let tree = self.tree;
        let top = self.top_function(node)?;
        let parent = tree.raw_parent(top).map(|p| tree.kind(p));
        if let AstKind::Function(f) = tree.kind(top) {
            match parent {
                Some(AstKind::MethodDefinition(m)) => {
                    return Some(match (&m.key, m.kind) {
                        (_, MethodDefinitionKind::Constructor) => "Anonymous".into(),
                        (PropertyKey::StaticIdentifier(i), _) => i.name.to_string(),
                        _ => "Anonymous".into(),
                    });
                }
                Some(AstKind::ObjectProperty(p)) if p.method || p.kind != PropertyKind::Init => {
                    return Some(match &p.key {
                        PropertyKey::StaticIdentifier(i) => i.name.to_string(),
                        _ => "Anonymous".into(),
                    });
                }
                _ => {}
            }
            if let Some(id) = &f.id {
                return Some(id.name.to_string());
            }
        }
        if let Some(AstKind::VariableDeclarator(d)) = parent {
            if let BindingPatternKind::BindingIdentifier(id) = &d.id.kind {
                return Some(id.name.to_string());
            }
        }
        Some("Anonymous".into())
    }

    fn declaration_of(&self, ident: &IdentifierReference<'a>) -> Option<NodeId> {
        let decl = self.tree.resolve(ident, true)?;
        self.tree.decl_kind(decl).is_value().then_some(decl)
    }

    fn module_scoped(&self, decl: NodeId) -> bool {
        let tree = self.tree;
        let mut n = tree.raw_parent(decl);
        while let Some(id) = n {
            if matches!(tree.kind(id), AstKind::Program(_)) {
                break;
            }
            if is_function(tree, id) {
                return false;
            }
            n = tree.raw_parent(id);
        }
        tree.decl_kind(decl) != DeclKind::Parameter
    }

    fn within(&self, node: NodeId, outer: NodeId) -> bool {
        let (a, b) = (self.tree.span(node), self.tree.span(outer));
        a.start >= b.start && a.end <= b.end && node != outer
    }

    fn import_of(&self, callee: &Expression<'a>) -> Option<(String, &'a str)> {
        let Expression::Identifier(ident) = callee else { return None };
        let decl = self.tree.resolve(ident, false)?;
        let AstKind::ImportSpecifier(s) = self.tree.kind(decl) else { return None };
        let from = import_source(self.tree, decl)?;
        Some((s.imported.name().to_string(), from))
    }

    fn add(&mut self, mut site: Site, closure: NodeId) -> Option<usize> {
        let component = self.component_of(closure)?;
        site.closure = Some(closure);
        site.component = component;
        let kind = site.kind;
        self.sites.push(site);
        let index = self.sites.len() - 1;
        self.candidates.push(index);
        self.claimed.insert(closure);
        // Render regions are scanned inside: their elements' handlers and bindings are sites too.
        if !kind.render() {
            self.site_closures.insert(closure);
        }
        Some(index)
    }

    fn ref_target(&self, value: &'a Expression<'a>) -> Option<NodeId> {
        let (params, body, concise) = match value {
            Expression::ArrowFunctionExpression(a) => (&a.params, &*a.body, a.expression),
            Expression::FunctionExpression(f) => (&f.params, f.body.as_deref()?, false),
            _ => return None,
        };
        if params.items.len() + usize::from(params.rest.is_some()) != 1 {
            return None;
        }
        let param = match (params.items.first(), &params.rest) {
            (Some(p), _) => &p.pattern,
            (None, Some(rest)) => &rest.argument,
            _ => return None,
        };
        let BindingPatternKind::BindingIdentifier(param) = &param.kind else { return None };
        let mut expression = if concise {
            match body.statements.first() {
                Some(Statement::ExpressionStatement(s)) => &s.expression,
                _ => return None,
            }
        } else {
            match body.statements.as_slice() {
                [Statement::ExpressionStatement(s)] => &s.expression,
                _ => return None,
            }
        };
        while let Expression::ParenthesizedExpression(p) = expression {
            expression = &p.expression;
        }
        let Expression::AssignmentExpression(assign) = expression else { return None };
        if assign.operator != AssignmentOperator::Assign {
            return None;
        }
        let AssignmentTarget::AssignmentTargetIdentifier(left) = &assign.left else { return None };
        let Expression::Identifier(right) = &assign.right else { return None };
        if right.name != param.name {
            return None;
        }
        let decl = self.declaration_of(left)?;
        let AstKind::VariableDeclarator(d) = self.tree.kind(decl) else { return None };
        if d.init.is_some() || d.kind != VariableDeclarationKind::Let || self.module_scoped(decl) {
            return None;
        }
        Some(decl)
    }

    /// A function literal, or a local bound to one: a ref callback that a resumed page never calls.
    fn local_callback(&self, value: &'a Expression<'a>) -> bool {
        let mut value = value;
        while let Expression::ParenthesizedExpression(p) = value {
            value = &p.expression;
        }
        let function = |e: &Expression| {
            let mut e = e;
            while let Expression::ParenthesizedExpression(p) = e {
                e = &p.expression;
            }
            matches!(e, Expression::ArrowFunctionExpression(_) | Expression::FunctionExpression(_))
        };
        if function(value) {
            return true;
        }
        let Expression::Identifier(ident) = value else { return false };
        let Some(decl) = self.declaration_of(ident) else { return false };
        match self.tree.kind(decl) {
            AstKind::Function(_) => true,
            AstKind::VariableDeclarator(d) => d.init.as_ref().is_some_and(function),
            _ => false,
        }
    }

    /// `row()` / `index()`: a zero-argument, non-optional call of a `<For>` row getter parameter.
    fn accessor_call(&self, call: &CallExpression<'a>) -> bool {
        if self.accessors.is_empty() || !call.arguments.is_empty() || call.optional {
            return false;
        }
        let Expression::Identifier(callee) = &call.callee else { return false };
        self.tree.resolve(callee, false).is_some_and(|decl| self.accessors.contains(&decl))
    }

    /// CORE-GAPS (c): `object` (through parentheses / TS casts) names a props object whose members may be live
    /// getters (LIVE-PROPS): reading one can read signals, like a call (`live_binding`).
    fn live_object(&self, object: &Expression<'a>) -> bool {
        let Expression::Identifier(ident) = unwrap(object) else { return false };
        self.declaration_of(ident).is_some_and(|decl| self.live_binding(decl))
    }

    /// A binding holding a props object: the first identifier parameter of a PascalCase component function
    /// (`function Badge(props)`, `const Card = (props) => …`), a `const` initialized by `mergeProps(…)` /
    /// array-destructured from `splitProps(…)` (`@rivetjs/runtime/props`: getters forwarded unread), or a `const`
    /// getter object literal (`{ get x() {…} }`). Destructured props, `.map` / `For` row parameters and lowercase
    /// helpers are not (their member reads stay plain: list rows `{item.name}` keep their cost).
    fn live_binding(&self, decl: NodeId) -> bool {
        let tree = self.tree;
        match tree.kind(decl) {
            AstKind::FormalParameter(p) => {
                if !matches!(p.pattern.kind, BindingPatternKind::BindingIdentifier(_)) {
                    return false;
                }
                let Some(params) = tree.raw_parent(decl) else { return false };
                let AstKind::FormalParameters(list) = tree.kind(params) else { return false };
                if list.items.first().is_none_or(|first| first.span != p.span) {
                    return false;
                }
                tree.raw_parent(params).is_some_and(|function| self.component_function(function))
            }
            AstKind::VariableDeclarator(d) => {
                d.kind == VariableDeclarationKind::Const
                    && matches!(d.id.kind, BindingPatternKind::BindingIdentifier(_))
                    && (self.props_helper(d.init.as_ref(), "mergeProps") || accessor_object(d.init.as_ref()))
            }
            // `const [local, rest] = splitProps(props, […])`: an element binding of an array pattern (no object
            // pattern on the way: that would read the members eagerly).
            _ => {
                let mut n = tree.raw_parent(decl);
                for _ in 0..8 {
                    let Some(id) = n else { return false };
                    match tree.kind(id) {
                        AstKind::VariableDeclarator(d) => {
                            return d.kind == VariableDeclarationKind::Const
                                && matches!(d.id.kind, BindingPatternKind::ArrayPattern(_))
                                && self.props_helper(d.init.as_ref(), "splitProps");
                        }
                        AstKind::ObjectPattern(_) | AstKind::AssignmentPattern(_) | AstKind::Function(_) | AstKind::ArrowFunctionExpression(_) => {
                            return false;
                        }
                        _ => n = tree.raw_parent(id),
                    }
                }
                false
            }
        }
    }

    /// `init` is a call of `name` imported from `@rivetjs/runtime/props`.
    fn props_helper(&self, init: Option<&Expression<'a>>, name: &str) -> bool {
        let Some(Expression::CallExpression(call)) = init.map(unwrap) else { return false };
        self.import_of(&call.callee).is_some_and(|(imported, from)| imported == name && from == "@rivetjs/runtime/props")
    }

    /// A function named in PascalCase (its own name, or the `const` it initializes through parentheses / TS
    /// casts): a component by convention.
    fn component_function(&self, function: NodeId) -> bool {
        let tree = self.tree;
        let pascal = |name: &str| name.chars().next().is_some_and(|c| c.is_ascii_uppercase());
        if let AstKind::Function(f) = tree.kind(function) {
            if let Some(id) = &f.id {
                return pascal(id.name.as_str());
            }
        } else if !matches!(tree.kind(function), AstKind::ArrowFunctionExpression(_)) {
            return false;
        }
        let mut n = tree.raw_parent(function);
        while let Some(id) = n {
            match tree.kind(id) {
                AstKind::ParenthesizedExpression(_) | AstKind::TSAsExpression(_) | AstKind::TSSatisfiesExpression(_) | AstKind::TSNonNullExpression(_) => {
                    n = tree.raw_parent(id);
                }
                AstKind::VariableDeclarator(d) => {
                    return matches!(&d.id.kind, BindingPatternKind::BindingIdentifier(b) if pascal(b.name.as_str()));
                }
                _ => return false,
            }
        }
        false
    }

    fn contains_call(&self, id: NodeId) -> bool {
        let tree = self.tree;
        // Row getter calls read nothing, but JSX in the expression keeps the site: its components may
        // read signals while rendering, and the site is the region they attribute to.
        let getters = !self.accessors.is_empty() && !self.contains_jsx(id);
        let mut found = false;
        tree.walk(id, &mut |n| {
            if found {
                return false;
            }
            match tree.kind(n) {
                // `t(...)` / `t.in(...)` through a static-call binding is not a runtime call; its
                // arguments still are.
                AstKind::CallExpression(call) if self.static_call(call) => true,
                // A For row getter reads no signals (`row().values[0]` is like `item.values[0]` in `.map`).
                AstKind::CallExpression(call) if getters && self.accessor_call(call) => false,
                AstKind::CallExpression(_)
                | AstKind::TaggedTemplateExpression(_)
                | AstKind::NewExpression(_)
                | AstKind::ImportExpression(_) => {
                    found = true;
                    false
                }
                // CORE-GAPS (c): a member read of a props object may run a live-props getter (`{props.count}`).
                AstKind::StaticMemberExpression(m) if m.property.name != "children" && self.live_object(&m.object) => {
                    found = true;
                    false
                }
                AstKind::ComputedMemberExpression(m)
                    if !matches!(unwrap(&m.expression), Expression::StringLiteral(s) if s.value == "children") && self.live_object(&m.object) =>
                {
                    found = true;
                    false
                }
                _ => !is_function(tree, n),
            }
        });
        found
    }

    /// The site closure of a function child holding a call: a concise body (`{() => log().join()}`) is the
    /// body expression; a block body (`{() => { const v = s(); return <b>{v}</b>; }}`) is the function itself
    /// (its statements are no expression; the browser reads the function in a nested binding). Calls in nested
    /// functions do not count (they do not run when the child renders).
    fn function_child(&self, e: &'a Expression<'a>) -> Option<NodeId> {
        let tree = self.tree;
        if let Some(body) = function_child_body(e) {
            return tree.expr_id(body).filter(|&body| self.contains_call(body));
        }
        let arrow = function_child_block(e)?;
        let calls = arrow.body.statements.iter().any(|statement| tree.node_at(statement.address()).is_some_and(|id| self.contains_call(id)));
        if calls { tree.expr_id(e) } else { None }
    }

    fn contains_jsx(&self, id: NodeId) -> bool {
        let tree = self.tree;
        let mut found = false;
        tree.walk(id, &mut |n| {
            if matches!(tree.kind(n), AstKind::JSXElement(_) | AstKind::JSXFragment(_)) {
                found = true;
            }
            !found
        });
        found
    }

    fn static_call(&self, call: &CallExpression<'a>) -> bool {
        if self.statics.is_empty() {
            return false;
        }
        let callee = match &call.callee {
            Expression::Identifier(i) => i,
            Expression::StaticMemberExpression(m) if m.property.name == "in" => match &m.object {
                Expression::Identifier(i) => i,
                _ => return false,
            },
            _ => return false,
        };
        self.tree.resolve(callee, false).is_some_and(|decl| self.statics.contains(&decl))
    }

    fn contains_function(&self, id: NodeId) -> bool {
        let tree = self.tree;
        let mut found = false;
        tree.walk(id, &mut |n| {
            if found {
                return false;
            }
            if is_function(tree, n) || matches!(tree.kind(n), AstKind::JSXElement(_) | AstKind::JSXFragment(_)) {
                found = true;
                return false;
            }
            true
        });
        found
    }

    fn scan(&mut self, id: NodeId, in_site: bool, diags: &mut Diags) {
        let tree = self.tree;
        let kind = tree.kind(id);
        if !in_site {
            if let AstKind::JSXElement(el) = kind {
                if !is_native(tree, el) {
                    self.scan_component(el);
                } else if !slots::is_slot(tree, Some(id), el) {
                    self.scan_element(id, el, diags);
                }
            }
            if let AstKind::CallExpression(call) = kind {
                self.scan_call(id, call);
                // RESOURCE-COMPILER: RV2016 for a `resource()` form that cannot resume (`resources.rs`).
                self.scan_resource(id, call, diags);
            }
            // R2: values that leave the function (object literal values, returned values) may reach
            // resumed captures; functions among them become symbols.
            match kind {
                // Method shorthands (`{ onPress(e) {…} }`) are function expressions: wrapped like arrows.
                AstKind::ObjectProperty(p) if p.kind == PropertyKind::Init => self.escaping(&p.value),
                AstKind::ReturnStatement(r) => {
                    if let Some(argument) = &r.argument {
                        self.escaping(argument);
                        let owner = self.nearest_function(id);
                        self.returned_value(owner, id, argument, diags);
                    }
                }
                // RESUME-ACCESSOR-ROW: a component's concise arrow body (`(props) => () => …`).
                AstKind::ArrowFunctionExpression(a) if a.expression => {
                    if let Some(Statement::ExpressionStatement(body)) = a.body.statements.first() {
                        if let Some(statement) = self.id(&**body) {
                            self.returned_value(Some(id), statement, &body.expression, diags);
                        }
                    }
                }
                // LIVE-PROPS P3: a local `const value = { get x() {…} }` (context values over live props, e.g. ui Card's
                // `SurfaceContext`) is a seed: an Fn symbol rebuilds the getters in the browser instead of the state
                // holding a snapshot of what they returned during the server render.
                AstKind::VariableDeclarator(d) if d.kind == VariableDeclarationKind::Const && accessor_object(d.init.as_ref()) => {
                    if !self.module_scoped(id) && !self.seeds.contains(&id) {
                        self.seeds.push(id);
                    }
                }
                _ => {}
            }
            // Function Bridge C3: module functions / imports in value positions (`refs.rs`).
            self.scan_refs(kind);
            // Function Bridge T4: stores into local holders (`escape.rs`).
            self.scan_holder_write(kind);
        }
        if let AstKind::AssignmentExpression(assign) = kind {
            if assign.operator == AssignmentOperator::Assign {
                if let AssignmentTarget::AssignmentTargetIdentifier(left) = &assign.left {
                    if let Some(decl) = self.declaration_of(left) {
                        *self.all_assignments.entry(decl).or_default() += 1;
                    }
                }
            }
        }
        for &child in tree.children(id) {
            let inside = in_site || self.site_closures.contains(&child);
            self.scan(child, inside, diags);
        }
    }

    fn scan_element(&mut self, element: NodeId, el: &'a JSXElement<'a>, diags: &mut Diags) {
        let tree = self.tree;
        let has_spread = el.opening_element.attributes.iter().any(|a| matches!(a, JSXAttributeItem::SpreadAttribute(_)));
        let groups = styling::analyze(tree, el, has_spread, &|_| None);
        let spread = self.scan_spread(el, groups.as_ref());
        if let Some(groups) = &groups {
            self.scan_styled(el, groups, spread);
        }
        for (index, item) in el.opening_element.attributes.iter().enumerate() {
            let JSXAttributeItem::Attribute(attr) = item else { continue };
            let Some(attr_id) = self.id(&**attr) else { continue };
            let name = attr_name(tree, attr);
            if spread && spread_plain(tree, el, attr) {
                continue;
            }
            if groups.as_ref().is_some_and(|g| g.members.contains(&index)) {
                continue;
            }
            let value = match &attr.value {
                Some(JSXAttributeValue::ExpressionContainer(c)) => c.expression.as_expression(),
                _ => None,
            };
            let value_id = value.and_then(|v| tree.expr_id(v));
            let global = global_event(name);
            if let (Some(Some((target, event_type))), Some(value_id)) = (&global, value_id) {
                let mut site = Site::new(SiteKind::ClientEvent);
                site.attr = Some(attr_id);
                site.target = if *target == "window" { "w" } else { "d" }.into();
                site.event_type = event_type.clone();
                self.add(site, value_id);
            } else if name == "ref" && value.is_some() {
                let (Some(value), Some(value_id)) = (value, value_id) else { continue };
                if let Some(decl) = self.ref_target(value) {
                    match self.ref_assignments.iter_mut().find(|(d, _)| *d == decl) {
                        Some(entry) => entry.1 += 1,
                        None => self.ref_assignments.push((decl, 1)),
                    }
                    let mut site = Site::new(SiteKind::Ref);
                    site.declaration = Some(decl);
                    // Editor sites only (ref sites are not symbols); analysis never reads these.
                    site.ref_callback = Some((attr_id, value_id));
                    site.component = self.component_of(value_id).unwrap_or_default();
                    site.ref_name = match tree.kind(decl) {
                        AstKind::VariableDeclarator(d) => match &d.id.kind {
                            BindingPatternKind::BindingIdentifier(i) => i.name.to_string(),
                            _ => String::new(),
                        },
                        _ => String::new(),
                    };
                    let _ = element;
                    self.sites.push(site);
                    self.map.set(attr_id, self.sites.len() - 1);
                } else if let Some(component) = self.component_of(value_id) {
                    if self.local_callback(value) {
                        diags.add("Resumable ref callbacks must assign a local: ref={(el) => (local = el)}", Some(attr_id));
                    } else {
                        // A ref object (or whatever the expression yields: checked when rendering).
                        let mut site = Site::new(SiteKind::Ref);
                        site.ref_object = true;
                        site.component = component;
                        self.sites.push(site);
                        self.map.set(attr_id, self.sites.len() - 1);
                    }
                }
            } else if starts_with_on(name) && value.is_some() {
                let Some(value_id) = value_id else { continue };
                if let Some((event_type, capture)) = event_info(name) {
                    let mut site = Site::new(SiteKind::Event);
                    site.attr = Some(attr_id);
                    site.event_type = event_type;
                    site.capture = capture;
                    site.present = value.and_then(|e| presence_test(tree, e));
                    self.add(site, value_id);
                }
            } else if let Some(prop) = prop_name(name) {
                let mut site = Site::new(SiteKind::Element);
                site.attr = Some(attr_id);
                let literal = match &attr.value {
                    None => Some("true".to_string()),
                    Some(JSXAttributeValue::StringLiteral(_)) => Some(quote(&attr_string(tree, attr).map(decode_html).unwrap_or_default())),
                    _ => None,
                };
                let closure = if literal.is_some() { Some(attr_id) } else { value_id };
                site.element_helper = ("_setProp", format!("{}, ", quote(prop)), literal);
                if let Some(closure) = closure {
                    self.add(site, closure);
                }
            } else if name == "model:value" && tree.text_of(el.opening_element.name.span()) == "select" && value.is_some() {
                let Some(value_id) = value_id else { continue };
                let mut site = Site::new(SiteKind::Element);
                site.attr = Some(attr_id);
                site.element_helper = ("_resumeSelect", String::new(), None);
                self.add(site, value_id);
            } else if name.starts_with("model:") && value.is_some() {
                // The signal itself is the state.
                self.sites.push(Site::new(SiteKind::Model));
                self.map.set(attr_id, self.sites.len() - 1);
            } else if let Some(value_id) = value_id {
                if global.is_none() && self.contains_call(value_id) {
                    let mut site = Site::new(SiteKind::Attr);
                    site.attr = Some(attr_id);
                    self.add(site, value_id);
                }
            }
        }
        for child in &el.children {
            match child {
                JSXChild::ExpressionContainer(c) => {
                    let Some(e) = c.expression.as_expression() else { continue };
                    let (Some(child_id), Some(expr_id)) = (self.id(&**c), tree.expr_id(e)) else { continue };
                    if self.contains_call(expr_id) {
                        let mut site = Site::new(SiteKind::Bind);
                        site.child = Some(child_id);
                        self.add(site, expr_id);
                    } else if let Some(closure) = self.function_child(e) {
                        // A function child (`{() => log().join()}`, `{() => { const v = s(); return <b>{v}</b>; }}`):
                        // the server renders its value (`_rBind` calls the function under tracking), the browser
                        // binds the body (a block body: the function itself, read in a nested binding).
                        let mut site = Site::new(SiteKind::Bind);
                        site.child = Some(child_id);
                        self.add(site, closure);
                    }
                }
                // A component child may read signals while constructing (props, body, For each):
                // the server records it as a region when it does, or when it mounts client-only code.
                JSXChild::Element(c) if !is_native(tree, c) || slots::is_slot(tree, self.id(&**c), c) => {
                    let Some(child_id) = self.id(&**c) else { continue };
                    // A statically known component with constant props cannot depend on signals at
                    // its site: it renders as a plain call (stray reads attribute to the enclosing region).
                    if !is_native(tree, c) && self.static_component(c, &mut FxHashSet::default()) {
                        continue;
                    }
                    let mut site = Site::new(SiteKind::Region);
                    site.child = Some(child_id);
                    self.add(site, child_id);
                }
                _ => {}
            }
        }
    }

    /// `{ "name": (value), … }` of class toggles; expression values join `group` (captures).
    /// A spread element's style group as an object literal (source order; `false` unsets).
    fn spread_style_text(&self, style: &styling::StyleGroup<'a>, group: &mut Vec<NodeId>) -> String {
        let mut parts = Vec::new();
        for entry in &style.entries {
            match entry {
                styling::Entry::Prop(name, value) => {
                    let value = match value {
                        styling::Val::Expr(e) => match self.tree.expr_id(e) {
                            Some(id) => {
                                group.push(id);
                                format!("({})", self.tree.text(id))
                            }
                            None => "undefined".into(),
                        },
                        styling::Val::Str(text) | styling::Val::Num(text) => quote(text),
                        styling::Val::Bool(_) => "null".into(),
                    };
                    parts.push(format!("{}: {value}", quote(name)));
                }
                styling::Entry::Object(e) => match self.tree.expr_id(e) {
                    Some(id) => {
                        group.push(id);
                        parts.push(format!("...({})", self.tree.text(id)));
                    }
                    None => {}
                },
            }
        }
        format!("{{ {} }}", parts.join(", "))
    }

    fn toggles_text(&self, toggles: &[styling::Toggle<'a>], group: &mut Vec<NodeId>) -> String {
        let parts: Vec<String> = toggles
            .iter()
            .map(|toggle| {
                let value = match &toggle.value {
                    styling::Val::Expr(e) => match self.tree.expr_id(e) {
                        Some(id) => {
                            group.push(id);
                            format!("({})", self.tree.text(id))
                        }
                        None => "undefined".into(),
                    },
                    styling::Val::Bool(true) => "true".into(),
                    _ => "false".into(),
                };
                format!("{}: {value}", quote(&toggle.name))
            })
            .collect();
        format!("{{ {} }}", parts.join(", "))
    }

    /// G10: the element's class / style group binding (spread elements: style only). A site only when a
    /// dynamic value contains a call; its symbol re-binds the dynamic parts in the browser (literal
    /// parts are already in the server markup). Same first-attribute rule as the compiler.
    fn scan_styled(&mut self, el: &'a JSXElement<'a>, groups: &styling::Groups<'a>, spread: bool) {
        let tree = self.tree;
        let class = groups.class.as_ref().filter(|_| !spread);
        // exception: user ruling 2026-10-06 (MATRIX-1) — a spread element's style group is in the spread site.
        let style = groups.style.as_ref().filter(|_| !spread);
        let first = match (class.map(|g| g.first), style.map(|g| g.first)) {
            (Some(a), Some(b)) => a.min(b),
            (Some(a), None) | (None, Some(a)) => a,
            (None, None) => return,
        };
        let mut group = Vec::new();
        let mut statements = Vec::new();
        let mut helpers: Vec<(&'static str, &'static str)> = Vec::new();
        let text = |e: &Expression<'a>, group: &mut Vec<NodeId>| -> Option<String> {
            let id = tree.expr_id(e)?;
            group.push(id);
            Some(tree.text(id).to_string())
        };
        if let Some(class) = class {
            if let Some(styling::Base::Expr(base)) = &class.base {
                let Some(base) = text(base, &mut group) else { return };
                let toggles = if class.toggles.is_empty() { String::new() } else { format!(", {}", self.toggles_text(&class.toggles, &mut group)) };
                add_helper(&mut helpers, ("__rivetResumeAttr", "_attrValue"));
                add_helper(&mut helpers, ("__rivetResumeCx", "_class"));
                statements.push(format!("__rivetResumeAttr(__rivetEl, \"class\", () => __rivetResumeCx(({base}){toggles}))"));
            } else {
                for toggle in &class.toggles {
                    let styling::Val::Expr(e) = &toggle.value else { continue };
                    let Some(value) = text(e, &mut group) else { continue };
                    add_helper(&mut helpers, ("__rivetResumeClass", "_bindClass"));
                    statements.push(format!("__rivetResumeClass(__rivetEl, {}, () => ({value}))", quote(&toggle.name)));
                }
            }
        }
        if let Some(style) = style {
            for entry in &style.entries {
                let (name, e) = match entry {
                    styling::Entry::Prop(name, styling::Val::Expr(e)) => (quote(name), e),
                    styling::Entry::Object(e) => ("null".to_string(), e),
                    styling::Entry::Prop(..) => continue,
                };
                let Some(value) = text(e, &mut group) else { continue };
                add_helper(&mut helpers, ("__rivetResumeStyle", "_bindStyle"));
                statements.push(format!("__rivetResumeStyle(__rivetEl, {name}, () => ({value}))"));
            }
        }
        let Some(&closure) = group.first() else { return };
        if !group.iter().any(|&id| self.contains_call(id)) {
            return;
        }
        let JSXAttributeItem::Attribute(attr) = &el.opening_element.attributes[first] else { return };
        let mut site = Site::new(SiteKind::Styled);
        site.attr = self.id(&**attr);
        site.group = group.clone();
        site.spread_parts = statements;
        site.dom_helpers = helpers;
        if self.add(site, closure).is_some() {
            for member in group {
                self.site_closures.insert(member);
            }
        }
    }

    /// `{...x}` on a native element: one spread site whose symbol rebuilds the merged attribute object
    /// (spreads and plain attributes, source order). Always a site: the server records a binding only
    /// when it read signals, and rejects spread event handlers (they could not resume).
    fn scan_spread(&mut self, el: &'a JSXElement<'a>, groups: Option<&styling::Groups<'a>>) -> bool {
        let tree = self.tree;
        let mut first = None;
        let mut group = Vec::new();
        let mut parts = Vec::new();
        let mut helpers: Vec<(&'static str, &'static str)> = Vec::new();
        // MATRIX-1: the style group joins the object as one `style` object at its first attribute (compile.rs `spread_style`).
        let style = groups.and_then(|g| g.style.as_ref());
        for (index, item) in el.opening_element.attributes.iter().enumerate() {
            if let Some(style) = style.filter(|g| g.first == index) {
                let text = self.spread_style_text(style, &mut group);
                parts.push(format!("\"style\": {text}"));
            }
            match item {
                JSXAttributeItem::SpreadAttribute(s) => {
                    first = first.or(self.id(&**s));
                    // `{...{ onClick: () => … }}`: the server evaluates the object; its functions are R2 symbols.
                    if let Expression::ObjectExpression(object) = unwrap(&s.argument) {
                        for property in &object.properties {
                            if let ObjectPropertyKind::ObjectProperty(p) = property {
                                if p.kind == PropertyKind::Init {
                                    self.escaping(&p.value);
                                }
                            }
                        }
                    }
                    let Some(arg) = tree.expr_id(&s.argument) else { continue };
                    group.push(arg);
                    parts.push(format!("...({})", tree.text(arg)));
                }
                JSXAttributeItem::Attribute(attr) if spread_plain(tree, el, attr) => {
                    let key = crate::ir::quote(attr_name(tree, attr));
                    match &attr.value {
                        None => parts.push(format!("{key}: true")),
                        Some(JSXAttributeValue::StringLiteral(_)) => {
                            let text = crate::compile::attr_string(tree, attr).map(crate::entities::decode_html).unwrap_or_default();
                            parts.push(format!("{key}: {}", crate::ir::quote(&text)));
                        }
                        Some(JSXAttributeValue::ExpressionContainer(c)) => match c.expression.as_expression().and_then(|e| tree.expr_id(e)) {
                            Some(value) => {
                                group.push(value);
                                let name = attr_name(tree, attr);
                                if (name == "class" || name == "className") && c.expression.as_expression().is_some_and(styling::class_literal) {
                                    // A class object / array normalizes before the spread reads it.
                                    add_helper(&mut helpers, ("__rivetResumeCx", "_class"));
                                    parts.push(format!("{key}: __rivetResumeCx(({}))", tree.text(value)));
                                } else {
                                    parts.push(format!("{key}: ({})", tree.text(value)));
                                }
                            }
                            None => parts.push(format!("{key}: undefined")),
                        },
                        Some(_) => {}
                    }
                }
                JSXAttributeItem::Attribute(_) => {}
            }
        }
        let Some(first) = first else { return false };
        // ref-spread-dedupe (LIVE-PROPS P4, compile.rs `spread_object`): an explicit `ref` after the last spread wins.
        if crate::compile::ref_after_spread(tree, el) {
            parts.push(format!("{}: undefined", crate::ir::quote("ref")));
        }
        // `class:` toggles apply to the spread class (`_spreadClass`).
        let mut spread_class = None;
        if let Some(class) = groups.and_then(|g| g.class.as_ref()).filter(|c| !c.toggles.is_empty()) {
            spread_class = Some(self.toggles_text(&class.toggles, &mut group));
            add_helper(&mut helpers, ("__rivetResumeSpreadClass", "_spreadClass"));
        }
        let Some(&closure) = group.first() else { return true };
        let mut site = Site::new(SiteKind::Spread);
        site.attr = Some(first);
        site.group = group.clone();
        site.spread_parts = parts;
        site.spread_class = spread_class;
        site.dom_helpers = helpers;
        site.spread_content = crate::compile::spread_content(tree, el, tree.text_of(el.opening_element.name.span()));
        if self.add(site, closure).is_some() {
            for member in group {
                self.site_closures.insert(member);
            }
        }
        true
    }

    /// A component element that needs no region site: its tag is a statically known component
    /// (an allow-listed `@rivetjs/*` import; with `STATIC_LOCAL_COMPONENTS`, also a module-scope function component
    /// whose body reads nothing outside its own sites) and every prop / child is constant (no calls, functions or non-constant
    /// bindings). Imports from other modules may be `clientOnly` / `lazyComponent` values: kept.
    fn static_component(&self, el: &'a JSXElement<'a>, visiting: &mut FxHashSet<NodeId>) -> bool {
        let tree = self.tree;
        let JSXElementName::IdentifierReference(tag) = &el.opening_element.name else { return false };
        let Some(decl) = tree.resolve(tag, false) else { return false };
        let known = match tree.kind(decl) {
            AstKind::ImportSpecifier(s) => import_source(tree, decl).is_some_and(|from| static_framework_component(from, s.imported.name().as_str())),
            _ if !STATIC_LOCAL_COMPONENTS => false,
            AstKind::Function(_) if tree.decl_kind(decl) == DeclKind::FunctionDeclaration && self.module_scoped(decl) => {
                self.static_body(decl, visiting)
            }
            AstKind::VariableDeclarator(d) if d.kind == VariableDeclarationKind::Const && self.module_scoped(decl) => {
                match &d.init {
                    Some(init @ (Expression::ArrowFunctionExpression(_) | Expression::FunctionExpression(_))) => {
                        tree.expr_id(init).is_some_and(|f| self.static_body(f, visiting))
                    }
                    _ => false,
                }
            }
            _ => false,
        };
        if !known {
            return false;
        }
        for item in &el.opening_element.attributes {
            let JSXAttributeItem::Attribute(attr) = item else { return false };
            match &attr.value {
                None | Some(JSXAttributeValue::StringLiteral(_)) => {}
                Some(JSXAttributeValue::ExpressionContainer(c)) => {
                    let Some(e) = c.expression.as_expression() else { continue };
                    if !tree.expr_id(e).is_some_and(|id| self.static_value(id, visiting)) {
                        return false;
                    }
                }
                Some(JSXAttributeValue::Element(e)) => {
                    if !self.id(&**e).is_some_and(|id| self.static_value(id, visiting)) {
                        return false;
                    }
                }
                Some(JSXAttributeValue::Fragment(f)) => {
                    if !self.id(&**f).is_some_and(|id| self.static_value(id, visiting)) {
                        return false;
                    }
                }
            }
        }
        for child in &el.children {
            let id = match child {
                JSXChild::Text(_) => continue,
                JSXChild::ExpressionContainer(c) => match c.expression.as_expression() {
                    Some(e) => tree.expr_id(e),
                    None => continue,
                },
                // Named slot content keeps its slot symbol and the component its region.
                JSXChild::Element(c) if slots::usage_name(tree, c).is_some() => return false,
                JSXChild::Element(c) => self.id(&**c),
                JSXChild::Fragment(f) => self.id(&**f),
                JSXChild::Spread(_) => return false,
            };
            if !id.is_some_and(|id| self.static_value(id, visiting)) {
                return false;
            }
        }
        true
    }

    /// A prop / child expression that evaluates to the same value on every render: no calls (other
    /// than compile-time static calls), functions, `new`, tagged templates or assignments; identifiers
    /// are imports or `const`s initialized the same way; nested JSX is native or a static component.
    fn static_value(&self, id: NodeId, visiting: &mut FxHashSet<NodeId>) -> bool {
        let tree = self.tree;
        if is_function(tree, id) {
            return false;
        }
        match tree.kind(id) {
            // A For row getter call is constant for the row (no descent: the callee is a parameter).
            AstKind::CallExpression(call) if self.accessor_call(call) => return true,
            AstKind::CallExpression(call) if !self.static_call(call) => return false,
            AstKind::NewExpression(_)
            | AstKind::TaggedTemplateExpression(_)
            | AstKind::ImportExpression(_)
            | AstKind::AwaitExpression(_)
            | AstKind::YieldExpression(_)
            | AstKind::AssignmentExpression(_)
            | AstKind::UpdateExpression(_)
            | AstKind::ThisExpression(_)
            | AstKind::Super(_)
            | AstKind::JSXSpreadChild(_)
            | AstKind::JSXSpreadAttribute(_)
            | AstKind::Class(_) => return false,
            AstKind::JSXElement(el) => {
                if !is_native(tree, el) {
                    return self.static_component(el, visiting);
                }
                if slots::is_slot(tree, Some(id), el) {
                    return false;
                }
            }
            AstKind::IdentifierReference(ident) if !tree.in_type_name(id) => {
                if let Some(decl) = self.declaration_of(ident) {
                    if !self.static_binding(decl, visiting) {
                        return false;
                    }
                }
            }
            _ => {}
        }
        tree.children(id).iter().all(|&child| self.static_value(child, visiting))
    }

    /// An import, or a `const` whose initializer is a static value.
    fn static_binding(&self, decl: NodeId, visiting: &mut FxHashSet<NodeId>) -> bool {
        let tree = self.tree;
        match tree.kind(decl) {
            AstKind::ImportSpecifier(_) | AstKind::ImportDefaultSpecifier(_) | AstKind::ImportNamespaceSpecifier(_) => true,
            AstKind::VariableDeclarator(d) if d.kind == VariableDeclarationKind::Const => {
                let Some(init) = d.init.as_ref().and_then(|e| tree.expr_id(e)) else { return false };
                if !visiting.insert(decl) {
                    return false;
                }
                let ok = self.static_value(init, visiting);
                visiting.remove(&decl);
                ok
            }
            _ => false,
        }
    }

    /// A component function whose evaluation reads no signals outside its own resume sites:
    /// besides signal / computed / client effect creation and compile-time static calls, no calls
    /// outside native-element attributes and call-bearing child expressions (those are sites); every
    /// component element it renders outside a native element's children is static too.
    fn static_body(&self, function: NodeId, visiting: &mut FxHashSet<NodeId>) -> bool {
        if !visiting.insert(function) {
            return false;
        }
        let ok = self.tree.children(function).iter().all(|&child| self.static_body_node(child, visiting));
        visiting.remove(&function);
        ok
    }

    fn static_body_node(&self, id: NodeId, visiting: &mut FxHashSet<NodeId>) -> bool {
        let tree = self.tree;
        // Nested functions (handlers, local helpers) do not run while rendering unless called.
        if is_function(tree, id) {
            return true;
        }
        match tree.kind(id) {
            AstKind::CallExpression(call) => {
                let creator = self.static_call(call)
                    || self.import_of(&call.callee).is_some_and(|(name, from)| {
                        (from == "@rivetjs/reactivity" && matches!(name.as_str(), "signal" | "computed"))
                            || (from.starts_with("@rivetjs/runtime") && matches!(name.as_str(), "clientEffect" | "clientEvent" | "reconstruct"))
                    });
                if !creator {
                    return false;
                }
            }
            AstKind::NewExpression(_) | AstKind::TaggedTemplateExpression(_) | AstKind::ImportExpression(_) | AstKind::AwaitExpression(_) => {
                return false;
            }
            AstKind::JSXElement(el) if !is_native(tree, el) => return self.static_component(el, visiting),
            AstKind::JSXElement(el) => {
                if slots::is_slot(tree, Some(id), el) {
                    return false;
                }
                // Attribute values are attribute / event / ref / model sites or constants.
                for child in &el.children {
                    let ok = match child {
                        JSXChild::Text(_) => true,
                        JSXChild::ExpressionContainer(c) => match c.expression.as_expression().and_then(|e| tree.expr_id(e)) {
                            // A call-bearing child is its own binding site.
                            Some(e) => self.contains_call(e) || self.static_body_node(e, visiting),
                            None => true,
                        },
                        // Component children of a native element decide their own site.
                        JSXChild::Element(c) if !is_native(tree, c) => true,
                        JSXChild::Element(c) => self.id(&**c).is_some_and(|c| self.static_body_node(c, visiting)),
                        JSXChild::Fragment(f) => self.id(&**f).is_some_and(|f| self.static_body_node(f, visiting)),
                        JSXChild::Spread(_) => false,
                    };
                    if !ok {
                        return false;
                    }
                }
                return true;
            }
            _ => {}
        }
        tree.children(id).iter().all(|&child| self.static_body_node(child, visiting))
    }

    /// A function literal whose body renders JSX.
    fn jsx_function(&self, e: &'a Expression<'a>) -> Option<NodeId> {
        let mut e = e;
        while let Expression::ParenthesizedExpression(p) = e {
            e = &p.expression;
        }
        if !matches!(e, Expression::ArrowFunctionExpression(_) | Expression::FunctionExpression(_)) {
            return None;
        }
        let id = self.tree.expr_id(e)?;
        let tree = self.tree;
        let mut found = false;
        tree.walk(id, &mut |n| {
            if found {
                return false;
            }
            if matches!(tree.kind(n), AstKind::JSXElement(_) | AstKind::JSXFragment(_)) {
                found = true;
            }
            !found
        });
        found.then_some(id)
    }

    /// Lazy children of a user component element: one slot site over the plain children (see
    /// `lazy_children`), so `props.children` serializes as a slot symbol when captured.
    fn scan_lazy_children(&mut self, el: &'a JSXElement<'a>) {
        let group = lazy_children(self.tree, el);
        if group.is_empty() {
            return;
        }
        let mut site = Site::new(SiteKind::Slot);
        // Keyed on the component's opening element: its first member may be a component region
        // (`scan_component`), keyed on the member itself.
        site.value = self.id(&*el.opening_element).or(Some(group[0]));
        site.group = group.clone();
        site.lazy_children = true;
        self.add(site, group[0]);
    }

    /// lane COND (2026-10-07): a Bind site for an expression child among a user component's lazy children
    /// (same rule as `scan_element`: a call in the expression, or a function child whose body has one).
    fn lazy_child_bind(&mut self, child_id: NodeId, value: &'a Expression<'a>) {
        let tree = self.tree;
        let Some(expr_id) = tree.expr_id(value) else { return };
        let closure = if self.contains_call(expr_id) { Some(expr_id) } else { self.function_child(value) };
        if let Some(closure) = closure {
            let mut site = Site::new(SiteKind::Bind);
            site.child = Some(child_id);
            self.add(site, closure);
        }
    }

    /// Slot content and callbacks passed to a user component. Framework components (structural
    /// helpers, `Router`, …) never capture their props in resumable sites: their callbacks keep
    /// today's treatment. Components of source packages (option `sourcePackages`, e.g.
    /// `@rivetjs/aria`: resume-compiled like application code) are user components.
    fn scan_component(&mut self, el: &'a JSXElement<'a>) {
        let tree = self.tree;
        // LAZY-ROWS T2: a structural `For` gets its lazy-rows verdict (and, when lazy, its row / `by` sites) here; its other
        // props stay framework props (the return below).
        if rows::structural_for(tree, el) {
            self.scan_for_rows(el);
        }
        if let JSXElementName::IdentifierReference(tag) = &el.opening_element.name {
            if let Some((_, from)) = self.import_of_ident(tag) {
                let package = |p: &str| from == p || from.strip_prefix(p).is_some_and(|rest| rest.starts_with('/'));
                if from.starts_with("@rivetjs/") && !self.source_packages.iter().any(|p| package(p)) {
                    return;
                }
            }
        }
        for item in &el.opening_element.attributes {
            let JSXAttributeItem::Attribute(attr) = item else { continue };
            let Some(JSXAttributeValue::ExpressionContainer(c)) = &attr.value else { continue };
            let Some(value) = c.expression.as_expression() else { continue };
            self.module_refs(value);
            self.prop_value(value, false);
        }
        let mut groups: Vec<(&'a str, Vec<NodeId>)> = Vec::new();
        let lazy = !lazy_children(tree, el).is_empty();
        for child in &el.children {
            match child {
                JSXChild::ExpressionContainer(c) => {
                    let Some(value) = c.expression.as_expression() else { continue };
                    // `{cond && <el r:slot="x"/>}`: each branch element is slot content.
                    if let Some(usage) = slots::conditional_usage(tree, value) {
                        if usage.name.is_ok() {
                            for branch in usage.branches.iter().flatten() {
                                let Some(branch) = self.id(*branch) else { continue };
                                let mut site = Site::new(SiteKind::Slot);
                                site.value = Some(branch);
                                site.group = vec![branch];
                                self.add(site, branch);
                            }
                        }
                        continue;
                    }
                    // Members of the lazy children slot are inside its closure.
                    if !lazy {
                        self.module_refs(value);
                        self.prop_value(value, false);
                    } else if let Some(child_id) = self.id(&**c) {
                        // lane COND (2026-10-07): an expression among the lazy children is a child binding,
                        // as on a native element (`<Box>{c() && <p/>}</Box>`, `<Box>{label()}</Box>`): the
                        // server records its reads (text or region) where the component renders it.
                        self.lazy_child_bind(child_id, value);
                    }
                }
                JSXChild::Element(c) => {
                    let Some(child_id) = self.id(&**c) else { continue };
                    match slots::usage_name(tree, c) {
                        Some(Ok(name)) => match groups.iter_mut().find(|(n, _)| *n == name) {
                            Some((_, list)) => list.push(child_id),
                            None => groups.push((name, vec![child_id])),
                        },
                        Some(Err(_)) => {}
                        // A component among the lazy children is its own region (same rule as a
                        // component child of a native element): `<List><For each={items}/></List>`
                        // re-creates the `For` alone, so its rows are adopted instead of the whole
                        // `List` being rebuilt. Its server read is isolated from the enclosing read.
                        None if lazy && !is_native(tree, c) && !self.static_component(c, &mut FxHashSet::default()) => {
                            let mut site = Site::new(SiteKind::Region);
                            site.child = Some(child_id);
                            self.add(site, child_id);
                        }
                        None => {}
                    }
                }
                _ => {}
            }
        }
        for (_, group) in groups {
            let mut site = Site::new(SiteKind::Slot);
            site.value = Some(group[0]);
            site.group = group.clone();
            self.add(site, group[0]);
        }
        self.scan_lazy_children(el);
        self.scan_props(el);
    }

    /// LIVE-PROPS P3: a `Props` site for a user component element whose props can read state — an attribute
    /// or non-lazy child expression holding a call, a spread, or a conditional `r:slot` test holding a call
    /// (member reads alone stay eager: `.map` rows of plain data keep their list mounts). Keyed on the tag
    /// name node (the element is the Region site's key, the opening element the lazy Slot site's). The
    /// closure is the whole element (captures: everything its props and children read); opportunistic:
    /// captures report nothing at compile time (`_rProps` falls back to the props by value when a capture
    /// is not serializable). Skipped when the element reads `this` / `super` / `new.target` / `arguments`
    /// or holds `await` / `yield` (the symbol is a module-level function), and when it holds a native
    /// `<slot>` element whose rewrite would be lost (`props_text` keeps the source text).
    fn scan_props(&mut self, el: &'a JSXElement<'a>) {
        let tree = self.tree;
        let key = match &el.opening_element.name {
            JSXElementName::IdentifierReference(i) => self.id(&**i),
            JSXElementName::MemberExpression(m) => self.id(&**m),
            _ => None,
        };
        let (Some(key), Some(element)) = (key, self.id(el)) else { return };
        if !self.props_dynamic(el) || !props_portable(tree, element) || self.destructures_props(el) {
            return;
        }
        let named = el.children.iter().any(|child| match child {
            JSXChild::Element(c) => slots::usage_name(tree, c).is_some(),
            JSXChild::ExpressionContainer(c) => c.expression.as_expression().is_some_and(|e| slots::conditional_usage(tree, e).is_some()),
            _ => false,
        });
        let children = !named && !lazy_children(tree, el).is_empty();
        if !children && slots::rewrite(tree, element, false).is_some() {
            return;
        }
        let mut site = Site::new(SiteKind::Props);
        site.value = Some(key);
        site.props_children = children;
        site.opportunistic = true;
        self.add(site, element);
    }

    /// A local component whose first parameter is a pattern (`function Panel({ k })`) reads its props in the
    /// body: the reads stay in the enclosing region (re-created on change), so a Props site would only add a
    /// recipe and a symbol (`scan_props` skips it).
    fn destructures_props(&self, el: &'a JSXElement<'a>) -> bool {
        let JSXElementName::IdentifierReference(tag) = &el.opening_element.name else { return false };
        let Some(decl) = self.declaration_of(tag) else { return false };
        let params = match self.tree.kind(decl) {
            AstKind::Function(f) => &f.params,
            AstKind::VariableDeclarator(d) => match d.init.as_ref().map(unwrap) {
                Some(Expression::ArrowFunctionExpression(a)) => &a.params,
                Some(Expression::FunctionExpression(f)) => &f.params,
                _ => return false,
            },
            _ => return false,
        };
        params.items.first().is_some_and(|p| !matches!(p.pattern.kind, BindingPatternKind::BindingIdentifier(_)))
    }

    /// Whether a component element's props can read state (`scan_props`).
    fn props_dynamic(&self, el: &'a JSXElement<'a>) -> bool {
        let tree = self.tree;
        let reads = |e: &'a Expression<'a>| tree.expr_id(e).is_some_and(|id| self.contains_call(id));
        // `<C {...props} />` alone passes `props` itself (`live_props`: `props || {}`): nothing to rebuild.
        let lone = el.opening_element.attributes.len() == 1
            && el.children.iter().all(|child| matches!(child, JSXChild::Text(t) if jsx_text(tree.text_of(t.span)).is_empty()));
        for item in &el.opening_element.attributes {
            match item {
                JSXAttributeItem::SpreadAttribute(s) => {
                    if !(lone && member_chain(&s.argument)) {
                        return true;
                    }
                }
                JSXAttributeItem::Attribute(attr) => {
                    if let Some(JSXAttributeValue::ExpressionContainer(c)) = &attr.value {
                        if c.expression.as_expression().is_some_and(reads) {
                            return true;
                        }
                    }
                }
            }
        }
        let lazy = !lazy_children(tree, el).is_empty();
        el.children.iter().any(|child| match child {
            JSXChild::ExpressionContainer(c) => c.expression.as_expression().is_some_and(|e| match slots::conditional_usage(tree, e) {
                Some(usage) => reads(usage.test),
                None => !lazy && reads(e),
            }),
            _ => false,
        })
    }

    /// A component prop / child value: JSX-returning functions are slot symbols, other functions Fn
    /// symbols (R2), through conditional (`c ? f : g`) and logical (`c && f`, `a ?? f`) branches; local
    /// bindings are seeds.
    fn prop_value(&mut self, e: &'a Expression<'a>, nested: bool) {
        let e = unwrap(e);
        match e {
            Expression::ConditionalExpression(c) => {
                self.prop_value(&c.consequent, true);
                self.prop_value(&c.alternate, true);
            }
            Expression::LogicalExpression(l) => {
                if l.operator != LogicalOperator::And {
                    self.prop_value(&l.left, true);
                }
                self.prop_value(&l.right, true);
            }
            Expression::ArrowFunctionExpression(_) | Expression::FunctionExpression(_) => {
                if let Some(function) = self.jsx_function(e) {
                    if self.claimed.contains(&function) || (nested && self.free_names(function).2) {
                        return;
                    }
                    let mut site = Site::new(SiteKind::Slot);
                    site.value = Some(function);
                    site.opportunistic = nested;
                    self.add(site, function);
                } else {
                    self.escaping(e);
                }
            }
            // CORE-GAPS (d): a module-level function / import as a prop value (`<Price format={formatEuro} />`): an Fn site
            // on the reference (server `"format": _rFn(id, formatEuro, [])`, symbol `() => (formatEuro)`), so a props object
            // passed by value (static props) serializes it as a module reference.
            // Function Bridge T3: a value a module reference covers needs no site (its `_rMod` stamp wins).
            Expression::Identifier(ident) if self.tree.resolve(ident, false).is_some_and(|t| self.module_function(t)) && !self.ref_covered(ident) => {
                let Some(value) = self.tree.expr_id(e) else { return };
                if self.claimed.contains(&value) {
                    return;
                }
                let Some(component) = self.component_of(value) else { return };
                let mut site = Site::new(SiteKind::Fn);
                site.closure = Some(value);
                site.value = Some(value);
                site.component = component;
                site.opportunistic = true;
                self.sites.push(site);
                self.candidates.push(self.sites.len() - 1);
                self.claimed.insert(value);
            }
            _ => self.escaping(e),
        }
    }

    /// The outermost function enclosing `node` (the function `component_of` names).
    fn top_function(&self, node: NodeId) -> Option<NodeId> {
        let tree = self.tree;
        let mut top = None;
        let mut n = tree.raw_parent(node);
        while let Some(id) = n {
            if matches!(tree.kind(id), AstKind::Program(_)) {
                break;
            }
            if is_function(tree, id) {
                top = Some(id);
            }
            n = tree.raw_parent(id);
        }
        top
    }

    /// The innermost function enclosing `node` (not `node` itself).
    fn nearest_function(&self, node: NodeId) -> Option<NodeId> {
        let tree = self.tree;
        let mut n = tree.raw_parent(node);
        while let Some(id) = n {
            if is_function(tree, id) {
                return Some(id);
            }
            n = tree.raw_parent(id);
        }
        None
    }

    /// `function` is a module-level component (outermost function, PascalCase name).
    fn component_name(&self, function: NodeId) -> bool {
        let tree = self.tree;
        let name = match tree.kind(function) {
            AstKind::Function(f) => f.id.as_ref().map(|i| i.name.as_str()),
            _ => None,
        };
        let name = name.or_else(|| match tree.raw_parent(function).map(|p| tree.kind(p)) {
            Some(AstKind::VariableDeclarator(d)) => match &d.id.kind {
                BindingPatternKind::BindingIdentifier(i) => Some(i.name.as_str()),
                _ => None,
            },
            _ => None,
        });
        name.is_some_and(|n| n.starts_with(|c: char| c.is_ascii_uppercase()))
    }

    /// RESUME-ACCESSOR-ROW (+ fix 1): a value `owner` returns (`statement` = the `return` / the concise body's expression
    /// statement). When `owner` is a module-level PascalCase component and a returned position (through `?:` / `&&` /
    /// `||` / `??` / parens / TS casts) is a plain accessor — a parameterless, non-async, non-generator arrow / function
    /// expression, or a local `const` bound to one — that accessor is an Fn site and the server wraps the whole returned
    /// value in `_rChild` (`Resumed.child_returns`): a symbol function renders as its own child site where the component
    /// renders. The same accessor returned by an anonymous default export or a function passed to a wrapper call
    /// (`memo(…)`, `forwardRef(…)`) cannot resume that way: RV2015 warning.
    fn returned_value(&mut self, owner: Option<NodeId>, statement: NodeId, value: &'a Expression<'a>, diags: &mut Diags) {
        let Some(owner) = owner else { return };
        if self.top_function(owner).is_some() {
            return;
        }
        let named = self.component_name(owner);
        let form = if named { None } else { self.component_form(owner) };
        if !named && form.is_none() {
            return;
        }
        let mut leaves = Vec::new();
        returned_leaves(value, &mut leaves);
        let tree = self.tree;
        let mut any = false;
        for leaf in leaves {
            let mut form = form.clone();
            let accessor = match leaf {
                Expression::ArrowFunctionExpression(_) | Expression::FunctionExpression(_) => {
                    tree.expr_id(leaf).is_some_and(|f| plain_accessor(tree, f))
                }
                // A local `const view = () => …` or hoisted `function view() {}` (plain, parameterless); a `let` one
                // cannot be wrapped (it may be reassigned): RV2015.
                Expression::Identifier(ident) => self.declaration_of(ident).is_some_and(|decl| {
                    self.top_function(decl) == Some(owner)
                        && match tree.kind(decl) {
                            AstKind::VariableDeclarator(d) => {
                                let plain = d.init.as_ref().and_then(|init| tree.expr_id(unwrap(init))).is_some_and(|f| plain_accessor(tree, f));
                                if plain && d.kind == VariableDeclarationKind::Let {
                                    form = Some(format!("returned through `let {}`: declare it with `const`", ident.name));
                                }
                                plain && matches!(d.kind, VariableDeclarationKind::Const | VariableDeclarationKind::Let)
                            }
                            AstKind::Function(f) => {
                                f.r#type == FunctionType::FunctionDeclaration && !f.r#async && !f.generator && f.params.items.is_empty() && f.params.rest.is_none()
                            }
                            _ => false,
                        }
                }),
                _ => false,
            };
            if !accessor {
                continue;
            }
            if let Some(form) = &form {
                diags.warn(
                    format!("Component returns a function that cannot resume ({form}): return an inline arrow from a named component (`function Name(props) {{ return () => …; }}`)"),
                    tree.expr_id(leaf),
                );
                continue;
            }
            self.escaping(leaf);
            any = true;
        }
        if any {
            self.child_returns.insert(statement);
        }
    }

    /// RV2015 forms: an anonymous default export, or a function passed to a call whose result is a PascalCase `const` /
    /// the default export (`const Card = memo((props) => () => …)`).
    fn component_form(&self, owner: NodeId) -> Option<String> {
        let tree = self.tree;
        let parent = |n: NodeId| {
            let mut p = tree.raw_parent(n);
            while let Some(id) = p {
                if !matches!(tree.kind(id), AstKind::Argument(_) | AstKind::ParenthesizedExpression(_) | AstKind::TSAsExpression(_) | AstKind::TSSatisfiesExpression(_)) {
                    break;
                }
                p = tree.raw_parent(id);
            }
            p
        };
        let up = parent(owner)?;
        match tree.kind(up) {
            AstKind::ExportDefaultDeclaration(_) => Some("an anonymous default export".into()),
            AstKind::CallExpression(call) if call.arguments.iter().any(|a| a.as_expression().and_then(|e| tree.expr_id(unwrap(e))) == Some(owner)) => {
                let target = parent(up)?;
                let component = match tree.kind(target) {
                    AstKind::ExportDefaultDeclaration(_) => true,
                    AstKind::VariableDeclarator(d) => matches!(&d.id.kind, BindingPatternKind::BindingIdentifier(i) if i.name.starts_with(|c: char| c.is_ascii_uppercase())),
                    _ => false,
                };
                let callee = tree.text_of(call.callee.span());
                component.then(|| format!("wrapped in `{callee}(…)`"))
            }
            _ => None,
        }
    }

    /// A value leaving its function (R2): a function expression becomes an Fn symbol (unless it
    /// uses `this`); a local binding is a seed.
    fn escaping(&mut self, e: &'a Expression<'a>) {
        let e = unwrap(e);
        match e {
            Expression::ArrowFunctionExpression(_) | Expression::FunctionExpression(_) => {
                let Some(function) = self.tree.expr_id(e) else { return };
                if self.claimed.contains(&function) || self.free_names(function).2 {
                    return;
                }
                let Some(component) = self.component_of(function) else { return };
                let mut site = Site::new(SiteKind::Fn);
                site.closure = Some(function);
                site.value = Some(function);
                site.component = component;
                site.opportunistic = true;
                self.sites.push(site);
                self.candidates.push(self.sites.len() - 1);
                self.claimed.insert(function);
            }
            Expression::Identifier(ident) => {
                if let Some(decl) = self.declaration_of(ident) {
                    if !self.module_scoped(decl) && !self.seeds.contains(&decl) {
                        self.seeds.push(decl);
                    }
                }
            }
            _ => {}
        }
    }

    /// A local function (declaration, or `const` initialized with a function or derived through
    /// functions / JSX) re-created on the client from a symbol plus its own captures.
    fn fn_closure(&self, decl: NodeId) -> Option<NodeId> {
        let tree = self.tree;
        if tree.decl_kind(decl) == DeclKind::FunctionDeclaration {
            return Some(decl);
        }
        let AstKind::VariableDeclarator(d) = tree.kind(decl) else { return None };
        let init = d.init.as_ref()?;
        let init_id = tree.expr_id(init)?;
        // Function Bridge C9 / T10: a bound const is a value (`_rBound`), never a recipe re-running `.bind` in the browser.
        if self.bind_call(decl) {
            return None;
        }
        (d.kind == VariableDeclarationKind::Const
            && !self.candidates.iter().any(|&c| self.sites[c].call == Some(init_id))
            && (matches!(init, Expression::ArrowFunctionExpression(_) | Expression::FunctionExpression(_))
                || self.contains_function(init_id)
                || self.module_alias(decl)
                // RESOURCE-COMPILER: a resource always resumes from its recipe (`resources.rs`).
                || self.resource_call(init)))
        .then_some(init_id)
    }

    /// Function Bridge C9 / T10: the shape of `const g = <callee>.bind(…)` (no optional chain), TS casts / parentheses
    /// unwrapped on the initializer, the callee and its object.
    fn bind_shape(&self, decl: NodeId) -> Option<BindShape<'a>> {
        let tree = self.tree;
        let AstKind::VariableDeclarator(d) = tree.kind(decl) else { return None };
        if d.kind != VariableDeclarationKind::Const || !matches!(d.id.kind, BindingPatternKind::BindingIdentifier(_)) {
            return None;
        }
        let init = unwrap(d.init.as_ref()?);
        let Expression::CallExpression(call) = init else { return None };
        let Expression::StaticMemberExpression(m) = unwrap(&call.callee) else { return None };
        if call.optional || m.optional || m.property.name != "bind" {
            return None;
        }
        let id = tree.expr_id(init)?;
        if matches!(call.arguments.first(), Some(Argument::SpreadElement(_))) {
            let object = match unwrap(&m.object) {
                Expression::Identifier(object) => Some(&**object),
                _ => None,
            };
            return Some(BindShape::SpreadThis(id, object));
        }
        match unwrap(&m.object) {
            Expression::Identifier(object) => Some(BindShape::Call(id, object)),
            _ => Some(BindShape::Callee(id, tree.text_of(m.object.span()).to_string())),
        }
    }

    /// Any `const g = <callee>.bind(…)` (`fn_closure` never makes it a recipe).
    pub(super) fn bind_call(&self, decl: NodeId) -> bool {
        self.bind_shape(decl).is_some()
    }

    /// Function Bridge C9 / T10 (+ fix 1, F2 / F9): a bind const reached by a resumable value use (captured by a site, a
    /// prop / returned / object value, stored by name in a holder). Follows bound-of-bound chains (≤ 8); the innermost
    /// callee must be a local function (promoted to an Fn site, returned for the queue) or a module function / import
    /// (`_rMod` stamp): then every call of the chain is recorded in `bound` (server `_rBound(f, t, [args])`). Otherwise,
    /// outside the quiet phase, a diagnostic names the problem (spread `this`, a callee Rivet cannot resume).
    #[allow(clippy::too_many_arguments)]
    fn bind_chain(
        &mut self,
        decl: NodeId,
        component: &str,
        quiet: bool,
        ref_cells: &FxHashSet<NodeId>,
        fn_sites: &mut FxHashSet<NodeId>,
        bound: &mut FxHashSet<NodeId>,
        diags: &mut Diags,
    ) -> Option<usize> {
        let tree = self.tree;
        let mut calls = Vec::new();
        let mut at = decl;
        loop {
            let (call, callee) = match self.bind_shape(at)? {
                BindShape::Call(call, callee) => (call, callee),
                // T10 fix 2: an error only when the receiver is provably a function (else a warning: an object with its
                // own `bind` is legal; the runtime "not serializable" error stays the ground truth).
                BindShape::SpreadThis(call, object) => {
                    if !quiet {
                        if object.is_some_and(|o| self.provable_function(o)) {
                            diags.add(BIND_SPREAD_THIS, Some(call));
                        } else {
                            diags.warn(BIND_SPREAD_THIS_MAYBE, Some(call));
                        }
                    }
                    return None;
                }
                BindShape::Callee(call, text) => {
                    if !quiet {
                        diags.warn(bind_callee_warning(&text), Some(call));
                    }
                    return None;
                }
            };
            calls.push(call);
            let target = tree.resolve(callee, false);
            match target {
                Some(t) if self.bind_shape(t).is_some() && calls.len() < 8 => at = t,
                Some(t) if self.module_function(t) => {
                    if self.bind_module_ref(callee) {
                        bound.extend(calls);
                    } else if !quiet {
                        diags.add(bind_callee_message(callee.name.as_str()), Some(call));
                    }
                    return None;
                }
                Some(t) if !ref_cells.contains(&t) => {
                    let mut site = None;
                    if !fn_sites.contains(&t) {
                        if let Some(function) = self.fn_closure(t) {
                            let mut s = Site::new(SiteKind::Fn);
                            s.closure = Some(function);
                            s.component = self.component_of(function).unwrap_or_else(|| component.to_string());
                            s.declaration = Some(t);
                            s.opportunistic = quiet;
                            self.sites.push(s);
                            fn_sites.insert(t);
                            site = Some(self.sites.len() - 1);
                        }
                    }
                    if fn_sites.contains(&t) {
                        bound.extend(calls);
                    } else if !quiet {
                        self.bind_callee_diag(callee, call, diags);
                    }
                    return site;
                }
                _ => {
                    if !quiet {
                        self.bind_callee_diag(callee, call, diags);
                    }
                    return None;
                }
            }
        }
    }

    /// T10 fix 2: a provable function — a local function declaration / `const` function literal, a module-level
    /// function or an import (the ruling's set; an import is assumed to be one).
    fn provable_function(&self, ident: &IdentifierReference<'a>) -> bool {
        self.tree.resolve(ident, false).is_some_and(|t| self.module_function(t) || self.local_function(t))
    }

    /// RV2013: an error when `callee` is provably a function Rivet cannot resume, else a warning.
    fn bind_callee_diag(&self, callee: &IdentifierReference<'a>, call: NodeId, diags: &mut Diags) {
        if self.provable_function(callee) {
            diags.add(bind_callee_message(callee.name.as_str()), Some(call));
        } else {
            diags.warn(bind_callee_warning(callee.name.as_str()), Some(call));
        }
    }

    /// T10 fix 1 (F9) + fix 2: a non-opportunistic site captures a `const o = { f: g.bind(…) }` and reaches `f` — the
    /// whole object (no member narrowing) or `o.f` read: the value is a native bound function (no rewrite). A warning
    /// (`g` may be an object with its own `bind`); never for a key the site does not read.
    fn object_bind_warnings(&self, index: usize, diags: &mut Diags) {
        let tree = self.tree;
        let site = &self.sites[index];
        if site.opportunistic {
            return;
        }
        for (i, &decl) in site.capture_decls.iter().enumerate() {
            let AstKind::VariableDeclarator(d) = tree.kind(decl) else { continue };
            let Some(Expression::ObjectExpression(object)) = d.init.as_ref().map(unwrap) else { continue };
            let member = site.members.get(i).cloned().flatten();
            for property in &object.properties {
                let ObjectPropertyKind::ObjectProperty(p) = property else { continue };
                let Expression::CallExpression(call) = unwrap(&p.value) else { continue };
                if !matches!(unwrap(&call.callee), Expression::StaticMemberExpression(m) if m.property.name == "bind") {
                    continue;
                }
                let reached = match &member {
                    None => true,
                    Some((_, literal)) => p.key.static_name().is_some_and(|key| quote(&key) == *literal),
                };
                if reached {
                    diags.warn(BIND_IN_OBJECT, tree.expr_id(&p.value));
                }
            }
        }
    }

    /// CORE-GAPS (d): `const f = g` (also through value positions: `c ? g : h`, `a ?? g`, `null` / `undefined` branches)
    /// where every value is a module-level function (declaration or `const` function) or an import. The const holds a
    /// module reference, like a direct use of `g` (module scope, never a capture): it is an Fn site whose closure is the
    /// initializer — server `const f = _rFn(id, g, [])`, symbol `() => (g)` importing `g` — so a site capturing `f`
    /// serializes it as that symbol (before: `f` was captured by value and threw "function is not serializable").
    fn module_alias(&self, decl: NodeId) -> bool {
        let tree = self.tree;
        let AstKind::VariableDeclarator(d) = tree.kind(decl) else { return false };
        if d.kind != VariableDeclarationKind::Const || !matches!(d.id.kind, BindingPatternKind::BindingIdentifier(_)) {
            return false;
        }
        let Some(init) = d.init.as_ref() else { return false };
        let mut values = Vec::new();
        value_positions(init, &mut values);
        let mut any = false;
        for value in values {
            match unwrap(value) {
                Expression::NullLiteral(_) => {}
                Expression::Identifier(ident) => match tree.resolve(ident, false) {
                    None if ident.name == "undefined" => {}
                    // Function Bridge T3: covered by a module reference (`_rMod`): no alias site needed for it.
                    Some(target) if self.module_function(target) => any |= !self.ref_covered(ident),
                    _ => return false,
                },
                _ => return false,
            }
        }
        any
    }

    /// A module-level function (declaration, or `const` initialized with a function) or an imported binding.
    fn module_function(&self, target: NodeId) -> bool {
        let tree = self.tree;
        if matches!(tree.kind(target), AstKind::ImportSpecifier(_) | AstKind::ImportDefaultSpecifier(_)) {
            return true;
        }
        self.module_scoped(target)
            && (tree.decl_kind(target) == DeclKind::FunctionDeclaration
                || matches!(tree.kind(target), AstKind::VariableDeclarator(t)
                    if t.kind == VariableDeclarationKind::Const
                        && matches!(t.init.as_ref().map(unwrap), Some(Expression::ArrowFunctionExpression(_) | Expression::FunctionExpression(_)))))
    }

    /// The function-literal default of a destructured binding (`const { f = () => x } = o`, `({ f = () => x }) => …`), when
    /// `decl` is that binding: the binding may hold it, so it must be a symbol (`_rFn`) for the captured value to serialize
    /// (RT-PRELOAD 2026-10-08: cdk ColorThumb `{ isSnapping = () => false } = ctx` failed to resume).
    fn default_function(&self, decl: NodeId) -> Option<NodeId> {
        let tree = self.tree;
        let AstKind::BindingIdentifier(binding) = tree.kind(decl) else { return None };
        let mut n = tree.raw_parent(decl);
        while let Some(id) = n {
            match tree.kind(id) {
                AstKind::AssignmentPattern(p) => {
                    let BindingPatternKind::BindingIdentifier(left) = &p.left.kind else { return None };
                    if left.span != binding.span {
                        return None;
                    }
                    let right = unwrap(&p.right);
                    return matches!(right, Expression::ArrowFunctionExpression(_) | Expression::FunctionExpression(_))
                        .then(|| tree.expr_id(right))
                        .flatten();
                }
                AstKind::VariableDeclarator(_) | AstKind::FormalParameter(_) | AstKind::ObjectPattern(_) | AstKind::ArrayPattern(_) => return None,
                _ if tree.is_function(id) => return None,
                _ => n = tree.raw_parent(id),
            }
        }
        None
    }

    /// An Fn site for `decl`'s function-literal default (`default_function`), keyed by the function itself (the server wraps
    /// it in place: `{ f = _rFn(id, () => x, caps) } = o`). `None` when there is none, it is claimed, or it uses `this`.
    fn default_site(&mut self, decl: NodeId, component: Option<String>, opportunistic: bool) -> Option<usize> {
        let function = self.default_function(decl)?;
        if self.claimed.contains(&function) || self.free_names(function).2 {
            return None;
        }
        let component = self.component_of(function).or(component)?;
        let mut site = Site::new(SiteKind::Fn);
        site.closure = Some(function);
        site.value = Some(function);
        site.component = component;
        site.opportunistic = opportunistic;
        self.sites.push(site);
        self.claimed.insert(function);
        Some(self.sites.len() - 1)
    }

    /// LIVE-PROPS P4 (gap 2a): the local functions a `const` can hold through its initializer's value positions
    /// (`const v = live ? f : f()`, `a ?? f`; transitively through other such consts). The const's value may be one of
    /// them, so each must be a symbol (`_rFn`) for that value to serialize where a resumed site captures it.
    fn alias_functions(&self, decl: NodeId) -> Vec<NodeId> {
        let tree = self.tree;
        let mut out = Vec::new();
        let mut seen = vec![decl];
        let mut stack = vec![decl];
        while let Some(current) = stack.pop() {
            let AstKind::VariableDeclarator(d) = tree.kind(current) else { continue };
            if d.kind != VariableDeclarationKind::Const {
                continue;
            }
            let Some(init) = d.init.as_ref() else { continue };
            let mut values = Vec::new();
            value_positions(init, &mut values);
            for value in values {
                let Expression::Identifier(ident) = value else { continue };
                let Some(target) = self.declaration_of(ident) else { continue };
                if seen.contains(&target) || self.module_scoped(target) {
                    continue;
                }
                seen.push(target);
                let function = tree.decl_kind(target) == DeclKind::FunctionDeclaration
                    || matches!(tree.kind(target), AstKind::VariableDeclarator(t)
                        if t.kind == VariableDeclarationKind::Const
                            && matches!(t.init.as_ref().map(unwrap), Some(Expression::ArrowFunctionExpression(_) | Expression::FunctionExpression(_))));
                if function {
                    out.push(target);
                } else {
                    stack.push(target);
                }
            }
        }
        out
    }

    /// LIVE-PROPS P4 (gap 2b): a call to user code — an identifier bound to a function declared in this module (or a
    /// const function), or imported from a relative module / a source package (option `sourcePackages`).
    fn user_helper(&self, callee: &Expression<'a>) -> bool {
        let tree = self.tree;
        let Expression::Identifier(ident) = unwrap(callee) else { return false };
        let Some(decl) = tree.resolve(ident, false) else { return false };
        if matches!(tree.kind(decl), AstKind::ImportSpecifier(_) | AstKind::ImportDefaultSpecifier(_)) {
            let Some(from) = import_source(tree, decl) else { return false };
            let package = |p: &str| from == p || from.strip_prefix(p).is_some_and(|rest| rest.starts_with('/'));
            return from.starts_with('.') || self.source_packages.iter().any(|p| package(p));
        }
        tree.decl_kind(decl) == DeclKind::FunctionDeclaration
            || matches!(tree.kind(decl), AstKind::VariableDeclarator(d)
                if matches!(d.init.as_ref().map(unwrap), Some(Expression::ArrowFunctionExpression(_) | Expression::FunctionExpression(_))))
    }

    fn import_of_ident(&self, ident: &IdentifierReference<'a>) -> Option<(String, &'a str)> {
        let decl = self.tree.resolve(ident, false)?;
        let AstKind::ImportSpecifier(s) = self.tree.kind(decl) else { return None };
        let from = import_source(self.tree, decl)?;
        Some((s.imported.name().to_string(), from))
    }

    fn scan_call(&mut self, id: NodeId, call: &'a CallExpression<'a>) {
        let tree = self.tree;
        let import = self.import_of(&call.callee);
        let runtime = import.as_ref().is_some_and(|(_, from)| *from == "@rivetjs/runtime/dom" || *from == "@rivetjs/runtime/server");
        let reactivity = import.as_ref().is_some_and(|(_, from)| *from == "@rivetjs/reactivity");
        let name = import.as_ref().map(|(n, _)| n.as_str()).unwrap_or("");
        let helper = (runtime && (name == "clientEffect" || name == "clientEvent" || name == "reconstruct")).then_some(name);
        let reactive = (reactivity && (name == "computed" || name == "signal")).then_some(name);
        let arg_id = |n: usize| -> Option<NodeId> {
            let arg = call.arguments.get(n)?;
            match arg {
                Argument::SpreadElement(s) => tree.id_of(&**s),
                _ => arg.as_expression().and_then(|e| tree.expr_id(e)),
            }
        };
        let with_call = |kind: SiteKind| {
            let mut site = Site::new(kind);
            site.call = Some(id);
            site
        };
        if helper == Some("clientEffect") {
            if let Some(closure) = arg_id(0) {
                self.add(with_call(SiteKind::Effect), closure);
            }
        } else if helper == Some("clientEvent") {
            if let Some(closure) = arg_id(2) {
                self.add(with_call(SiteKind::ClientEvent), closure);
            }
        } else if reactive == Some("computed") {
            if let Some(closure) = arg_id(0) {
                self.add(with_call(SiteKind::Computed), closure);
            }
        } else if helper == Some("reconstruct") {
            // Function Bridge T27 (C14): `reconstruct(factory)` = `computed(factory, { equals: false })`; the factory is a
            // captured closure (ordinary capture rules), so the server never encodes the value: the browser runs it on first read.
            if let Some(closure) = arg_id(0) {
                let mut site = with_call(SiteKind::Computed);
                site.reconstruct = true;
                self.add(site, closure);
            }
        }
        // An `equals` comparator in literal options becomes a symbol, so resumed state can carry it.
        if reactive.is_some() {
            if let Some(Argument::ObjectExpression(options)) = call.arguments.get(1) {
                for property in &options.properties {
                    let ObjectPropertyKind::ObjectProperty(p) = property else { continue };
                    if p.kind != PropertyKind::Init || p.method || p.shorthand || p.computed {
                        continue;
                    }
                    if tree.text_of(p.key.span()) != "equals" || matches!(p.value, Expression::BooleanLiteral(ref b) if !b.value) {
                        continue;
                    }
                    // Function Bridge T3: a module-level comparator is a module reference (`_rMod`), no `equals` symbol.
                    if matches!(unwrap(&p.value), Expression::Identifier(ident) if self.ref_covered(ident)) {
                        continue;
                    }
                    let Some(value_id) = tree.expr_id(&p.value) else { continue };
                    let mut site = Site::new(SiteKind::Equals);
                    site.value = Some(value_id);
                    self.add(site, value_id);
                }
            }
        }
        // LIVE-PROPS P4 (gap 2b): a function passed to user code (`cdkClass(live, () => …)`, `plus(f)`) may be captured by a
        // closure the helper returns: an inline one becomes an R2 symbol, a local binding a seed, so that closure
        // serializes. Framework / library calls and method calls (`xs.map(…)`) keep plain closures.
        if helper.is_none() && reactive.is_none() && self.user_helper(&call.callee) {
            for argument in &call.arguments {
                let Some(value) = argument.as_expression() else { continue };
                if matches!(unwrap(value), Expression::ArrowFunctionExpression(_) | Expression::FunctionExpression(_) | Expression::Identifier(_)) {
                    self.escaping(value);
                }
            }
        }
    }

    /// Free value identifiers of a closure: captures (enclosing function locals) and module scope refs.
    fn free_names(&self, closure: NodeId) -> (Vec<(String, NodeId)>, Vec<(String, NodeId)>, bool, bool, Vec<Span>) {
        let tree = self.tree;
        let mut captures = Vec::new();
        let mut capture_spans = Vec::new();
        let mut scope = Vec::new();
        let mut seen: FxHashSet<String> = FxHashSet::default();
        let (mut uses_this, mut has_jsx) = (false, false);
        let mut stack = vec![(closure, true)];
        while let Some((n, this_scope)) = stack.pop() {
            let kind = tree.kind(n);
            match kind {
                AstKind::JSXElement(el) => {
                    has_jsx = true;
                    if is_native(tree, el) && slots::is_slot(tree, Some(n), el) {
                        if let Ok(reference) = slots::slot_ref(tree, n, el) {
                            let (name, decl) = reference.binding;
                            if !self.within(decl, closure) && decl != closure && !seen.contains(name.as_str()) {
                                seen.insert(name.clone());
                                if self.module_scoped(decl) {
                                    scope.push((name, decl))
                                } else {
                                    capture_spans.push(tree.span(decl));
                                    captures.push((name, decl))
                                }
                            }
                        }
                    }
                }
                AstKind::JSXFragment(_) => has_jsx = true,
                AstKind::ThisExpression(_) if this_scope => uses_this = true,
                AstKind::IdentifierReference(ident) if !tree.in_type_name(n) => {
                    if let Some(decl) = self.declaration_of(ident) {
                        if !self.within(decl, closure) && decl != closure && !seen.contains(ident.name.as_str()) {
                            seen.insert(ident.name.to_string());
                            let entry = (ident.name.to_string(), decl);
                            if self.module_scoped(decl) {
                                scope.push(entry)
                            } else {
                                capture_spans.push(tree.binding_span(ident).unwrap_or(ident.span));
                                captures.push(entry)
                            }
                        }
                    }
                }
                _ => {}
            }
            let nested = n != closure && matches!(kind, AstKind::Function(_)) && !accessor_or_constructor(tree, n);
            for &child in tree.children(n).iter().rev() {
                stack.push((child, this_scope && !nested));
            }
        }
        (captures, scope, uses_this, has_jsx, capture_spans)
    }

    /// Member-read captures (spread / styled sites): a captured local used in the group only as the
    /// object of static member reads (`props.a`, `props["x-y"]`) or as the argument of a pure DOM-prop
    /// projection (`globalDOMProps(props)`) is captured per member / projection instead of whole: the
    /// state table then holds `props.a` (not every prop) and the symbol rebuilds `props` from its
    /// parameters. None: nothing changes (every capture stays whole).
    /// `narrow`: the T11 site kinds (handlers, bindings, …): only `narrow_decl` objects narrow, and a plain object
    /// literal is rebuilt as a plain object (no forward boxes). Spread / Styled (`narrow` false) keep their rules.
    /// `props`: props-like objects narrow too (handler-like sites: events, client events, Fn symbols, effects). Bindings,
    /// attributes and computeds keep whole props: a props recipe ref is one shared entry (packed binding rows, `{y}`
    /// repeats), a forward box per member and instance is more state, and the binding re-reads the getter anyway.
    fn member_captures(
        &self,
        group: &[NodeId],
        captures: &[(String, NodeId)],
        ref_cells: &FxHashSet<NodeId>,
        narrow: bool,
        props: bool,
    ) -> Option<MemberCaptures> {
        let tree = self.tree;
        let mut out = MemberCaptures::default();
        let mut used: FxHashSet<String> = captures.iter().map(|(n, _)| n.clone()).collect();
        let mut changed = false;
        for (name, decl) in captures {
            let mut uses: Vec<(String, Span, bool)> = Vec::new();
            let mut whole = ref_cells.contains(decl) || self.fn_closure(*decl).is_some();
            let live = if narrow {
                match self.narrow_decl(*decl, name) {
                    // An object recipe (methods: an Fn site) narrows too — its member values are read on the server.
                    Some(live) => {
                        whole = ref_cells.contains(decl) || (live && !props);
                        live
                    }
                    None => {
                        whole = true;
                        false
                    }
                }
            } else {
                true
            };
            for &member in group {
                tree.walk(member, &mut |n| {
                    if whole {
                        return false;
                    }
                    if let AstKind::IdentifierReference(ident) = tree.kind(n) {
                        if !tree.in_type_name(n) && self.declaration_of(ident) == Some(*decl) {
                            match self.member_use(n, name) {
                                // T11 props: only called members narrow (`props.onPress()`: a function). Any other read
                                // (`props.item`, `props.item.id`, `props.rows.map(…)`) may be an object value: a constant
                                // getter's member capture serializes it by value (runtime `forwardSources`), the whole
                                // props object as its recipe (review M1; path narrowing is T12).
                                Some(_) if narrow && live && (self.deep_member(n) || !self.called_member(n)) => whole = true,
                                Some(usage) => {
                                    if !uses.iter().any(|(text, ..)| *text == usage.0) {
                                        uses.push(usage);
                                    }
                                }
                                None => whole = true,
                            }
                        }
                    }
                    true
                });
            }
            if whole || uses.is_empty() {
                out.captures.push(name.clone());
                out.decls.push(*decl);
                out.spans.push(tree.span(*decl));
                out.params.push(name.clone());
                out.members.push(None);
                continue;
            }
            changed = true;
            let mut projections = Vec::new();
            let mut members = Vec::new();
            for (text, span, projection) in uses {
                // `props.a` → `a`; `props["x-y"]` → `x-y` (the quoted key is the object key below).
                let property = &text[name.len()..];
                let key = match property.strip_prefix('.') {
                    Some(stripped) => stripped.to_string(),
                    None if projection => projections.len().to_string(),
                    None => property[2..property.len() - 2].to_string(),
                };
                let base = format!("{name}${}", key.chars().map(|c| if c.is_ascii_alphanumeric() || c == '_' { c } else { '_' }).collect::<String>());
                let mut param = base.clone();
                let mut n = 1;
                while used.contains(&param) {
                    n += 1;
                    param = format!("{base}${n}");
                }
                used.insert(param.clone());
                if projection {
                    projections.push(format!("...{param}"));
                    out.members.push(None);
                } else {
                    let key = if property.starts_with('.') { key } else { property[1..property.len() - 1].to_string() };
                    let literal = if property.starts_with('.') { quote(&key) } else { key.clone() };
                    out.members.push(Some((name.clone(), literal)));
                    members.push(format!("{key}: {param}"));
                }
                out.captures.push(text);
                out.decls.push(*decl);
                out.spans.push(span);
                out.params.push(param);
            }
            if members.is_empty() && projections.len() == 1 {
                out.prologue.push_str(&format!("const {name} = {}; ", &projections[0][3..]));
            } else if members.is_empty() {
                out.prologue.push_str(&format!("const {name} = {{ {} }}; ", projections.join(", ")));
            } else if live {
                // Member values may be live props forward boxes (`_rMember`): `_members` turns them into getters.
                projections.extend(members);
                out.prologue.push_str(&format!("const {name} = __rivetMembers({{ {} }}); ", projections.join(", ")));
                out.helper = true;
            } else {
                // T11: a plain `const` object literal — its member values are the values themselves.
                projections.extend(members);
                out.prologue.push_str(&format!("const {name} = {{ {} }}; ", projections.join(", ")));
            }
        }
        changed.then_some(out)
    }

    /// Function Bridge C7 / T11: whether a captured local may be captured per member path by a handler / binding /
    /// Fn / effect / computed site: `Some(true)` for props-like objects (a component's props parameter, a `mergeProps`
    /// const: member values may be live forward boxes, rebuilt through `__rivetMembers`), `Some(false)` for a `const`
    /// object literal (static keys, `key: value` / shorthand / method properties — no accessors, spreads, computed keys,
    /// classes or `__proto__`) whose every reference in the program is a non-written static member read of one of its
    /// own keys (`store.count`, `store.count()`, `store.count.set(…)`; not passed, spread, assigned, deleted or
    /// iterated; a called key only when its value is `this`-free, `this_free`), so no code can replace a first-level
    /// value between the JSX and the encode, nor in the browser. None: whole.
    fn narrow_decl(&self, decl: NodeId, name: &str) -> Option<bool> {
        let tree = self.tree;
        match tree.kind(decl) {
            AstKind::FormalParameter(_) => self.live_binding(decl).then_some(true),
            AstKind::VariableDeclarator(d) => {
                if d.kind != VariableDeclarationKind::Const {
                    return None;
                }
                let BindingPatternKind::BindingIdentifier(binding) = &d.id.kind else { return None };
                if self.props_helper(d.init.as_ref(), "mergeProps") {
                    return Some(true);
                }
                let Expression::ObjectExpression(object) = unwrap(d.init.as_ref()?) else { return None };
                // Own keys (fix round 1, review H2: an inherited key — `hasOwnProperty`, a `__proto__` method — read on
                // the rebuilt object would differ) and whether each value is provably `this`-free (review H1: calling
                // `store.inc()` on the rebuilt object binds `this` to it — only an arrow, a `const` arrow binding, a
                // non-function literal or a reactivity primitive cannot observe that).
                let mut keys: Vec<(String, bool)> = Vec::new();
                for p in &object.properties {
                    let ObjectPropertyKind::ObjectProperty(p) = p else { return None };
                    if p.kind != PropertyKind::Init || p.computed {
                        return None;
                    }
                    let Some(key) = p.key.static_name() else { return None };
                    if key == "__proto__" && !p.shorthand {
                        return None;
                    }
                    if matches!(unwrap(&p.value), Expression::ClassExpression(_)) {
                        return None;
                    }
                    // `this` in a function value: only non-written member reads (`this.count.set(…)`), never
                    // `this.count = …` or `this` escaping (a first-level write the reference scan cannot see).
                    if let Expression::FunctionExpression(_) = unwrap(&p.value) {
                        let function = tree.expr_id(&p.value);
                        let mut ok = true;
                        if let Some(function) = function {
                            tree.walk(function, &mut |n| {
                                if ok && matches!(tree.kind(n), AstKind::ThisExpression(_)) && !matches!(self.member_use(n, "this"), Some((_, _, false))) {
                                    ok = false;
                                }
                                ok
                            });
                        }
                        if !ok {
                            return None;
                        }
                    }
                    keys.push((key.to_string(), !p.method && self.this_free(&p.value, 0)));
                }
                let symbol = binding.symbol_id.get()?;
                for reference in tree.sem.scoping().get_resolved_references(symbol) {
                    let node = reference.node_id();
                    if tree.in_type_name(node) || matches!(tree.parent_kind(node), Some(AstKind::TSTypeQuery(_))) {
                        continue;
                    }
                    if reference.flags().is_write() {
                        return None;
                    }
                    let Some((text, _, false)) = self.member_use(node, name) else { return None };
                    let key = text[name.len()..].trim_start_matches('.').trim_start_matches("[\"").trim_end_matches("\"]");
                    // An undeclared key (inherited or absent), or a called key whose value may use `this`: whole.
                    let Some(&(_, this_free)) = keys.iter().find(|(k, _)| k == key) else { return None };
                    if !this_free && self.called_member(node) {
                        return None;
                    }
                }
                Some(false)
            }
            _ => None,
        }
    }

    /// T11 fix round 1 (review H1): an object literal value that cannot observe `this` when called through the object:
    /// an arrow, a non-function literal / object / array, a `signal` / `computed` / `selector` call from
    /// `@rivetjs/reactivity` (T10, T11 review nit), or
    /// an identifier bound by a `const` declarator whose initializer is one of those. Anything else (function
    /// expression / declaration, method, import, parameter, member, other call) may.
    fn this_free(&self, value: &Expression<'a>, depth: u8) -> bool {
        match unwrap(value) {
            Expression::ArrowFunctionExpression(_)
            | Expression::StringLiteral(_)
            | Expression::NumericLiteral(_)
            | Expression::BooleanLiteral(_)
            | Expression::NullLiteral(_)
            | Expression::BigIntLiteral(_)
            | Expression::RegExpLiteral(_)
            | Expression::TemplateLiteral(_)
            | Expression::ObjectExpression(_)
            | Expression::ArrayExpression(_) => true,
            // T11 review nit (T10): only the reactivity primitives whose value never reads `this` (a helper returning a passed-in
            // function, such as `untrack(() => f)`, does not count).
            Expression::CallExpression(call) => self
                .import_of(&call.callee)
                .is_some_and(|(name, from)| from == "@rivetjs/reactivity" && matches!(name.as_str(), "signal" | "computed" | "selector")),
            Expression::Identifier(ident) if depth < 8 => {
                let Some(decl) = self.declaration_of(ident) else { return false };
                let AstKind::VariableDeclarator(d) = self.tree.kind(decl) else { return false };
                d.kind == VariableDeclarationKind::Const
                    && matches!(d.id.kind, BindingPatternKind::BindingIdentifier(_))
                    && d.init.as_ref().is_some_and(|init| self.this_free(init, depth + 1))
            }
            _ => false,
        }
    }

    /// The member read on `reference` (`props.item`) is itself the object of a member read (`props.item.id`, through
    /// parentheses / TS casts).
    fn deep_member(&self, reference: NodeId) -> bool {
        let tree = self.tree;
        let mut at = tree.span(reference);
        let mut member = false;
        let mut n = tree.parent(reference);
        while let Some(id) = n {
            match tree.kind(id) {
                AstKind::StaticMemberExpression(m) if m.object.span() == at => {
                    if member {
                        return true;
                    }
                    member = true;
                    at = m.span;
                }
                AstKind::ComputedMemberExpression(m) if m.object.span() == at => {
                    if member {
                        return true;
                    }
                    member = true;
                    at = m.span;
                }
                AstKind::ParenthesizedExpression(p) if p.expression.span() == at => at = p.span,
                AstKind::TSNonNullExpression(p) if p.expression.span() == at => at = p.span,
                AstKind::TSAsExpression(p) if p.expression.span() == at => at = p.span,
                AstKind::TSSatisfiesExpression(p) if p.expression.span() == at => at = p.span,
                _ => return false,
            }
            n = tree.parent(id);
        }
        false
    }

    /// The member read on `reference` (`store.inc`) is a callee (`store.inc()`, through parentheses / TS casts).
    fn called_member(&self, reference: NodeId) -> bool {
        let tree = self.tree;
        let mut at = tree.span(reference);
        let mut member = false;
        let mut n = tree.parent(reference);
        while let Some(id) = n {
            match tree.kind(id) {
                AstKind::StaticMemberExpression(m) if !member && m.object.span() == at => {
                    member = true;
                    at = m.span;
                }
                AstKind::ComputedMemberExpression(m) if !member && m.object.span() == at => {
                    member = true;
                    at = m.span;
                }
                AstKind::ParenthesizedExpression(p) if p.expression.span() == at => at = p.span,
                AstKind::TSNonNullExpression(p) if p.expression.span() == at => at = p.span,
                AstKind::TSAsExpression(p) if p.expression.span() == at => at = p.span,
                AstKind::TSSatisfiesExpression(p) if p.expression.span() == at => at = p.span,
                AstKind::CallExpression(c) => return member && c.callee.span() == at,
                AstKind::TaggedTemplateExpression(t) => return member && t.tag.span() == at,
                _ => return false,
            }
            n = tree.parent(id);
        }
        false
    }

    /// How `n` (a reference to a captured local) is used: `Some((capture text, span, projection))` for
    /// a static member read / string-keyed computed read (not written, updated or deleted) or a
    /// projection call; None for any other use (the whole value escapes).
    fn member_use(&self, n: NodeId, name: &str) -> Option<(String, Span, bool)> {
        let tree = self.tree;
        let skip = |kind: &AstKind| {
            matches!(kind, AstKind::ParenthesizedExpression(_) | AstKind::TSNonNullExpression(_) | AstKind::TSAsExpression(_) | AstKind::TSSatisfiesExpression(_))
        };
        let (mut node, mut parent) = (n, tree.parent(n)?);
        while skip(&tree.kind(parent)) {
            node = parent;
            parent = tree.parent(parent)?;
        }
        let node_span = tree.span(node);
        let text = match tree.kind(parent) {
            // `a?.b`: the guard belongs to the read; the object itself is captured.
            AstKind::StaticMemberExpression(m) if m.optional => return None,
            AstKind::ComputedMemberExpression(m) if m.optional => return None,
            AstKind::StaticMemberExpression(m) if m.object.span() == node_span => format!("{name}.{}", m.property.name),
            AstKind::ComputedMemberExpression(m) if m.object.span() == node_span => match unwrap(&m.expression) {
                Expression::StringLiteral(s) => format!("{name}[{}]", quote(&s.value)),
                _ => return None,
            },
            AstKind::CallExpression(c) => {
                let first = c.arguments.first().and_then(|a| a.as_expression()).is_some_and(|e| e.span() == node_span);
                return (first && self.projection_call(c)).then(|| (tree.text(parent).to_string(), tree.span(parent), true));
            }
            _ => return None,
        };
        // A read: the member is not assigned, updated, deleted or a loop target.
        let (mut member, mut outer) = (parent, tree.parent(parent)?);
        while skip(&tree.kind(outer)) {
            member = outer;
            outer = tree.parent(outer)?;
        }
        let member_span = tree.span(member);
        match tree.kind(outer) {
            AstKind::AssignmentExpression(a) if a.left.span() == member_span => return None,
            AstKind::UpdateExpression(_) | AstKind::ArrayAssignmentTarget(_) | AstKind::ObjectAssignmentTarget(_) | AstKind::AssignmentTargetWithDefault(_) => return None,
            AstKind::UnaryExpression(u) if u.operator == UnaryOperator::Delete => return None,
            AstKind::ForInStatement(f) if f.left.span() == member_span => return None,
            AstKind::ForOfStatement(f) if f.left.span() == member_span => return None,
            _ => {}
        }
        Some((text, tree.span(parent), false))
    }

    /// `globalDOMProps(x[, owned])` / `textInputDOMProps(x[, owned])` from `@rivetjs/cdk/dom-props`:
    /// idempotent, signal-free filters (`f(f(x), owned) === f(x, owned)`) whose result can stand in for
    /// `x`; `owned` must be a literal, a string array literal or a module-scope binding.
    fn projection_call(&self, call: &CallExpression<'a>) -> bool {
        if call.optional || call.arguments.len() > 2 {
            return false;
        }
        let Some((name, from)) = self.import_of(&call.callee) else { return false };
        if from != "@rivetjs/cdk/dom-props" || !matches!(name.as_str(), "globalDOMProps" | "textInputDOMProps") {
            return false;
        }
        match call.arguments.get(1) {
            None => true,
            Some(Argument::SpreadElement(_)) => false,
            Some(argument) => match argument.as_expression().map(unwrap) {
                Some(Expression::StringLiteral(_) | Expression::NumericLiteral(_) | Expression::BooleanLiteral(_) | Expression::NullLiteral(_)) => true,
                Some(Expression::ArrayExpression(a)) => a.elements.iter().all(|e| matches!(e, ArrayExpressionElement::StringLiteral(_))),
                Some(Expression::Identifier(i)) => self.declaration_of(i).is_some_and(|d| self.module_scoped(d)),
                _ => false,
            },
        }
    }
}

#[derive(Default)]
struct MemberCaptures {
    captures: Vec<String>,
    decls: Vec<NodeId>,
    spans: Vec<Span>,
    params: Vec<String>,
    prologue: String,
    members: Vec<Option<(String, String)>>,
    /// The prologue calls `__rivetMembers` (forward boxes possible).
    helper: bool,
}

/// The plain (default-slot) children of a component element that compile to a lazy thunk
/// (`children: () => …`, evaluated where the component renders them, after its providers): every
/// child that is not `r:slot` content, when at least one is an element / fragment / expression.
/// Empty: text-only children stay a string; a single function child stays the function itself; a
/// single bare reference (`{props.children}`) passes through; no children.
pub fn lazy_children<'a>(tree: &Tree<'a>, el: &'a JSXElement<'a>) -> Vec<NodeId> {
    let mut members = Vec::new();
    let mut content = false;
    for child in &el.children {
        let id = match child {
            JSXChild::Text(text) => {
                if jsx_text(tree.text_of(text.span)).is_empty() {
                    continue;
                }
                tree.id_of(&**text)
            }
            JSXChild::ExpressionContainer(c) => {
                let Some(value) = c.expression.as_expression() else { continue };
                if slots::conditional_usage(tree, value).is_some() {
                    continue;
                }
                content = true;
                tree.id_of(&**c)
            }
            JSXChild::Element(c) => {
                if slots::usage_name(tree, c).is_some() {
                    continue;
                }
                content = true;
                tree.id_of(&**c)
            }
            JSXChild::Fragment(f) => {
                content = true;
                tree.id_of(&**f)
            }
            JSXChild::Spread(_) => return Vec::new(),
        };
        let Some(id) = id else { return Vec::new() };
        members.push(id);
    }
    if !content {
        return Vec::new();
    }
    if members.len() == 1 {
        if let AstKind::JSXExpressionContainer(c) = tree.kind(members[0]) {
            // A function child is the content function itself; a bare reference (`{props.children}`,
            // `{content}`) passes the already-constructed value through (a thunk stays a thunk).
            if c.expression.as_expression().is_some_and(|e| is_function_or_reference(unwrap(e))) {
                return Vec::new();
            }
        }
    }
    members
}

fn is_function_or_reference(e: &Expression) -> bool {
    match e {
        Expression::ArrowFunctionExpression(_) | Expression::FunctionExpression(_) | Expression::Identifier(_) => true,
        Expression::StaticMemberExpression(m) => is_function_or_reference(unwrap(&m.object)),
        _ => false,
    }
}

/// The body of a function child of a native element: a concise, parameterless, non-async arrow
/// (`{() => log().join(", ")}`). Block bodies: `function_child_block`; other functions stay unbound values.
fn function_child_body<'b, 'a>(e: &'b Expression<'a>) -> Option<&'b Expression<'a>> {
    let mut e = e;
    while let Expression::ParenthesizedExpression(p) = e {
        e = &p.expression;
    }
    let Expression::ArrowFunctionExpression(arrow) = e else { return None };
    if !arrow.expression || arrow.r#async || !arrow.params.items.is_empty() || arrow.params.rest.is_some() {
        return None;
    }
    match arrow.body.statements.first()? {
        Statement::ExpressionStatement(statement) => Some(&statement.expression),
        _ => None,
    }
}

/// A parameterless, non-async, block-bodied arrow function child (`{() => { const v = s(); return <b>{v}</b>; }}`).
fn function_child_block<'b, 'a>(e: &'b Expression<'a>) -> Option<&'b ArrowFunctionExpression<'a>> {
    let mut e = e;
    while let Expression::ParenthesizedExpression(p) = e {
        e = &p.expression;
    }
    let Expression::ArrowFunctionExpression(arrow) = e else { return None };
    if arrow.expression || arrow.r#async || !arrow.params.items.is_empty() || arrow.params.rest.is_some() {
        return None;
    }
    Some(arrow)
}

/// On a spread element, an attribute merged into the spread object (same rule as the compiler's
/// `spread_plain`): not an event, ref, model, global event, `r:slot` or preload directive.
fn spread_plain<'a>(tree: &Tree<'a>, el: &JSXElement<'a>, attr: &JSXAttribute<'a>) -> bool {
    let name = attr_name(tree, attr);
    let tag = tree.text_of(el.opening_element.name.span());
    name != slots::SLOT
        && !(name == "preload" && tag != "audio" && tag != "video")
        && global_event(name).is_none()
        && name != "ref"
        && !starts_with_on(name)
        && !name.starts_with("model:")
        && !name.starts_with("prop:")
        && !styling::spread_directive(tree, attr)
}

fn add_helper(helpers: &mut Vec<(&'static str, &'static str)>, helper: (&'static str, &'static str)) {
    if !helpers.contains(&helper) {
        helpers.push(helper);
    }
}

/// Strip parentheses and TypeScript expression wrappers (`as`, `satisfies`, `!`).
/// `test ? f : undefined` / `test ? undefined : f` / `test && f`: the handler's presence, when the test
/// is side-effect free and reads no signals (an identifier, a static member chain, or `!` of one) —
/// the server evaluates it to skip recording an absent handler. None: unknown (always recorded).
fn presence_test<'a>(tree: &Tree<'a>, e: &'a Expression<'a>) -> Option<String> {
    fn nullish(e: &Expression) -> bool {
        matches!(unwrap(e), Expression::NullLiteral(_)) || matches!(unwrap(e), Expression::Identifier(i) if i.name == "undefined")
    }
    fn simple(e: &Expression) -> bool {
        match unwrap(e) {
            Expression::Identifier(_) | Expression::ThisExpression(_) => true,
            Expression::StaticMemberExpression(m) => simple(&m.object),
            Expression::UnaryExpression(u) => u.operator == UnaryOperator::LogicalNot && simple(&u.argument),
            _ => false,
        }
    }
    match unwrap(e) {
        Expression::ConditionalExpression(c) if simple(&c.test) => {
            // A boolean: the runtime skips the record only on `present === false`.
            if nullish(&c.alternate) {
                Some(format!("!!({})", tree.text_of(c.test.span())))
            } else if nullish(&c.consequent) {
                Some(format!("!({})", tree.text_of(c.test.span())))
            } else {
                None
            }
        }
        Expression::LogicalExpression(l) if l.operator == LogicalOperator::And && simple(&l.left) => Some(format!("!!({})", tree.text_of(l.left.span()))),
        _ => None,
    }
}

/// Function Bridge C9 / T10: a `const g = <callee>.bind(…)` initializer (`Analysis::bind_shape`).
enum BindShape<'a> {
    /// `f.bind(…)`: the call node and the identifier `f`.
    Call(NodeId, &'a IdentifierReference<'a>),
    /// `f.bind(...args)`: the bound `this` comes from a spread (not rewritten); `f` when an identifier.
    SpreadThis(NodeId, Option<&'a IdentifierReference<'a>>),
    /// `<expression>.bind(…)` over something other than an identifier (`props.onPress.bind(…)`): its text.
    Callee(NodeId, String),
}

/// T10 fix 1 (F9) diagnostics (RV2012–RV2014, `diagnostics.rs`).
const BIND_SPREAD_THIS: &str =
    "`.bind` with a spread first argument is not resumable: pass the bound `this` as its own first argument (`f.bind(self, ...args)`)";
const BIND_SPREAD_THIS_MAYBE: &str = "`.bind` with a spread first argument may not resume: if the callee is a function Rivet compiled, pass the bound `this` as its own first argument (`f.bind(self, ...args)`); an object with its own `bind` is fine";
const BIND_IN_OBJECT: &str = "`.bind(…)` inside an object literal may not resume (a native bound function is not serializable): keep the bound function in a local constant (`const g = f.bind(…)`) and store `g`; an object with its own `bind` is fine";
fn bind_callee_warning(callee: &str) -> String {
    format!(
        "`.bind` of `{callee}` may not resume: Rivet cannot tell that `{callee}` is a function it compiled; if it is one, call it from an arrow instead (`(...args) => {callee}(...args)`); an object with its own `bind` is fine"
    )
}
fn bind_callee_message(callee: &str) -> String {
    format!(
        "`.bind` of `{callee}` is not resumable: only a function declared in the component, a module-level function or an import can be bound; call it from an arrow instead (`(...args) => {callee}(...args)`)"
    )
}

/// TS casts and parentheses around an expression (also `compile.rs` `.bind` rewrite: same unwrapping as the analysis).
/// RESUME-ACCESSOR-ROW fix 1: the positions a returned value may come from (`?:` branches, `&&` / `||` / `??` operands).
fn returned_leaves<'b, 'a>(e: &'b Expression<'a>, out: &mut Vec<&'b Expression<'a>>) {
    match unwrap(e) {
        Expression::ConditionalExpression(c) => {
            returned_leaves(&c.consequent, out);
            returned_leaves(&c.alternate, out);
        }
        Expression::LogicalExpression(l) => {
            returned_leaves(&l.left, out);
            returned_leaves(&l.right, out);
        }
        leaf => out.push(leaf),
    }
}

/// A parameterless, non-async, non-generator arrow / function expression (a child accessor).
fn plain_accessor(tree: &Tree, function: NodeId) -> bool {
    match tree.kind(function) {
        AstKind::ArrowFunctionExpression(a) => !a.r#async && a.params.items.is_empty() && a.params.rest.is_none(),
        AstKind::Function(f) => f.r#type == FunctionType::FunctionExpression && !f.r#async && !f.generator && f.params.items.is_empty() && f.params.rest.is_none(),
        _ => false,
    }
}

pub(crate) fn unwrap<'b, 'a>(mut e: &'b Expression<'a>) -> &'b Expression<'a> {
    loop {
        e = match e {
            Expression::ParenthesizedExpression(p) => &p.expression,
            Expression::TSAsExpression(x) => &x.expression,
            Expression::TSSatisfiesExpression(x) => &x.expression,
            Expression::TSNonNullExpression(x) => &x.expression,
            _ => return e,
        };
    }
}

/// `function` / `async function` / `function*` prefix for the function of an object method shorthand
/// (`{ async *m() {} }`): its source text starts at the parameters. None for other functions.
/// An object literal with a getter / setter (`{ get variant() {…} }`), parentheses unwrapped.
/// An initializer whose value can be an object literal with accessors (`{ get x() {…} }`), also in a branch
/// (`live ? { get x() {…} } : {…}`, LIVE-PROPS P4 gap 2c).
fn accessor_object(init: Option<&Expression<'_>>) -> bool {
    let Some(init) = init else { return false };
    let mut values = Vec::new();
    value_positions(init, &mut values);
    values.iter().any(|e| {
        matches!(e, Expression::ObjectExpression(o)
            if o.properties.iter().any(|p| matches!(p, ObjectPropertyKind::ObjectProperty(p) if p.kind != PropertyKind::Init)))
    })
}

/// The sub-expressions `e`'s value can be (conditional branches, logical operands, a sequence's last), through
/// parentheses and TS casts (LIVE-PROPS P4).
fn value_positions<'b, 'a>(e: &'b Expression<'a>, out: &mut Vec<&'b Expression<'a>>) {
    match unwrap(e) {
        Expression::ConditionalExpression(c) => {
            value_positions(&c.consequent, out);
            value_positions(&c.alternate, out);
        }
        Expression::LogicalExpression(l) => {
            value_positions(&l.left, out);
            value_positions(&l.right, out);
        }
        Expression::SequenceExpression(s) => {
            if let Some(last) = s.expressions.last() {
                value_positions(last, out);
            }
        }
        other => out.push(other),
    }
}

pub(crate) fn method_prefix(tree: &Tree, function: NodeId) -> Option<&'static str> {
    let AstKind::Function(f) = tree.kind(function) else { return None };
    match tree.raw_parent(function).map(|p| tree.kind(p)) {
        Some(AstKind::ObjectProperty(p)) if p.method && p.kind == PropertyKind::Init => Some(match (f.r#async, f.generator) {
            (true, true) => "async function* ",
            (true, false) => "async function ",
            (false, true) => "function* ",
            (false, false) => "function ",
        }),
        _ => None,
    }
}

fn accessor_or_constructor(tree: &Tree, function: NodeId) -> bool {
    match tree.raw_parent(function).map(|p| tree.kind(p)) {
        Some(AstKind::MethodDefinition(m)) => m.kind != MethodDefinitionKind::Method,
        Some(AstKind::ObjectProperty(p)) => p.kind != PropertyKind::Init,
        _ => false,
    }
}

/// Row getter parameters (`FormalParameter` nodes) of every `<For>` element's children function
/// (sole expression child or `children={…}`), `For` imported from `@rivetjs/runtime/dom` / `/server`
/// (the compiler's structural helper), minus parameters the module assigns.
fn for_accessors<'a>(tree: &Tree<'a>) -> FxHashSet<NodeId> {
    let mut params = FxHashSet::default();
    let mut assigned = FxHashSet::default();
    let is_for = |el: &JSXElement<'a>| {
        let JSXElementName::IdentifierReference(tag) = &el.opening_element.name else { return false };
        let Some(decl) = tree.resolve(tag, false) else { return false };
        let AstKind::ImportSpecifier(s) = tree.kind(decl) else { return false };
        s.imported.name() == "For" && matches!(import_source(tree, decl), Some("@rivetjs/runtime/dom" | "@rivetjs/runtime/server"))
    };
    tree.walk(tree.root(), &mut |n| {
        match tree.kind(n) {
            AstKind::JSXElement(el) if is_for(el) => {
                let mut function = None;
                for item in &el.opening_element.attributes {
                    if let JSXAttributeItem::Attribute(attr) = item {
                        if attr_name(tree, attr) == "children" {
                            if let Some(JSXAttributeValue::ExpressionContainer(c)) = &attr.value {
                                function = c.expression.as_expression();
                            }
                        }
                    }
                }
                let mut expressions = el.children.iter().filter(|c| !matches!(c, JSXChild::Text(t) if t.value.trim().is_empty()));
                if let (Some(JSXChild::ExpressionContainer(c)), None) = (expressions.next(), expressions.next()) {
                    function = function.or(c.expression.as_expression());
                }
                let formal = match function.map(unwrap) {
                    Some(Expression::ArrowFunctionExpression(f)) => Some(&f.params),
                    Some(Expression::FunctionExpression(f)) => Some(&f.params),
                    _ => None,
                };
                if let Some(formal) = formal {
                    for param in formal.items.iter().take(2) {
                        if matches!(param.pattern.kind, BindingPatternKind::BindingIdentifier(_)) {
                            if let Some(id) = tree.id_of(param) {
                                params.insert(id);
                            }
                        }
                    }
                }
            }
            AstKind::AssignmentExpression(assign) => {
                if let AssignmentTarget::AssignmentTargetIdentifier(left) = &assign.left {
                    if let Some(decl) = tree.resolve(left, false) {
                        assigned.insert(decl);
                    }
                }
            }
            AstKind::UpdateExpression(update) => {
                if let SimpleAssignmentTarget::AssignmentTargetIdentifier(target) = &update.argument {
                    if let Some(decl) = tree.resolve(target, false) {
                        assigned.insert(decl);
                    }
                }
            }
            _ => {}
        }
        true
    });
    params.retain(|p| !assigned.contains(p));
    params
}

pub(crate) fn import_source<'a>(tree: &Tree<'a>, decl: NodeId) -> Option<&'a str> {
    let mut n = Some(decl);
    while let Some(id) = n {
        if let AstKind::ImportDeclaration(d) = tree.kind(id) {
            return Some(d.source.value.as_str());
        }
        n = tree.raw_parent(id);
    }
    None
}

/// Analyze one source file: sites keyed by node, ref cells, symbols and module scope names.
pub fn analyze(
    tree: &Tree,
    module: &str,
    diags: &mut Diags,
    statics: &FxHashSet<NodeId>,
    source_packages: &[String],
    resolved: &FxHashMap<String, String>,
) -> Resumed {
    let mut a = Analysis {
        child_returns: FxHashSet::default(),
        tree,
        sites: Vec::new(),
        map: SiteMap::default(),
        candidates: Vec::new(),
        site_closures: FxHashSet::default(),
        ref_assignments: Vec::new(),
        all_assignments: FxHashMap::default(),
        statics,
        source_packages,
        claimed: FxHashSet::default(),
        seeds: Vec::new(),
        accessors: for_accessors(tree),
        refs: Vec::new(),
        resolved,
        holder_writes: FxHashMap::default(),
        rejected: FxHashSet::default(),
        closures: FxHashSet::default(),
        closures_indexed: 0,
        for_rows: Vec::new(),
    };
    // Pass 1: candidate sites, outermost only. Ref-binding callbacks mark their target locals.
    a.scan(tree.root(), false, diags);
    // Function Bridge C12 / T24: which module classes are data classes (`classes.rs`).
    let class_verdicts = classes::verdicts(tree);
    let mut ref_cells = FxHashSet::default();
    for (decl, count) in &a.ref_assignments {
        if a.all_assignments.get(decl) == Some(count) {
            ref_cells.insert(*decl);
        }
    }
    let refs: Vec<(NodeId, usize)> = a.map.iter().collect();
    for (attr, site) in refs {
        if a.sites[site].kind == SiteKind::Ref
            && !a.sites[site].ref_object
            && !a.sites[site].declaration.is_some_and(|d| ref_cells.contains(&d))
        {
            diags.add(
                "Ref-bound locals must be assigned only by ref callbacks: keep other state in a signal, or use const el = ref<…>() with ref={el}",
                Some(attr),
            );
            a.map.delete(attr);
        }
    }
    // Pass 2: captures; captured local functions become symbols too (fixed point). Definite sites
    // first (with diagnostics), then seeds and opportunistic (R2) sites, whose promotions report nothing.
    let mut fn_sites: FxHashSet<NodeId> = FxHashSet::default();
    // Destructured bindings whose function-literal default became an Fn site (`default_site`).
    let mut defaults: FxHashSet<NodeId> = FxHashSet::default();
    // Function Bridge T4 (C4): captured holders already searched for stored functions, and the holder sites found before
    // the quiet phase (analysed in it: opportunistic, no capture diagnostics).
    let mut holders: FxHashSet<NodeId> = FxHashSet::default();
    let mut held: Vec<usize> = Vec::new();
    // Function Bridge C9 / T10: `.bind` calls the server rewrites to `_rBound`.
    let mut bound: FxHashSet<NodeId> = FxHashSet::default();
    let (mut queue, opportunistic): (Vec<usize>, Vec<usize>) = a.candidates.iter().partition(|&&c| !a.sites[c].opportunistic);
    let mut i = 0;
    let mut quiet = false;
    loop {
        if i == queue.len() {
            if quiet {
                break;
            }
            quiet = true;
            for seed in a.seeds.clone() {
                if ref_cells.contains(&seed) || fn_sites.contains(&seed) {
                    continue;
                }
                let direct = tree.decl_kind(seed) == DeclKind::FunctionDeclaration
                    || matches!(tree.kind(seed), AstKind::VariableDeclarator(d)
                        if matches!(d.init, Some(Expression::ArrowFunctionExpression(_) | Expression::FunctionExpression(_))) || accessor_object(d.init.as_ref()))
                    || a.module_alias(seed);
                if !direct && defaults.insert(seed) {
                    if let Some(site) = a.default_site(seed, None, true) {
                        queue.push(site);
                    }
                }
                // T10 fix 1 (F2): a bind const used by name as a value (prop, returned / object value) is rewritten too.
                if !direct {
                    if let Some(component) = a.component_of(seed) {
                        if let Some(site) = a.bind_chain(seed, &component, true, &ref_cells, &mut fn_sites, &mut bound, diags) {
                            queue.push(site);
                        }
                    }
                }
                // LIVE-PROPS P4 (gap 2a): a const aliasing local functions (`live ? f : f()`) escapes them as values.
                let targets = if direct { vec![seed] } else { a.alias_functions(seed) };
                for decl in targets {
                    if ref_cells.contains(&decl) || fn_sites.contains(&decl) {
                        continue;
                    }
                    let Some(function) = a.fn_closure(decl) else { continue };
                    let Some(component) = a.component_of(function) else { continue };
                    let mut site = Site::new(SiteKind::Fn);
                    site.closure = Some(function);
                    site.component = component;
                    site.declaration = Some(decl);
                    site.opportunistic = true;
                    a.sites.push(site);
                    fn_sites.insert(decl);
                    queue.push(a.sites.len() - 1);
                }
            }
            // Functions inside consts derived through functions get symbols too: a const holding signals
            // (`const s = createState({ onChange: (v) => … })`) serializes by value so handlers and
            // bindings share its state; signal-free consts (route tables) still re-create from their recipe.
            queue.extend(opportunistic.iter().copied());
            queue.append(&mut held);
            continue;
        }
        let index = queue[i];
        i += 1;
        let Some(closure) = a.sites[index].closure else { continue };
        let (mut captures, mut scope, uses_this, has_jsx, mut capture_spans) = a.free_names(closure);
        for &member in a.sites[index].group.clone().iter().skip(1) {
            let (more, more_scope, _, _, more_spans) = a.free_names(member);
            for (entry, span) in more.into_iter().zip(more_spans) {
                if !captures.iter().any(|(n, _)| *n == entry.0) {
                    captures.push(entry);
                    capture_spans.push(span);
                }
            }
            for entry in more_scope {
                if !scope.iter().any(|(n, _)| *n == entry.0) {
                    scope.push(entry);
                }
            }
        }
        // A const arrow referring to itself (`const fact = (k) => … fact(k - 1)`): not a capture (the
        // server would read it in its own TDZ); the symbol binds the name around the function instead.
        if let Some(declaration) = a.sites[index].declaration {
            if let Some(at) = captures.iter().position(|(_, d)| *d == declaration) {
                captures.remove(at);
                capture_spans.remove(at);
                a.sites[index].self_ref = true;
            }
        }
        let kind = a.sites[index].kind;
        // Function Bridge C7 / T11: member-only captures narrow for handlers, bindings, attributes, Fn symbols, effects,
        // client events and computeds too (`narrow_decl`: plain `const` object literals; props-like objects for handler-like
        // sites only).
        let members = if matches!(kind, SiteKind::Spread | SiteKind::Styled) {
            a.member_captures(&a.sites[index].group, &captures, &ref_cells, false, true)
        } else if matches!(
            kind,
            SiteKind::Event | SiteKind::Bind | SiteKind::Attr | SiteKind::Fn | SiteKind::Effect | SiteKind::ClientEvent | SiteKind::Computed
        ) {
            let nodes: Vec<NodeId> = if a.sites[index].group.is_empty() { a.sites[index].closure.into_iter().collect() } else { a.sites[index].group.clone() };
            let props = matches!(kind, SiteKind::Event | SiteKind::ClientEvent | SiteKind::Fn | SiteKind::Effect);
            a.member_captures(&nodes, &captures, &ref_cells, true, props)
        } else {
            None
        };
        match members {
            Some(members) => {
                let site = &mut a.sites[index];
                site.captures = members.captures;
                site.capture_decls = members.decls;
                site.capture_spans = members.spans;
                site.params = members.params;
                site.prologue = members.prologue;
                site.members = members.members;
                site.members_helper = members.helper;
            }
            None => {
                a.sites[index].captures = captures.iter().map(|(n, _)| n.clone()).collect();
                a.sites[index].capture_decls = captures.iter().map(|(_, d)| *d).collect();
                a.sites[index].capture_spans = capture_spans;
            }
        }
        a.sites[index].scope = scope.iter().map(|(n, _)| n.clone()).collect();
        a.sites[index].scope_decls = scope;
        // T10 fix 2 (RV2014): after narrowing — only a `.bind(…)` property the site actually reaches.
        if !quiet {
            a.object_bind_warnings(index, diags);
        }
        if has_jsx && !kind.render() && kind != SiteKind::Fn && !quiet {
            diags.add(
                "JSX inside handlers, effects and computeds is not resumable: set a signal in the handler and render from it ({() => …} / <Show>)",
                Some(closure),
            );
        }
        if uses_this && !quiet {
            diags.add(
                "Resumable code cannot capture `this`: use an arrow function and event.currentTarget (or a ref)",
                Some(closure),
            );
        }
        for (name, decl) in captures {
            if ref_cells.contains(&decl) || fn_sites.contains(&decl) {
                continue;
            }
            // Captured local functions and consts derived through functions/JSX (route tables, mapped
            // data) are re-created on the client from a symbol plus their own captures. They must be pure.
            if let Some(function) = a.fn_closure(decl) {
                let mut site = Site::new(SiteKind::Fn);
                site.closure = Some(function);
                site.component = a.component_of(function).unwrap_or_else(|| a.sites[index].component.clone());
                site.declaration = Some(decl);
                site.opportunistic = quiet;
                a.sites.push(site);
                fn_sites.insert(decl);
                queue.push(a.sites.len() - 1);
            } else {
                // `new X(…)` of a built-in the resume encoder serializes (`serializable_builtin`) is plain data; of a module
                // data class (or a relative import: its module registers it) too; of an ineligible class RV2102 (T24).
                let class = if quiet { None } else { classes::class_capture(tree, &class_verdicts, resolved, decl) };
                if let Some(Some(message)) = &class {
                    diags.add(message.clone(), Some(closure));
                }
                if !quiet
                    && class.is_none()
                    && matches!(tree.kind(decl), AstKind::VariableDeclarator(d)
                        if match &d.init {
                            Some(Expression::NewExpression(n)) => !serializable_builtin(tree, &n.callee),
                            Some(Expression::ClassExpression(_)) => true,
                            _ => false,
                        })
                {
                    diags.add(
                        format!(
                            "Resumable code cannot capture `{name}`: class instances are not serializable; create it inside the handler / clientEffect, build it with reconstruct(() => …), or capture plain data or signals"
                        ),
                        Some(closure),
                    );
                }
                // A destructured binding with a function-literal default (`{ f = () => x } = o`) may hold it: the
                // default becomes a symbol so the captured value serializes (else the server throws "function is not
                // serializable", or a region silently drops the value).
                if defaults.insert(decl) {
                    let component = a.sites[index].component.clone();
                    if let Some(site) = a.default_site(decl, Some(component), quiet) {
                        queue.push(site);
                    }
                }
                // LIVE-PROPS P4 (gap 2a): a captured const aliasing local functions (`const g = live ? f : h`) holds one of
                // them: each becomes a symbol so the captured value serializes.
                for target in a.alias_functions(decl) {
                    if ref_cells.contains(&target) || fn_sites.contains(&target) {
                        continue;
                    }
                    let Some(function) = a.fn_closure(target) else { continue };
                    let mut site = Site::new(SiteKind::Fn);
                    site.closure = Some(function);
                    site.component = a.component_of(function).unwrap_or_else(|| a.sites[index].component.clone());
                    site.declaration = Some(target);
                    site.opportunistic = quiet;
                    a.sites.push(site);
                    fn_sites.insert(target);
                    queue.push(a.sites.len() - 1);
                }
                // Function Bridge C9 / T10: a captured `const g = f.bind(t, ...args)` (bound-of-bound chains too): `bind_chain`.
                let component = a.sites[index].component.clone();
                if let Some(site) = a.bind_chain(decl, &component, quiet, &ref_cells, &mut fn_sites, &mut bound, diags) {
                    queue.push(site);
                }
            }
        }
        // Function Bridge T4 (C4): function literals stored into a captured holder (`api.inc = f`, `signal(f)`,
        // `track([f])`) are Fn symbols, so the holder's value serializes (`escape.rs`). Their captures promote further
        // holders (same fixed point).
        // T4b: local functions stored by name get one recipe at their declaration; local bindings a holder stores
        // (`const outer = { inner }`, `x = holder`) are holders too (worklist).
        let mut work = a.sites[index].capture_decls.clone();
        while let Some(decl) = work.pop() {
            if ref_cells.contains(&decl) || !holders.insert(decl) {
                continue;
            }
            let stored = a.holder_stores(decl, fn_sites.contains(&decl));
            let mut found: Vec<usize> = stored.functions.iter().filter_map(|&function| a.holder_site(function)).collect();
            for named in stored.named {
                if !ref_cells.contains(&named) {
                    found.extend(a.named_site(named, &mut fn_sites));
                    // T10 fix 1 (F2): a bind const stored by name (`list.push(inc)`, `{ inc }`, `signal(inc)`).
                    if let Some(component) = a.component_of(named) {
                        found.extend(a.bind_chain(named, &component, true, &ref_cells, &mut fn_sites, &mut bound, diags));
                    }
                }
            }
            for site in found {
                if quiet {
                    queue.push(site);
                } else {
                    held.push(site);
                }
            }
            work.extend(stored.holders);
        }
    }
    // Function Bridge C6 / T8: captured `let`s with any write box into shared cells (snapshot captures: `cells.rs`).
    let cells = a.boxed_lets(&queue, &ref_cells, &fn_sites);
    // Function Bridge C11 / T13: captured stores whose every reference has a literal path (`stores.rs`).
    let store_paths = a.store_paths(&queue);
    for &index in &queue {
        let site = &mut a.sites[index];
        let members = std::mem::take(&mut site.members);
        site.capture_kinds = site
            .capture_decls
            .iter()
            .enumerate()
            .map(|(i, decl)| {
                // T11: a member-read capture is that member's value, whatever its object is.
                if members.get(i).is_some_and(Option::is_some) {
                    "value"
                } else if ref_cells.contains(decl) {
                    "ref"
                } else if fn_sites.contains(decl) {
                    "fn"
                } else if cells.decls.contains(decl) && !cells.snapshots.contains(&(index, *decl)) {
                    "cell"
                } else {
                    "value"
                }
            })
            .collect();
        site.members = members;
        // T8 follow-up: a mixed eager site also captures the JSX-time value of the cell (`x$s` = `_rMember(x, "v")`).
        let mut extra: Vec<(NodeId, &(String, String, FxHashSet<NodeId>))> =
            cells.mixed.iter().filter(|((s, _), _)| *s == index).map(|((_, d), m)| (*d, m)).collect();
        extra.sort_by_key(|(d, _)| tree.span(*d).start);
        for (decl, (name, param, _)) in extra {
            let span = tree.span(decl);
            site.members.resize(site.captures.len(), None);
            site.members.push(Some((name.clone(), quote("v"))));
            if !site.params.is_empty() {
                site.params.push(param.clone());
            }
            site.captures.push(param.clone());
            site.capture_decls.push(decl);
            site.capture_spans.push(span);
            site.capture_kinds.push("value");
        }
    }
    // Function Bridge C8 / T10: capture cycles between local functions of one statement list → group symbols.
    let groups = a.function_groups(&mut queue, &ref_cells, &fn_sites, &cells, diags);
    queue.sort_by_key(|&s| a.sites[s].closure.map_or(0, |c| tree.span(c).start));
    let mut symbols = Vec::new();
    let mut scope: Vec<String> = Vec::new();
    // Content-stable ids (Function Bridge C2): `<Component>$<hash>` over the symbol's own content (kind, component,
    // parameters + capture kinds, imports, body), so an id changes only when that closure's code or captures change —
    // never because another site was added before it. The hash is the shortest prefix (≥ `HASH_MIN` base-36 digits)
    // of the content digest that no other symbol of the same component shares (decided after the loop, below).
    // Every symbol's digest, in queue order (= `symbols` order).
    let mut digests: Vec<String> = Vec::with_capacity(queue.len());
    for &index in queue.iter() {
        let site = &mut a.sites[index];
        let key = if site.group_container.is_some() {
            // T10 fix 1 (F1): a group site has no map key (several groups share a statement list); emission goes through
            // `Resumed.groups` / `group_after`, containment queries through `group_of` (`bounds.rs`).
            None
        } else if site.kind == SiteKind::Fn {
            site.declaration.or(site.value)
        } else {
            site.attr.or(site.child).or(site.call).or(site.value)
        };
        let kind = site.kind;
        let closure = site.closure;
        for name in &site.scope {
            if !scope.contains(name) {
                scope.push(name.clone());
            }
        }
        if let Some(key) = key {
            a.map.set(key, index);
        }
        let site = &a.sites[index];
        // T8: references of captured cells inside the symbol's text read / write `.v` (`cells.rs`).
        let edits = if cells.decls.is_empty() {
            Vec::new()
        } else {
            let mut spans: Vec<Span> = closure.map(|c| tree.span(c)).into_iter().collect();
            spans.extend(site.group.iter().chain(&site.group_closures).map(|&m| tree.span(m)));
            cells.edits(index, &site.capture_decls, &spans)
        };
        // `<slot>` elements are lowered in the symbol text (their props binding is a capture).
        let text = closure.map_or(String::new(), |c| slots::rewrite_edits(tree, c, false, &edits).unwrap_or_else(|| tree.text(c).to_string()));
        let text = text.as_str();
        let body = if !site.group_names.is_empty() {
            // Function Bridge C8 / T10: the members' declarations in source order, returning them (member index = position).
            let parts: Vec<String> = site
                .group_closures
                .iter()
                .zip(&site.group_names)
                .map(|(&member, name)| {
                    let at = tree.span(member);
                    let own: Vec<(Span, String)> = edits.iter().filter(|(span, _)| span.start >= at.start && span.end <= at.end).cloned().collect();
                    let text = slots::rewrite_edits(tree, member, false, &own).unwrap_or_else(|| tree.text(member).to_string());
                    if tree.decl_kind(member) == DeclKind::FunctionDeclaration { text } else { format!("const {name} = ({text});") }
                })
                .collect();
            format!("{{ {}{} return [{}]; }}", site.prologue, parts.join(" "), site.group_names.join(", "))
        } else if kind == SiteKind::Element {
            let (_, args, literal) = &site.element_helper;
            format!("() => __rivetResumeElement(__rivetEl, {args}({}))", literal.as_deref().unwrap_or(text))
        } else if kind == SiteKind::Spread {
            // The browser binding: DOM v2 `_spread(element, () => merged, flags (1: content), rendered names)`.
            let flags = if site.spread_content { "1" } else { "0" };
            let object = format!("{{ {} }}", site.spread_parts.join(", "));
            let object = match &site.spread_class {
                Some(toggles) => format!("__rivetResumeSpreadClass({object}, {toggles})"),
                None => format!("({object})"),
            };
            format!("(__rivetEl, __rivetNames) => __rivetResumeSpread(__rivetEl, () => {object}, {flags}, __rivetNames)")
        } else if kind == SiteKind::Styled {
            // Called like a spread binding (element, names); binds the dynamic parts on the element.
            let statements: Vec<String> = site.spread_parts.iter().map(|s| format!("{s};")).collect();
            format!("(__rivetEl) => {{ {} }}", statements.join(" "))
        } else if kind == SiteKind::Props {
            // The live props object (`_c(_propsOf, props)` once compiled for the browser).
            format!("({})", closure.map_or(String::new(), |c| props_text(tree, c, site.props_children)))
        } else if kind == SiteKind::Slot && !site.group.is_empty() {
            if site.lazy_children {
                // Lazy children: the branded thunk (`_slot`) over one element, the expression, or a
                // fragment spanning the children (slot rewriting applies inside).
                let text = match (site.group.len() == 1, tree.kind(site.group[0])) {
                    (true, AstKind::JSXExpressionContainer(c)) => slots::splice_edits(tree, c.expression.span(), &edits),
                    (true, AstKind::JSXElement(_)) => {
                        slots::rewrite_edits(tree, site.group[0], false, &edits).unwrap_or_else(|| tree.text(site.group[0]).to_string())
                    }
                    _ => slots::rewrite_fragment_edits(tree, &site.group, &edits),
                };
                format!("__rivetSlot(() => ({text}))")
            } else {
                let parts: Vec<String> = site
                    .group
                    .iter()
                    .map(|&member| slots::rewrite_edits(tree, member, true, &edits).unwrap_or_else(|| tree.text(member).to_string()))
                    .collect();
                if parts.len() == 1 { format!("() => ({})", parts[0]) } else { format!("() => [{}]", parts.join(", ")) }
            }
        } else if matches!(kind, SiteKind::Bind | SiteKind::Attr | SiteKind::Region) {
            format!("() => ({text})")
        } else if closure.is_some_and(|c| tree.decl_kind(c) == DeclKind::FunctionDeclaration) {
            let stripped = text.strip_prefix("export").filter(|rest| rest.starts_with(char::is_whitespace));
            format!("({})", stripped.map_or(text, |rest| rest.trim_start()))
        } else if closure.is_some_and(|c| method_prefix(tree, c).is_some()) {
            // A method shorthand's function (`(e) {…}` in source) as a function expression.
            format!("({}{text})", method_prefix(tree, closure.unwrap()).unwrap())
        } else if site.self_ref {
            let name = site.declaration.and_then(|d| match tree.kind(d) {
                AstKind::VariableDeclarator(d) => match &d.id.kind {
                    BindingPatternKind::BindingIdentifier(id) => Some(id.name.to_string()),
                    _ => None,
                },
                _ => None,
            });
            match name {
                Some(name) => format!("{{ const {name} = ({text}); return {name}; }}"),
                None => format!("({text})"),
            }
        } else {
            format!("({text})")
        };
        // Package imports are re-declared in the symbol module (structural helpers stay recognizable);
        // everything else comes from the source module, which re-exports it.
        let mut imports = Vec::new();
        let mut locals = Vec::new();
        for (local, decl) in &site.scope_decls {
            let from = import_source(tree, *decl);
            match from {
                Some(from) if !from.starts_with('.') && !from.starts_with('/') => {
                    let imported = match tree.kind(*decl) {
                        AstKind::ImportSpecifier(s) => s.imported.name().to_string(),
                        AstKind::ImportNamespaceSpecifier(_) => "*".into(),
                        _ => "default".into(),
                    };
                    imports.push(Import { local: local.clone(), imported, from: from.to_string() });
                }
                _ => locals.push(local.clone()),
            }
        }
        if kind == SiteKind::Spread {
            imports.push(Import { local: "__rivetResumeSpread".into(), imported: "_spread".into(), from: "@rivetjs/runtime/dom".into() });
        }
        if site.lazy_children {
            imports.push(Import { local: "__rivetSlot".into(), imported: "_slot".into(), from: "@rivetjs/runtime/dom".into() });
        }
        if kind == SiteKind::Props {
            imports.push(Import { local: "__rivetPropsOf".into(), imported: "_propsOf".into(), from: "@rivetjs/runtime/props".into() });
        }
        if site.members_helper {
            imports.push(Import { local: "__rivetMembers".into(), imported: "_members".into(), from: "@rivetjs/runtime/props".into() });
        }
        for (local, imported) in &site.dom_helpers {
            let from = if *imported == "_attrValue" { "@rivetjs/runtime/dom" } else { "@rivetjs/runtime/style" };
            imports.push(Import { local: (*local).into(), imported: (*imported).into(), from: from.into() });
        }
        let mut params = if site.params.is_empty() { site.captures.clone() } else { site.params.clone() };
        let mut labels = site.captures.clone();
        if site.props_children {
            params.push("__rivetChildren".into());
            labels.push("__rivetChildren".into());
        }
        // Member-read captures: rebuild the captured objects before the binding closure.
        let body = if site.prologue.is_empty() || !site.group_names.is_empty() { body } else { format!("{{ {}return {body}; }}", site.prologue) };
        if kind == SiteKind::Element {
            imports.push(Import { local: "__rivetResumeElement".into(), imported: site.element_helper.0.into(), from: "@rivetjs/runtime/dom".into() });
            params.insert(0, "__rivetEl".into());
            labels.insert(0, "__rivetEl".into());
        }
        if labels == params || labels.len() != params.len() {
            labels = Vec::new();
        }
        let mut content: Vec<&str> = vec![kind.label(), site.component.as_str(), body.as_str()];
        content.extend(params.iter().map(String::as_str));
        content.extend(site.capture_kinds.iter().copied());
        for import in &imports {
            content.extend([import.local.as_str(), import.imported.as_str(), import.from.as_str()]);
        }
        digests.push(content_digest(&content));
        let (component, site_scope) = (site.component.clone(), site.scope.clone());
        // Named below; `source` holds the body until then.
        symbols.push(Symbol {
            source: body,
            name: String::new(),
            id: String::new(),
            kind: kind.label(),
            component,
            captures: params,
            labels,
            scope: site_scope,
            imports,
            locals,
            uses: Vec::new(),
            aliases: Vec::new(),
        });
    }
    // Names: `<Component>$<prefix>` with the shortest digest prefix (≥ `HASH_MIN`) unique among the component's other
    // digests — a set rule, independent of source order, so a symbol's id changes only when its own content changes or
    // a new symbol of its component shares its prefix (both then extend; deploy skew stays fail-safe). Identical twins
    // (equal digests) get `_<k>` (k = ordinal among them in source order; twins are interchangeable, so an ordinal
    // swap is harmless).
    let mut twins: FxHashMap<String, usize> = FxHashMap::default();
    for (i, &index) in queue.iter().enumerate() {
        let (component, digest) = (&symbols[i].component, &digests[i]);
        let mut len = HASH_MIN;
        while len < digest.len()
            && (RESERVED_SUFFIXES.contains(&&digest[..len])
                || symbols
                    .iter()
                    .zip(&digests)
                    .any(|(other, d)| other.component == *component && d != digest && d[..len] == digest[..len]))
        {
            len += 1;
        }
        let local = format!("{component}${}", &digest[..len]);
        let twin = twins.entry(local.clone()).or_insert(0);
        let name = if *twin == 0 { local } else { format!("{local}_{twin}") };
        *twin += 1;
        let id = format!("{module}#{name}");
        let site = &mut a.sites[index];
        site.name = name.clone();
        site.id = id.clone();
        let symbol = &mut symbols[i];
        symbol.source = format!("export const {name} = ({}) => {};\n", symbol.captures.join(", "), symbol.source);
        symbol.name = name;
        symbol.id = id;
    }
    // Function Bridge C3: one `() => (g)` symbol per module reference (`refs.rs`), after the closure symbols.
    let mut module_refs = a.module_ref_symbols(module, &mut symbols, &mut scope, diags);
    // DIET-STATE 1c: captured pure-literal component locals hoisted to module scope as module static data.
    let (local_data, local_refs) = a.local_data(module, &queue, &mut symbols, &mut scope);
    module_refs.extend(local_refs);
    // Function Bridge C12 / T24: data class registrations + class symbols + class-field arrow symbols.
    let (class_regs, class_arrows) = a.class_symbols(module, &class_verdicts, &mut symbols, &mut scope);
    // Function Bridge T6 (C5): function declarations register at the top of their statement list (hoisted, thunk captures).
    for site in a.sites.iter_mut() {
        site.hoisted = site.kind == SiteKind::Fn
            && site.closure.is_some_and(|c| tree.decl_kind(c) == DeclKind::FunctionDeclaration && hoist_container(tree, c).is_some());
        // T10: a group with a `const` member registers after that declaration instead.
        if site.group_container.is_some() {
            site.hoisted = site.group_after.is_none();
        }
    }
    let mut group_after: FxHashMap<NodeId, Vec<usize>> = FxHashMap::default();
    let mut group_of = FxHashMap::default();
    for (site, decls) in groups {
        if let Some(statement) = a.sites[site].group_after {
            group_after.entry(statement).or_default().push(site);
        }
        for decl in decls {
            group_of.insert(decl, site);
        }
    }
    let cell_refs = cells.uses.values().flatten().map(|(node, _, text)| (*node, text.clone())).collect();
    // LAZY-ROWS T2: a row (or `by`) site that did not survive pass 2 leaves its For recorded.
    let mut for_rows = std::mem::take(&mut a.for_rows);
    for entry in for_rows.iter_mut() {
        if entry.reason.is_none() && (entry.row.is_none_or(|r| a.map.get(r).is_none()) || entry.by.is_some_and(|b| a.map.get(b).is_none())) {
            entry.reason = Some("row");
        }
    }
    Resumed {
        child_returns: a.child_returns,
        sites: a.sites,
        map: a.map,
        bounds: OnceCell::new(),
        ref_cells,
        symbols,
        scope,
        module_refs,
        cells: cells.decls,
        cell_refs,
        bound,
        group_after,
        group_of,
        store_paths,
        local_data,
        classes: class_regs,
        class_arrows,
        for_rows,
    }
}

/// Global constructors whose instances the resume encoder serializes (`libs/runtime/resume-format.ts` `build`: Date `d`,
/// URL `h`, Map `m`, Set `e`, URLSearchParams `U`, RegExp `t`, binary `b`, errors `E`). Keep in sync with the encoder.
const SERIALIZABLE_BUILTINS: &[&str] = &[
    "Map",
    "Set",
    "Date",
    "URL",
    "URLSearchParams",
    "RegExp",
    "ArrayBuffer",
    "DataView",
    "Int8Array",
    "Uint8Array",
    "Uint8ClampedArray",
    "Int16Array",
    "Uint16Array",
    "Int32Array",
    "Uint32Array",
    "Float16Array",
    "Float32Array",
    "Float64Array",
    "BigInt64Array",
    "BigUint64Array",
    "Error",
    "EvalError",
    "RangeError",
    "ReferenceError",
    "SyntaxError",
    "TypeError",
    "URIError",
    "AggregateError",
];

/// `new X(…)` where `X` is an unshadowed global in `SERIALIZABLE_BUILTINS` (Function Bridge C1): its instance is data.
fn serializable_builtin<'a>(tree: &Tree<'a>, callee: &Expression<'a>) -> bool {
    match callee.without_parentheses() {
        Expression::Identifier(ident) => tree.symbol_of_ref(ident).is_none() && SERIALIZABLE_BUILTINS.contains(&ident.name.as_str()),
        _ => false,
    }
}

/// An identifier / `this` / static member chain of one (`dom_v2.rs` `member_chain`: a spread source read as an object).
fn member_chain(e: &Expression<'_>) -> bool {
    match e {
        Expression::ParenthesizedExpression(p) => member_chain(&p.expression),
        Expression::Identifier(_) | Expression::ThisExpression(_) => true,
        Expression::StaticMemberExpression(m) => member_chain(&m.object),
        _ => false,
    }
}

/// Shortest symbol id hash (base-36 digits); longer only where a component's digests share the prefix.
const HASH_MIN: usize = 3;

/// Id suffixes of non-closure symbols (Function Bridge plan D2: `<local>$ref` module references, `<Class>$class`,
/// `<X>$ctx` context ids): a hash prefix equal to one extends by a digit, so `<Component>$<hash>` never spells them.
const RESERVED_SUFFIXES: &[&str] = &["ref", "ctx", "class"];

/// A symbol's content digest (Function Bridge C2): FNV-1a 64 over `parts` joined by NUL, as its 13 base-36 digits,
/// least significant first (an id uses the shortest unique prefix). Deterministic across targets, runs and machines
/// (no paths, no addresses, no hash-map order).
fn content_digest(parts: &[&str]) -> String {
    let mut h: u64 = 0xcbf2_9ce4_8422_2325;
    for (i, part) in parts.iter().enumerate() {
        if i > 0 {
            // A NUL separator byte (`h ^= 0` is a no-op).
            h = h.wrapping_mul(0x0000_0100_0000_01b3);
        }
        for byte in part.bytes() {
            h ^= u64::from(byte);
            h = h.wrapping_mul(0x0000_0100_0000_01b3);
        }
    }
    const DIGITS: &[u8; 36] = b"0123456789abcdefghijklmnopqrstuvwxyz";
    let mut out = String::with_capacity(13);
    for _ in 0..13 {
        out.push(DIGITS[(h % 36) as usize] as char);
        h /= 36;
    }
    out
}

/// No `this` / `super` / `new.target` / `arguments` / `await` / `yield` anywhere in a Props site's element:
/// its symbol is a module-level function (conservative: nested functions count too).
fn props_portable(tree: &Tree, element: NodeId) -> bool {
    let mut ok = true;
    tree.walk(element, &mut |n| {
        match tree.kind(n) {
            AstKind::ThisExpression(_)
            | AstKind::Super(_)
            | AstKind::MetaProperty(_)
            | AstKind::AwaitExpression(_)
            | AstKind::YieldExpression(_) => ok = false,
            AstKind::IdentifierReference(i) if i.name == "arguments" => ok = false,
            _ => {}
        }
        ok
    });
    ok
}

/// A Props site's symbol text: the element's source with its tag renamed to `__rivetPropsOf` (the browser's
/// DOM lowering then builds exactly the server's live props: getters, `_spreadProps` spreads, lazy slots);
/// `children`: the children between the tags become `{__rivetChildren}` (the server's slot, a parameter).
fn props_text(tree: &Tree, element: NodeId, children: bool) -> String {
    let AstKind::JSXElement(el) = tree.kind(element) else { return tree.text(element).to_string() };
    let base = el.span.start;
    let text = tree.text_of(el.span);
    let at = |pos: u32| (pos - base) as usize;
    let name = el.opening_element.name.span();
    let mut out = String::with_capacity(text.len());
    out.push_str(&text[..at(name.start)]);
    out.push_str("__rivetPropsOf");
    match &el.closing_element {
        None => out.push_str(&text[at(name.end)..]),
        Some(closing) => {
            let closing_name = closing.name.span();
            if children {
                out.push_str(&text[at(name.end)..at(el.opening_element.span.end)]);
                out.push_str("{__rivetChildren}");
                out.push_str(&text[at(closing.span.start)..at(closing_name.start)]);
            } else {
                out.push_str(&text[at(name.end)..at(closing_name.start)]);
            }
            out.push_str("__rivetPropsOf");
            out.push_str(&text[at(closing_name.end)..]);
        }
    }
    out
}

/// Editor view of one resume site (`check` op). Offsets are UTF-16 code units.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SiteInfo {
    pub name: String,
    pub id: String,
    pub kind: &'static str,
    pub component: String,
    /// "client": runs only in the browser on a resumed page; "both": also evaluated during server
    /// rendering (bindings, regions, computeds, local functions), re-run in the browser on change.
    pub runs_on: &'static str,
    pub start: u32,
    pub end: u32,
    /// The attribute name, helper callee or declaration name the site belongs to.
    pub anchor_start: u32,
    pub anchor_end: u32,
    pub captures: Vec<CaptureInfo>,
}

#[derive(Serialize)]
pub struct CaptureInfo {
    pub name: String,
    pub kind: &'static str,
    /// Binding identifier of the captured declaration.
    pub start: u32,
    pub end: u32,
}

/// Symbol sites (source order) and ref sites, for editors.
pub fn site_infos(tree: &Tree, resumed: &Resumed) -> Vec<SiteInfo> {
    let index = crate::diagnostics::Utf16Index::new(tree.src);
    let utf16 = |pos: u32| index.offset(pos);
    let mut out = Vec::new();
    for (index, site) in resumed.sites.iter().enumerate() {
        let (closure, anchor) = if let Some((attr, callback)) = site.ref_callback {
            if resumed.map.get(attr) != Some(index) {
                continue;
            }
            (callback, Some(attr))
        } else if site.name.is_empty() {
            continue;
        } else {
            let Some(closure) = site.closure else { continue };
            (closure, site.attr.or(site.call).or(if site.kind == SiteKind::Fn { site.declaration } else { None }))
        };
        let anchor_span = match anchor.map(|a| tree.kind(a)) {
            Some(AstKind::JSXAttribute(a)) => a.name.span(),
            Some(AstKind::CallExpression(c)) => c.callee.span(),
            Some(AstKind::VariableDeclarator(d)) => d.id.span(),
            Some(AstKind::Function(f)) => f.id.as_ref().map_or(f.span, |id| id.span),
            _ => tree.span(closure),
        };
        let span = tree.span(closure);
        let captures = site
            .captures
            .iter()
            .zip(&site.capture_spans)
            .zip(&site.capture_kinds)
            .map(|((name, span), kind)| CaptureInfo { name: name.clone(), kind, start: utf16(span.start), end: utf16(span.end) })
            .collect();
        out.push(SiteInfo {
            name: site.name.clone(),
            id: site.id.clone(),
            kind: site.kind.label(),
            component: site.component.clone(),
            // Handlers, effects, client events and refs never run during server rendering.
            runs_on: if matches!(site.kind, SiteKind::Event | SiteKind::Effect | SiteKind::ClientEvent | SiteKind::Ref | SiteKind::Model | SiteKind::Element) {
                "client"
            } else {
                "both"
            },
            start: utf16(tree.start(closure).max(span.start)),
            end: utf16(span.end),
            anchor_start: utf16(anchor_span.start),
            anchor_end: utf16(anchor_span.end),
            captures,
        });
    }
    out.sort_by_key(|s| s.start);
    out
}

/// Browser globals read during server component evaluation (outside resumable closures).
pub fn browser_global_reads(tree: &Tree, resumed: &Resumed, diags: &mut Diags) {
    // Render regions run on the server too; only browser-only closures are exempt.
    let mut closures: FxHashSet<NodeId> = FxHashSet::default();
    for (_, index) in resumed.map.iter() {
        let site = &resumed.sites[index];
        if !site.kind.render() {
            if let Some(closure) = site.closure {
                closures.insert(closure);
            }
        }
    }
    // clientEvent targets name window/document by design; they are recorded, not read.
    for (_, index) in resumed.map.iter() {
        let site = &resumed.sites[index];
        if site.kind != SiteKind::ClientEvent {
            continue;
        }
        let Some(call) = site.call else { continue };
        if let AstKind::CallExpression(c) = tree.kind(call) {
            if let Some(first) = c.arguments.first() {
                let id = match first {
                    Argument::SpreadElement(s) => tree.id_of(&**s),
                    _ => first.as_expression().and_then(|e| tree.expr_id(e)),
                };
                if let Some(id) = id {
                    closures.insert(id);
                }
            }
        }
    }
    let mut stack = vec![(tree.root(), false)];
    while let Some((n, in_function)) = stack.pop() {
        if closures.contains(&n) {
            continue;
        }
        if in_function {
            if let AstKind::IdentifierReference(ident) = tree.kind(n) {
                let typeof_operand = matches!(tree.parent_kind(n), Some(AstKind::UnaryExpression(u)) if u.operator == UnaryOperator::Typeof && u.argument.span() == ident.span);
                if BROWSER_GLOBALS.contains(&ident.name.as_str())
                    && !tree.in_type_name(n)
                    && !typeof_operand
                    && !shorthand_or_export_name(tree, n)
                    && tree.resolve(ident, false).is_none()
                {
                    diags.add(
                        format!(
                            "Browser global `{}` is read during server rendering; move it into a handler, clientEffect or clientEvent",
                            ident.name
                        ),
                        Some(n),
                    );
                }
            }
        }
        for &child in tree.children(n).iter().rev() {
            stack.push((child, in_function || is_function(tree, child)));
        }
    }
}

/// TypeScript resolves these names to property/export symbols that have declarations.
fn shorthand_or_export_name(tree: &Tree, id: NodeId) -> bool {
    matches!(tree.parent_kind(id), Some(AstKind::ObjectProperty(p)) if p.shorthand)
        || matches!(tree.parent_kind(id), Some(AstKind::ExportSpecifier(_)))
}

