//! Lower JSX/TSX into hoisted HTML fragments and ordered server slots (server target) or template
//! specs with binding setup (DOM target); diagnostics suppress output.
//!
//! Source text is rewritten in place: every replaced node (JSX, structural helper calls, resume
//! sites, twins) is spliced into the original text, then TypeScript syntax is
//! stripped by oxc. Traversal order mirrors the TypeScript transformer so diagnostics and
//! generated names come out in the same order.

use oxc_allocator::Allocator;
use oxc_ast::{AstKind, ast::*};
use oxc_parser::{ParseOptions, Parser};
use oxc_semantic::{NodeId, SemanticBuilder};
use oxc_span::{GetSpan, Span};
use rustc_hash::{FxHashMap, FxHashSet};
use std::collections::BTreeMap;
use std::rc::Rc;

use crate::entities::decode_html;
use crate::html::{AttrValue, attribute_namespace, encode_attribute};
use crate::i18n::{self, Part, Usage};
use crate::ir::{Expr, Key, quote};
use crate::resume;
use crate::map;
use crate::slots;
use crate::events_data::EVENTS;
use crate::strip::strip_types;
use crate::styles;
use crate::styling;
use crate::tree::Tree;

mod dom_v2;
// exception: lane V2-Q4 (2026-10-07) — bind-once handlers (RV1016).
mod handlers;
mod lazy_binds;
// exception: lane IMPL-RESUME (2026-10-09) — server target: a bare router `<Link>` child is native `<a>` markup.
mod server_link;
// exception: derived model (M2 C2 / C3, 2026-10-20) — server + DOM target boundary / keyed-state lowering.
mod derived;
// ZERO C1 (2026-10-25): lite residuals `<Name>$a` on the derived DOM target.
mod derived_lite;
// ZERO REGRESS (2026-10-26): independent boundaries' rendered-only props read back from the markup (`_rB` `read`).
mod derived_read;
use derived::{Derived, is_function_child};

pub const TARGET_HELPERS: &[&str] = &["Provider", "For", "Async", "lazyComponent", "clientOnly"];
const SVG_TAGS: &[&str] = &[
    "circle", "ellipse", "g", "line", "path", "polygon", "polyline", "rect", "text", "tspan", "defs", "symbol", "use",
    "marker", "mask", "pattern", "clipPath", "linearGradient", "radialGradient", "stop", "foreignObject", "filter",
    "feGaussianBlur",
];
const MATH_TAGS: &[&str] = &[
    "mi", "mn", "mo", "ms", "mtext", "mrow", "mfrac", "msqrt", "mroot", "msub", "msup", "msubsup", "munder", "mover",
    "munderover", "mtable", "mtr", "mtd",
];
const VOID_TAGS: &[&str] =
    &["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"];
const PRELOAD_STRATEGIES: &[&str] = &["eager", "idle", "visible", "intent", "interaction"];
/// Runtime ABI names besides the template callee: server `omitted` / spreads, DOM
/// `clientEvent` (`window:` / `document:` events); the DOM lowering's own names are `dom_v2::V2_ABI`.
const ABI: &[&str] = &["omitted", "clientEvent", "spreadAttributes", "spreadChildren"];
// exception: user ruling 2026-10-06 (round-2 C5) — RV1005 for statically visible rows directly in <table>.
const IMPLIED_TBODY: &str =
    "Unsupported parser-repaired native nesting: rows directly in <table> get an implied <tbody> (wrap the For / Show / .map in <tbody>)";
/// HTML elements whose content the browser parses as text (or into an inert template fragment): resume
/// markers written inside are never comment nodes the resumed page can see.
const OPAQUE_CONTENT: &[&str] = &["textarea", "title", "noscript", "template", "iframe", "noembed", "noframes", "xmp", "plaintext"];

pub struct Options {
    pub target: String,
    pub filename: String,
    pub server_list_mounts: bool,
    /// `resume.module` (defaults to the filename) when resume is on (the derived model: `compile/derived.rs`).
    pub resume: Option<String>,
    /// Return a source map (`Output::map`) of the emitted code to `source`.
    pub source_map: bool,
    /// Declarative static-call hook (i18n): calls of `export` imported from `module` resolve from a
    /// registered table at compile time.
    pub static_calls: Vec<StaticCall>,
    /// Variant names (locales); server output carries every variant, DOM output `variant` only.
    pub variants: Vec<String>,
    pub variant: Option<usize>,
    /// Time zone for date formatting in generated message code.
    pub time_zone: Option<String>,
    /// Dev build: missing prefixed keys warn at runtime.
    pub dev: bool,
    /// css`` blocks (`css` imported from `@rivetjs/runtime/css`); `None` leaves them untouched.
    pub styles: Option<Styles>,
    /// Editor check: analysis and JSX lowering only (no rendering, type stripping or code); the
    /// output carries diagnostics and resume sites (`check` `sites`), even when there are diagnostics.
    pub check: bool,
    /// Resume: `@rivetjs/*` packages compiled like application code (source packages): their components count as
    /// local components in the resume analysis.
    pub source_packages: Vec<String>,
    /// Resume (derived model, M2 C2): the build's verdicts (`resume.boundaries` / `resume.independent`). Both targets
    /// lower plain plus boundary / keyed-state calls from one plan (`compile/derived.rs`: server `_rB` / `_rSig`; DOM
    /// `_b` / `_sig`). Read only when `resume` is set.
    pub verdicts: resume::derived::Verdicts,
}

/// Scoped styles options: class names hash `scope` (root-relative module id) with the local name.
#[derive(Clone)]
pub struct Styles {
    pub scope: String,
    pub names: styles::Names,
    pub layer: Option<String>,
}

/// Extracted css`` output: module CSS and class maps per binding (source order).
pub struct StylesOutput {
    pub css: String,
    pub classes: Vec<(String, Vec<(String, String)>)>,
}

#[derive(Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StaticCall {
    pub id: String,
    pub module: String,
    pub export: String,
    /// Allow `` t(`prefix.${x}`) ``: a per-variant lookup over the keys under the prefix.
    #[serde(default)]
    pub prefix_lookup: bool,
}

/// Elements a message tag may render without a mapping param.
const MESSAGE_TAGS: &[&str] = &["b", "i", "em", "strong", "code", "br", "small"];

/// A `t()` call matched through a static-call import binding.
enum Matched<'a> {
    Key(String),
    Prefix(String, &'a Expression<'a>),
    In(&'a Expression<'a>, String),
}

/// A validated message call: per-variant parts and its params in source order.
struct Message<'a> {
    key: String,
    /// Parts per variant index; `texts` when every variant is plain text.
    variants: Vec<Vec<Part>>,
    texts: Option<Vec<String>>,
    /// Value params (name, expression) in source order; tag params are compiled away.
    params: Vec<(String, &'a Expression<'a>)>,
    usage: BTreeMap<String, Usage>,
    /// Tag name → (opening HTML, closing HTML) around the tag's children.
    tags: FxHashMap<String, (String, String)>,
}

#[derive(Clone, Debug)]
pub struct Diagnostic {
    pub message: String,
    pub filename: String,
    pub line: Option<u32>,
    pub column: Option<u32>,
    /// Byte range of the reported node (or the parser's label); `check` only, never in `compile` output.
    pub span: Option<(u32, u32)>,
    /// Code override (`check` only); otherwise classified from the message.
    pub code: Option<&'static str>,
    /// T10 fix 2: a warning (`Diags::warn`): reported (`compile` `warnings`, `check` severity), never suppresses output.
    pub warning: bool,
}

pub struct Output {
    pub code: String,
    pub diagnostics: Vec<Diagnostic>,
    /// Source map v3 JSON when `Options::source_map` is set.
    pub map: Option<String>,
    /// css`` blocks of the module (styles option on and at least one block).
    pub css: Option<StylesOutput>,
    /// `Options::check`: resume sites (empty without resume).
    pub sites: Vec<resume::SiteInfo>,
    /// Resume: the module's boundary names (`<module>#<Name>`, source order), the
    /// keys of the build manifest's `symbols` (`compile` JSON `boundaries`).
    pub boundaries: Vec<String>,
    /// ZERO C1 (derived DOM target): the module's lite residual entry (`<Name>$a` / `<Name>$c` exports against
    /// `@rivetjs/runtime/dom-lite`; never imports this module statically) and the boundary names it covers.
    pub lite: Option<(String, Vec<String>)>,
    /// B1 census: boundary name → why no residual (derived DOM target).
    pub lite_because: Vec<(String, String)>,
}

pub struct Diags<'t, 'a> {
    pub tree: Option<&'t Tree<'a>>,
    pub filename: String,
    pub list: Vec<Diagnostic>,
}

impl Diags<'_, '_> {
    pub fn add(&mut self, message: impl Into<String>, node: Option<NodeId>) {
        let span = match (node, self.tree) {
            (Some(node), Some(tree)) => Some((tree.start(node), tree.span(node).end)),
            _ => None,
        };
        let position = match (span, self.tree) {
            (Some((start, _)), Some(tree)) => Some(tree.line_col(start)),
            _ => None,
        };
        self.list.push(Diagnostic {
            message: message.into(),
            filename: self.filename.clone(),
            line: position.map(|p| p.0),
            column: position.map(|p| p.1),
            span,
            code: None,
            warning: false,
        });
    }

    /// T10 fix 2: a warning — reported once per (message, node), never suppresses the module's code.
    pub fn warn(&mut self, message: impl Into<String>, node: Option<NodeId>) {
        let message = message.into();
        let span = match (node, self.tree) {
            (Some(node), Some(tree)) => Some((tree.start(node), tree.span(node).end)),
            _ => None,
        };
        if self.list.iter().any(|d| d.warning && d.span == span && d.message == message) {
            return;
        }
        self.add(message, node);
        if let Some(last) = self.list.last_mut() {
            last.warning = true;
        }
    }

    /// Any diagnostic other than a warning (those empty the module's code).
    pub fn has_errors(&self) -> bool {
        self.list.iter().any(|d| !d.warning)
    }

    /// A parse error: line/column (UTF-16, 1-based) of the parser's label, its byte range and code
    /// RV1000 for `check`.
    pub fn add_parse_error(&mut self, message: impl Into<String>, span: Option<(u32, u32)>, source: &str) {
        self.add(message, None);
        if let Some(last) = self.list.last_mut() {
            if let Some((start, _)) = span {
                let pos = (start as usize).min(source.len());
                let pos = (0..=pos).rev().find(|&p| source.is_char_boundary(p)).unwrap_or(0);
                let line_start = source[..pos].rfind('\n').map_or(0, |i| i + 1);
                let line = source[..line_start].matches('\n').count() as u32 + 1;
                last.line = Some(line);
                last.column = Some(source[line_start..pos].encode_utf16().count() as u32 + 1);
            }
            last.span = span;
            last.code = Some("RV1000");
        }
    }
}

/// `window:onX` / `document:onX`: None = not a global event attribute, Some(None) = malformed.
pub fn global_event(name: &str) -> Option<Option<(&'static str, String)>> {
    let (target, rest) = if let Some(rest) = name.strip_prefix("window:") {
        ("window", rest)
    } else if let Some(rest) = name.strip_prefix("document:") {
        ("document", rest)
    } else {
        return None;
    };
    let event = rest.strip_prefix("on").filter(|e| {
        let mut chars = e.chars();
        matches!(chars.next(), Some(c) if c.is_ascii_uppercase()) && chars.all(|c| c.is_ascii_alphabetic())
    });
    Some(event.map(|e| (target, e.to_lowercase())))
}

/// `onClick` → ("click", capture); `on:my-event` → ("my-event", false) (custom events, any case,
/// never capture). None for unknown events.
pub fn event_info(name: &str) -> Option<(String, bool)> {
    if let Some(custom) = name.strip_prefix("on:") {
        let valid = !custom.is_empty() && custom.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_');
        return valid.then(|| (custom.to_string(), false));
    }
    let capture = name.ends_with("Capture");
    let end = if capture { name.len().saturating_sub(7) } else { name.len() };
    let base = name.get(2..end.max(2)).unwrap_or("");
    let index = EVENTS.binary_search_by(|(name, _)| name.cmp(&base)).ok()?;
    Some((EVENTS[index].1.to_string(), capture))
}

pub fn starts_with_on(name: &str) -> bool {
    name.get(..2).is_some_and(|prefix| prefix.eq_ignore_ascii_case("on"))
}

pub(crate) fn jsx_text(raw: &str) -> String {
    let cleaned = raw.replace('\r', "");
    let lines: Vec<&str> = cleaned.split('\n').collect();
    let last = lines.len() - 1;
    let mut parts: Vec<String> = Vec::new();
    for (i, line) in lines.iter().enumerate() {
        let mut line = line.replace('\t', " ");
        if i > 0 {
            line = line.trim_start_matches(' ').to_string();
        }
        if i < last {
            line = line.trim_end_matches(' ').to_string();
        }
        if !line.is_empty() {
            parts.push(line);
        }
    }
    decode_html(&parts.join(" "))
}

fn escaped(value: &str) -> String {
    value.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;")
}

fn native_tag_name(tag: &str) -> bool {
    let mut chars = tag.chars();
    matches!(chars.next(), Some(c) if c.is_ascii_lowercase())
        && chars.all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

fn safe_attribute_name(name: &str) -> bool {
    let mut chars = name.chars();
    let shape = matches!(chars.next(), Some(c) if c.is_ascii_alphabetic() || c == '_')
        && chars.all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | ':' | '.' | '-'));
    let lower = name.to_lowercase();
    shape
        && !(lower.len() >= 12 && lower.starts_with("data-rivet-s"))
        && !["dangerouslysetinnerhtml", "innerhtml", "srcdoc", "style"].contains(&lower.as_str())
}

/// `prop:name`: an element property set in the browser (identifier names; never markup, style,
/// handler or prototype properties).
pub fn prop_name(name: &str) -> Option<&str> {
    let prop = name.strip_prefix("prop:")?;
    let mut chars = prop.chars();
    let shape = matches!(chars.next(), Some(c) if c.is_ascii_alphabetic() || c == '_' || c == '$')
        && chars.all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '$');
    let lower = prop.to_ascii_lowercase();
    (shape
        && !lower.starts_with("on")
        && !["innerhtml", "outerhtml", "srcdoc", "style", "__proto__", "constructor", "prototype"].contains(&lower.as_str()))
    .then_some(prop)
}

fn is_js_filename(filename: &str) -> bool {
    [".js", ".jsx", ".mjs", ".cjs"].iter().any(|ext| filename.ends_with(ext))
}

/// A conditional / logical child expression mixing JSX and non-JSX branches (`c() ? <a/> : null`,
/// `c() && <a/>`): its value may be primitive at SSR and JSX later. All-JSX or JSX-free: not one.
fn may_render_jsx(e: &Expression<'_>) -> bool {
    fn leaves(e: &Expression<'_>, out: &mut (bool, bool)) {
        match e {
            Expression::JSXElement(_) | Expression::JSXFragment(_) => out.0 = true,
            Expression::ConditionalExpression(c) => {
                leaves(&c.consequent, out);
                leaves(&c.alternate, out);
            }
            Expression::LogicalExpression(l) => {
                leaves(&l.left, out);
                leaves(&l.right, out);
            }
            Expression::ParenthesizedExpression(p) => leaves(&p.expression, out),
            Expression::SequenceExpression(s) => match s.expressions.last() {
                Some(last) => leaves(last, out),
                None => out.1 = true,
            },
            Expression::TSAsExpression(t) => leaves(&t.expression, out),
            Expression::TSSatisfiesExpression(t) => leaves(&t.expression, out),
            Expression::TSNonNullExpression(t) => leaves(&t.expression, out),
            _ => out.1 = true,
        }
    }
    let mut found = (false, false);
    leaves(e, &mut found);
    found == (true, true)
}

/// Peel parentheses (TypeScript `strip`).
fn strip_parens<'b, 'a>(mut e: &'b Expression<'a>) -> &'b Expression<'a> {
    while let Expression::ParenthesizedExpression(p) = e {
        e = &p.expression;
    }
    e
}

/// ZERO A2 (C4b): an expression child whose rendered text is known at compile time, folded into the template text on
/// BOTH targets (same rule, so server markup and the DOM template agree): a string literal, an expression-free template,
/// an integer literal of at most 15 decimal digits (its `String(n)` is its source text), `true` / `false` / `null`
/// (render nothing).
pub(crate) fn literal_child(tree: &Tree<'_>, e: &Expression<'_>) -> Option<String> {
    match strip_parens(e) {
        Expression::StringLiteral(s) => Some(s.value.to_string()),
        Expression::TemplateLiteral(t) if t.expressions.is_empty() => t.quasis.first().and_then(|q| q.value.cooked.as_ref()).map(|c| c.to_string()),
        Expression::NumericLiteral(n) => {
            let text = tree.text_of(n.span);
            (text.len() <= 15 && text.chars().all(|c| c.is_ascii_digit()) && (text == "0" || !text.starts_with('0'))).then(|| text.to_string())
        }
        Expression::BooleanLiteral(_) | Expression::NullLiteral(_) => Some(String::new()),
        _ => None,
    }
}

fn as_element<'b, 'a>(e: &'b Expression<'a>) -> Option<&'b JSXElement<'a>> {
    match e {
        Expression::JSXElement(el) => Some(el),
        _ => None,
    }
}

#[derive(Clone, Copy)]
pub enum Jsx<'a> {
    Element(&'a JSXElement<'a>),
    Fragment(&'a JSXFragment<'a>),
}

pub fn is_native(tree: &Tree, el: &JSXElement) -> bool {
    matches!(el.opening_element.name, JSXElementName::Identifier(_) | JSXElementName::IdentifierReference(_))
        && tree.text_of(el.opening_element.name.span()).starts_with(|c: char| c.is_ascii_lowercase())
}

pub fn attr_name<'a>(tree: &Tree<'a>, attr: &JSXAttribute<'a>) -> &'a str {
    tree.text_of(attr.name.span())
}

fn string_inner<'a>(tree: &Tree<'a>, s: &StringLiteral<'a>) -> &'a str {
    let span = s.span;
    if span.end > span.start + 1 { tree.text_of(Span::new(span.start + 1, span.end - 1)) } else { "" }
}

/// ref-spread-dedupe (LIVE-PROPS P4): an explicit `ref={…}` after the element's last `{...spread}`.
pub fn ref_after_spread<'a>(tree: &Tree<'a>, el: &JSXElement<'a>) -> bool {
    let attributes = &el.opening_element.attributes;
    let Some(last) = attributes.iter().rposition(|a| matches!(a, JSXAttributeItem::SpreadAttribute(_))) else { return false };
    attributes.iter().skip(last + 1).any(|a| matches!(a, JSXAttributeItem::Attribute(attr) if attr.value.is_some() && attr_name(tree, attr) == "ref"))
}

/// Raw JSX attribute string (TypeScript keeps JSX attribute strings unescaped).
/// A native element whose spread `children` key renders as its content (React semantics): it has a
/// `{...x}` and no explicit JSX children (whitespace-only text and `{/* */}` are none). Void and
/// rcdata (`textarea`, `title`) elements take no spread content.
pub fn spread_content<'a>(tree: &Tree<'a>, el: &JSXElement<'a>, tag: &str) -> bool {
    el.opening_element.attributes.iter().any(|a| matches!(a, JSXAttributeItem::SpreadAttribute(_)))
        && !VOID_TAGS.contains(&tag)
        && tag != "textarea"
        && tag != "title"
        && el.children.iter().all(|c| match c {
            JSXChild::Text(text) => jsx_text(tree.text_of(text.span)).is_empty(),
            JSXChild::ExpressionContainer(c) => c.expression.as_expression().is_none(),
            _ => false,
        })
}

pub fn attr_string<'a>(tree: &Tree<'a>, attr: &JSXAttribute<'a>) -> Option<&'a str> {
    match &attr.value {
        Some(JSXAttributeValue::StringLiteral(s)) => Some(string_inner(tree, s)),
        _ => None,
    }
}

struct Twin {
    tape: String,
    plan: String,
    keys: Option<Vec<String>>,
}

enum Step {
    Value { value: Expr, offset: usize },
    Child { child: NodeId, props: Vec<(Key, Expr)>, offset: usize },
}

struct Split {
    steps: Vec<Step>,
    size: usize,
    deps: Vec<String>,
    plan: Expr,
}

struct Plan {
    name: String,
    deps: Vec<String>,
    value: Expr,
}

/// Statements built by plan stores.
enum Stmt {
    Expr(Expr),
    Const(Vec<(String, Expr)>),
}

impl Stmt {
    fn print(&self) -> String {
        match self {
            Stmt::Expr(e) => e.print() + ";",
            Stmt::Const(decls) => {
                let list: Vec<String> = decls
                    .iter()
                    .map(|(name, value)| format!("{name} = {}", Expr::Array(vec![value.clone()]).print_single()))
                    .collect();
                format!("const {};", list.join(", "))
            }
        }
    }
}

impl Expr {
    /// Operand-printed single expression (strip the array brackets used to reuse operand rules).
    fn print_single(&self) -> String {
        let text = self.print();
        text[1..text.len() - 1].to_string()
    }
}

struct MapSite<'a> {
    call: &'a CallExpression<'a>,
    callback: &'a ArrowFunctionExpression<'a>,
    body: &'a JSXElement<'a>,
    tag: Option<&'a IdentifierReference<'a>>,
    component: Option<NodeId>,
}

struct ServerTemplate {
    /// Fragments and slot write order per variant: one entry unless the module translates messages.
    sets: Vec<(Vec<String>, Vec<usize>)>,
    slots: Vec<Expr>,
    model_temps: Vec<String>,
}

impl ServerTemplate {
    fn new(variants: usize) -> Self {
        Self { sets: vec![(vec![String::new()], Vec::new()); variants.max(1)], slots: Vec::new(), model_temps: Vec::new() }
    }
    fn append(&mut self, text: &str) {
        for (fragments, _) in &mut self.sets {
            if let Some(last) = fragments.last_mut() {
                last.push_str(text);
            }
        }
    }
    fn append_variant(&mut self, variant: usize, text: &str) {
        if let Some(last) = self.sets[variant].0.last_mut() {
            last.push_str(text);
        }
    }
    fn slot(&mut self, value: Expr) {
        let slot = self.add_slot(value);
        for variant in 0..self.sets.len() {
            self.emit_slot(variant, slot);
        }
    }
    /// Evaluated in slot order; written only where a variant emits it.
    fn add_slot(&mut self, value: Expr) -> usize {
        self.slots.push(value);
        self.slots.len() - 1
    }
    fn emit_slot(&mut self, variant: usize, slot: usize) {
        let (fragments, order) = &mut self.sets[variant];
        order.push(slot);
        fragments.push(String::new());
    }
    fn source_order(&self) -> bool {
        self.sets.iter().all(|(_, order)| order.len() == self.slots.len() && order.iter().enumerate().all(|(k, &i)| k == i))
    }
    /// Every variant writes the same fragments in slot order: a plain compiled template.
    fn plain(&self) -> bool {
        self.source_order() && self.sets.windows(2).all(|w| w[0].0 == w[1].0)
    }
}

pub struct Compiler<'t, 'a> {
    tree: &'t Tree<'a>,
    server: bool,
    /// Derived model, server target (M2 C2): the plan + ABI locals (`compile/derived.rs`).
    derived: Option<Derived>,
    target: &'static str,
    list_mounts: bool,
    has_checker: bool,
    diags: Diags<'t, 'a>,
    names: FxHashSet<String>,
    // exception: user ruling 2026-10-06 (round-2 compile speed) — last name `unique` returned per base.
    unique_last: FxHashMap<String, String>,
    // exception: user ruling 2026-10-06 (round-2 C6) — native ancestors of the server element being walked.
    server_ancestors: Vec<&'a str>,
    hoists: Vec<String>,
    structural: FxHashMap<NodeId, &'static str>,
    structural_namespaces: FxHashSet<NodeId>,
    /// Import bindings from `@rivetjs/runtime/{dom,server}` whose plain JSX children are thunked:
    /// `ErrorBoundary` / `Suspense` always (`Show` / `Match` / `Switch` are recorded for their eager rules).
    thunked: FxHashMap<NodeId, &'static str>,
    template_name: String,
    attribute_name: String,
    abi: Vec<(&'static str, String)>,
    used_abi: FxHashSet<&'static str>,
    /// `Options::check`, resume: the resume sites (`compile/derived.rs` `derived_setup`).
    sites: Vec<resume::SiteInfo>,
    twins: FxHashMap<NodeId, Twin>,
    twin_order: Vec<NodeId>,
    /// Shell cache H-holes (PPR-T6, `crate::holes`): source offsets of eligible `<Async>` elements (server resume target:
    /// `$hole: 1` prop).
    holes: FxHashSet<u32>,
    edges: FxHashMap<NodeId, Vec<NodeId>>,
    widths: FxHashMap<NodeId, usize>,
    list_name: String,
    list_plan_name: String,
    list_used: bool,
    plans: Vec<Plan>,
    reps: Vec<Vec<(Span, Expr)>>,
    /// Source maps: `render` marks copied source chunks and replacements (see `map`).
    mapping: bool,
    static_calls: Vec<StaticCall>,
    /// Import specifier → index into `static_calls`.
    static_bindings: FxHashMap<NodeId, usize>,
    static_decls: FxHashSet<NodeId>,
    static_tables: Vec<Option<Rc<i18n::Table>>>,
    variants: Vec<String>,
    variant: Option<usize>,
    time_zone: Option<String>,
    dev: bool,
    v2_names: Vec<(&'static str, String)>,
    used_v2: FxHashSet<&'static str>,
    v2_vars: usize,
    /// The module calls a static-call binding: templates carry one fragment set per variant.
    i18n: bool,
    /// Lazily allocated helper locals: (module, export, local).
    i18n_imports: Vec<(String, &'static str, String)>,
    /// B1 census (ZERO C1): boundary → why it has no lite residual (`Output.lite_because`).
    lite_because: Vec<(String, String)>,
    /// G10 helpers imported from `@rivetjs/runtime/style` (export, local), first use order.
    style_imports: Vec<(&'static str, String)>,
    /// Local name of `_slot` (`@rivetjs/runtime/slot`) once lazy children brand a thunk.
    slot_import: Option<String>,
    /// `@rivetjs/runtime/props` helpers (export, local), first use order: `_spreadProps` once a component element
    /// spreads (LIVE-PROPS), `_p` / `_pg` once a live props object has a getter (props-layout).
    props_imports: Vec<(&'static str, String)>,
    /// Hoisted live props factories (props-layout) by key layout: one `const __rivetPropsN = (e, …) => …` per layout.
    props_factories: FxHashMap<String, String>,
    /// Parameter name of the live props env dispatchers (`($rivetKey) => …`), allocated once per module.
    props_key: Option<String>,
    /// Hoisted prefix-lookup tables by prefix.
    prefix_tables: FxHashMap<String, String>,
    styles: Option<Styles>,
    /// `css` import specifiers (from `@rivetjs/runtime/css`).
    css_tags: FxHashSet<NodeId>,
    /// css`` declarator → class map.
    css_blocks: FxHashMap<NodeId, Rc<Vec<(String, String)>>>,
    /// css`` tagged template → frozen class-map literal.
    css_tagged: FxHashMap<NodeId, String>,
    css_out: Vec<String>,
    css_classes: Vec<(String, Vec<(String, String)>)>,
    /// `r:slot` usage elements being lowered as slot content of their component parent.
    slot_children: FxHashSet<NodeId>,
    /// Server: value temps of the enclosing `<select value>`/`model:value` (None: a select without one).
    select_stack: Vec<Option<String>>,
    /// Server: the hoisted option-match helper, once used.
    select_helper: Option<String>,
}

pub fn compile(source: &str, options: Options) -> Output {
    let list_mounts = options.server_list_mounts;
    let filename = options.filename.clone();
    let mut early = Diags { tree: None, filename: filename.clone(), list: Vec::new() };
    let target: &'static str = match options.target.as_str() {
        "server" => "server",
        "dom" => "dom",
        _ => {
            early.add("Unknown compilation target", None);
            return Output { code: String::new(), diagnostics: early.list, map: None, sites: Vec::new(), css: None, boundaries: Vec::new(), lite: None, lite_because: Vec::new() };
        }
    };
    let allocator = Allocator::default();
    // exception: user ruling 2026-10-06 (round-2 T7) — `.ts` parses without JSX (`<T>expr` casts), `.js`/`.jsx` without type syntax.
    let parsed = Parser::new(&allocator, source, crate::source_type::of(&filename))
        .with_options(ParseOptions { preserve_parens: true, ..ParseOptions::default() })
        .parse();
    for error in &parsed.errors {
        let label = error.labels.as_ref().and_then(|labels| labels.first());
        let span = label.map(|l| (l.offset() as u32, (l.offset() + l.len()) as u32));
        early.add_parse_error(error.message.to_string(), span, source);
    }
    if parsed.panicked {
        return Output { code: String::new(), diagnostics: early.list, map: None, sites: Vec::new(), css: None, boundaries: Vec::new(), lite: None, lite_because: Vec::new() };
    }
    let program = allocator.alloc(parsed.program);
    let semantic = SemanticBuilder::new().with_check_syntax_error(false).build(program).semantic;
    let tree = Tree::new(source, program, semantic);
    let mut diags = Diags { tree: Some(&tree), filename: filename.clone(), list: early.list };
    let compiler = Compiler {
        tree: &tree,
        server: target == "server",
        derived: None,
        target,
        list_mounts,
        has_checker: false,
        diags: Diags { tree: Some(&tree), filename: filename.clone(), list: std::mem::take(&mut diags.list) },
        names: FxHashSet::default(),
        unique_last: FxHashMap::default(),
        server_ancestors: Vec::new(),
        hoists: Vec::new(),
        structural: FxHashMap::default(),
        structural_namespaces: FxHashSet::default(),
        thunked: FxHashMap::default(),
        template_name: String::new(),
        attribute_name: String::new(),
        abi: Vec::new(),
        used_abi: FxHashSet::default(),
        sites: Vec::new(),
        twins: FxHashMap::default(),
        twin_order: Vec::new(),
        holes: if target == "server" && options.resume.is_some() { crate::holes::eligible(&tree) } else { FxHashSet::default() },
        edges: FxHashMap::default(),
        widths: FxHashMap::default(),
        list_name: String::new(),
        list_plan_name: String::new(),
        list_used: false,
        plans: Vec::new(),
        reps: Vec::new(),
        // Sources that already contain the mark character compile without a map.
        mapping: options.source_map && !source.contains(map::MARK),
        static_tables: options.static_calls.iter().map(|c| i18n::table(&c.id)).collect(),
        static_calls: options.static_calls.clone(),
        static_bindings: FxHashMap::default(),
        static_decls: FxHashSet::default(),
        variants: options.variants.clone(),
        variant: options.variant,
        time_zone: options.time_zone.clone(),
        dev: options.dev,
        v2_names: Vec::new(),
        used_v2: FxHashSet::default(),
        v2_vars: 0,
        i18n: false,
        i18n_imports: Vec::new(),
        lite_because: Vec::new(),
        style_imports: Vec::new(),
        slot_import: None,
        props_imports: Vec::new(),
        props_factories: FxHashMap::default(),
        props_key: None,
        prefix_tables: FxHashMap::default(),
        styles: options.styles.clone(),
        css_tags: FxHashSet::default(),
        css_blocks: FxHashMap::default(),
        css_tagged: FxHashMap::default(),
        css_out: Vec::new(),
        css_classes: Vec::new(),
        slot_children: FxHashSet::default(),
        select_stack: Vec::new(),
        select_helper: None,
    };
    compiler.run(source, &options, &filename)
}

impl<'t, 'a> Compiler<'t, 'a> {
    fn diag(&mut self, message: impl Into<String>, node: Option<NodeId>) {
        self.diags.add(message, node);
    }

    fn unique(&mut self, base: &str) -> String {
        // exception: user ruling 2026-10-06 (round-2 compile speed) — resume the `_` probe after the name last
        // returned for `base`: every shorter candidate is taken and `names` only grows, so the result is unchanged.
        let mut name = match self.unique_last.get(base) {
            Some(last) => format!("{last}_"),
            None => base.to_string(),
        };
        while self.names.contains(&name) {
            name.push('_');
        }
        self.names.insert(name.clone());
        self.unique_last.insert(base.to_string(), name.clone());
        name
    }

    fn abi_name(&self, name: &str) -> String {
        self.abi.iter().find(|(n, _)| *n == name).map(|(_, local)| local.clone()).unwrap_or_default()
    }

    fn id<T>(&self, node: &T) -> Option<NodeId> {
        self.tree.id_of(node)
    }

    fn run(mut self, source: &str, options: &Options, filename: &str) -> Output {
        let tree = self.tree;
        let program = tree.program;
        let root = tree.root();
        tree.walk(root, &mut |id| {
            match tree.kind(id) {
                AstKind::IdentifierName(n) => {
                    self.names.insert(n.name.to_string());
                }
                AstKind::IdentifierReference(n) => {
                    self.names.insert(n.name.to_string());
                }
                AstKind::BindingIdentifier(n) => {
                    self.names.insert(n.name.to_string());
                }
                AstKind::LabelIdentifier(n) => {
                    self.names.insert(n.name.to_string());
                }
                AstKind::JSXIdentifier(n) => {
                    self.names.insert(n.name.to_string());
                }
                _ => {}
            }
            true
        });
        for statement in &program.body {
            let Statement::ImportDeclaration(import) = statement else { continue };
            let from = import.source.value.as_str();
            for (index, call) in self.static_calls.iter().enumerate() {
                if call.module != from {
                    continue;
                }
                for specifier in import.specifiers.iter().flatten() {
                    if let ImportDeclarationSpecifier::ImportSpecifier(s) = specifier {
                        if s.imported.name() == call.export.as_str() {
                            if let Some(id) = self.tree.id_of(&**s) {
                                self.static_bindings.insert(id, index);
                                self.static_decls.insert(id);
                            }
                        }
                    }
                }
            }
            if from != "@rivetjs/runtime/dom" && from != "@rivetjs/runtime/server" {
                continue;
            }
            for specifier in import.specifiers.iter().flatten() {
                match specifier {
                    ImportDeclarationSpecifier::ImportNamespaceSpecifier(ns) => {
                        if let Some(id) = self.id(&**ns) {
                            self.structural_namespaces.insert(id);
                        }
                    }
                    ImportDeclarationSpecifier::ImportSpecifier(s) => {
                        let imported = s.imported.name();
                        let Some(id) = self.id(&**s) else { continue };
                        if let Some(helper) = TARGET_HELPERS.iter().find(|h| **h == imported.as_str()) {
                            self.structural.insert(id, helper);
                        }
                        if let Some(name) =
                            ["ErrorBoundary", "Suspense", "Show", "Match", "Switch"].into_iter().find(|n| *n == imported.as_str())
                        {
                            self.thunked.insert(id, name);
                        }
                    }
                    ImportDeclarationSpecifier::ImportDefaultSpecifier(_) => {}
                }
            }
        }
        if !self.static_bindings.is_empty() {
            self.static_setup();
        }
        if self.styles.is_some() {
            self.styles_setup();
        }
        self.has_checker = !self.structural.is_empty()
            || !self.structural_namespaces.is_empty()
            || self.thunked.values().any(|name| *name != "Switch")
            || (self.server && self.list_mounts && source.contains(".map("));
        self.template_name = self.unique("__rivetTemplate");
        for name in dom_v2::V2_ABI.iter().chain(dom_v2::SPREAD_ABI) {
            let local = self.unique(&format!("__rivet{name}"));
            self.v2_names.push((name, local));
        }
        self.attribute_name = self.unique("__rivetAttribute");
        for name in ABI {
            let mut local = String::from("__rivet");
            local.push_str(&name[..1].to_uppercase());
            local.push_str(&name[1..]);
            let local = self.unique(&local);
            self.abi.push((name, local));
        }
        self.list_name = self.unique("__rivetList");
        self.list_plan_name = self.unique("__rivetListPlan");
        // Resume (derived model, both targets): lowered as plain server / DOM output plus the boundary / keyed-state
        // calls (`compile/derived.rs`).
        if let Some(module) = &options.resume {
            self.derived_setup(module, &options.verdicts, options);
        }
        if self.server && self.list_mounts && self.has_checker {
            self.discover_twins();
        }

        // Transform.
        self.reps.push(Vec::new());
        for &child in tree.children(root) {
            self.visit(child);
        }
        if options.check {
            let sites = std::mem::take(&mut self.sites);
            return Output { code: String::new(), diagnostics: self.diags.list, map: None, sites, css: None, boundaries: Vec::new(), lite: None, lite_because: Vec::new() };
        }
        let top = self.reps.pop().unwrap_or_default();
        let mut body = self.render(program.span, &top);
        let mut hashbang = String::new();
        if let Some(h) = &program.hashbang {
            let text = tree.text_of(h.span).to_string();
            if self.mapping {
                // The body starts with the mark of its first chunk: drop the hashbang after it.
                let (clean, _) = map::extract(&body);
                if clean.starts_with(&text) {
                    let skip = h.span.end;
                    body = self.render(Span::new(skip, program.span.end), &top);
                }
            } else if body.starts_with(&text) {
                body = body[text.len()..].to_string();
            }
            hashbang = text + "\n";
        }

        // Child plans first: a parent plan splices its flattened children's fragments at module load.
        let plans = std::mem::take(&mut self.plans);
        let mut emitted: FxHashSet<String> = FxHashSet::default();
        for n in 0..plans.len() {
            self.emit_plan(&plans, n, &mut emitted);
        }

        let mut specifiers: Vec<(String, String)> = Vec::new();
        if self.server {
            specifiers.push(("compiledTemplate".into(), self.template_name.clone()));
            specifiers.push(("attribute".into(), self.attribute_name.clone()));
            specifiers.push(("omitted".into(), self.abi_name("omitted")));
            if self.used_abi.contains("spreadAttributes") {
                specifiers.push(("spreadAttributes".into(), self.abi_name("spreadAttributes")));
            }
            if self.used_abi.contains("spreadChildren") {
                specifiers.push(("spreadChildren".into(), self.abi_name("spreadChildren")));
            }
            if self.list_used || !self.twins.is_empty() {
                specifiers.push(("_list".into(), self.list_name.clone()));
                specifiers.push(("_listPlan".into(), self.list_plan_name.clone()));
            }
        } else if self.used_abi.contains("clientEvent") {
            specifiers.push(("clientEvent".into(), self.abi_name("clientEvent")));
        }
        let named = |list: &[(String, String)]| {
            list.iter().map(|(imported, local)| format!("{imported} as {local}")).collect::<Vec<_>>().join(", ")
        };
        if !self.server {
            for (name, local) in &self.v2_names {
                if self.used_v2.contains(name) {
                    specifiers.push(((*name).into(), local.clone()));
                }
            }
        }
        for (module, export, local) in &self.i18n_imports {
            if module.starts_with("@rivetjs/runtime/") {
                specifiers.push(((*export).into(), local.clone()));
            }
        }
        // DOM: imports on use only (a module without JSX imports nothing).
        let mut imports = if specifiers.is_empty() {
            String::new()
        } else {
            format!("import {{ {} }} from \"@rivetjs/runtime/{}\";\n", named(&specifiers), self.target)
        };
        if !self.style_imports.is_empty() {
            let list: Vec<(String, String)> = self.style_imports.iter().map(|(e, l)| ((*e).into(), l.clone())).collect();
            imports.push_str(&format!("import {{ {} }} from \"@rivetjs/runtime/style\";\n", named(&list)));
        }
        if let Some(local) = &self.slot_import {
            // DOM target: from the dom entry, so slot.ts shares dom.ts's chunk (one request less); server keeps the subpath.
            let from = if self.server { "@rivetjs/runtime/slot" } else { "@rivetjs/runtime/dom" };
            imports.push_str(&format!("import {{ _slot as {local} }} from \"{from}\";\n"));
        }
        if !self.props_imports.is_empty() {
            // Pay-per-use subpath: only modules whose component elements spread or pass live props import it.
            let list: Vec<(String, String)> = self.props_imports.iter().map(|(e, l)| ((*e).into(), l.clone())).collect();
            imports.push_str(&format!("import {{ {} }} from \"@rivetjs/runtime/props\";\n", named(&list)));
        }
        let mut helper_modules: Vec<&str> = Vec::new();
        for (module, _, _) in &self.i18n_imports {
            if !module.starts_with("@rivetjs/runtime/") && !helper_modules.contains(&module.as_str()) {
                helper_modules.push(module);
            }
        }
        for module in helper_modules {
            let list: Vec<(String, String)> = self
                .i18n_imports
                .iter()
                .filter(|(m, _, _)| m == module)
                .map(|(_, export, local)| ((*export).into(), local.clone()))
                .collect();
            imports.push_str(&format!("import {{ {} }} from {};\n", named(&list), quote(module)));
        }
        let resume_imports = self.derived_imports();
        // ZERO C1: lite residual entry (`compile/derived_lite.rs`), derived DOM target only — a module of its own.
        let lite = self.lite_residuals(filename);
        let hoists: String = self.hoists.iter().map(|h| h.clone() + "\n").collect();
        let text = format!("{hashbang}{imports}{resume_imports}{hoists}{body}");
        if self.diags.has_errors() {
            return Output { code: String::new(), diagnostics: self.diags.list, map: None, sites: Vec::new(), css: None, boundaries: Vec::new(), lite: None, lite_because: Vec::new() };
        }
        let (clean, segments) = if self.mapping { map::extract(&text) } else { (text, Vec::new()) };
        let mapped = self.mapping.then_some((source, segments.as_slice()));
        let (code, source_map) = match strip_types(&clean, filename, is_js_filename(filename), mapped) {
            Ok(output) => output,
            Err(message) => {
                self.diag(format!("Internal error: emitted code failed to parse: {message}"), None);
                return Output { code: String::new(), diagnostics: self.diags.list, map: None, sites: Vec::new(), css: None, boundaries: Vec::new(), lite: None, lite_because: Vec::new() };
            }
        };
        let css = self.styles_output();
        let boundaries = self.derived_boundaries();
        let lite = match lite {
            Some((text, names)) => match strip_types(&text, filename, is_js_filename(filename), None) {
                Ok((code, _)) => Some((code, names)),
                Err(message) => {
                    self.diag(format!("Internal error: emitted lite code failed to parse: {message}"), None);
                    return Output { code: String::new(), diagnostics: self.diags.list, map: None, sites: Vec::new(), css: None, boundaries: Vec::new(), lite: None, lite_because: Vec::new() };
                }
            },
            None => None,
        };
        let lite_because = std::mem::take(&mut self.lite_because);
        Output { code, diagnostics: self.diags.list, map: source_map, sites: Vec::new(), css, boundaries, lite, lite_because }
    }

    fn emit_plan(&mut self, plans: &[Plan], n: usize, emitted: &mut FxHashSet<String>) {
        let plan = &plans[n];
        if !emitted.insert(plan.name.clone()) {
            return;
        }
        for dep in &plan.deps {
            if let Some(m) = plans.iter().position(|p| &p.name == dep) {
                self.emit_plan(plans, m, emitted);
            }
        }
        self.hoists.push(format!("const {} = {};", plan.name, plan.value.print()));
    }

    // ---- text splicing ----

    fn render(&self, span: Span, reps: &[(Span, Expr)]) -> String {
        let mut out = String::new();
        let mut pos = span.start;
        for (rep_span, expr) in reps {
            if rep_span.start < pos || rep_span.end > span.end {
                continue;
            }
            self.copy(&mut out, Span::new(pos, rep_span.start));
            if self.mapping {
                map::mark(&mut out, rep_span.start, 0);
            }
            out.push_str(&expr.print());
            pos = rep_span.end;
        }
        self.copy(&mut out, Span::new(pos, span.end));
        out
    }

    /// Append source text, marked with its origin when mapping.
    fn copy(&self, out: &mut String, span: Span) {
        if span.start >= span.end {
            return;
        }
        if self.mapping {
            map::mark(out, span.start, span.end - span.start);
        }
        out.push_str(self.tree.text_of(span));
    }

    fn visit(&mut self, id: NodeId) {
        if let Some(out) = self.visit_node(id) {
            let span = self.tree.span(id);
            if let Some(top) = self.reps.last_mut() {
                top.push((span, out));
            }
            return;
        }
        let tree = self.tree;
        for &child in tree.children(id) {
            self.visit(child);
        }
    }

    /// Visit the children of `id` (TypeScript `visitEachChild`), returning their replacements.
    fn visit_children(&mut self, id: NodeId) -> Vec<(Span, Expr)> {
        self.reps.push(Vec::new());
        let tree = self.tree;
        for &child in tree.children(id) {
            self.visit(child);
        }
        self.reps.pop().unwrap_or_default()
    }

    /// TypeScript `ts.visitNode(node, visitor)`.
    fn expr_node(&mut self, id: NodeId) -> Expr {
        if let Some(out) = self.visit_node(id) {
            return out;
        }
        let reps = self.visit_children(id);
        self.raw(id, &reps)
    }

    /// Source text of a visited node with its replacements; functions are marked so generated
    /// wrappers never parenthesize them as values.
    fn raw(&self, id: NodeId, reps: &[(Span, Expr)]) -> Expr {
        let text = self.render(self.tree.span(id), reps);
        match self.tree.kind(id) {
            AstKind::ArrowFunctionExpression(_) | AstKind::Function(_) => Expr::Func(text),
            _ => Expr::Raw(text),
        }
    }

    fn expr(&mut self, e: &'a Expression<'a>) -> Expr {
        match self.tree.expr_id(e) {
            Some(id) => self.expr_node(id),
            None => Expr::Raw(self.tree.text_of(e.span()).to_string()),
        }
    }

    fn arg_expr(&mut self, arg: &'a Argument<'a>) -> Expr {
        match arg {
            Argument::SpreadElement(s) => match self.id(&**s) {
                Some(id) => self.expr_node(id),
                None => Expr::Raw(self.tree.text_of(s.span).to_string()),
            },
            _ => match arg.as_expression() {
                Some(e) => self.expr(e),
                None => Expr::Raw(self.tree.text_of(arg.span()).to_string()),
            },
        }
    }

    // ---- symbol helpers (absent without a checker, as in the TypeScript implementation) ----

    fn resolve_ref(&self, ident: &IdentifierReference<'a>, shorthand_value: bool) -> Option<NodeId> {
        if !self.has_checker {
            return None;
        }
        self.tree.resolve(ident, shorthand_value)
    }

    fn imported_structural(&self, ident: &IdentifierReference<'a>) -> Option<&'static str> {
        self.resolve_ref(ident, true).and_then(|decl| self.structural.get(&decl).copied())
    }

    fn is_namespace_ref(&self, ident: &IdentifierReference<'a>) -> bool {
        self.resolve_ref(ident, false).is_some_and(|decl| self.structural_namespaces.contains(&decl))
    }

    fn target_namespace(&self, e: &Expression<'a>) -> bool {
        matches!(e, Expression::Identifier(ident) if self.is_namespace_ref(ident))
    }

    fn has_declarations(&self, ident: &IdentifierReference<'a>) -> bool {
        self.resolve_ref(ident, false).is_some()
    }

    fn resolve_tag(&self, name: &JSXElementName<'a>) -> Option<NodeId> {
        match name {
            JSXElementName::IdentifierReference(ident) => self.resolve_ref(ident, false),
            _ => None,
        }
    }

    // ---- the visitor ----

    fn is_concise_body(&self, id: NodeId) -> bool {
        let Some(body) = self.tree.raw_parent(id) else { return false };
        matches!(self.tree.raw_parent(body).map(|p| self.tree.kind(p)), Some(AstKind::ArrowFunctionExpression(a)) if a.expression)
    }

    fn visit_node(&mut self, id: NodeId) -> Option<Expr> {
        let tree = self.tree;
        let kind = tree.kind(id);
        if !self.css_blocks.is_empty() || !self.css_tagged.is_empty() {
            if let Some(out) = self.styles_node(id) {
                return Some(out);
            }
        }
        if self.derived.is_some() {
            if let Some(replaced) = self.derived_node(id) {
                return Some(replaced);
            }
        }
        // Server: `clientEvent(…)` never attaches on the server, but its target argument (`window` / `document`) would
        // still be evaluated and throw where those globals do not exist; on a plain server build the call lowers to
        // `undefined`. The derived server target drops `clientEffect(…)`'s closure the same way (M6-PARITY): a server no-op
        // whose closure would keep browser-only imports (`import("./dialog.tsx")`) in the SSR bundle. Both calls stay there
        // with their options only — `clientEffect(void 0, options)` (M6-CUT), `clientEvent(void 0, void 0, void 0, options)`
        // (TOAST-ACTIVE 2026-10-26; a literal `standalone: false` one still lowers to `undefined`): the server's helper flags
        // the open boundary's client trigger (`when`; a standalone `clientEvent` without `when` = idle), without which the
        // boundary never adopts — a `clientEffect` page never boots,
        // a document `clientEvent` (cdk `ToastRegion`'s `rv-toast-queue`) never hears its event.
        if self.server {
            if let AstKind::CallExpression(call) = kind {
                if let Expression::Identifier(ident) = &call.callee {
                    if let Some(decl) = tree.resolve(ident, false) {
                        if let AstKind::ImportSpecifier(s) = tree.kind(decl) {
                            let name = s.imported.name();
                            if (name == "clientEvent" || (name == "clientEffect" && self.derived.is_some()))
                                && resume::import_source(tree, decl).is_some_and(|from| from.starts_with("@rivetjs/runtime"))
                            {
                                // Options position: clientEffect(fn, options), clientEvent(target, type, handler, options).
                                let at = if name == "clientEffect" { 1 } else { 3 };
                                // A literal `standalone: false` clientEvent flags nothing on the server (router / sidebar
                                // listeners): it lowers to `undefined` as before, no server bytes.
                                let inert = name == "clientEvent"
                                    && matches!(call.arguments.get(at), Some(Argument::ObjectExpression(o)) if o.properties.iter().any(|p| matches!(p,
                                        ObjectPropertyKind::ObjectProperty(p) if !p.computed && p.kind == PropertyKind::Init
                                            && matches!(&p.key, PropertyKey::StaticIdentifier(i) if i.name == "standalone")
                                            && matches!(&p.value, Expression::BooleanLiteral(b) if !b.value))));
                                if self.derived.is_some() && !inert && !call.arguments.iter().any(|a| matches!(a, Argument::SpreadElement(_))) {
                                    let mut args = vec![Expr::VoidZero; at];
                                    if let Some(options) = call.arguments.get(at) {
                                        args.push(self.arg_expr(options));
                                    }
                                    let mut callee = tree.text_of(call.callee.span()).to_string();
                                    if call.optional {
                                        callee.push_str("?.");
                                    }
                                    return Some(Expr::Call(Box::new(Expr::Raw(callee)), args));
                                }
                                return Some(Expr::ident("undefined"));
                            }
                        }
                    }
                }
            }
        }
        if self.i18n {
            if let AstKind::CallExpression(call) = kind {
                if let Some(matched) = self.static_call(call, Some(id)) {
                    return Some(match matched {
                        Ok((index, matched, params)) => self.static_value(index, matched, params, Some(id)),
                        Err(()) => Expr::Null,
                    });
                }
            }
        }
        // exception: user ruling 2026-10-07 (CTX-1) — a v2 template returned / as a concise body lowers to a block.
        if matches!(kind, AstKind::ExpressionStatement(_) | AstKind::ReturnStatement(_)) {
            if let Some(block) = self.v2_block_statement(id) {
                return Some(block);
            }
        }
        match kind {
            AstKind::ComputedMemberExpression(m) => {
                if self.target_namespace(&m.object)
                    && !matches!(&m.expression, Expression::StringLiteral(s) if !TARGET_HELPERS.contains(&s.value.as_str()))
                {
                    self.diag(
                        "Import target helpers as named bindings; computed namespace helpers are not supported",
                        Some(id),
                    );
                }
            }
            AstKind::IdentifierReference(ident) => {
                if self.is_namespace_ref(ident) {
                    let object_of_member = match tree.parent_kind(id) {
                        Some(AstKind::StaticMemberExpression(m)) => m.object.span() == ident.span,
                        Some(AstKind::ComputedMemberExpression(m)) => m.object.span() == ident.span,
                        Some(AstKind::PrivateFieldExpression(m)) => m.object.span() == ident.span,
                        Some(AstKind::JSXMemberExpression(m)) => m.object.span() == ident.span,
                        _ => false,
                    };
                    if !object_of_member {
                        self.diag(
                            "Target runtime namespaces cannot be aliased or destructured; use named helper imports",
                            Some(id),
                        );
                    }
                }
            }
            AstKind::ExportNamedDeclaration(e) => {
                if e.source.as_ref().is_some_and(|s| runtime_target(&s.value)) {
                    self.diag("Target helper re-exports are not supported; use a direct named import", Some(id));
                }
            }
            AstKind::ExportAllDeclaration(e) => {
                if runtime_target(&e.source.value) {
                    self.diag("Target helper re-exports are not supported; use a direct named import", Some(id));
                }
            }
            AstKind::StaticMemberExpression(m) => {
                if TARGET_HELPERS.contains(&m.property.name.as_str()) && self.target_namespace(&m.object) {
                    self.diag("Import target helpers as named bindings; namespace aliases are not supported", Some(id));
                }
            }
            AstKind::JSXMemberExpression(m) => {
                if let JSXMemberExpressionObject::IdentifierReference(object) = &m.object {
                    if TARGET_HELPERS.contains(&m.property.name.as_str()) && self.is_namespace_ref(object) {
                        self.diag(
                            "Import target helpers as named bindings; namespace aliases are not supported",
                            Some(id),
                        );
                    }
                }
            }
            _ => {}
        }
        if self.server {
            if let AstKind::CallExpression(call) = kind {
                if let Expression::Identifier(callee) = &call.callee {
                    if self.imported_structural(callee) == Some("clientOnly") {
                        return Some(self.client_only(id, call));
                    }
                }
            }
            if let AstKind::IdentifierReference(ident) = kind {
                if self.imported_structural(ident) == Some("clientOnly") {
                    let callee = matches!(tree.parent_kind(id), Some(AstKind::CallExpression(c)) if c.callee.span() == ident.span && matches!(c.callee, Expression::Identifier(_)));
                    if !callee {
                        self.diag("Server clientOnly must be called directly through its named import binding", Some(id));
                    }
                }
            }
        }
        match kind {
            AstKind::VariableDeclarator(d) => {
                if let Some(Expression::Identifier(init)) = &d.init {
                    if self.imported_structural(init).is_some() {
                        self.diag("Structural helper aliases require a named import alias", Some(id));
                    }
                }
                None
            }
            AstKind::ImportDeclaration(import) if runtime_target(&import.source.value) => {
                let span = tree.span(id);
                let mut text = tree.text_of(Span::new(span.start, import.source.span.start)).to_string();
                text.push_str(&quote(&format!("@rivetjs/runtime/{}", self.target)));
                text.push_str(tree.text_of(Span::new(import.source.span.end, span.end)));
                Some(Expr::Stmts(text))
            }
            AstKind::JSXElement(el) => Some(self.lower(Jsx::Element(el))),
            AstKind::JSXFragment(fragment) => Some(self.lower(Jsx::Fragment(fragment))),
            AstKind::Function(_) if self.twins.contains_key(&id) => {
                let reps = self.visit_children(id);
                Some(self.twin(id, &reps))
            }
            _ => None,
        }
    }

    fn client_only(&mut self, id: NodeId, call: &'a CallExpression<'a>) -> Expr {
        let literal_function = |arg: Option<&Argument>| {
            matches!(arg, Some(Argument::ArrowFunctionExpression(_) | Argument::FunctionExpression(_)))
        };
        let importer = call.arguments.first();
        let selector = call.arguments.get(1);
        let options = call.arguments.get(2);
        let selector_ok = match selector {
            None => true,
            Some(arg) if literal_function(Some(arg)) => true,
            Some(Argument::Identifier(ident)) => ident.name == "undefined" && !self.has_declarations(ident),
            Some(_) => false,
        };
        if !literal_function(importer)
            || !selector_ok
            || call.arguments.len() > 3
            || call.arguments.iter().any(|a| matches!(a, Argument::SpreadElement(_)))
        {
            self.diag("Server clientOnly erasure requires an inline importer and inline selector or undefined", Some(id));
            return Expr::Null;
        }
        // Function literals have no invocation-time side effects here; preserve options evaluation.
        let mut args = vec![Expr::VoidZero, Expr::VoidZero];
        if let Some(options) = options {
            args.push(self.arg_expr(options));
        }
        let callee = self.tree.text_of(call.callee.span()).to_string();
        let mut text = callee;
        if call.optional {
            text.push_str("?.");
        }
        Expr::Call(Box::new(Expr::Raw(text)), args)
    }

    // ---- JSX lowering ----

    fn tag_of(&self, el: &JSXElement<'a>) -> &'a str {
        self.tree.text_of(el.opening_element.name.span())
    }

    fn native(&self, el: &JSXElement<'a>) -> bool {
        is_native(self.tree, el) && !slots::is_slot(self.tree, self.id(el), el)
    }

    /// `r:slot` on an element that is not being lowered as slot content.
    fn slot_attr(&mut self, el: &'a JSXElement<'a>, attr: &JSXAttribute<'a>) {
        if !self.id(el).is_some_and(|id| self.slot_children.contains(&id)) {
            let id = self.id(attr);
            self.diag("r:slot is only allowed on a direct child of a component element", id);
        }
    }

    /// `<slot>`: the prop it renders, its fallback when absent, and scoped-slot arguments.
    fn lower_slot(&mut self, el: &'a JSXElement<'a>) -> Expr {
        let id = self.id(el);
        let Some(node) = id else { return Expr::Null };
        let reference = match slots::slot_ref(self.tree, node, el) {
            Ok(reference) => reference,
            Err(message) => {
                self.diag(message, id);
                return Expr::Null;
            }
        };
        let args = match slots::slot_args(self.tree, el) {
            None => None,
            Some(Err(message)) => {
                self.diag(message, id);
                return Expr::Null;
            }
            Some(Ok(list)) => Some(list.into_iter().map(|e| self.expr(e).print()).collect::<Vec<_>>()),
        };
        let mut list = self.child_expressions(&el.children);
        let fallback = match list.len() {
            0 => None,
            1 => Some(list.remove(0).print()),
            _ => Some(Expr::Array(list).print()),
        };
        let value = slots::lowered(&reference.text, args.as_deref(), fallback.as_deref());
        // CORE-GAPS (a): on the client a `<slot>` over a props member (`props.header`: a live getter, e.g. a
        // conditional `r:slot`) is an accessor, so the insertion re-reads it when the usage's content changes
        // (fallback back when it is absent). A destructured slot prop (`header`) is a value: read once, as before.
        // The server reads once (resume: the `<slot>` is its own Bind site).
        if !self.server && reference.text != reference.binding.0 {
            return Expr::Raw(format!("() => {value}"));
        }
        Expr::Raw(value)
    }

    fn attr_value(&mut self, attr: &'a JSXAttribute<'a>) -> Expr {
        match &attr.value {
            None => Expr::True,
            Some(JSXAttributeValue::StringLiteral(s)) => Expr::Str(decode_html(string_inner(self.tree, s))),
            Some(JSXAttributeValue::ExpressionContainer(c)) => match &c.expression {
                JSXExpression::EmptyExpression(_) => Expr::ident("undefined"),
                e => match e.as_expression() {
                    Some(e) => self.expr(e),
                    None => Expr::ident("undefined"),
                },
            },
            Some(_) => Expr::ident("undefined"),
        }
    }

    /// The attribute's expression is an arrow/function literal that survived visiting unchanged.
    /// exception: user ruling 2026-10-06 (round-2 C14) — a string / number / boolean / template literal
    /// event handler (`onClick="go()"`) is never callable: a diagnostic on every target.
    fn literal_handler(attr: &JSXAttribute<'a>) -> bool {
        match &attr.value {
            Some(JSXAttributeValue::StringLiteral(_)) => true,
            Some(JSXAttributeValue::ExpressionContainer(c)) => matches!(
                c.expression,
                JSXExpression::StringLiteral(_)
                    | JSXExpression::NumericLiteral(_)
                    | JSXExpression::BooleanLiteral(_)
                    | JSXExpression::TemplateLiteral(_)
            ),
            _ => false,
        }
    }

    fn function_value(attr: &JSXAttribute<'a>, value: &Expr) -> bool {
        let literal = matches!(&attr.value, Some(JSXAttributeValue::ExpressionContainer(c))
            if matches!(c.expression, JSXExpression::ArrowFunctionExpression(_) | JSXExpression::FunctionExpression(_)));
        literal && matches!(value, Expr::Raw(_) | Expr::Func(_))
    }

    fn tag_expr(&mut self, name: &'a JSXElementName<'a>) -> Expr {
        let id = match name {
            JSXElementName::IdentifierReference(i) => self.id(&**i),
            JSXElementName::MemberExpression(m) => self.id(&**m),
            JSXElementName::ThisExpression(t) => self.id(&**t),
            JSXElementName::Identifier(i) => self.id(&**i),
            JSXElementName::NamespacedName(n) => self.id(&**n),
        };
        match id {
            Some(id) => self.expr_node(id),
            None => Expr::Raw(self.tree.text_of(name.span()).to_string()),
        }
    }

    fn lower(&mut self, node: Jsx<'a>) -> Expr {
        let el = match node {
            Jsx::Fragment(fragment) if !self.server => return self.fragment_v2(&fragment.children),
            Jsx::Fragment(fragment) => return Expr::Array(self.child_expressions(&fragment.children)),
            Jsx::Element(el) => el,
        };
        let el_id = self.id(el);
        if let JSXElementName::NamespacedName(_) = el.opening_element.name {
            self.diag("Unsupported namespaced tag: drop the prefix (<rect> inside <svg>, not <svg:rect>)", el_id);
            return Expr::Null;
        }
        if is_native(self.tree, el) && slots::is_slot(self.tree, el_id, el) {
            return self.lower_slot(el);
        }
        if !self.native(el) {
            let tag = &el.opening_element.name;
            if let JSXElementName::MemberExpression(m) = tag {
                if let JSXMemberExpressionObject::IdentifierReference(object) = &m.object {
                    if self.is_namespace_ref(object) && TARGET_HELPERS.contains(&m.property.name.as_str()) {
                        let tag_id = self.id(&**m);
                        self.diag("Import structural helpers as named bindings; namespace aliases are not supported", tag_id);
                    }
                }
            }
            let is_provider =
                matches!(tag, JSXElementName::IdentifierReference(i) if self.imported_structural(i) == Some("Provider"));
            // `ErrorBoundary` / `Suspense` children render inside the boundary: plain JSX children become a
            // thunk.
            // `Switch` collects its `Match` markers from `children` eagerly: never lazy.
            let mut eager_switch = false;
            let thunk_children = match tag {
                JSXElementName::IdentifierReference(i) => {
                    match self.resolve_ref(i, true).and_then(|decl| self.thunked.get(&decl).copied()) {
                        Some("ErrorBoundary" | "Suspense") => true,
                        Some("Switch") => {
                            eager_switch = true;
                            false
                        }
                        Some(_) | None => false,
                    }
                }
                _ => false,
            };
            let mut props: Vec<(Key, Expr)> = Vec::new();
            for item in &el.opening_element.attributes {
                let attr = match item {
                    // Merged in source order by the props object (later keys win), read at snapshot time.
                    JSXAttributeItem::SpreadAttribute(s) => {
                        let value = self.expr(&s.argument);
                        props.push((Key::Spread, value));
                        continue;
                    }
                    JSXAttributeItem::Attribute(attr) => attr,
                };
                let name = attr_name(self.tree, attr);
                if name == slots::SLOT {
                    self.slot_attr(el, attr);
                    continue;
                }
                let value = self.attr_value(attr);
                let value = if (is_provider || thunk_children) && name == "children" && !Self::function_value(attr, &value) {
                    Expr::thunk(value)
                } else {
                    value
                };
                props.push((Key::Str(name.to_string()), value));
            }
            // `r:slot="x"` children become lazy props; the rest stays the (eager) default slot.
            let mut groups: Vec<(&'a str, Vec<&'a JSXElement<'a>>)> = Vec::new();
            let mut rest: Vec<&'a JSXChild<'a>> = Vec::new();
            // `{cond && <el r:slot="x"/>}` / `{cond ? <el r:slot="x"/> : null}`: a conditional slot prop.
            let mut conditional: Vec<(&'a str, slots::CondUsage<'a>)> = Vec::new();
            for child in &el.children {
                if let JSXChild::ExpressionContainer(c) = child {
                    if let Some(usage) = c.expression.as_expression().and_then(|e| slots::conditional_usage(self.tree, e)) {
                        let child_id = self.id(&**c);
                        match usage.name {
                            Err(message) => self.diag(message, child_id),
                            Ok("children") => self.diag(r#"r:slot="children": pass default slot content as plain children"#, child_id),
                            Ok(name) if props.iter().any(|(key, _)| key.text() == name) => {
                                self.diag(format!(r#"slot "{name}" is also passed as an attribute"#), child_id)
                            }
                            Ok(name) => {
                                for branch in usage.branches.iter().flatten() {
                                    if let Some(id) = self.id(*branch) {
                                        self.slot_children.insert(id);
                                    }
                                }
                                conditional.push((name, usage));
                            }
                        }
                        continue;
                    }
                }
                if let JSXChild::Element(c) = child {
                    if let Some(name) = slots::usage_name(self.tree, c) {
                        let child_id = self.id(&**c);
                        match name {
                            Err(message) => self.diag(message, child_id),
                            Ok("children") => self.diag(
                                r#"r:slot="children": pass default slot content as plain children"#,
                                child_id,
                            ),
                            Ok(name) if props.iter().any(|(key, _)| key.text() == name) => {
                                self.diag(format!(r#"slot "{name}" is also passed as an attribute"#), child_id)
                            }
                            Ok(name) => {
                                if let Some(child_id) = child_id {
                                    self.slot_children.insert(child_id);
                                }
                                match groups.iter_mut().find(|(n, _)| *n == name) {
                                    Some((_, list)) => list.push(c),
                                    None => groups.push((name, vec![c])),
                                }
                            }
                        }
                        continue;
                    }
                }
                rest.push(child);
            }
            for (name, elements) in groups {
                let mut values: Vec<Expr> = elements.iter().map(|c| self.lower(Jsx::Element(c))).collect();
                let body = if values.len() == 1 { values.remove(0) } else { Expr::Array(values) };
                let value = Expr::thunk(body);
                props.push((Key::Str(name.to_string()), value));
            }
            for (n, (name, usage)) in conditional.iter().enumerate() {
                if props.iter().any(|(key, _)| key.text() == *name) || conditional[..n].iter().any(|(other, _)| other == name) {
                    let id = usage.branches.iter().flatten().next().and_then(|el| self.id(*el));
                    self.diag(format!(r#"slot "{name}" is passed more than once"#), id);
                    continue;
                }
                let test = self.expr(usage.test);
                let [a, b] = usage.branches.map(|branch| match branch {
                    None => Expr::VoidZero,
                    Some(c) => Expr::thunk(self.lower(Jsx::Element(c))),
                });
                let mut text = String::new();
                for (part, value) in [("", &test), (" ? ", &a), (" : ", &b)] {
                    text.push_str(part);
                    text.push('(');
                    text.push_str(&value.print());
                    text.push(')');
                }
                props.push((Key::Str(name.to_string()), Expr::Raw(text)));
            }
            // A boundary's single function-literal child (`{() => <X/>}`) is already the thunk.
            let function_child = thunk_children && {
                let mut content = rest.iter().filter(|c| !matches!(c, JSXChild::Text(t) if jsx_text(self.tree.text_of(t.span)).is_empty()));
                matches!((content.next(), content.next()), (Some(JSXChild::ExpressionContainer(c)), None)
                    if matches!(c.expression, JSXExpression::ArrowFunctionExpression(_) | JSXExpression::FunctionExpression(_)))
            };
            // exception: user ruling 2026-10-06 (FLATTEN-CMP-3) — keyed `<For>` rows as a list mount (server, no
            // resume): `children` + compiler-private `$list: [plan, each]` (runtime `For` → `_list` without a row hook).
            if let Some((children, list)) = self.for_list(el, &rest) {
                props.push((Key::Ident("children".into()), children));
                props.push((Key::Str("$list".into()), list));
                rest.clear();
            }
            // Plain children with elements / expressions are lazy: a thunk the component calls where
            // it renders them (after its providers). Text-only children stay a string.
            let lazy = if eager_switch { Vec::new() } else { resume::lazy_children(self.tree, el) };
            // exception: lane COND (2026-10-07) — lazy child expressions lower through `compile/lazy_binds.rs`.
            let mut list = self.child_values(rest.into_iter(), !lazy.is_empty());
            if !list.is_empty() {
                let value = if list.len() == 1 { list.remove(0) } else { Expr::Array(list) };
                let thunk = is_provider || (thunk_children && !function_child) || !lazy.is_empty();
                let mut value = if thunk { Expr::thunk(value) } else { value };
                if !lazy.is_empty() {
                    // Branded (`isSlot`): components tell lazy content from a user render function.
                    let slot = self.slot_helper();
                    value = Expr::call(&slot, vec![value]);
                }
                props.push((Key::Ident("children".into()), value));
            }
            // ZERO STATESPACE: a proven native call site (`plan.native`, both targets) renders its family's native automaton.
            if self.tree.id_of(el).is_some_and(|id| self.derived.as_ref().is_some_and(|d| d.plan.native.contains(&id))) {
                props.push((Key::Str("$native".into()), Expr::Num(1)));
            }
            let callee = self.tag_expr(&el.opening_element.name);
            if !self.server {
                return self.component_v2(el, callee, props);
            }
            // exception: derived model (DERIVED-S 2026-10-21) — a list-mounted `<For>` (`$list`) calls the derived For
            // (`_rFor`, `@rivetjs/runtime/server-derived`): a derived render writes its rows from the list tape.
            let derived_for = self.derived.is_some() && props.iter().any(|(key, _)| key.text() == "$list");
            let callee = if derived_for { Expr::Ident(self.derived_for()) } else { callee };
            return self.mark_component(el, callee, props);
        }
        if !self.server {
            // A tree v2 cannot lower always has a diagnostic (`report_dom`).
            return if self.v2_supported(el, &mut Vec::new()) { self.lower_dom_v2(el) } else { self.report_dom(el) };
        }
        let mut t = ServerTemplate::new(if self.i18n { self.variants.len() } else { 1 });
        // exception: user ruling 2026-10-06 (round-2 C6) — each server template starts a fresh ancestor chain.
        let ancestors = std::mem::take(&mut self.server_ancestors);
        self.walk_server(el, "html", &mut t);
        self.server_ancestors = ancestors;
        let name = self.unique(&format!("__rivetFragments{}", self.hoists.len()));
        let list = |fragments: &[String]| fragments.iter().map(|s| quote(s)).collect::<Vec<_>>().join(", ");
        let callee = if t.plain() {
            // Frozen once at module load: the runtime caches each array's UTF-8 encoding.
            self.hoists.push(format!("const {name} = /*#__PURE__*/ Object.freeze([{}]);", list(&t.sets[0].0)));
            self.template_name.clone()
        } else {
            // One fragment set per variant (frozen by _variants), plus write orders when a variant
            // writes slots out of source order.
            let sets: Vec<String> = t.sets.iter().map(|(f, _)| format!("[{}]", list(f))).collect();
            let orders = if t.source_order() {
                "null".to_string()
            } else {
                let orders: Vec<String> = t
                    .sets
                    .iter()
                    .map(|(_, o)| format!("[{}]", o.iter().map(|i| i.to_string()).collect::<Vec<_>>().join(", ")))
                    .collect();
                format!("[{}]", orders.join(", "))
            };
            let variants = self.i18n_name("@rivetjs/runtime/server", "_variants");
            self.hoists.push(format!("const {name} = /*#__PURE__*/ {variants}([{}], {orders});", sets.join(", ")));
            self.i18n_name("@rivetjs/runtime/server", "_variantTemplate")
        };
        let output = Expr::Template { callee, fragments: name, slots: t.slots };
        if t.model_temps.is_empty() {
            return output;
        }
        Expr::Call(
            Box::new(Expr::ArrowBlock(
                Vec::new(),
                vec![format!("let {};", t.model_temps.join(", ")), format!("return {};", output.print())],
            )),
            Vec::new(),
        )
    }

    fn mark_component(&mut self, el: &'a JSXElement<'a>, callee: Expr, mut props: Vec<(Key, Expr)>) -> Expr {
        if self.holes.contains(&el.span.start) {
            props.push((Key::Str("$hole".into()), Expr::Num(1)));
        }
        // ZERO CALLSITE: a proven call site of a `SITE` callee: `Tag(_rS({ props }))` marks this instance independent.
        if let Some(site) = self.tree.id_of(el).and_then(|id| self.derived_site(id)) {
            return Expr::Call(Box::new(callee), vec![Expr::Call(Box::new(Expr::Ident(site)), vec![Expr::Object(props)])]);
        }
        let spread = el.opening_element.attributes.iter().any(|a| matches!(a, JSXAttributeItem::SpreadAttribute(_)));
        let declaration = if spread { None } else { self.resolve_tag(&el.opening_element.name) };
        let twin = declaration.filter(|d| self.twins.contains_key(d));
        Expr::Component { callee: Box::new(callee), props, twin }
    }

    fn child_expressions(&mut self, children: &'a [JSXChild<'a>]) -> Vec<Expr> {
        self.child_values(children.iter(), false)
    }

    /// `lazy`: the children of a component element that compile to a lazy slot (`resume::lazy_children`).
    fn child_values(&mut self, children: impl Iterator<Item = &'a JSXChild<'a>>, lazy: bool) -> Vec<Expr> {
        let mut values = Vec::new();
        for child in children {
            match child {
                JSXChild::Text(text) => {
                    let text = jsx_text(self.tree.text_of(text.span));
                    if !text.is_empty() {
                        values.push(Expr::Str(text));
                    }
                }
                JSXChild::ExpressionContainer(c) => {
                    if let Some(e) = c.expression.as_expression() {
                        let value = if lazy { self.lazy_child_expression(c, e) } else { self.expr(e) };
                        values.push(value);
                    }
                }
                JSXChild::Spread(s) => {
                    let id = self.id(&**s);
                    self.diag("Spread children are not supported: render the array as one child ({items}) or map it ({items.map((x) => <li>{x}</li>)} / <For each={items} by={…}>)", id);
                }
                JSXChild::Element(el) => values.push(self.lower(Jsx::Element(el))),
                JSXChild::Fragment(f) => values.push(self.lower(Jsx::Fragment(f))),
            }
        }
        values
    }

    fn attrs(el: &'a JSXElement<'a>) -> impl Iterator<Item = &'a JSXAttribute<'a>> {
        el.opening_element.attributes.iter().filter_map(|item| match item {
            JSXAttributeItem::Attribute(attr) => Some(&**attr),
            JSXAttributeItem::SpreadAttribute(_) => None,
        })
    }

    fn has_attribute(&self, el: &'a JSXElement<'a>, name: &str) -> bool {
        Self::attrs(el).any(|attr| attr_name(self.tree, attr) == name)
    }

    /// `preload` on <audio>/<video> is the native attribute; on other elements it is the resume
    /// preload directive for the element's handlers, never rendered.
    fn is_preload_directive(&self, attr: &JSXAttribute<'a>, tag: &str) -> bool {
        attr_name(self.tree, attr) == "preload" && tag != "audio" && tag != "video"
    }

    /// A native element with `{...x}`: its plain attributes and spreads merge into one object.
    fn has_spread(el: &'a JSXElement<'a>) -> bool {
        el.opening_element.attributes.iter().any(|a| matches!(a, JSXAttributeItem::SpreadAttribute(_)))
    }

    /// On a spread element, an attribute merged into the spread object (not an event, ref, model,
    /// global event, `r:slot` or preload directive).
    fn spread_plain(&self, attr: &JSXAttribute<'a>, tag: &str) -> bool {
        let name = attr_name(self.tree, attr);
        name != slots::SLOT
            && !self.is_preload_directive(attr, tag)
            && global_event(name).is_none()
            && name != "ref"
            && !starts_with_on(name)
            && !name.starts_with("model:")
            && !name.starts_with("prop:")
            // exception: user ruling 2026-10-06 — a plain `style` merges into the spread object.
            && !styling::spread_directive(self.tree, attr)
    }

    /// The merged attribute object of a spread element, in source order (later keys win). Static
    /// attributes keep their compile-time checks (names, URL literals). `split` (DOM target, F1 `dom_v2_spread.rs`):
    /// the last spread's index when the plain attributes after it lower on their own (`_attrs`); they (and the
    /// `ref` sentinel, an `exclude` name then) stay out of the object, a `children` attribute stays in.
    fn spread_object(
        &mut self,
        el: &'a JSXElement<'a>,
        tag: &str,
        namespace: &'static str,
        groups: Option<&styling::Groups<'a>>,
        split: Option<usize>,
    ) -> Vec<(Key, Expr)> {
        let mut entries = Vec::new();
        // exception: user ruling 2026-10-06 (MATRIX-1) — a `style:` group joins the object as one `style`
        // object at its first attribute (source order: a later spread's `style` still wins, an earlier
        // one is overridden), never a second style binding next to the spread.
        let style = groups.and_then(|g| g.style.as_ref());
        for (index, item) in el.opening_element.attributes.iter().enumerate() {
            if let Some(group) = style.filter(|g| g.first == index) {
                let value = self.spread_style(group);
                entries.push((Key::Str("style".into()), value));
            }
            let attr = match item {
                JSXAttributeItem::SpreadAttribute(s) => {
                    let value = self.expr(&s.argument);
                    entries.push((Key::Spread, value));
                    continue;
                }
                JSXAttributeItem::Attribute(attr) => &**attr,
            };
            if split.is_some_and(|last| index > last) && attr_name(self.tree, attr) != "children" {
                continue;
            }
            if let Some(entry) = self.spread_entry(attr, tag, namespace) {
                entries.push(entry);
            }
        }
        // ref-spread-dedupe (LIVE-PROPS P4): an explicit `ref` after the last spread wins over a spread `ref` key (React:
        // the later prop, one ref): the object ends with `ref: undefined`, which the spread runtimes skip.
        if split.is_none() && ref_after_spread(self.tree, el) {
            entries.push((Key::Str("ref".into()), Expr::VoidZero));
        }
        entries
    }

    /// A plain attribute of a spread element as its object entry, checked (names, static values); None for
    /// any other attribute and for a reported one.
    fn spread_entry(&mut self, attr: &'a JSXAttribute<'a>, tag: &str, namespace: &'static str) -> Option<(Key, Expr)> {
        if !self.spread_plain(attr, tag) {
            return None;
        }
        let attr_id = self.id(attr);
        let name = attr_name(self.tree, attr);
        // exception: user ruling 2026-10-06 — `style={obj}` joins the object (the runtime spread
        // encodes / applies it like an explicit style object); `styling::analyze` reports strings.
        if name == "style" {
            if matches!(attr.value, Some(JSXAttributeValue::ExpressionContainer(_))) {
                let value = self.attr_value(attr);
                return Some((Key::Str(name.to_string()), value));
            }
            return None;
        }
        if !safe_attribute_name(name) {
            self.diag(format!("Unsafe or unsupported native attribute: {name}"), attr_id);
            return None;
        }
        let value = match &attr.value {
            None => Expr::True,
            Some(JSXAttributeValue::StringLiteral(_)) => {
                let text = attr_string(self.tree, attr).map(decode_html).unwrap_or_default();
                let html_name = match name {
                    "className" => "class",
                    "htmlFor" => "for",
                    other => other,
                };
                if let Err(message) = encode_attribute(html_name, AttrValue::Text(&text), attribute_namespace(tag, name, namespace)) {
                    self.diag(message, attr_id);
                    return None;
                }
                Expr::Str(text)
            }
            Some(JSXAttributeValue::ExpressionContainer(c))
                if (name == "class" || name == "className") && c.expression.as_expression().is_some_and(styling::class_literal) =>
            {
                // A class object / array normalizes before the spread reads it.
                let value = self.attr_value(attr);
                Expr::call(&self.style_helper("_class"), vec![value])
            }
            _ => self.attr_value(attr),
        };
        Some((Key::Str(name.to_string()), value))
    }

    /// A spread element's `style` group as one style object: properties and objects in source order
    /// (later wins, `false` unsets), as the spread runtimes apply / encode a `style` key.
    fn spread_style(&mut self, group: &styling::StyleGroup<'a>) -> Expr {
        let mut entries = Vec::new();
        for entry in &group.entries {
            match entry {
                styling::Entry::Prop(name, value) => {
                    let value = match value {
                        styling::Val::Bool(_) => Expr::Null,
                        value => self.style_val(value),
                    };
                    entries.push((Key::Str(name.clone()), value));
                }
                styling::Entry::Object(e) => {
                    let value = self.expr(e);
                    entries.push((Key::Spread, value));
                }
            }
        }
        Expr::Object(entries)
    }

    /// Spread runtime namespace argument: SVG/MathML (HTML needs none; media is per tag at runtime).
    fn spread_args(tag: &str, namespace: &'static str) -> Vec<Expr> {
        let mut args = vec![Expr::str(tag)];
        if namespace == "svg" || namespace == "mathml" {
            args.push(Expr::str(namespace));
        }
        args
    }

    fn preload_directive(&mut self, el: &'a JSXElement<'a>, tag: &str) -> Option<&'a str> {
        let attr = Self::attrs(el).find(|a| self.is_preload_directive(a, tag))?;
        match attr_string(self.tree, attr) {
            Some(text) if PRELOAD_STRATEGIES.contains(&text) => Some(text),
            _ => {
                let id = self.id(attr);
                self.diag(r#"preload must be one of "eager", "idle", "visible", "intent", "interaction""#, id);
                None
            }
        }
    }

    fn validate_model(&mut self, el: &'a JSXElement<'a>, attr: &'a JSXAttribute<'a>) -> Option<&'static str> {
        let name = attr_name(self.tree, attr);
        let kind = name.get(6..).unwrap_or("");
        let tag = self.tag_of(el);
        let value = match &attr.value {
            Some(JSXAttributeValue::ExpressionContainer(c)) => c.expression.as_expression(),
            _ => None,
        };
        let type_attr = Self::attrs(el).find(|a| attr_name(self.tree, a) == "type");
        let type_value = type_attr.and_then(|a| attr_string(self.tree, a)).unwrap_or("text");
        let dynamic_type = type_attr.is_some_and(|a| a.value.is_some() && attr_string(self.tree, a).is_none());
        let reference = match value {
            Some(Expression::Identifier(_) | Expression::StaticMemberExpression(_) | Expression::PrivateFieldExpression(_)) => true,
            Some(Expression::ChainExpression(c)) => {
                matches!(c.expression, ChainElement::StaticMemberExpression(_) | ChainElement::PrivateFieldExpression(_))
            }
            _ => false,
        };
        let allowed = match kind {
            "value" => {
                tag == "textarea"
                    || tag == "select"
                    || (tag == "input" && ["text", "search", "email", "url", "tel", "password"].contains(&type_value))
            }
            "checked" => tag == "input" && type_value == "checkbox",
            _ => false,
        };
        if dynamic_type || !reference || !allowed {
            let id = self.id(attr);
            self.diag(format!("Unsupported model binding: {name}"), id);
            return None;
        }
        Some(if kind == "value" { "value" } else { "checked" })
    }

    /// `prop:` with a literal string (attribute string or `{"…"}`): URL properties get the static
    /// URL attribute check (RV1101). False when it failed (diagnostic reported).
    fn prop_literal_ok(&mut self, attr: &'a JSXAttribute<'a>, prop: &str, tag: &str, namespace: &'static str) -> bool {
        let text = match &attr.value {
            Some(JSXAttributeValue::StringLiteral(_)) => attr_string(self.tree, attr).map(decode_html),
            Some(JSXAttributeValue::ExpressionContainer(c)) => match c.expression.as_expression().map(strip_parens) {
                Some(Expression::StringLiteral(l)) => Some(l.value.to_string()),
                _ => None,
            },
            _ => None,
        };
        let Some(text) = text else { return true };
        let lower = prop.to_ascii_lowercase();
        match encode_attribute(&lower, AttrValue::Text(&text), attribute_namespace(tag, &lower, namespace)) {
            Ok(_) => true,
            Err(message) => {
                let id = self.id(attr);
                self.diag(message, id);
                false
            }
        }
    }

    // ---- class / style groups (G10) ----
    // `class:` toggles, class objects / arrays, `style:` properties and style objects. Helpers are
    // imported from the target runtime only when used.

    /// `_spreadProps` from `@rivetjs/runtime/props` (LIVE-PROPS component spreads: object-spread semantics, the
    /// live twin of the server's `{ ...a, b }` — an own `undefined` overrides), imported on first use.
    fn props_helper(&mut self) -> String {
        self.props_export("_spreadProps", "__rivetSpreadProps")
    }

    /// Local name of a `@rivetjs/runtime/props` export, imported on first use (`base` = local name stem).
    pub(super) fn props_export(&mut self, export: &'static str, base: &str) -> String {
        if let Some((_, local)) = self.props_imports.iter().find(|(e, _)| *e == export) {
            return local.clone();
        }
        let local = self.unique(base);
        self.props_imports.push((export, local.clone()));
        local
    }

    /// Local name of `_slot` (`@rivetjs/runtime/slot`), imported on first use.
    fn slot_helper(&mut self) -> String {
        if let Some(local) = &self.slot_import {
            return local.clone();
        }
        let local = self.unique("__rivetSlot");
        self.slot_import = Some(local.clone());
        local
    }

    fn style_helper(&mut self, export: &'static str) -> String {
        if let Some((_, local)) = self.style_imports.iter().find(|(e, _)| *e == export) {
            return local.clone();
        }
        let rest = &export[1..];
        let local = self.unique(&format!("__rivet{}{}", rest[..1].to_uppercase(), &rest[1..]));
        self.style_imports.push((export, local.clone()));
        local
    }

    /// The element's class / style groups (diagnostics reported); None: neither (output unchanged).
    fn style_groups(&mut self, el: &'a JSXElement<'a>, spread: bool) -> Option<styling::Groups<'a>> {
        let groups = {
            let this = &*self;
            styling::analyze(this.tree, el, spread, &|attr| this.folded(attr))?
        };
        for (message, index) in &groups.errors {
            let id = match &el.opening_element.attributes[*index] {
                JSXAttributeItem::Attribute(attr) => self.id(&**attr),
                JSXAttributeItem::SpreadAttribute(_) => None,
            };
            self.diag(message.clone(), id);
        }
        Some(groups)
    }

    /// First attribute of the element's resumable class / style binding (spread elements: none; their
    /// class toggles and style group merge into the spread binding). Same rule as resume analysis.
    fn style_val(&mut self, value: &styling::Val<'a>) -> Expr {
        match value {
            styling::Val::Bool(true) => Expr::True,
            styling::Val::Bool(false) => Expr::Raw("false".into()),
            styling::Val::Str(text) | styling::Val::Num(text) => Expr::Str(text.clone()),
            styling::Val::Expr(e) => self.expr(e),
        }
    }

    fn class_toggles(&mut self, toggles: &[styling::Toggle<'a>]) -> Expr {
        let mut entries = Vec::new();
        for toggle in toggles {
            let value = self.style_val(&toggle.value);
            entries.push((Key::Str(toggle.name.clone()), value));
        }
        Expr::Object(entries)
    }

    /// `_class(base, { toggles })`: the merged class attribute value.
    fn class_value(&mut self, group: &styling::ClassGroup<'a>) -> Expr {
        let base = match &group.base {
            None => Expr::Null,
            Some(styling::Base::Static(text)) => Expr::Str(text.clone()),
            Some(styling::Base::Expr(e)) => self.expr(e),
        };
        let mut args = vec![base];
        if !group.toggles.is_empty() {
            args.push(self.class_toggles(&group.toggles));
        }
        Expr::call(&self.style_helper("_class"), args)
    }

    /// `_style({ props }, object, …)`: the style attribute value (source order, later wins).
    fn style_value(&mut self, group: &styling::StyleGroup<'a>) -> Expr {
        let mut parts = Vec::new();
        let mut props = Vec::new();
        for entry in &group.entries {
            match entry {
                styling::Entry::Prop(name, value) => {
                    let value = match value {
                        styling::Val::Bool(_) => Expr::Null,
                        value => self.style_val(value),
                    };
                    props.push((Key::Str(name.clone()), value));
                }
                styling::Entry::Object(e) => {
                    if !props.is_empty() {
                        parts.push(Expr::Object(std::mem::take(&mut props)));
                    }
                    parts.push(self.expr(e));
                }
            }
        }
        if !props.is_empty() {
            parts.push(Expr::Object(props));
        }
        Expr::call(&self.style_helper("_style"), parts)
    }

    /// Server class attribute: literal → markup; else a slot (`value`: a resume temp, or merged here).
    fn server_class(&mut self, group: &styling::ClassGroup<'a>, value: Option<Expr>, t: &mut ServerTemplate) {
        if let Some(text) = styling::static_class_value(group) {
            if let Some(text) = text {
                t.append(&encode_attribute("class", AttrValue::Text(&text), "html").unwrap_or_default());
            }
            return;
        }
        let value = value.unwrap_or_else(|| self.class_value(group));
        t.slot(Expr::Attr { callee: self.attribute_name.clone(), name: "class".into(), value: Box::new(value), namespace: None });
    }

    fn server_style(&mut self, group: &styling::StyleGroup<'a>, value: Option<Expr>, t: &mut ServerTemplate) {
        if let Some(text) = styling::static_style_value(group) {
            if let Some(text) = text {
                t.append(&encode_attribute("style", AttrValue::Text(&text), "html").unwrap_or_default());
            }
            return;
        }
        let value = value.unwrap_or_else(|| self.style_value(group));
        let callee = self.style_helper("_styleAttr");
        t.slot(Expr::Attr { callee, name: "style".into(), value: Box::new(value), namespace: None });
    }

    /// Spread element: its merged object with the `class:` toggles applied (`_spreadClass`).
    fn spread_with_class(&mut self, object: Expr, groups: Option<&styling::Groups<'a>>) -> Expr {
        match groups.and_then(|g| g.class.as_ref()) {
            Some(group) if !group.toggles.is_empty() => {
                let toggles = self.class_toggles(&group.toggles);
                Expr::call(&self.style_helper("_spreadClass"), vec![object, toggles])
            }
            _ => object,
        }
    }

    fn walk_server(&mut self, el: &'a JSXElement<'a>, namespace: &'static str, t: &mut ServerTemplate) {
        let mut namespace = namespace;
        let mut textarea_body: Option<Expr> = None;
        let tag = self.tag_of(el);
        let el_id = self.id(el);
        // Element preload directive: validated only (RV1102; nothing to preload on the server).
        self.preload_directive(el, tag);
        if !native_tag_name(tag) {
            self.diag(
                format!("Unsupported native tag <{tag}>: use an HTML / SVG / MathML tag, a custom element with a hyphen (<my-el>) or a capitalized component (<MyEl />)"),
                el_id,
            );
            return;
        }
        // exception: user ruling 2026-10-06 (round-2 C6) — the server target runs the parser-repair check too.
        if crate::html::parser_repaired(tag, &self.server_ancestors) {
            self.diag(format!("Unsupported parser-repaired native nesting: {tag}"), el_id);
        }
        // exception: user ruling 2026-10-06 (round-2 C5) — rows directly in <table> (implied <tbody>).
        if tag == "table" {
            if let Some(id) = self.implied_tbody_child(el) {
                self.diag(IMPLIED_TBODY, Some(id));
            }
        }
        if tag == "script" || tag == "style" {
            self.diag(
                if self.styles.is_some() {
                    "Script/style JSX content is not supported; use css`` from @rivetjs/runtime/css or build-time assets"
                } else {
                    "Script/style JSX content is not supported; use build-time assets"
                },
                el_id,
            );
            return;
        }
        if tag == "svg" || SVG_TAGS.contains(&tag) {
            namespace = "svg";
        } else if tag == "math" || MATH_TAGS.contains(&tag) {
            namespace = "mathml";
        }
        t.append(&format!("<{tag}"));
        let spread = Self::has_spread(el);
        // `<select value>` / `model:value`: the value goes to a temp the options compare with; the
        // ignored `value` attribute is not rendered.
        let select_temp = (tag == "select"
            && !spread
            && (self.has_attribute(el, "value") || self.has_attribute(el, "model:value")))
        .then(|| {
            let temp = self.unique("__rivetSelect");
            t.model_temps.push(temp.clone());
            temp
        });
        // `<option>` inside such a select (lexically, also through expressions) without its own
        // `selected`: compared by its value (attribute or static text).
        let option_of = match self.select_stack.last() {
            Some(Some(temp)) if tag == "option" && !spread && !self.has_attribute(el, "selected") => Some(temp.clone()),
            _ => None,
        };
        let mut option_value: Option<Expr> = None;
        let groups = self.style_groups(el, spread);
        for (index, item) in el.opening_element.attributes.iter().enumerate() {
            let attr = match item {
                JSXAttributeItem::SpreadAttribute(_) => continue,
                JSXAttributeItem::Attribute(attr) => &**attr,
            };
            if spread && self.spread_plain(attr, tag) {
                continue;
            }
            if let Some(groups) = groups.as_ref().filter(|g| g.members.contains(&index)) {
                if let Some(group) = groups.class.as_ref().filter(|g| !spread && g.first == index) {
                    self.server_class(group, None, t);
                }
                if let Some(group) = groups.style.as_ref().filter(|g| !spread && g.first == index) {
                    self.server_style(group, None, t);
                }
                continue;
            }
            let attr_id = self.id(attr);
            let name = attr_name(self.tree, attr);
            let namespace = attribute_namespace(tag, name, namespace);
            if name == slots::SLOT {
                self.slot_attr(el, attr);
                continue;
            }
            // exception: user ruling 2026-10-06 (round-2 C14) — literal event handlers.
            if starts_with_on(name) && Self::literal_handler(attr) {
                self.diag(format!("Event handler {name} must be a function"), attr_id);
                continue;
            }
            // exception: lane V2-Q4 (2026-10-07) — handlers bind once: RV1016 for bind-time state reads.
            self.bind_once_handler(name, attr, attr_id);
            let global = global_event(name);
            if self.is_preload_directive(attr, tag) {
                continue;
            }
            if name == "value" && select_temp.is_none() && option_of.is_some() && matches!(attr.value, Some(JSXAttributeValue::StringLiteral(_))) {
                option_value = Some(Expr::Str(attr_string(self.tree, attr).map(decode_html).unwrap_or_default()));
            } else if name == "value" && (select_temp.is_some() || option_of.is_some()) {
                let temp = match &select_temp {
                    Some(temp) => temp.clone(),
                    None => {
                        let temp = self.unique("__rivetOption");
                        t.model_temps.push(temp.clone());
                        temp
                    }
                };
                let value = match &attr.value {
                    None => Expr::True,
                    Some(JSXAttributeValue::StringLiteral(_)) => {
                        Expr::Str(attr_string(self.tree, attr).map(decode_html).unwrap_or_default())
                    }
                    _ => self.attr_value(attr),
                };
                let assign = Expr::Assign(Box::new(Expr::Ident(temp.clone())), Box::new(value));
                if select_temp.is_none() {
                    option_value = Some(Expr::Ident(temp));
                }
                if select_temp.is_some() {
                    t.slot(Expr::call(&self.abi_name("omitted"), vec![assign]));
                } else {
                    t.slot(Expr::Attr { callee: self.attribute_name.clone(), name: name.to_string(), value: Box::new(assign), namespace: None });
                }
                continue;
            }
            // exception: user ruling 2026-10-06 (round-2 C3) — a textarea's `value` / `defaultValue` is its
            // content (the attribute is ignored by browsers).
            if tag == "textarea" && namespace == "html" && !spread && (name == "value" || name == "defaultValue") {
                let value = match &attr.value {
                    None => Expr::Str(String::new()),
                    Some(JSXAttributeValue::StringLiteral(_)) => Expr::Str(attr_string(self.tree, attr).map(decode_html).unwrap_or_default()),
                    _ => self.attr_value(attr),
                };
                let temp = self.unique("__rivetTextareaValue");
                t.model_temps.push(temp.clone());
                textarea_body = Some(Expr::Ident(temp.clone()));
                let assign = Expr::Assign(Box::new(Expr::Ident(temp)), Box::new(value));
                t.slot(Expr::call(&self.abi_name("omitted"), vec![assign]));
                continue;
            }
            if name == "ref" || matches!(global, Some(Some(_))) {
                let value = self.attr_value(attr);
                // An arrow / function literal has nothing to evaluate on the server: no slot (S6).
                if !Self::function_value(attr, &value) {
                    t.slot(Expr::call(&self.abi_name("omitted"), vec![value]));
                }
                continue;
            }
            if matches!(global, Some(None)) {
                self.diag(format!("Unsupported global event attribute: {name} (write window:onX / document:onX with a capitalized event name: window:onResize={{…}})"), attr_id);
                continue;
            }
            if starts_with_on(name) {
                if event_info(name).is_none() {
                    self.diag(format!("Unknown native event: {name} (a DOM event like onClick / onInput, or on:my-event={{…}} for a custom event)"), attr_id);
                } else {
                    let value = self.attr_value(attr);
                    // exception: derived model (STATIC-ZERO T3) — a conditional handler records its value: `_rHandler(B, v)`.
                    if let Some(on) = self.derived_on(attr_id, &value) {
                        t.slot(on);
                    } else if !Self::function_value(attr, &value) {
                        t.slot(Expr::call(&self.abi_name("omitted"), vec![value]));
                    } else if let Some(on) = self.derived_orphan_on(attr_id) {
                        // exception: derived model (D5, intake 3) — a helper's handler: the open boundary listens to it.
                        t.slot(on);
                    }
                }
                continue;
            }
            if name.starts_with("prop:") {
                let Some(prop) = prop_name(name) else {
                    self.diag(format!("Unsafe or unsupported native attribute: {name}"), attr_id);
                    continue;
                };
                if !self.prop_literal_ok(attr, prop, tag, namespace) {
                    continue;
                }
                // Not rendered (the DOM target sets it in the browser).
                let value = self.attr_value(attr);
                t.slot(Expr::call(&self.abi_name("omitted"), vec![value]));
                continue;
            }
            if name.starts_with("model:") {
                if let Some(model) = self.validate_model(el, attr) {
                    let state = self.attr_value(attr);
                    let read = Expr::Call(Box::new(state), Vec::new());
                    if let Some(temp) = select_temp.as_ref().filter(|_| tag == "select") {
                        t.slot(Expr::call(
                            &self.abi_name("omitted"),
                            vec![Expr::Assign(Box::new(Expr::Ident(temp.clone())), Box::new(read))],
                        ));
                    } else if tag == "textarea" {
                        let temp = self.unique("__rivetModelValue");
                        t.model_temps.push(temp.clone());
                        textarea_body = Some(Expr::Ident(temp.clone()));
                        t.slot(Expr::call(
                            &self.abi_name("omitted"),
                            vec![Expr::Assign(Box::new(Expr::Ident(temp)), Box::new(read))],
                        ));
                    } else {
                        t.slot(Expr::Attr {
                            callee: self.attribute_name.clone(),
                            name: model.to_string(),
                            value: Box::new(read),
                            namespace: None,
                        });
                    }
                }
                continue;
            }
            if !safe_attribute_name(name) {
                self.diag(format!("Unsafe or unsupported native attribute: {name}"), attr_id);
                continue;
            }
            let static_value = match &attr.value {
                None => Some(AttrValue::True),
                Some(JSXAttributeValue::StringLiteral(_)) => None,
                _ => {
                    // dynamic
                    if self.static_attribute(attr, name, namespace, AttrSink::Server(&mut *t)) {
                        continue;
                    }
                    let value = self.attr_value(attr);
                    t.slot(Expr::Attr {
                        callee: self.attribute_name.clone(),
                        name: name.to_string(),
                        value: Box::new(value),
                        namespace: (namespace != "html").then(|| namespace.to_string()),
                    });
                    continue;
                }
            };
            let decoded = attr_string(self.tree, attr).map(decode_html);
            let value = match (&static_value, &decoded) {
                (Some(AttrValue::True), _) | (_, None) => AttrValue::True,
                (_, Some(text)) => AttrValue::Text(text),
            };
            let html_name = match name {
                "className" => "class",
                "htmlFor" => "for",
                other => other,
            };
            match encode_attribute(html_name, value, namespace) {
                Ok(text) => t.append(&text),
                Err(message) => self.diag(message, attr_id),
            }
        }
        if spread {
            let object = Expr::Object(self.spread_object(el, tag, namespace, groups.as_ref(), None));
            let object = self.spread_with_class(object, groups.as_ref());
            // exception: derived model (STATIC-ZERO T3) — a conditional boundary's forwarded listeners make it live.
            let object = self.derived_spread(el_id, object);
            self.used_abi.insert("spreadAttributes");
            let mut args = vec![object];
            args.extend(Self::spread_args(tag, namespace));
            t.slot(Expr::call(&self.abi_name("spreadAttributes"), args));
        }
        if let Some(select) = option_of {
            let value = option_value.or_else(|| {
                let mut text = String::new();
                for child in &el.children {
                    match child {
                        JSXChild::Text(part) => text.push_str(&jsx_text(self.tree.text_of(part.span))),
                        _ => return None,
                    }
                }
                Some(Expr::Str(text.split_ascii_whitespace().collect::<Vec<_>>().join(" ")))
            });
            if let Some(value) = value {
                let helper = match &self.select_helper {
                    Some(name) => name.clone(),
                    None => {
                        let name = self.unique("__rivetSelected");
                        self.hoists.push(format!(
                            "const {name} = (s, v) => (v = String(v), s != null && (Array.isArray(s) ? s.some((x) => String(x) === v) : String(s) === v));"
                        ));
                        self.select_helper = Some(name.clone());
                        name
                    }
                };
                t.slot(Expr::Attr {
                    callee: self.attribute_name.clone(),
                    name: "selected".into(),
                    value: Box::new(Expr::call(&helper, vec![Expr::Ident(select), value])),
                    namespace: None,
                });
            }
        }
        // exception: derived model (M2 C2) — `_rBAttr(B)` last in a boundary root's start tag.
        if let Some(call) = self.derived_attr(el_id) {
            t.slot(call);
        }
        t.append(">");
        // No JSX children: the merged object's `children` is the content (stored by spreadAttributes).
        if spread && spread_content(self.tree, el, tag) {
            self.used_abi.insert("spreadChildren");
            t.slot(Expr::call(&self.abi_name("spreadChildren"), Vec::new()));
        }
        if tag == "textarea" || tag == "title" {
            for child in &el.children {
                if !matches!(child, JSXChild::Text(_) | JSXChild::ExpressionContainer(_) | JSXChild::Spread(_)) {
                    let id = self.child_id(child);
                    self.diag(
                        "Textarea/title children must be scalar text expressions; elements and fragments are not supported",
                        id,
                    );
                }
            }
        }
        // HTML consumes exactly one leading textarea newline. Emit a sentinel so authored leading LF survives.
        if tag == "textarea" && namespace == "html" {
            t.append("\n");
        }
        let has_content = |this: &Self| {
            el.children.iter().any(|c| match c {
                JSXChild::Text(text) => !jsx_text(this.tree.text_of(text.span)).is_empty(),
                _ => true,
            })
        };
        if VOID_TAGS.contains(&tag) {
            if has_content(self) {
                self.diag(format!("Void elements cannot have children: self-close <{tag} /> and drop its children"), el_id);
            }
            return;
        }
        if let Some(body) = textarea_body {
            if has_content(self) {
                self.diag("Textarea model cannot also have children", el_id);
            }
            t.slot(body);
        } else if spread && tag == "textarea" && !has_content(self) {
            // exception: user ruling 2026-10-06 — a spread textarea without children or model renders
            // the merged object's `value` / `defaultValue` (else `children`) as content, after the
            // newline sentinel (`spreadAttributes` keeps them for `spreadChildren`).
            self.used_abi.insert("spreadChildren");
            t.slot(Expr::call(&self.abi_name("spreadChildren"), Vec::new()));
        }
        if tag == "select" {
            self.select_stack.push(select_temp.clone());
        }
        // exception: derived model (M2 C2) — slot marker pairs for the adopt walk (`compile/derived.rs` `slot_marks`).
        let marks = self.slot_marks(el_id, tag, &el.children);
        for child in &el.children {
            match child {
                JSXChild::Text(text) => t.append(&escaped(&jsx_text(self.tree.text_of(text.span)))),
                JSXChild::Spread(s) => {
                    let id = self.id(&**s);
                    self.diag("Spread children are not supported: render the array as one child ({items}) or map it ({items.map((x) => <li>{x}</li>)} / <For each={items} by={…}>)", id);
                }
                JSXChild::ExpressionContainer(c) => {
                    let Some(e) = c.expression.as_expression() else { continue };
                    if self.static_child_server(e, t) {
                        continue;
                    }
                    // ZERO A2 (C4b): compile-time text joins the template (no slot, no markers, no runtime escape).
                    if !OPAQUE_CONTENT.contains(&tag) && tag != "script" && tag != "style" {
                        if let Some(text) = literal_child(self.tree, e) {
                            t.append(&escaped(&text));
                            continue;
                        }
                    }
                    let value = match self.list_slot(e) {
                        Some(value) => value,
                        None => self.expr(e),
                    };
                    Self::marked_slot(t, value, marks.is_some_and(|sole| (!sole || may_render_jsx(e)) && !is_function_child(e)));
                }
                JSXChild::Element(child) if self.native(child) => {
                    self.server_ancestors.push(tag);
                    self.walk_server(child, if tag == "foreignObject" { "html" } else { namespace }, t);
                    self.server_ancestors.pop();
                }
                JSXChild::Element(_) | JSXChild::Fragment(_) => {
                    if let JSXChild::Element(c) = child {
                        if self.server_link(c, t) {
                            continue;
                        }
                    }
                    let value = match child {
                        JSXChild::Element(c) => self.lower(Jsx::Element(c)),
                        JSXChild::Fragment(f) => self.lower(Jsx::Fragment(f)),
                        _ => Expr::Null,
                    };
                    Self::marked_slot(t, value, marks.is_some());
                }
            }
        }
        if tag == "select" {
            self.select_stack.pop();
        }
        t.append(&format!("</{tag}>"));
    }

    fn child_id(&self, child: &'a JSXChild<'a>) -> Option<NodeId> {
        match child {
            JSXChild::Text(t) => self.id(&**t),
            JSXChild::Element(e) => self.id(&**e),
            JSXChild::Fragment(f) => self.id(&**f),
            JSXChild::ExpressionContainer(c) => self.id(&**c),
            JSXChild::Spread(s) => self.id(&**s),
        }
    }

    fn rcdata_parts(&mut self, el: &'a JSXElement<'a>, reactive: bool) -> Vec<Expr> {
        let mut parts = Vec::new();
        for child in &el.children {
            match child {
                JSXChild::Text(text) => {
                    let text = jsx_text(self.tree.text_of(text.span));
                    if !text.is_empty() {
                        parts.push(Expr::Str(text));
                    }
                }
                JSXChild::Spread(s) => {
                    let id = self.id(&**s);
                    self.diag("Spread children are not supported: render the array as one child ({items}) or map it ({items.map((x) => <li>{x}</li>)} / <For each={items} by={…}>)", id);
                }
                JSXChild::ExpressionContainer(c) => {
                    if let Some(e) = c.expression.as_expression() {
                        let value = self.expr(e);
                        parts.push(if reactive { Expr::thunk(value) } else { value });
                    }
                }
                _ => {
                    let id = self.child_id(child);
                    self.diag(
                        "Textarea/title children must be scalar text expressions; elements and fragments are not supported",
                        id,
                    );
                }
            }
        }
        parts
    }

    // ---- static calls (i18n) ----
    // `t("key", params)` through a static-call import binding resolves from a registered table at
    // compile time. Server templates get one fragment set per variant (static message text, escaped
    // for its context); arguments are ordinary slots and plural/select/number/date parts per-variant
    // values. The DOM target inlines its one variant. Elsewhere a call becomes a per-variant value
    // (server) or a string expression (DOM).

    fn static_setup(&mut self) {
        self.i18n = true;
        // List-mount plans read one flat fragment array.
        self.list_mounts = false;
        let mut used: Vec<usize> = self.static_bindings.values().copied().collect();
        used.sort_unstable();
        used.dedup();
        for index in used {
            if self.static_tables[index].is_none() {
                let id = self.static_calls[index].id.clone();
                self.diag(format!("Static call table \"{id}\" is not registered"), None);
            }
        }
        if self.variants.is_empty() {
            self.diag("staticCalls require at least one variant", None);
            self.variants.push("und".into());
        }
        if !self.server && self.variant.is_none_or(|v| v >= self.variants.len()) {
            self.diag("DOM target with staticCalls requires a variant index", None);
        }
    }

    /// Local name of a generated helper import, allocated on first use.
    fn i18n_name(&mut self, module: &str, export: &'static str) -> String {
        if let Some((_, _, local)) = self.i18n_imports.iter().find(|(m, e, _)| m == module && *e == export) {
            return local.clone();
        }
        let base = match export.strip_prefix('_') {
            Some(rest) => format!("__rivet{}{}", rest[..1].to_uppercase(), &rest[1..]),
            None => format!("__i18n{}{}", export[..1].to_uppercase(), &export[1..]),
        };
        let local = self.unique(&base);
        self.i18n_imports.push((module.to_string(), export, local.clone()));
        local
    }

    fn helper_module(&self, index: usize) -> String {
        format!("{}/runtime", self.static_calls[index].module)
    }

    fn locale(&self, variant: usize) -> String {
        self.variants.get(variant).cloned().unwrap_or_default()
    }

    /// Variants this target emits: all on the server, the compiled one in the DOM.
    fn emitted_variants(&self) -> Vec<usize> {
        if self.server { (0..self.variants.len()).collect() } else { vec![self.variant.unwrap_or(0)] }
    }

    /// `t("k", params)`, `` t(`p.${x}`) `` or `t.in(locale, "k", params)` through a static-call
    /// binding: None when `call` is not one, Err when diagnosed.
    #[allow(clippy::type_complexity)]
    fn static_call(
        &mut self,
        call: &'a CallExpression<'a>,
        id: Option<NodeId>,
    ) -> Option<Result<(usize, Matched<'a>, Option<&'a Expression<'a>>), ()>> {
        let (callee, is_in) = match &call.callee {
            Expression::Identifier(i) => (i, false),
            Expression::StaticMemberExpression(m) if m.property.name == "in" => match &m.object {
                Expression::Identifier(i) => (i, true),
                _ => return None,
            },
            _ => return None,
        };
        let index = *self.static_bindings.get(&self.tree.resolve(callee, false)?)?;
        let export = self.static_calls[index].export.clone();
        if call.arguments.iter().any(|a| matches!(a, Argument::SpreadElement(_))) {
            self.diag(format!("{export}() arguments cannot be spread"), id);
            return Some(Err(()));
        }
        let args: Vec<&'a Expression<'a>> = call.arguments.iter().filter_map(|a| a.as_expression()).collect();
        let (locale, rest) = if is_in { (args.first().copied(), args.get(1..).unwrap_or_default()) } else { (None, &args[..]) };
        if rest.is_empty() || rest.len() > 2 || (is_in && locale.is_none()) {
            self.diag(format!("{export}() takes a key and an optional params object"), id);
            return Some(Err(()));
        }
        let key = strip_parens(rest[0]);
        let params = rest.get(1).copied();
        let literal = match key {
            Expression::StringLiteral(s) => Some(s.value.to_string()),
            Expression::TemplateLiteral(tl) if tl.expressions.is_empty() => tl.quasis[0].value.cooked.map(|c| c.to_string()),
            _ => None,
        };
        let matched = match (literal, locale) {
            (Some(key), Some(locale)) => Matched::In(locale, key),
            (Some(key), None) => Matched::Key(key),
            (None, None) => match key {
                Expression::TemplateLiteral(tl)
                    if self.static_calls[index].prefix_lookup
                        && tl.expressions.len() == 1
                        && tl.quasis[0].value.cooked.is_some_and(|c| !c.is_empty())
                        && tl.quasis[1].value.cooked.is_some_and(|c| c.is_empty()) =>
                {
                    Matched::Prefix(tl.quasis[0].value.cooked.map(|c| c.to_string()).unwrap_or_default(), &tl.expressions[0])
                }
                _ => {
                    self.diag(
                        format!("{export}() key must be a string literal or a prefixed template literal (`prefix.${{x}}`)"),
                        id,
                    );
                    return Some(Err(()));
                }
            },
            (None, Some(_)) => {
                self.diag(format!("{export}.in() key must be a string literal"), id);
                return Some(Err(()));
            }
        };
        Some(Ok((index, matched, params)))
    }

    /// Look up and validate a message call's key and params.
    fn message(&mut self, index: usize, key: &str, params: Option<&'a Expression<'a>>, id: Option<NodeId>) -> Option<Message<'a>> {
        let table = self.static_tables[index].clone()?;
        let export = self.static_calls[index].export.clone();
        let Some(entry) = table.get(key) else {
            self.diag(format!("Unknown message key \"{key}\""), id);
            return None;
        };
        let count = self.variants.len();
        let pick = |v: usize| entry.get(v).or(entry.first());
        let variants: Vec<Vec<Part>> = (0..count).map(|v| pick(v).map(i18n::Variant::parts).unwrap_or_default()).collect();
        let texts = (0..count).map(|v| pick(v).and_then(i18n::Variant::text).map(str::to_string)).collect::<Option<Vec<_>>>();
        let mut usage = BTreeMap::new();
        for parts in &variants {
            i18n::usage(parts, false, &mut usage);
        }
        let mut values = Vec::new();
        let mut tags = FxHashMap::default();
        let mut given: Vec<String> = Vec::new();
        if let Some(params) = params {
            let Expression::ObjectExpression(object) = strip_parens(params) else {
                self.diag(format!("{export}() params must be an object literal"), id);
                return None;
            };
            for property in &object.properties {
                let ObjectPropertyKind::ObjectProperty(property) = property else {
                    self.diag(format!("{export}() params must be an object literal"), id);
                    return None;
                };
                let name = match &property.key {
                    PropertyKey::StaticIdentifier(i) if !property.computed => i.name.to_string(),
                    PropertyKey::StringLiteral(s) if !property.computed => s.value.to_string(),
                    _ => String::new(),
                };
                if name.is_empty() || property.method || property.kind != PropertyKind::Init {
                    self.diag(format!("{export}() params must be an object literal"), id);
                    return None;
                }
                let Some(u) = usage.get(&name).copied() else {
                    self.diag(format!("Unknown param \"{name}\" for \"{key}\""), id);
                    return None;
                };
                if u.tag {
                    let wrapper = self.tag_wrapper(&property.value, id)?;
                    tags.insert(name.clone(), wrapper);
                } else {
                    values.push((name.clone(), &property.value));
                }
                given.push(name);
            }
        }
        for (name, u) in &usage {
            if given.contains(name) {
                continue;
            }
            if u.tag && MESSAGE_TAGS.contains(&name.as_str()) {
                let close = if name == "br" { String::new() } else { format!("</{name}>") };
                tags.insert(name.clone(), (format!("<{name}>"), close));
            } else if u.tag {
                self.diag(format!("Tag <{name}> in \"{key}\" needs a param: {export}(\"{key}\", {{ {name}: (c) => <…>{{c}}</…> }})"), id);
                return None;
            } else {
                self.diag(format!("Missing param \"{name}\" for \"{key}\""), id);
                return None;
            }
        }
        Some(Message { key: key.to_string(), variants, texts, params: values, usage, tags })
    }

    /// `(children) => <native jsx>` with static markup around `{children}`: its HTML around the hole.
    fn tag_wrapper(&mut self, value: &'a Expression<'a>, id: Option<NodeId>) -> Option<(String, String)> {
        let element = match strip_parens(value) {
            Expression::ArrowFunctionExpression(arrow)
                if arrow.expression && !arrow.r#async && arrow.params.items.len() == 1 && arrow.params.rest.is_none() =>
            {
                match (&arrow.params.items[0].pattern.kind, arrow.get_expression().map(strip_parens).and_then(as_element)) {
                    (BindingPatternKind::BindingIdentifier(param), Some(el)) if self.native(el) => Some((param.name.as_str(), el)),
                    _ => None,
                }
            }
            _ => None,
        };
        let Some((hole, el)) = element else {
            self.diag("Tag param must be (children) => <jsx>", id);
            return None;
        };
        let (mut open, mut close, mut found) = (String::new(), String::new(), false);
        if self.static_markup(el, hole, "html", &mut open, &mut close, &mut found).is_err() || !found {
            self.diag("Tag param JSX must be static native markup around {children}", id);
            return None;
        }
        Some((open, close))
    }

    fn static_markup(
        &self,
        el: &'a JSXElement<'a>,
        hole: &str,
        namespace: &'static str,
        open: &mut String,
        close: &mut String,
        found: &mut bool,
    ) -> Result<(), ()> {
        let tag = self.tag_of(el);
        if !native_tag_name(tag) || tag == "script" || tag == "style" {
            return Err(());
        }
        let namespace = if tag == "svg" || SVG_TAGS.contains(&tag) {
            "svg"
        } else if tag == "math" || MATH_TAGS.contains(&tag) {
            "mathml"
        } else {
            namespace
        };
        let mut html = format!("<{tag}");
        for item in &el.opening_element.attributes {
            let JSXAttributeItem::Attribute(attr) = item else { return Err(()) };
            let name = attr_name(self.tree, attr);
            let namespace = attribute_namespace(tag, name, namespace);
            if starts_with_on(name)
                || name.starts_with("model:")
                || name.starts_with("prop:")
                || styling::directive(name)
                || name == "ref"
                || !safe_attribute_name(name)
            {
                return Err(());
            }
            let decoded = attr_string(self.tree, attr).map(decode_html);
            let value = match (&attr.value, &decoded) {
                (None, _) => AttrValue::True,
                (_, Some(text)) => AttrValue::Text(text),
                _ => return Err(()),
            };
            let html_name = match name {
                "className" => "class",
                "htmlFor" => "for",
                other => other,
            };
            html.push_str(&encode_attribute(html_name, value, namespace).map_err(|_| ())?);
        }
        html.push('>');
        (if *found { &mut *close } else { &mut *open }).push_str(&html);
        if VOID_TAGS.contains(&tag) {
            return if el.children.iter().all(|c| matches!(c, JSXChild::Text(t) if jsx_text(self.tree.text_of(t.span)).is_empty())) {
                Ok(())
            } else {
                Err(())
            };
        }
        for child in &el.children {
            match child {
                JSXChild::Text(text) => {
                    let text = escaped(&jsx_text(self.tree.text_of(text.span)));
                    (if *found { &mut *close } else { &mut *open }).push_str(&text);
                }
                JSXChild::ExpressionContainer(c) => match &c.expression {
                    JSXExpression::EmptyExpression(_) => {}
                    JSXExpression::Identifier(i) if i.name == hole && !*found => *found = true,
                    _ => return Err(()),
                },
                JSXChild::Element(child) if self.native(child) => {
                    self.static_markup(child, hole, if tag == "foreignObject" { "html" } else { namespace }, open, close, found)?
                }
                _ => return Err(()),
            }
        }
        (if *found { &mut *close } else { &mut *open }).push_str(&format!("</{tag}>"));
        Ok(())
    }

    /// Message runtime helpers needed by `parts` (empty names for unused ones).
    fn message_names(&mut self, index: usize, parts: &[&[Part]]) -> i18n::Names {
        let mut uses = [false; 4];
        for p in parts {
            i18n::runtime_uses(p, &mut uses);
        }
        let module = self.helper_module(index);
        let mut names = i18n::Names::default();
        for (n, export, slot) in [
            (0, "plural", &mut names.plural),
            (1, "select", &mut names.select),
            (2, "number", &mut names.number),
            (3, "date", &mut names.date),
        ] {
            if uses[n] {
                *slot = self.i18n_name(&module, export);
            }
        }
        names
    }

    /// Non-JSX position: server per-variant value, DOM string expression.
    fn static_value(&mut self, index: usize, matched: Matched<'a>, params: Option<&'a Expression<'a>>, id: Option<NodeId>) -> Expr {
        match matched {
            Matched::Key(key) => match self.message(index, &key, params, id) {
                Some(message) => self.message_value(index, &message, None, id),
                None => Expr::Null,
            },
            Matched::Prefix(prefix, key) => self.prefix_value(index, &prefix, key, params, id),
            Matched::In(locale, key) => self.message_in(index, locale, &key, params, id),
        }
    }

    /// Expressions of `message` for `variants`; params read through `param`. `strings`: the string
    /// position (an attribute, `t.in()`) where tags are diagnosed; None: a value position, where a
    /// message with tags (top level or inside plural/select cases) is a template of its own.
    fn message_strings(
        &mut self,
        index: usize,
        message: &Message<'a>,
        variants: &[usize],
        param: &dyn Fn(&str) -> String,
        strings: Option<&'static str>,
        id: Option<NodeId>,
    ) -> Option<Vec<String>> {
        let refs: Vec<&[Part]> = variants.iter().map(|&v| message.variants[v].as_slice()).collect();
        let names = self.message_names(index, &refs);
        let mut out = Vec::new();
        for &v in variants {
            let parts = &message.variants[v];
            let result = match strings {
                None if i18n::has_tag(parts) => self.case_template(parts, v, param, &names, &message.tags).map(|t| t.print()),
                _ => i18n::string_expr(parts, &self.locale(v), param, &names, self.time_zone.as_deref()),
            };
            match result {
                Ok(text) => out.push(text),
                Err(tag) => {
                    let key = &message.key;
                    let text = match strings {
                        Some("t.in()") => format!(
                            "Message tags ({tag} in \"{key}\") are not supported in t.in(): it returns a string, and tags need JSX content. Use t() in JSX (children, a prop, a variable), or a message without tags"
                        ),
                        Some(position) => format!(
                            "Message tags ({tag} in \"{key}\") are not supported in {position}: attribute values are strings, and tags need JSX content. Use a message without tags here, or render this one as JSX (children, a prop, a variable)"
                        ),
                        None => format!("Message tag {tag} in \"{key}\" cannot be lowered here"),
                    };
                    self.diag(text, id);
                    return None;
                }
            }
        }
        Some(out)
    }

    /// `((p…) => body)(args…)`: params evaluated once, in source order, where the call was.
    fn with_params(locals: Vec<String>, body: Expr, args: Vec<Expr>) -> Expr {
        if locals.is_empty() { body } else { Expr::Call(Box::new(Expr::Arrow(locals, Box::new(body))), args) }
    }

    /// `strings`: see `message_strings` (None: tags make the value JSX content).
    fn message_value(&mut self, index: usize, message: &Message<'a>, strings: Option<&'static str>, id: Option<NodeId>) -> Expr {
        let args: Vec<Expr> = message.params.iter().map(|(_, e)| self.expr(e)).collect();
        let variants = self.emitted_variants();
        if let Some(texts) = &message.texts {
            if !self.server {
                return Expr::Str(texts[variants[0]].clone());
            }
            let value = self.i18n_name("@rivetjs/runtime/server", "_variantValue");
            return Expr::call(&value, vec![Expr::Array(texts.iter().map(|t| Expr::Str(t.clone())).collect())]);
        }
        let locals: Vec<String> = message.params.iter().map(|_| self.unique("__rivetP")).collect();
        let names: Vec<String> = message.params.iter().map(|(n, _)| n.clone()).collect();
        let param = |name: &str| names.iter().position(|n| n == name).map(|i| locals[i].clone()).unwrap_or_default();
        let Some(strings) = self.message_strings(index, message, &variants, &param, strings, id) else { return Expr::Null };
        let body = if self.server {
            let value = self.i18n_name("@rivetjs/runtime/server", "_variantValue");
            let values = strings
                .into_iter()
                .zip(&variants)
                .map(|(s, &v)| if message.variants[v].iter().all(|p| matches!(p, Part::Text { .. })) { Expr::Raw(s) } else { Expr::thunk(Expr::Raw(s)) })
                .collect();
            Expr::call(&value, vec![Expr::Array(values)])
        } else {
            Expr::Raw(strings.into_iter().next().unwrap_or_default())
        };
        Self::with_params(locals, body, args)
    }

    /// `t.in(locale, "k", params)`: the locale's message, picked at runtime on both targets.
    fn message_in(
        &mut self,
        index: usize,
        locale: &'a Expression<'a>,
        key: &str,
        params: Option<&'a Expression<'a>>,
        id: Option<NodeId>,
    ) -> Expr {
        let Some(message) = self.message(index, key, params, id) else { return Expr::Null };
        let locale = self.expr(locale);
        let mut args: Vec<Expr> = message.params.iter().map(|(_, e)| self.expr(e)).collect();
        let locals: Vec<String> = message.params.iter().map(|_| self.unique("__rivetP")).collect();
        let names: Vec<String> = message.params.iter().map(|(n, _)| n.clone()).collect();
        let param = |name: &str| names.iter().position(|n| n == name).map(|i| locals[i].clone()).unwrap_or_default();
        let all: Vec<usize> = (0..self.variants.len()).collect();
        let Some(strings) = self.message_strings(index, &message, &all, &param, Some("t.in()"), id) else { return Expr::Null };
        let pick = self.i18n_name(&self.helper_module(index), "pick");
        let list = Expr::Array(self.variants.iter().map(|v| Expr::Str(v.clone())).collect());
        let thunks = Expr::Array(strings.into_iter().map(|s| Expr::thunk(Expr::Raw(s))).collect());
        if locals.is_empty() {
            return Expr::call(&pick, vec![locale, list, thunks]);
        }
        let l = self.unique("__rivetL");
        let mut all_locals = vec![l.clone()];
        all_locals.extend(locals);
        args.insert(0, locale);
        Self::with_params(all_locals, Expr::call(&pick, vec![Expr::Ident(l), list, thunks]), args)
    }

    /// `` t(`prefix.${x}`) ``: lookup in a hoisted per-variant object of the keys under `prefix`.
    fn prefix_value(
        &mut self,
        index: usize,
        prefix: &str,
        key: &'a Expression<'a>,
        params: Option<&'a Expression<'a>>,
        id: Option<NodeId>,
    ) -> Expr {
        if params.is_some() {
            self.diag("Prefixed keys must not take params", id);
            return Expr::Null;
        }
        let Some(table) = self.static_tables[index].clone() else { return Expr::Null };
        let mut keys: Vec<&String> = table.keys().filter(|k| k.starts_with(prefix)).collect();
        keys.sort();
        if keys.is_empty() {
            self.diag(format!("No message keys match prefix \"{prefix}\""), id);
            return Expr::Null;
        }
        let variants = self.emitted_variants();
        let mut objects = Vec::new();
        for &v in &variants {
            let mut entries = Vec::new();
            for k in &keys {
                let entry = &table[*k];
                let Some(text) = entry.get(v).or(entry.first()).and_then(i18n::Variant::text) else {
                    self.diag(format!("Prefixed keys must not take params (\"{k}\")"), id);
                    return Expr::Null;
                };
                entries.push(format!("{}: {}", quote(&k[prefix.len()..]), quote(text)));
            }
            objects.push(format!("{{ {} }}", entries.join(", ")));
        }
        let hoisted = match self.prefix_tables.get(prefix) {
            Some(name) => name.clone(),
            None => {
                let name = self.unique(&format!("__rivetI18n{}", self.hoists.len()));
                let value = if self.server { format!("[{}]", objects.join(", ")) } else { objects.remove(0) };
                self.hoists.push(format!("const {name} = {value};"));
                self.prefix_tables.insert(prefix.to_string(), name.clone());
                name
            }
        };
        let k = self.unique("__rivetK");
        let missing = if self.dev {
            format!("(console.warn({} + {k}), \"\")", quote(&format!("rivet i18n: missing message {prefix}")))
        } else {
            "\"\"".to_string()
        };
        let lookup = |object: String| Expr::Raw(format!("(Object.hasOwn({object}, {k}) ? {object}[{k}] : {missing})"));
        let body = if self.server {
            let value = self.i18n_name("@rivetjs/runtime/server", "_variantValue");
            let values = (0..variants.len()).map(|v| Expr::thunk(lookup(format!("{hoisted}[{v}]")))).collect();
            Expr::call(&value, vec![Expr::Array(values)])
        } else {
            lookup(hoisted)
        };
        let key = self.expr(key);
        Self::with_params(vec![k], body, vec![Expr::Raw(format!("`${{{}}}`", key.print()))])
    }

    /// A message call as an element child, lowered into the server template. False: not one.
    fn static_child_server(&mut self, e: &'a Expression<'a>, t: &mut ServerTemplate) -> bool {
        if !self.i18n {
            return false;
        }
        let Expression::CallExpression(call) = strip_parens(e) else { return false };
        let id = self.id(&**call);
        match self.static_call(call, id) {
            None | Some(Ok((_, Matched::In(..), _))) => false,
            Some(Err(())) => true,
            Some(Ok((index, Matched::Prefix(prefix, key), params))) => {
                let value = self.prefix_value(index, &prefix, key, params, id);
                t.slot(value);
                true
            }
            Some(Ok((index, Matched::Key(key), params))) => {
                if let Some(message) = self.message(index, &key, params, id) {
                    self.server_message(index, &message, t, id);
                }
                true
            }
        }
    }

    /// Static text into each variant's fragments; arguments as slots (each param evaluated once, in
    /// source order); formatter parts as per-variant values. Variants may order slots differently.
    fn server_message(&mut self, index: usize, message: &Message<'a>, t: &mut ServerTemplate, id: Option<NodeId>) {
        let count = t.sets.len();
        if let Some(texts) = &message.texts {
            for (v, text) in texts.iter().enumerate().take(count) {
                t.append_variant(v, &escaped(text));
            }
            return;
        }
        // Params read by generated code are assigned to temps by an omitted slot; others are slots.
        let mut slot_of: FxHashMap<String, usize> = FxHashMap::default();
        let mut temps: Vec<(String, String)> = Vec::new();
        let mut assignments = Vec::new();
        for (name, e) in &message.params {
            let value = self.expr(e);
            if message.usage.get(name).is_some_and(|u| u.inner) {
                let temp = self.unique("__rivetP");
                t.model_temps.push(temp.clone());
                let assign = Expr::Assign(Box::new(Expr::Ident(temp.clone())), Box::new(value));
                assignments.push(t.add_slot(Expr::call(&self.abi_name("omitted"), vec![assign])));
                temps.push((name.clone(), temp));
            } else {
                slot_of.insert(name.clone(), t.add_slot(value));
            }
        }
        for v in 0..count {
            for &slot in &assignments {
                t.emit_slot(v, slot);
            }
        }
        for (name, temp) in &temps {
            if message.usage.get(name).is_some_and(|u| u.top) {
                slot_of.insert(name.clone(), t.add_slot(Expr::Ident(temp.clone())));
            }
        }
        // The k-th formatter part of every variant shares slot k.
        let formatters: Vec<Vec<Part>> = message.variants.iter().map(|parts| formatter_parts(parts)).collect();
        let refs: Vec<&[Part]> = formatters.iter().map(Vec::as_slice).collect();
        let names = self.message_names(index, &refs);
        let param = |name: &str| temps.iter().find(|(n, _)| n == name).map(|(_, t)| t.clone()).unwrap_or_default();
        let mut slots = Vec::new();
        let widest = formatters.iter().map(Vec::len).max().unwrap_or(0);
        for k in 0..widest {
            let mut values = Vec::new();
            for (v, parts) in formatters.iter().enumerate() {
                match parts.get(k) {
                    None => values.push(Expr::str("")),
                    Some(part) => match self.formatter_js(part, v, &param, &names, &message.tags) {
                        Ok(text) => values.push(Expr::thunk(Expr::Raw(text))),
                        Err(tag) => {
                            self.diag(format!("Message tag {tag} in \"{}\" cannot be lowered here", message.key), id);
                            return;
                        }
                    },
                }
            }
            let value = self.i18n_name("@rivetjs/runtime/server", "_variantValue");
            slots.push(t.add_slot(Expr::call(&value, vec![Expr::Array(values)])));
        }
        for v in 0..count {
            let mut k = 0;
            Self::emit_parts(v, &message.variants[v], t, &slot_of, &slots, &mut k, &message.tags);
        }
    }

    fn emit_parts(
        v: usize,
        parts: &[Part],
        t: &mut ServerTemplate,
        slot_of: &FxHashMap<String, usize>,
        formatters: &[usize],
        k: &mut usize,
        tags: &FxHashMap<String, (String, String)>,
    ) {
        for part in parts {
            match part {
                Part::Text { t: text } => t.append_variant(v, &escaped(text)),
                Part::Arg { a } => {
                    if let Some(&slot) = slot_of.get(a) {
                        t.emit_slot(v, slot);
                    }
                }
                Part::Tag { tag, c } => {
                    let (open, close) = tags.get(tag).cloned().unwrap_or_default();
                    t.append_variant(v, &open);
                    Self::emit_parts(v, c, t, slot_of, formatters, k, tags);
                    t.append_variant(v, &close);
                }
                _ => {
                    if let Some(&slot) = formatters.get(*k) {
                        t.emit_slot(v, slot);
                    }
                    *k += 1;
                }
            }
        }
    }

    /// A formatter part as JavaScript in variant `v`. Plural/select cases holding tags evaluate to
    /// a nested template (server compiled template, DOM template); other cases stay strings.
    fn formatter_js(
        &mut self,
        part: &Part,
        v: usize,
        param: &dyn Fn(&str) -> String,
        names: &i18n::Names,
        tags: &FxHashMap<String, (String, String)>,
    ) -> Result<String, String> {
        let locale = self.locale(v);
        let tz = self.time_zone.clone();
        if !i18n::part_has_tag(part) {
            return i18n::part_expr(part, &locale, param, names, tz.as_deref());
        }
        let l = quote(&locale);
        let (cases, head, tail) = match part {
            Part::Plural { p, ord, cases } => {
                (cases, format!("{}({l}, {}, ", names.plural, param(p)), if ord.unwrap_or(false) { ", true)" } else { ")" })
            }
            Part::Select { s, cases } => (cases, format!("{}({}, ", names.select, param(s)), ")"),
            Part::Tag { tag, .. } => return Err(format!("<{tag}>")),
            _ => return i18n::part_expr(part, &locale, param, names, tz.as_deref()),
        };
        let mut out = Vec::new();
        for (k, case) in cases {
            let body = if i18n::has_tag(case) {
                self.case_template(case, v, param, names, tags)?.print()
            } else {
                i18n::string_expr(case, &locale, param, names, tz.as_deref())?
            };
            out.push(format!("{}: () => {}", quote(k), body));
        }
        Ok(format!("{head}{{ {} }}{tail}", out.join(", ")))
    }

    /// One plural/select case with tags as a template of its own: static text and tag markup as
    /// fragments (server) or spec HTML (DOM), arguments and nested formatters as child slots.
    fn case_template(
        &mut self,
        parts: &[Part],
        v: usize,
        param: &dyn Fn(&str) -> String,
        names: &i18n::Names,
        tags: &FxHashMap<String, (String, String)>,
    ) -> Result<Expr, String> {
        if self.server {
            let mut t = ServerTemplate::new(1);
            self.case_server(parts, v, param, names, tags, &mut t)?;
            let name = self.unique(&format!("__rivetFragments{}", self.hoists.len()));
            let list = t.sets[0].0.iter().map(|s| quote(s)).collect::<Vec<_>>().join(", ");
            self.hoists.push(format!("const {name} = /*#__PURE__*/ Object.freeze([{list}]);"));
            return Ok(Expr::Template { callee: self.template_name.clone(), fragments: name, slots: t.slots });
        }
        // DOM: case / value templates with `_tpl` (`dom_v2_i18n.rs`).
        self.case_template_v2(parts, v, param, names, tags)
    }

    fn case_server(
        &mut self,
        parts: &[Part],
        v: usize,
        param: &dyn Fn(&str) -> String,
        names: &i18n::Names,
        tags: &FxHashMap<String, (String, String)>,
        t: &mut ServerTemplate,
    ) -> Result<(), String> {
        for part in parts {
            match part {
                Part::Text { t: text } => t.append(&escaped(text)),
                Part::Arg { a } => t.slot(Expr::Raw(format!("({})", param(a)))),
                Part::Tag { tag, c } => {
                    let (open, close) = tags.get(tag).cloned().unwrap_or_default();
                    t.append(&open);
                    self.case_server(c, v, param, names, tags, t)?;
                    t.append(&close);
                }
                _ => {
                    let js = self.formatter_js(part, v, param, names, tags)?;
                    t.slot(Expr::Raw(js));
                }
            }
        }
        Ok(())
    }

    /// A message call as a native attribute value. False: not one.
    fn static_attribute(&mut self, attr: &'a JSXAttribute<'a>, name: &str, namespace: &'static str, mut sink: AttrSink) -> bool {
        if !self.css_blocks.is_empty() {
            if let Some(text) = self.folded_attribute(attr) {
                let html_name = match name {
                    "className" => "class",
                    "htmlFor" => "for",
                    other => other,
                };
                match encode_attribute(html_name, AttrValue::Text(&text), namespace) {
                    Ok(text) => match &mut sink {
                        AttrSink::Server(t) => t.append(&text),
                        AttrSink::Check => {}
                    },
                    Err(message) => {
                        let id = self.id(attr);
                        self.diag(message, id);
                    }
                }
                return true;
            }
        }
        if !self.i18n {
            return false;
        }
        let Some(JSXAttributeValue::ExpressionContainer(c)) = &attr.value else { return false };
        let Some(e) = c.expression.as_expression() else { return false };
        let Expression::CallExpression(call) = strip_parens(e) else { return false };
        let id = self.id(&**call);
        let (index, matched, params) = match self.static_call(call, id) {
            None => return false,
            Some(Err(())) => return true,
            Some(Ok(found)) => found,
        };
        let value = match matched {
            Matched::Key(key) => {
                let Some(message) = self.message(index, &key, params, id) else { return true };
                if let Some(texts) = &message.texts {
                    // Plain text: a static attribute per variant.
                    let html_name = match name {
                        "className" => "class",
                        "htmlFor" => "for",
                        other => other,
                    };
                    for v in self.emitted_variants() {
                        match encode_attribute(html_name, AttrValue::Text(&texts[v]), namespace) {
                            Ok(text) => match &mut sink {
                                AttrSink::Server(t) => t.append_variant(v, &text),
                                AttrSink::Check => {}
                            },
                            Err(message) => {
                                self.diag(message, id);
                                return true;
                            }
                        }
                    }
                    return true;
                }
                self.message_value(index, &message, Some("an attribute"), id)
            }
            Matched::Prefix(prefix, key) => self.prefix_value(index, &prefix, key, params, id),
            Matched::In(locale, key) => self.message_in(index, locale, &key, params, id),
        };
        match sink {
            AttrSink::Server(t) => t.slot(Expr::Attr {
                callee: self.attribute_name.clone(),
                name: name.to_string(),
                value: Box::new(value),
                namespace: (namespace != "html").then(|| namespace.to_string()),
            }),
            AttrSink::Check => {}
        }
        true
    }

}

/// Where a static attribute message is written (`Check`: nowhere, diagnostics only — `report_dom`).
enum AttrSink<'s> {
    Server(&'s mut ServerTemplate),
    Check,
}

/// Formatter parts of a message in emission order (tag children included).
fn formatter_parts(parts: &[Part]) -> Vec<Part> {
    let mut out = Vec::new();
    for part in parts {
        match part {
            Part::Tag { c, .. } => out.extend(formatter_parts(c)),
            p if i18n::is_formatter(p) => out.push(p.clone()),
            _ => {}
        }
    }
    out
}

impl<'t, 'a> Compiler<'t, 'a> {
    // ---- optimized list mounts ----
    // Compiled JSX output is opaque, so a `.map` whose result is consumed directly by a native
    // element slot need not materialize one record per row: rows push their slot values onto one
    // flat tape shared by the whole list. Evaluation stays eager and in author order; `_list`
    // mirrors the intrinsic map's observable steps or runs the original.

    /// Model bindings, `<select value>` and options under one: not list-mount eligible.
    fn has_model(&self, id: NodeId) -> bool {
        let tree = self.tree;
        let in_select = matches!(self.select_stack.last(), Some(Some(_)));
        let mut found = false;
        tree.walk(id, &mut |n| {
            match tree.kind(n) {
                AstKind::JSXAttribute(attr)
                    if ["model:", "prop:", "on:"].iter().any(|p| attr_name(tree, attr).starts_with(p)) =>
                {
                    found = true
                }
                AstKind::JSXElement(el) => {
                    let tag = tree.text_of(el.opening_element.name.span());
                    let value = el.opening_element.attributes.iter().any(
                        |a| matches!(a, JSXAttributeItem::Attribute(a) if attr_name(tree, a) == "value"),
                    );
                    if (tag == "select" && value) || (tag == "option" && in_select) {
                        found = true;
                    }
                }
                _ => {}
            }
            !found
        });
        found
    }

    fn function_like(&self, id: NodeId) -> bool {
        match self.tree.kind(id) {
            AstKind::Function(_) | AstKind::ArrowFunctionExpression(_) | AstKind::Class(_) | AstKind::MethodDefinition(_) => true,
            AstKind::ObjectProperty(p) => p.method || p.kind != PropertyKind::Init,
            _ => false,
        }
    }

    fn top_level_function(&self, id: NodeId) -> bool {
        let tree = self.tree;
        match tree.parent(id).map(|p| (p, tree.kind(p))) {
            Some((_, AstKind::Program(_))) => true,
            Some((p, AstKind::ExportNamedDeclaration(_) | AstKind::ExportDefaultDeclaration(_))) => {
                matches!(tree.parent(p).map(|g| tree.kind(g)), Some(AstKind::Program(_)))
            }
            _ => false,
        }
    }

    /// The trailing `return <native JSX>` root of an inlinable component.
    fn returned(&self, decl: NodeId) -> Option<&'a JSXElement<'a>> {
        let AstKind::Function(f) = self.tree.kind(decl) else { return None };
        let last = f.body.as_ref()?.statements.last()?;
        let Statement::ReturnStatement(ret) = last else { return None };
        as_element(strip_parens(ret.argument.as_ref()?))
    }

    /// Components whose whole body can run in a twin that pushes captures instead of returning.
    fn inlinable(&self, decl: NodeId) -> bool {
        let tree = self.tree;
        // exception: derived model (M2 C2) — a boundary keeps its own body (its `_rB` / `_rBOut` wrapping).
        if self.derived.as_ref().is_some_and(|d| d.plan.boundaries.contains_key(&decl)) {
            return false;
        }
        let AstKind::Function(f) = tree.kind(decl) else { return false };
        if f.r#type != FunctionType::FunctionDeclaration
            || f.id.is_none()
            || f.generator
            || f.r#async
            || f.declare
            || !self.top_level_function(decl)
            || f.params.items.len() + usize::from(f.params.rest.is_some()) > 1
            || f.params.rest.is_some()
        {
            return false;
        }
        let Some(body) = &f.body else { return false };
        let Some(Statement::ReturnStatement(last)) = body.statements.last() else { return false };
        let Some(argument) = &last.argument else { return false };
        let Some(root) = as_element(strip_parens(argument)) else { return false };
        let Some(root_id) = self.id(root) else { return false };
        if !self.native(root) || self.has_model(root_id) {
            return false;
        }
        let last_id = self.id(&**last);
        let mut ok = true;
        // Only the trailing return may leave the body; nested functions own their returns.
        let returns_ok = |this: &Self, start: NodeId, ok: &mut bool| {
            tree.walk(start, &mut |n| {
                if matches!(tree.kind(n), AstKind::ReturnStatement(_)) && Some(n) != last_id {
                    *ok = false;
                    return false;
                }
                *ok && !this.function_like(n)
            });
        };
        // The twin is a different function, so this/arguments/super/new.target must not refer to C's.
        // Arrow functions inherit them and are scanned; other functions and classes bind their own.
        let receiver_ok = |this: &Self, start: NodeId, ok: &mut bool| {
            tree.walk(start, &mut |n| {
                let bad = match tree.kind(n) {
                    AstKind::ThisExpression(_) | AstKind::Super(_) | AstKind::MetaProperty(_) => true,
                    AstKind::IdentifierReference(i) => i.name == "arguments",
                    AstKind::IdentifierName(i) => i.name == "arguments",
                    AstKind::BindingIdentifier(i) => i.name == "arguments",
                    _ => false,
                };
                if bad {
                    *ok = false;
                    return false;
                }
                *ok && (!this.function_like(n) || matches!(tree.kind(n), AstKind::ArrowFunctionExpression(_)))
            });
        };
        for statement in &body.statements {
            let Some(sid) = tree.node_at(oxc_allocator::GetAddress::address(statement)) else { continue };
            returns_ok(self, sid, &mut ok);
            receiver_ok(self, sid, &mut ok);
        }
        for parameter in &f.params.items {
            if let Some(pid) = self.id(parameter) {
                receiver_ok(self, pid, &mut ok);
            }
        }
        if !ok || !self.has_checker {
            return false;
        }
        // A reassigned binding could make call sites reach a different function.
        let Some(symbol) = f.id.as_ref().and_then(|i| i.symbol_id.get()) else { return false };
        let mut reassigned = false;
        tree.walk(tree.root(), &mut |n| {
            if let AstKind::IdentifierReference(i) = tree.kind(n) {
                if tree.symbol_of_ref(i) == Some(symbol) {
                    match tree.parent_kind(n) {
                        Some(AstKind::AssignmentExpression(a)) if a.left.span() == i.span => reassigned = true,
                        Some(AstKind::UpdateExpression(_)) => reassigned = true,
                        _ => {}
                    }
                }
            }
            !reassigned
        });
        !reassigned
    }

    /// `items.map(item => <jsx/>)` with a plain arrow callback.
    fn map_shape(&self, e: &'a Expression<'a>) -> Option<MapSite<'a>> {
        let Expression::CallExpression(call) = strip_parens(e) else { return None };
        if !self.server || !self.list_mounts || call.optional || call.arguments.len() != 1 {
            return None;
        }
        let Expression::StaticMemberExpression(member) = &call.callee else { return None };
        if member.optional || member.property.name != "map" {
            return None;
        }
        let callback = call.arguments[0].as_expression().map(strip_parens)?;
        let Expression::ArrowFunctionExpression(callback) = callback else { return None };
        let params = &callback.params;
        let count = params.items.len() + usize::from(params.rest.is_some());
        if callback.r#async || !callback.expression || !(1..=2).contains(&count) || params.rest.is_some() {
            return None;
        }
        if params.items.iter().any(|p| !matches!(p.pattern.kind, BindingPatternKind::BindingIdentifier(_)) || p.pattern.optional) {
            return None;
        }
        let body = as_element(strip_parens(callback.get_expression()?))?;
        let body_id = self.id(body)?;
        if self.has_model(body_id) {
            return None;
        }
        if self.native(body) {
            return Some(MapSite { call, callback, body, tag: None, component: None });
        }
        let JSXElementName::IdentifierReference(tag) = &body.opening_element.name else { return None };
        if body.opening_element.attributes.iter().any(|a| matches!(a, JSXAttributeItem::SpreadAttribute(_))) {
            return None;
        }
        Some(MapSite { call, callback, body, tag: Some(tag), component: None })
    }

    fn map_site(&self, e: &'a Expression<'a>) -> Option<MapSite<'a>> {
        let mut site = self.map_shape(e)?;
        let Some(tag) = site.tag else { return Some(site) };
        let decl = self.resolve_ref(tag, false)?;
        if !self.twins.contains_key(&decl) {
            return None;
        }
        site.component = Some(decl);
        Some(site)
    }

    /// Component elements in direct child positions of a native tree (through native elements only).
    fn child_components(&self, root: &'a JSXElement<'a>) -> Vec<&'a JSXElement<'a>> {
        let mut found = Vec::new();
        let mut stack = vec![root];
        // Depth-first in source order.
        fn scan<'a>(this: &Compiler<'_, 'a>, el: &'a JSXElement<'a>, found: &mut Vec<&'a JSXElement<'a>>) {
            for child in &el.children {
                let JSXChild::Element(child) = child else { continue };
                if this.native(child) { scan(this, child, found) } else { found.push(child) }
            }
        }
        if let Some(root) = stack.pop() {
            scan(self, root, &mut found);
        }
        found
    }

    fn discover_twins(&mut self) {
        let tree = self.tree;
        let mut queue: Vec<Option<NodeId>> = Vec::new();
        tree.walk(tree.root(), &mut |n| {
            // exception: user ruling 2026-10-06 (FLATTEN-CMP-3) — `<For>` row bodies seed twins like `.map` rows.
            if let AstKind::JSXElement(el) = tree.kind(n) {
                if let Some((_, body)) = self.for_shape(el) {
                    if self.native(body) {
                        for child in self.child_components(body) {
                            queue.push(self.resolve_tag(&child.opening_element.name));
                        }
                    } else {
                        queue.push(self.resolve_tag(&body.opening_element.name));
                    }
                }
            }
            let expression = match tree.kind(n) {
                AstKind::JSXExpressionContainer(c) => c.expression.as_expression(),
                AstKind::JSXSpreadChild(s) => Some(&s.expression),
                _ => None,
            };
            if let Some(expression) = expression {
                if let Some(AstKind::JSXElement(parent)) = tree.parent_kind(n) {
                    if is_native(tree, parent) {
                        if let Some(site) = self.map_shape(expression) {
                            if self.native(site.body) {
                                for el in self.child_components(site.body) {
                                    queue.push(self.resolve_tag(&el.opening_element.name));
                                }
                            } else {
                                queue.push(self.resolve_tag(&site.body.opening_element.name));
                            }
                        }
                    }
                }
            }
            true
        });
        let mut seen = FxHashSet::default();
        while let Some(entry) = queue.pop() {
            let Some(decl) = entry else { continue };
            if !seen.insert(decl) || !self.inlinable(decl) {
                continue;
            }
            let AstKind::Function(f) = tree.kind(decl) else { continue };
            let name = f.id.as_ref().map(|i| i.name.as_str()).unwrap_or_default();
            let tape = self.unique(&format!("{name}__rivetTape"));
            let plan = self.unique(&format!("{name}__rivetPlan"));
            let keys = self.positional(f);
            self.twins.insert(decl, Twin { tape, plan, keys });
            self.twin_order.push(decl);
            let nested: Vec<Option<NodeId>> = match self.returned(decl) {
                Some(root) => self
                    .child_components(root)
                    .into_iter()
                    .filter(|el| !el.opening_element.attributes.iter().any(|a| matches!(a, JSXAttributeItem::SpreadAttribute(_))))
                    .map(|el| self.resolve_tag(&el.opening_element.name))
                    .collect(),
                None => Vec::new(),
            };
            self.edges.insert(decl, nested.iter().flatten().copied().collect());
            queue.extend(nested);
        }
        let twins: FxHashSet<NodeId> = self.twins.keys().copied().collect();
        for list in self.edges.values_mut() {
            list.retain(|n| twins.contains(n));
        }
    }

    /// A flat destructured props parameter `{ a, b: c, d = 1 }` becomes positional parameters, so
    /// call sites pass values instead of allocating the props object the pattern would discard.
    fn positional(&self, f: &'a Function<'a>) -> Option<Vec<String>> {
        let Some(parameter) = f.params.items.first() else { return Some(Vec::new()) };
        let BindingPatternKind::ObjectPattern(pattern) = &parameter.pattern.kind else { return None };
        if pattern.rest.is_some() {
            return None;
        }
        let mut keys = Vec::new();
        for property in &pattern.properties {
            let simple = match &property.value.kind {
                BindingPatternKind::BindingIdentifier(_) => true,
                BindingPatternKind::AssignmentPattern(a) => matches!(a.left.kind, BindingPatternKind::BindingIdentifier(_)),
                _ => false,
            };
            if !simple || property.computed {
                return None;
            }
            match &property.key {
                PropertyKey::StaticIdentifier(i) => keys.push(i.name.to_string()),
                PropertyKey::StringLiteral(s) => keys.push(s.value.to_string()),
                _ => return None,
            }
        }
        Some(keys)
    }

    fn reaches(&self, from: NodeId, to: NodeId, seen: &mut FxHashSet<NodeId>) -> bool {
        if from == to {
            return true;
        }
        if !seen.insert(from) {
            return false;
        }
        let next: Vec<NodeId> = self.edges.get(&from).cloned().unwrap_or_default();
        next.into_iter().any(|n| self.reaches(n, to, seen))
    }

    /// Twin edge parent -> child flattens unless child reaches parent (a cycle has no finite plan).
    fn flattens(&self, parent: Option<NodeId>, child: NodeId) -> bool {
        self.twins.contains_key(&child) && parent.is_none_or(|p| !self.reaches(child, p, &mut FxHashSet::default()))
    }

    /// Static slot count of a native tree, mirroring walk(); flattened children add their own
    /// width plus two break slots. Checked against the lowered plan.
    fn width(&mut self, root: &'a JSXElement<'a>, parent: Option<NodeId>) -> usize {
        let mut n = 0;
        self.width_scan(root, parent, &mut n);
        n
    }

    fn width_scan(&mut self, el: &'a JSXElement<'a>, parent: Option<NodeId>, n: &mut usize) {
        // A spread element writes its merged plain attributes through one slot.
        let spread = Self::has_spread(el);
        let tag = self.tag_of(el);
        // … and its spread content (no JSX children) through one more.
        *n += usize::from(spread) + usize::from(spread && spread_content(self.tree, el, tag));
        // Class / style groups (`class`, `class:x`, `style`, `style:x`) write one slot each unless static,
        // exactly as `walk_server` lowers them (`server_class` / `server_style`).
        let groups = {
            let this = &*self;
            styling::analyze(this.tree, el, spread, &|attr| this.folded(attr))
        };
        if let Some(groups) = groups.as_ref().filter(|_| !spread) {
            *n += usize::from(groups.class.as_ref().is_some_and(|g| styling::static_class_value(g).is_none()));
            *n += usize::from(groups.style.as_ref().is_some_and(|g| styling::static_style_value(g).is_none()));
        }
        for (index, item) in el.opening_element.attributes.iter().enumerate() {
            let JSXAttributeItem::Attribute(attr) = item else { continue };
            let attr = &**attr;
            let name = attr_name(self.tree, attr);
            if spread && self.spread_plain(attr, tag) {
                continue;
            }
            if groups.as_ref().is_some_and(|g| g.members.contains(&index)) {
                continue;
            }
            // exception: H5/S6 width_scan parity — `walk_server` writes no `omitted()` slot for an
            // arrow / function literal `ref`, global event or `on*` value (resume mode never builds plans).
            let literal = matches!(&attr.value, Some(JSXAttributeValue::ExpressionContainer(c))
                if matches!(c.expression, JSXExpression::ArrowFunctionExpression(_) | JSXExpression::FunctionExpression(_)));
            if literal && (name == "ref" || matches!(global_event(name), Some(Some(_))) || starts_with_on(name)) {
                // D5 (intake 3): a helper's in-place handler writes `_rListens(type)` (`derived_orphan_on`).
                *n += usize::from(starts_with_on(name) && event_info(name).is_some() && self.id(attr).is_some_and(|id| self.derived_orphan_slot(id)));
                continue;
            }
            if starts_with_on(name) {
                *n += usize::from(event_info(name).is_some());
            } else if safe_attribute_name(name)
                && attr.value.is_some()
                && !matches!(attr.value, Some(JSXAttributeValue::StringLiteral(_)))
            {
                *n += 1;
            }
        }
        if VOID_TAGS.contains(&self.tag_of(el)) {
            return;
        }
        for child in &el.children {
            match child {
                JSXChild::Text(_) => {}
                // ZERO A2 (C4b): a literal child `walk_server` folds into the template text takes no slot.
                JSXChild::ExpressionContainer(c) => {
                    *n += usize::from(c.expression.as_expression().is_some_and(|e| {
                        OPAQUE_CONTENT.contains(&tag) || tag == "script" || tag == "style" || literal_child(self.tree, e).is_none()
                    }))
                }
                JSXChild::Spread(_) => {}
                JSXChild::Element(c) if self.native(c) => self.width_scan(c, parent, n),
                JSXChild::Element(c) => {
                    let spread = c.opening_element.attributes.iter().any(|a| matches!(a, JSXAttributeItem::SpreadAttribute(_)));
                    match self.resolve_tag(&c.opening_element.name) {
                        Some(decl) if self.flattens(parent, decl) && !spread => *n += self.twin_width(decl) + 2,
                        _ => *n += 1,
                    }
                }
                JSXChild::Fragment(_) => *n += 1,
            }
        }
    }

    fn twin_width(&mut self, decl: NodeId) -> usize {
        if let Some(&w) = self.widths.get(&decl) {
            return w;
        }
        let w = match self.returned(decl) {
            Some(root) => self.width(root, Some(decl)),
            None => 0,
        };
        self.widths.insert(decl, w);
        w
    }

    /// Split a lowered compiledTemplate call into fragments, attribute entries and tape steps.
    fn plan_of(&mut self, lowered: &Expr, parent: Option<NodeId>) -> Option<Split> {
        let Expr::Template { callee, fragments, slots } = lowered else { return None };
        if *callee != self.template_name {
            return None;
        }
        let mut steps = Vec::new();
        let mut entries = Vec::new();
        let mut deps = Vec::new();
        let mut size = 0;
        for slot in slots {
            let child = match slot {
                Expr::Component { twin, .. } => *twin,
                _ => None,
            };
            // Only plain `attribute()` slots become plan attribute entries; `_styleAttr` (style objects)
            // keeps its own encoding and is written as a whole value.
            let plain = match slot {
                Expr::Attr { callee, .. } => *callee == self.attribute_name,
                _ => false,
            };
            if let (true, Expr::Attr { name, value, namespace, .. }) = (plain, slot) {
                let text = match name.as_str() {
                    "className" => "class",
                    "htmlFor" => "for",
                    other => other,
                };
                entries.push(Expr::Array(vec![Expr::str(text), Expr::str(namespace.as_deref().unwrap_or("html"))]));
                steps.push(Step::Value { value: (**value).clone(), offset: size });
                size += 1;
            } else if let Some(child) = child.filter(|&c| self.flattens(parent, c)) {
                let plan = self.twins[&child].plan.clone();
                entries.push(Expr::Ident(plan.clone()));
                deps.push(plan);
                let props = match slot {
                    Expr::Component { props, .. } => props.clone(),
                    _ => Vec::new(),
                };
                steps.push(Step::Child { child, props, offset: size + 1 });
                size += self.twin_width(child) + 2;
            } else {
                entries.push(Expr::Null);
                steps.push(Step::Value { value: slot.clone(), offset: size });
                size += 1;
            }
        }
        let plan = Expr::call(&self.list_plan_name, vec![Expr::Ident(fragments.clone()), Expr::Array(entries)]);
        Some(Split { steps, size, deps, plan })
    }

    fn at(base: &str, offset: usize) -> Expr {
        if offset > 0 { Expr::Add(base.to_string(), offset) } else { Expr::ident(base) }
    }

    /// Statements calling a twin at tape[base + offset]. Every authored prop is evaluated in
    /// source order; positional twins then receive the bound ones by position.
    fn twin_call(&mut self, child: NodeId, tape: &str, base: &str, offset: usize, props: &[(Key, Expr)]) -> Vec<Stmt> {
        let (tape_fn, keys) = match self.twins.get(&child) {
            Some(names) => (names.tape.clone(), names.keys.clone()),
            None => return Vec::new(),
        };
        let mut head = vec![Expr::ident(tape), Self::at(base, offset)];
        let Some(keys) = keys else {
            head.push(Expr::Object(props.to_vec()));
            return vec![Stmt::Expr(Expr::call(&tape_fn, head))];
        };
        if props.len() == keys.len() && props.iter().zip(&keys).all(|((k, _), key)| k.text() == key) {
            head.extend(props.iter().map(|(_, v)| v.clone()));
            return vec![Stmt::Expr(Expr::call(&tape_fn, head))];
        }
        let mut temps = Vec::new();
        let mut by_key: FxHashMap<String, String> = FxHashMap::default();
        for (key, value) in props {
            let temp = self.unique("__rivetProp");
            temps.push((temp.clone(), value.clone()));
            by_key.insert(key.text().to_string(), temp);
        }
        let mut out = Vec::new();
        if !temps.is_empty() {
            out.push(Stmt::Const(temps));
        }
        head.extend(keys.iter().map(|key| by_key.get(key).map_or(Expr::VoidZero, |t| Expr::Ident(t.clone()))));
        out.push(Stmt::Expr(Expr::call(&tape_fn, head)));
        out
    }

    /// tape[base + offset] = value in slot order; each value is evaluated just before its store.
    fn store(&mut self, tape: &str, base: &str, steps: Vec<Step>) -> Vec<Stmt> {
        let mut out = Vec::new();
        for step in steps {
            match step {
                Step::Child { child, props, offset } => out.extend(self.twin_call(child, tape, base, offset, &props)),
                Step::Value { value, offset } => out.push(Stmt::Expr(Expr::Assign(
                    Box::new(Expr::Index(Box::new(Expr::ident(tape)), Box::new(Self::at(base, offset)))),
                    Box::new(value),
                ))),
            }
        }
        out
    }

    fn list_slot(&mut self, expression: &'a Expression<'a>) -> Option<Expr> {
        let site = self.map_site(expression)?;
        let lowered = self.lower(Jsx::Element(site.body));
        let params: Vec<String> = site
            .callback
            .params
            .items
            .iter()
            .map(|p| match &p.pattern.kind {
                BindingPatternKind::BindingIdentifier(i) => i.name.to_string(),
                _ => String::new(),
            })
            .collect();
        let tape = self.unique("__rivetTape");
        let base = self.unique("__rivetBase");
        let (plan, body) = if let Some(component) = site.component {
            let props = match &lowered {
                Expr::Component { props, .. } => props.clone(),
                _ => Vec::new(),
            };
            let plan = Expr::Ident(self.twins.get(&component).map(|t| t.plan.clone()).unwrap_or_default());
            (plan, self.twin_call(component, &tape, &base, 0, &props))
        } else {
            let Some(split) = self.plan_of(&lowered, None) else { return Some(self.expr(expression)) };
            let width = self.width(site.body, None);
            if split.size != width {
                let id = self.id(site.body);
                self.diag("Internal error: list plan width mismatch", id);
            }
            let name = self.unique(&format!("__rivetPlan{}", self.hoists.len()));
            self.plans.push(Plan { name: name.clone(), deps: split.deps, value: split.plan });
            (Expr::Ident(name), self.store(&tape, &base, split.steps))
        };
        self.list_used = true;
        let mut each_params = vec![tape, base];
        each_params.extend(params.iter().cloned());
        let each = match body.as_slice() {
            [Stmt::Expr(e)] => Expr::Arrow(each_params, Box::new(e.clone())),
            _ => Expr::ArrowBlock(each_params, body.iter().map(Stmt::print).collect()),
        };
        let items = match &site.call.callee {
            Expression::StaticMemberExpression(m) => self.expr(&m.object),
            other => self.expr(other),
        };
        Some(Expr::call(&self.list_name.clone(), vec![items, Expr::Arrow(params, Box::new(lowered)), plan, each]))
    }

    // exception: user ruling 2026-10-06 (FLATTEN-CMP-3) — `<For each by>{(row, index) => <jsx/>}</For>` with a
    // structural `For`, server target, list mounts on, no resume (resumable renders keep the row hook): the
    // sole child is a concise arrow (1–2 identifier params) returning a native element (no `model:`) or a
    // twin component without spread props.
    fn for_shape(&self, el: &'a JSXElement<'a>) -> Option<(&'a ArrowFunctionExpression<'a>, &'a JSXElement<'a>)> {
        if !self.server || !self.list_mounts {
            return None;
        }
        let JSXElementName::IdentifierReference(tag) = &el.opening_element.name else { return None };
        if self.imported_structural(tag) != Some("For") {
            return None;
        }
        if el.opening_element.attributes.iter().any(|a| match a {
            JSXAttributeItem::SpreadAttribute(_) => true,
            JSXAttributeItem::Attribute(attr) => matches!(attr_name(self.tree, attr), "children" | "$list") || attr_name(self.tree, attr) == slots::SLOT,
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
        let body = as_element(strip_parens(callback.get_expression()?))?;
        if self.has_model(self.id(body)?) {
            return None;
        }
        if !self.native(body) && body.opening_element.attributes.iter().any(|a| matches!(a, JSXAttributeItem::SpreadAttribute(_))) {
            return None;
        }
        Some((&**callback, body))
    }

    // exception: user ruling 2026-10-06 (FLATTEN-CMP-3) — `(children, [plan, each])` for an eligible `<For>`:
    // `each(tape, base, item, index)` rebuilds the row getters (`let row = () => item`) and stores the row's
    // slots like a `.map` list mount; `children` stays the authored row function (resumable / hooked renders).
    fn for_list(&mut self, el: &'a JSXElement<'a>, rest: &[&'a JSXChild<'a>]) -> Option<(Expr, Expr)> {
        let (callback, body) = self.for_shape(el)?;
        if rest.len() != el.children.len() {
            return None;
        }
        let component = if self.native(body) {
            None
        } else {
            let decl = self.resolve_tag(&body.opening_element.name)?;
            if !self.twins.contains_key(&decl) {
                return None;
            }
            Some(decl)
        };
        let lowered = self.lower(Jsx::Element(body));
        let params: Vec<String> = callback
            .params
            .items
            .iter()
            .map(|p| match &p.pattern.kind {
                BindingPatternKind::BindingIdentifier(i) => i.name.to_string(),
                _ => String::new(),
            })
            .collect();
        let tape = self.unique("__rivetTape");
        let base = self.unique("__rivetBase");
        let item = self.unique("__rivetItem");
        let at = self.unique("__rivetAt");
        let (plan, steps) = if let Some(component) = component {
            let props = match &lowered {
                Expr::Component { props, .. } => props.clone(),
                _ => Vec::new(),
            };
            let plan = Expr::Ident(self.twins.get(&component).map(|t| t.plan.clone()).unwrap_or_default());
            (plan, self.twin_call(component, &tape, &base, 0, &props))
        } else {
            let split = self.plan_of(&lowered, None)?;
            let width = self.width(body, None);
            if split.size != width {
                let id = self.id(body);
                self.diag("Internal error: list plan width mismatch", id);
            }
            let name = self.unique(&format!("__rivetPlan{}", self.hoists.len()));
            self.plans.push(Plan { name: name.clone(), deps: split.deps, value: split.plan });
            (Expr::Ident(name), self.store(&tape, &base, split.steps))
        };
        self.list_used = true;
        let mut statements = vec![format!("let {} = () => {item};", params[0])];
        if let Some(index) = params.get(1) {
            statements.push(format!("let {index} = () => {at};"));
        }
        statements.extend(steps.iter().map(Stmt::print));
        let each = Expr::ArrowBlock(vec![tape, base, item, at], statements);
        Some((Expr::Arrow(params, Box::new(lowered)), Expr::Array(vec![plan, each])))
    }

    /// Emit C's twin next to C: same parameter and statements, final JSX stored on the tape.
    fn twin(&mut self, decl: NodeId, reps: &[(Span, Expr)]) -> Expr {
        let tree = self.tree;
        let transformed = self.render(tree.span(decl), reps);
        let AstKind::Function(f) = tree.kind(decl) else { return Expr::Stmts(transformed) };
        let Some(root) = self.returned(decl) else { return Expr::Stmts(transformed) };
        let lowered = reps.iter().find(|(span, _)| *span == root.span).map(|(_, e)| e.clone());
        let split = match lowered.as_ref() {
            Some(lowered) => self.plan_of(lowered, Some(decl)),
            None => None,
        };
        let Some(split) = split else {
            self.diag("Internal error: inlinable component did not lower to a template", Some(decl));
            return Expr::Stmts(transformed);
        };
        if split.size != self.twin_width(decl) {
            self.diag("Internal error: component plan width mismatch", Some(decl));
        }
        let (tape_fn, plan_name, keyed) = {
            let names = &self.twins[&decl];
            (names.tape.clone(), names.plan.clone(), names.keys.is_some())
        };
        self.plans.push(Plan { name: plan_name, deps: split.deps, value: split.plan });
        let tape = self.unique("__rivetTape");
        let base = self.unique("__rivetBase");
        let mut parameters = vec![tape.clone(), base.clone()];
        let pattern_text = |this: &Self, pattern: &BindingPattern<'a>| -> String {
            match &pattern.kind {
                BindingPatternKind::AssignmentPattern(a) => format!(
                    "{} = {}",
                    this.render(a.left.kind.span(), reps),
                    this.render(a.right.span(), reps)
                ),
                kind => this.render(kind.span(), reps),
            }
        };
        if let Some(first) = f.params.items.first() {
            if keyed {
                if let BindingPatternKind::ObjectPattern(pattern) = &first.pattern.kind {
                    for property in &pattern.properties {
                        parameters.push(pattern_text(self, &property.value));
                    }
                }
            } else {
                for p in &f.params.items {
                    parameters.push(pattern_text(self, &p.pattern));
                }
            }
        }
        let Some(body) = &f.body else { return Expr::Stmts(transformed) };
        let mut statements: Vec<String> = Vec::new();
        let count = body.statements.len();
        for statement in body.statements.iter().take(count.saturating_sub(1)) {
            statements.push(self.render(statement.span(), reps));
        }
        for stmt in self.store(&tape, &base, split.steps) {
            statements.push(stmt.print());
        }
        Expr::Stmts(format!(
            "{transformed}\nfunction {tape_fn}({}) {{\n{}\n}}",
            parameters.join(", "),
            statements.join("\n")
        ))
    }
}

impl<'t, 'a> Compiler<'t, 'a> {
    // ---- css`` scoped styles ----

    /// Find `css` import bindings and scope every top-level `const X = css`…`` block.
    fn styles_setup(&mut self) {
        let tree = self.tree;
        for statement in &tree.program.body {
            let Statement::ImportDeclaration(import) = statement else { continue };
            if import.source.value.as_str() != "@rivetjs/runtime/css" {
                continue;
            }
            for specifier in import.specifiers.iter().flatten() {
                if let ImportDeclarationSpecifier::ImportSpecifier(s) = specifier {
                    if s.imported.name() == "css" {
                        if let Some(id) = tree.id_of(&**s) {
                            self.css_tags.insert(id);
                        }
                    }
                }
            }
        }
        if self.css_tags.is_empty() {
            return;
        }
        let mut found = Vec::new();
        tree.walk(tree.root(), &mut |id| {
            if let AstKind::TaggedTemplateExpression(t) = tree.kind(id) {
                if let Expression::Identifier(tag) = &t.tag {
                    if tree.resolve(tag, false).is_some_and(|decl| self.css_tags.contains(&decl)) {
                        found.push(id);
                    }
                }
            }
            true
        });
        let Some(options) = self.styles.clone() else { return };
        for id in found {
            let AstKind::TaggedTemplateExpression(tagged) = tree.kind(id) else { continue };
            let Some(declarator) = self.css_declarator(id) else {
                self.diag("css`` must initialize a top-level const (const styles = css`…`)", Some(id));
                continue;
            };
            if !tagged.quasi.expressions.is_empty() {
                self.diag("css`` interpolations are not supported: write values literally; for a dynamic value set a custom property on the element (style={{ \"--x\": value }}) and read var(--x) in the block; for states define a class per state and pick it with class:active={on} or cx(styles.base, on && styles.active), or select on a data-* attribute (.card[data-size=\"lg\"])", Some(id));
                continue;
            }
            let raw = tagged.quasi.quasis[0].value.raw.as_str().replace("\\`", "`").replace("\\$", "$");
            match styles::scope_css(&raw, &options.scope, options.names, options.layer.as_deref()) {
                Err(message) => self.diag(message, Some(id)),
                Ok(scoped) => {
                    let binding = match tree.kind(declarator) {
                        AstKind::VariableDeclarator(d) => match &d.id.kind {
                            BindingPatternKind::BindingIdentifier(i) => i.name.to_string(),
                            _ => String::new(),
                        },
                        _ => String::new(),
                    };
                    let fields: Vec<String> =
                        scoped.classes.iter().map(|(local, name)| format!("{}: {}", quote(local), quote(name))).collect();
                    self.css_tagged.insert(id, format!("/*#__PURE__*/ Object.freeze({{ {} }})", fields.join(", ")));
                    self.css_out.push(scoped.css);
                    self.css_classes.push((binding, scoped.classes.clone()));
                    self.css_blocks.insert(declarator, Rc::new(scoped.classes));
                }
            }
        }
    }

    /// The declarator of `const X = css`…`` at module top level (optionally exported).
    fn css_declarator(&self, tagged: NodeId) -> Option<NodeId> {
        let tree = self.tree;
        let declarator = tree.parent(tagged)?;
        let AstKind::VariableDeclarator(d) = tree.kind(declarator) else { return None };
        if !matches!(d.id.kind, BindingPatternKind::BindingIdentifier(_)) || d.init.as_ref().map(GetSpan::span) != Some(tree.span(tagged)) {
            return None;
        }
        let declaration = tree.parent(declarator)?;
        let AstKind::VariableDeclaration(v) = tree.kind(declaration) else { return None };
        if v.kind != VariableDeclarationKind::Const {
            return None;
        }
        let mut owner = tree.parent(declaration)?;
        if matches!(tree.kind(owner), AstKind::ExportNamedDeclaration(_)) {
            owner = tree.parent(owner)?;
        }
        matches!(tree.kind(owner), AstKind::Program(_)).then_some(declarator)
    }

    /// Class map of a css`` binding referenced by `object`.
    fn css_map(&self, object: &Expression<'a>) -> Option<Rc<Vec<(String, String)>>> {
        let Expression::Identifier(ident) = object else { return None };
        self.tree.resolve(ident, false).and_then(|decl| self.css_blocks.get(&decl).cloned())
    }

    fn styles_node(&mut self, id: NodeId) -> Option<Expr> {
        let tree = self.tree;
        match tree.kind(id) {
            AstKind::TaggedTemplateExpression(_) => self.css_tagged.get(&id).map(|text| Expr::Raw(text.clone())),
            AstKind::StaticMemberExpression(m) => {
                let map = self.css_map(&m.object)?;
                let written = match tree.parent_kind(id) {
                    Some(AstKind::AssignmentExpression(a)) => a.left.span() == m.span,
                    Some(AstKind::UpdateExpression(_)) => true,
                    Some(AstKind::UnaryExpression(u)) => u.operator == UnaryOperator::Delete,
                    _ => false,
                };
                if written {
                    self.diag("css`` class maps are read-only", Some(id));
                    return Some(Expr::Null);
                }
                let key = m.property.name.as_str();
                match map.iter().find(|(local, _)| local == key) {
                    Some((_, scoped)) => Some(Expr::Str(scoped.clone())),
                    None => {
                        let binding = tree.text_of(m.object.span());
                        self.diag(format!("Unknown class '{key}' in css`` block {binding}"), Some(id));
                        Some(Expr::Null)
                    }
                }
            }
            _ => None,
        }
    }

    /// A native attribute whose value folds to a string through css`` class lookups.
    /// A css``-folded attribute value (`class={styles.card}`); None without css`` blocks.
    fn folded(&self, attr: &'a JSXAttribute<'a>) -> Option<String> {
        if self.css_blocks.is_empty() {
            return None;
        }
        let Some(JSXAttributeValue::ExpressionContainer(c)) = &attr.value else { return None };
        let mut used = false;
        let text = self.const_string(c.expression.as_expression()?, &mut used)?;
        used.then_some(text)
    }

    fn folded_attribute(&mut self, attr: &'a JSXAttribute<'a>) -> Option<String> {
        let Some(JSXAttributeValue::ExpressionContainer(c)) = &attr.value else { return None };
        let e = c.expression.as_expression()?;
        let mut used = false;
        let text = self.const_string(e, &mut used)?;
        used.then_some(text)
    }

    /// Compile-time string value: literals, templates and `+` of foldable parts, css`` lookups.
    fn const_string(&self, e: &Expression<'a>, used: &mut bool) -> Option<String> {
        match strip_parens(e) {
            Expression::StringLiteral(s) => Some(s.value.to_string()),
            Expression::TemplateLiteral(t) => {
                let mut out = String::new();
                for (i, quasi) in t.quasis.iter().enumerate() {
                    out.push_str(quasi.value.cooked.as_ref()?.as_str());
                    if let Some(e) = t.expressions.get(i) {
                        out.push_str(&self.const_string(e, used)?);
                    }
                }
                Some(out)
            }
            Expression::BinaryExpression(b) if b.operator == BinaryOperator::Addition => {
                let left = self.const_string(&b.left, used)?;
                Some(left + &self.const_string(&b.right, used)?)
            }
            Expression::StaticMemberExpression(m) => {
                let map = self.css_map(&m.object)?;
                let (_, scoped) = map.iter().find(|(local, _)| local == m.property.name.as_str())?;
                *used = true;
                Some(scoped.clone())
            }
            _ => None,
        }
    }

    fn styles_output(&self) -> Option<StylesOutput> {
        if self.css_out.is_empty() {
            return None;
        }
        Some(StylesOutput { css: self.css_out.join("\n"), classes: self.css_classes.clone() })
    }
}

fn runtime_target(specifier: &str) -> bool {
    specifier == "@rivetjs/runtime/dom" || specifier == "@rivetjs/runtime/server"
}

