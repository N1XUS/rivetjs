//! Server code in route modules. A server export is a module-scope `const` initialized by a call of
//! a wrapper imported from `@rivetjs/router` — `load`, `guard`, `actions`, `entries`, `headers` and
//! the request handlers `onRequest`, `onGet`, `onPost`, `onPut`, `onPatch`, `onDelete`, `onOptions`
//! (aliases and namespace members followed; export names are free) — or a re-export from a
//! server-only module. Browser builds remove them and every module-scope binding (function, class,
//! variable, import specifier) whose value references all lie in removed code (fixpoint over oxc
//! semantic references; type references do not count). Spec:
//! `docs/design/specs/2026-10-20-server-exports-design.md`.
//!
//! Removal rewrites statements in place at the same byte length (newlines kept), so positions are
//! unchanged: diagnostics, source maps and resume symbol ids agree with the unstripped server
//! compile. Kept code reaching server-only code is an error, never silently kept.

use oxc_allocator::Allocator;
use oxc_ast::{AstKind, ast::*};
use oxc_parser::{ParseOptions, Parser};
use oxc_semantic::{NodeId, SemanticBuilder, SymbolId};
use oxc_span::{GetSpan, Span};
use rustc_hash::FxHashMap;

use crate::compile::{Diagnostic, Diags};
use crate::tree::Tree;

/// Server exports of a route module.
pub struct Server {
    /// The browser source (server code rewritten away; same length and lines as the input).
    pub browser: Option<String>,
    pub exports: Vec<String>,
    /// Kind of each export (parallel to `exports`): the wrapper name, `?` for a re-export from a server-only module.
    pub kinds: Vec<String>,
    pub imports: Vec<String>,
    pub diagnostics: Vec<Diagnostic>,
}

/// Parse and split `source`. Parse errors are left to the compile that follows.
pub fn run(source: &str, filename: &str, resume: bool) -> Server {
    let allocator = Allocator::default();
    let parsed = Parser::new(&allocator, source, crate::source_type::of(filename))
        .with_options(ParseOptions { preserve_parens: true, ..ParseOptions::default() })
        .parse();
    if parsed.panicked || !parsed.errors.is_empty() {
        return Server { browser: None, exports: Vec::new(), kinds: Vec::new(), imports: Vec::new(), diagnostics: Vec::new() };
    }
    let program = allocator.alloc(parsed.program);
    let semantic = SemanticBuilder::new().with_check_syntax_error(false).build(program).semantic;
    let tree = Tree::new(source, program, semantic);
    let result = split(&tree, resume);
    let mut diags = Diags { tree: Some(&tree), filename: filename.to_string(), list: Vec::new() };
    for (message, node) in &result.errors {
        diags.add(message.clone(), *node);
    }
    Server {
        browser: result.changes().then(|| result.apply(source)),
        exports: result.exports,
        kinds: result.kinds,
        imports: result.imports,
        diagnostics: diags.list,
    }
}

/// The package whose wrapper calls mark server exports.
pub const ROUTER: &str = "@rivetjs/router";

/// Server export wrappers of `@rivetjs/router` (the kind of a server export is the wrapper's name).
pub const WRAPPERS: &[&str] =
    &["load", "guard", "actions", "entries", "headers", "onRequest", "onGet", "onPost", "onPut", "onPatch", "onDelete", "onOptions"];

/// Former magic export names (before 2026-10-20) → (wrapper, conventional export name, argument shape).
/// An export with one of these names that is not a server export is RV3010.
const MAGIC: &[(&str, &str, &str, &str)] = &[
    ("serverLoad", "load", "loader", "(event) => …"),
    ("serverGuard", "guard", "access", "(event) => …"),
    ("serverActions", "actions", "forms", "{ name: (event) => … }"),
    ("serverEntries", "entries", "paths", "() => […]"),
    ("serverHeaders", "headers", "responseHeaders", "(event) => ({ … })"),
    ("onRequest", "onRequest", "middleware", "(event) => …"),
    ("onGet", "onGet", "GET", "(event) => …"),
    ("onPost", "onPost", "POST", "(event) => …"),
    ("onPut", "onPut", "PUT", "(event) => …"),
    ("onPatch", "onPatch", "PATCH", "(event) => …"),
    ("onDelete", "onDelete", "DELETE", "(event) => …"),
    ("onOptions", "onOptions", "OPTIONS", "(event) => …"),
];

/// RV3010 message for an untagged export named like a former magic export, if it is one.
fn untagged(name: &str) -> Option<String> {
    let (_, wrapper, export, argument) = MAGIC.iter().find(|(old, ..)| *old == name)?;
    Some(format!(
        "Untagged server export `{name}`: route server code is a wrapper call — `export const {export} = {wrapper}({argument})` with `import {{ {wrapper} }} from \"{ROUTER}\"`"
    ))
}

/// How a kind reads in messages (`load(…)`, `actions({ … })`).
fn kind_label(kind: &str) -> String {
    if kind == "actions" { "actions({ … })".into() } else { format!("{kind}(…)") }
}

/// Import sources that must never reach a browser bundle.
pub fn server_only_source(source: &str) -> bool {
    let path = source.split('?').next().unwrap_or(source);
    let file = path.rsplit('/').next().unwrap_or(path);
    file.contains(".server.") || file.ends_with(".server") || source.starts_with("node:") || source == "@rivetjs/router/server-only"
}

pub struct Split {
    /// Server export names, in source order.
    pub exports: Vec<String>,
    /// Kind per export (parallel to `exports`).
    pub kinds: Vec<String>,
    /// Import sources no longer imported by the browser module.
    pub imports: Vec<String>,
    /// Statement rewrites: (span, replacement no longer than the span).
    pub edits: Vec<(Span, String)>,
    pub errors: Vec<(String, Option<NodeId>)>,
}

impl Split {
    pub fn changes(&self) -> bool {
        !self.edits.is_empty()
    }

    /// The source with removed code rewritten (same byte length and line count).
    pub fn apply(&self, source: &str) -> String {
        let mut out = String::with_capacity(source.len());
        let mut pos = 0usize;
        for (span, text) in &self.edits {
            let (start, end) = (span.start as usize, span.end as usize);
            out.push_str(&source[pos..start]);
            let original = &source[start..end];
            let newlines: String = original.chars().filter(|c| *c == '\n' || *c == '\r').collect();
            out.push_str(text);
            out.push_str(&newlines);
            for _ in 0..original.len() - text.len() - newlines.len() {
                out.push(' ');
            }
            pos = end;
        }
        out.push_str(&source[pos..]);
        out
    }
}

struct Candidate {
    symbols: Vec<SymbolId>,
    /// The declaration's own span: references inside it do not keep it alive.
    own: Span,
    /// Import specifier: (declaration index, specifier index).
    import: Option<(usize, usize)>,
    name: String,
    removed: bool,
}

struct ImportDecl {
    span: Span,
    source: String,
    /// Specifier spans; `true` for default / namespace specifiers (written outside braces).
    specifiers: Vec<(Span, bool)>,
    removed: Vec<bool>,
    with_text: String,
}

fn binding_symbols(pattern: &BindingPattern, out: &mut Vec<(String, SymbolId)>) {
    match &pattern.kind {
        BindingPatternKind::BindingIdentifier(i) => {
            if let Some(s) = i.symbol_id.get() {
                out.push((i.name.to_string(), s));
            }
        }
        BindingPatternKind::ObjectPattern(o) => {
            for p in &o.properties {
                binding_symbols(&p.value, out);
            }
            if let Some(rest) = &o.rest {
                binding_symbols(&rest.argument, out);
            }
        }
        BindingPatternKind::ArrayPattern(a) => {
            for p in a.elements.iter().flatten() {
                binding_symbols(p, out);
            }
            if let Some(rest) = &a.rest {
                binding_symbols(&rest.argument, out);
            }
        }
        BindingPatternKind::AssignmentPattern(a) => binding_symbols(&a.left, out),
    }
}

fn inside(spans: &[Span], at: Span) -> bool {
    spans.iter().any(|s| at.start >= s.start && at.end <= s.end)
}

fn declared_names(declaration: &Declaration) -> Vec<(String, SymbolId)> {
    let mut names = Vec::new();
    let mut push = |i: &BindingIdentifier| {
        if let Some(s) = i.symbol_id.get() {
            names.push((i.name.to_string(), s));
        }
    };
    match declaration {
        Declaration::FunctionDeclaration(f) => f.id.iter().for_each(&mut push),
        Declaration::ClassDeclaration(c) => c.id.iter().for_each(&mut push),
        Declaration::VariableDeclaration(v) => {
            for d in &v.declarations {
                binding_symbols(&d.id, &mut names);
            }
        }
        _ => {}
    }
    names
}

/// Wrapper bindings of a module: named imports of `@rivetjs/router` wrappers (local symbol → kind) and
/// namespace imports of the package (`r.load(…)`).
struct Wrappers {
    named: FxHashMap<SymbolId, &'static str>,
    namespaces: Vec<SymbolId>,
}

fn wrapper_kind(name: &str) -> Option<&'static str> {
    WRAPPERS.iter().find(|w| **w == name).copied()
}

impl Wrappers {
    fn of(program: &Program) -> Wrappers {
        let mut out = Wrappers { named: FxHashMap::default(), namespaces: Vec::new() };
        for statement in &program.body {
            let Statement::ImportDeclaration(import) = statement else { continue };
            if import.import_kind.is_type() || import.source.value.as_str() != ROUTER {
                continue;
            }
            for specifier in import.specifiers.iter().flatten() {
                match specifier {
                    ImportDeclarationSpecifier::ImportSpecifier(s) if !s.import_kind.is_type() => {
                        if let (Some(kind), Some(symbol)) = (wrapper_kind(&s.imported.name()), s.local.symbol_id.get()) {
                            out.named.insert(symbol, kind);
                        }
                    }
                    ImportDeclarationSpecifier::ImportNamespaceSpecifier(s) => out.namespaces.extend(s.local.symbol_id.get()),
                    _ => {}
                }
            }
        }
        out
    }

    /// The kind of a wrapper call (`load(…)`, `l(…)` for an alias, `r.load(…)`) and the callee identifier's span.
    fn call<'a>(&self, tree: &Tree<'a>, init: &Expression<'a>) -> Option<(&'static str, Span)> {
        let Expression::CallExpression(call) = crate::resume::unwrap(init) else { return None };
        if call.optional {
            return None;
        }
        match crate::resume::unwrap(&call.callee) {
            Expression::Identifier(ident) => self.named.get(&tree.symbol_of_ref(ident)?).map(|kind| (*kind, ident.span)),
            Expression::StaticMemberExpression(m) if !m.optional => {
                let Expression::Identifier(object) = crate::resume::unwrap(&m.object) else { return None };
                let symbol = tree.symbol_of_ref(object)?;
                if !self.namespaces.contains(&symbol) {
                    return None;
                }
                wrapper_kind(&m.property.name).map(|kind| (kind, m.span))
            }
            _ => None,
        }
    }
}

/// Server bindings of a `const` declaration: (name, symbol, kind, callee span) per declarator; `None` kind for a
/// declarator that is not a wrapper call (destructuring patterns: every name `None`).
fn declarator_kinds<'a>(tree: &Tree<'a>, wrappers: &Wrappers, v: &VariableDeclaration<'a>) -> Vec<(String, SymbolId, Option<(&'static str, Span)>)> {
    let mut out = Vec::new();
    for d in &v.declarations {
        let call = match (&d.id.kind, &d.init) {
            (BindingPatternKind::BindingIdentifier(_), Some(init)) if v.kind == VariableDeclarationKind::Const => wrappers.call(tree, init),
            _ => None,
        };
        let mut names = Vec::new();
        binding_symbols(&d.id, &mut names);
        for (name, symbol) in names {
            out.push((name, symbol, call));
        }
    }
    out
}

/// Analyze a module. `resume`: removed code may not hold JSX (server exports are not resumable).
pub fn split(tree: &Tree, resume: bool) -> Split {
    let program = tree.program;
    let scoping = tree.sem.scoping();
    let mut out = Split { exports: Vec::new(), kinds: Vec::new(), imports: Vec::new(), edits: Vec::new(), errors: Vec::new() };
    let mut removed: Vec<Span> = Vec::new();
    let mut roots: Vec<(String, SymbolId)> = Vec::new();
    let mut candidates: Vec<Candidate> = Vec::new();
    let mut imports: Vec<ImportDecl> = Vec::new();
    let wrappers = Wrappers::of(program);
    // Value references of a symbol (type queries such as `typeof loader` do not count).
    let references = |symbol: SymbolId| -> Vec<(Span, NodeId)> {
        scoping
            .get_resolved_references(symbol)
            .filter(|r| r.flags().is_value() && !r.flags().is_value_as_type())
            .map(|r| (tree.span(r.node_id()), r.node_id()))
            .collect()
    };
    // Server bindings anywhere at module scope (an `export { x as y }` may precede the declaration).
    let mut bindings: FxHashMap<SymbolId, &'static str> = FxHashMap::default();
    let mut callees: Vec<Span> = Vec::new();
    for statement in &program.body {
        let declaration = match statement {
            Statement::VariableDeclaration(v) => Some(&**v),
            Statement::ExportNamedDeclaration(e) => match &e.declaration {
                Some(Declaration::VariableDeclaration(v)) => Some(&**v),
                _ => None,
            },
            _ => None,
        };
        for (_, symbol, call) in declaration.map(|v| declarator_kinds(tree, &wrappers, v)).unwrap_or_default() {
            if let Some((kind, callee)) = call {
                bindings.insert(symbol, kind);
                callees.push(callee);
            }
        }
    }
    // Exported server bindings by kind (duplicates are errors; request handlers repeat across methods only).
    let mut by_kind: Vec<(&'static str, String, SymbolId)> = Vec::new();
    let mut export = |out: &mut Split, name: String, kind: &str, symbol: Option<SymbolId>, node: Option<NodeId>| {
        if let Some(symbol) = symbol {
            let kind = wrapper_kind(kind).unwrap_or("?");
            if let Some((_, first, _)) = by_kind.iter().find(|(k, _, s)| *k == kind && *s != symbol) {
                out.errors.push((format!("Duplicate server export: `{first}` and `{name}` are both `{}`; keep one", kind_label(kind)), node));
            } else {
                by_kind.push((kind, name.clone(), symbol));
            }
        }
        out.exports.push(name);
        out.kinds.push(kind.to_string());
    };
    for statement in &program.body {
        match statement {
            Statement::ExportNamedDeclaration(e) => {
                let span = e.span;
                if let Some(declaration) = &e.declaration {
                    let names: Vec<(String, SymbolId, Option<&'static str>)> = match declaration {
                        Declaration::VariableDeclaration(v) => {
                            declarator_kinds(tree, &wrappers, v).into_iter().map(|(n, s, c)| (n, s, c.map(|(k, _)| k))).collect()
                        }
                        other => declared_names(other).into_iter().map(|(n, s)| (n, s, None)).collect(),
                    };
                    let server = names.iter().filter(|(_, _, kind)| kind.is_some()).count();
                    if server == 0 {
                        for (name, ..) in &names {
                            if let Some(message) = untagged(name) {
                                out.errors.push((message, tree.id_of(&**e)));
                            }
                        }
                        continue;
                    }
                    if server != names.len() {
                        out.errors.push((
                            "Declare server exports (`load(…)`, `onGet(…)`, …) in their own export statement".into(),
                            tree.id_of(&**e),
                        ));
                        continue;
                    }
                    for (name, symbol, kind) in names {
                        export(&mut out, name.clone(), kind.unwrap_or("?"), Some(symbol), tree.id_of(&**e));
                        roots.push((name, symbol));
                    }
                    removed.push(span);
                    out.edits.push((span, ";".into()));
                } else {
                    // `export { loader as data }` (a server binding) / `export { access } from "./auth.server.ts"`.
                    let from_server = e.source.as_ref().is_some_and(|s| server_only_source(&s.value));
                    let server: Vec<Option<(&str, Option<SymbolId>)>> = e
                        .specifiers
                        .iter()
                        .map(|s| {
                            if e.source.is_some() {
                                return from_server.then_some(("?", None));
                            }
                            let ModuleExportName::IdentifierReference(local) = &s.local else { return None };
                            let symbol = tree.symbol_of_ref(local)?;
                            bindings.get(&symbol).map(|kind| (*kind, Some(symbol)))
                        })
                        .collect();
                    for (s, is) in e.specifiers.iter().zip(&server) {
                        if is.is_none() {
                            if let Some(message) = untagged(&s.exported.name()) {
                                out.errors.push((message, tree.id_of(&**e)));
                            }
                        }
                    }
                    if server.iter().all(Option::is_none) {
                        continue;
                    }
                    for (s, is) in e.specifiers.iter().zip(&server) {
                        if let Some((kind, symbol)) = is {
                            export(&mut out, s.exported.name().to_string(), *kind, *symbol, tree.id_of(&**e));
                            removed.push(s.span);
                        }
                    }
                    let kept: Vec<&str> =
                        e.specifiers.iter().zip(&server).filter(|(_, is)| is.is_none()).map(|(s, _)| tree.text_of(s.span)).collect();
                    let text = if kept.is_empty() {
                        if let Some(source) = &e.source {
                            out.imports.push(source.value.to_string());
                        }
                        ";".to_string()
                    } else {
                        let from = e.source.as_ref().map_or(String::new(), |s| format!("from{}", tree.text_of(s.span)));
                        format!("export{{{}}}{from};", kept.join(","))
                    };
                    out.edits.push((span, text));
                }
            }
            Statement::ExportAllDeclaration(e) => {
                out.errors.push((
                    "`export *` is not allowed in a route module: server exports must be named".into(),
                    tree.id_of(&**e),
                ));
            }
            Statement::FunctionDeclaration(f) => {
                if let Some(i) = &f.id {
                    if let Some(s) = i.symbol_id.get() {
                        candidates.push(Candidate { symbols: vec![s], own: f.span, import: None, name: i.name.to_string(), removed: false });
                    }
                }
            }
            Statement::ClassDeclaration(c) => {
                if let Some(i) = &c.id {
                    if let Some(s) = i.symbol_id.get() {
                        candidates.push(Candidate { symbols: vec![s], own: c.span, import: None, name: i.name.to_string(), removed: false });
                    }
                }
            }
            Statement::VariableDeclaration(v) => {
                let declared = declarator_kinds(tree, &wrappers, v);
                let server = declared.iter().filter(|(_, _, call)| call.is_some()).count();
                if server > 0 {
                    // A server binding exported by name later (`export { loader as data }`), or unused: server code either way.
                    if server != declared.len() {
                        out.errors.push((
                            "Declare server exports (`load(…)`, `onGet(…)`, …) in their own export statement".into(),
                            tree.id_of(&**v),
                        ));
                        continue;
                    }
                    for (name, symbol, _) in declared {
                        roots.push((name, symbol));
                    }
                    removed.push(v.span);
                    out.edits.push((v.span, ";".into()));
                    continue;
                }
                if !declared.is_empty() {
                    candidates.push(Candidate {
                        symbols: declared.iter().map(|(_, s, _)| *s).collect(),
                        own: v.span,
                        import: None,
                        name: declared.iter().map(|(n, _, _)| n.as_str()).collect::<Vec<_>>().join(", "),
                        removed: false,
                    });
                }
            }
            Statement::ImportDeclaration(import) => {
                let Some(specifiers) = &import.specifiers else { continue };
                if import.import_kind.is_type() || specifiers.is_empty() {
                    continue;
                }
                let index = imports.len();
                imports.push(ImportDecl {
                    span: import.span,
                    source: import.source.value.to_string(),
                    specifiers: specifiers
                        .iter()
                        .map(|s| (s.span(), !matches!(s, ImportDeclarationSpecifier::ImportSpecifier(_))))
                        .collect(),
                    removed: vec![false; specifiers.len()],
                    with_text: import.with_clause.as_ref().map_or(String::new(), |w| tree.text_of(w.span).to_string()),
                });
                for (i, specifier) in specifiers.iter().enumerate() {
                    let (local, type_only) = match specifier {
                        ImportDeclarationSpecifier::ImportSpecifier(s) => (&s.local, s.import_kind.is_type()),
                        ImportDeclarationSpecifier::ImportDefaultSpecifier(s) => (&s.local, false),
                        ImportDeclarationSpecifier::ImportNamespaceSpecifier(s) => (&s.local, false),
                    };
                    let Some(symbol) = local.symbol_id.get() else { continue };
                    if type_only {
                        continue;
                    }
                    candidates.push(Candidate {
                        symbols: vec![symbol],
                        own: specifier.span(),
                        import: Some((index, i)),
                        name: local.name.to_string(),
                        removed: false,
                    });
                }
            }
            _ => {}
        }
    }
    // A wrapper is only ever the initializer call of a module-scope `const` (anything else would stay in the
    // browser build untagged-by-the-compiler).
    for (&symbol, kind) in &wrappers.named {
        if let Some((_, node)) = references(symbol).into_iter().find(|(span, _)| !callees.contains(span)) {
            let name = scoping.symbol_name(symbol);
            out.errors.push((
                format!(
                    "Server export wrapper `{name}` must initialize a module-scope `const` (`export const {} = {name}(…)`)",
                    MAGIC.iter().find(|(_, w, ..)| w == kind).map_or("x", |(_, _, export, _)| *export)
                ),
                Some(node),
            ));
        }
    }
    if roots.is_empty() && out.exports.is_empty() {
        return Split { exports: Vec::new(), kinds: Vec::new(), imports: Vec::new(), edits: Vec::new(), errors: out.errors };
    }
    // Fixpoint: remove declarations used only by removed code.
    loop {
        let mut changed = false;
        for c in candidates.iter_mut() {
            if c.removed {
                continue;
            }
            let refs: Vec<Span> =
                c.symbols.iter().flat_map(|&s| references(s)).map(|(span, _)| span).filter(|r| !inside(&[c.own], *r)).collect();
            let server_import = c.import.is_some_and(|(d, _)| server_only_source(&imports[d].source));
            // Unused server-only imports go too (TypeScript would elide them; JavaScript files keep them).
            let remove = if refs.is_empty() { server_import } else { refs.iter().all(|r| inside(&removed, *r)) };
            if remove {
                c.removed = true;
                removed.push(c.own);
                match c.import {
                    Some((d, i)) => imports[d].removed[i] = true,
                    None => out.edits.push((c.own, ";".into())),
                }
                changed = true;
            }
        }
        if !changed {
            break;
        }
    }
    for import in &imports {
        if !import.removed.contains(&true) {
            continue;
        }
        let kept: Vec<(&str, bool)> = import
            .specifiers
            .iter()
            .zip(&import.removed)
            .filter(|(_, r)| !**r)
            .map(|((s, head), _)| (tree.text_of(*s), *head))
            .collect();
        let text = if kept.is_empty() {
            out.imports.push(import.source.clone());
            ";".to_string()
        } else {
            let head: Vec<&str> = kept.iter().filter(|(_, h)| *h).map(|(t, _)| *t).collect();
            let named: Vec<&str> = kept.iter().filter(|(_, h)| !*h).map(|(t, _)| *t).collect();
            let mut list = head.join(",");
            if !named.is_empty() {
                if !list.is_empty() {
                    list.push(',');
                }
                list.push_str(&format!("{{{}}}", named.join(",")));
            }
            let source = tree.text_of(Span::new(import.span.start, import.span.end));
            let quoted = quoted_source(source, &import.source);
            format!("import {list}from{quoted}{};", import.with_text)
        };
        out.edits.push((import.span, text));
    }
    // Kept code may not reach server-only code.
    let line = |at: u32| tree.line_col(at).0;
    for (name, symbol) in &roots {
        if let Some((span, node)) = references(*symbol).into_iter().find(|(r, _)| !inside(&removed, *r)) {
            out.errors.push((
                format!("`{name}` is server-only (removed from browser builds) but browser code references it at line {}", line(span.start)),
                Some(node),
            ));
        }
    }
    for c in &candidates {
        let Some((d, _)) = c.import else { continue };
        if c.removed || !server_only_source(&imports[d].source) {
            continue;
        }
        let refs: Vec<(Span, NodeId)> = c.symbols.iter().flat_map(|&s| references(s)).collect();
        if let Some((span, node)) = refs.into_iter().find(|(r, _)| !inside(&removed, *r)) {
            out.errors.push((
                format!(
                    "`{}` (from \"{}\") is used by browser code at line {}; server-only modules cannot reach the browser — use it only inside server exports",
                    c.name,
                    imports[d].source,
                    line(span.start)
                ),
                Some(node),
            ));
        }
    }
    if resume {
        let mut first: Option<NodeId> = None;
        tree.walk(tree.root(), &mut |n| {
            if first.is_some() {
                return false;
            }
            if matches!(tree.kind(n), AstKind::JSXElement(_) | AstKind::JSXFragment(_)) && inside(&removed, tree.span(n)) {
                first = Some(n);
                return false;
            }
            true
        });
        if let Some(node) = first {
            out.errors.push(("Server-only code cannot render JSX in a resumed route module: return data and render it in the page".into(), Some(node)));
        }
    }
    out.edits.sort_by_key(|(s, _)| s.start);
    out
}

/// The source literal as written (quote style kept).
fn quoted_source(statement: &str, source: &str) -> String {
    for quote in ['"', '\''] {
        let literal = format!("{quote}{source}{quote}");
        if statement.contains(&literal) {
            return literal;
        }
    }
    format!("\"{source}\"")
}
