//! Server code in route modules: `serverLoad`, `serverGuard`, `serverActions`, `serverEntries`,
//! `serverHeaders` (any `server[A-Z]…` export) and request handlers `onRequest`, `onGet`, `onPost`,
//! `onPut`, `onPatch`, `onDelete`, `onOptions` run on the server only. Browser builds remove them and every
//! module-scope binding (function, class, variable, import specifier) whose value references all lie
//! in removed code (fixpoint over oxc semantic references; type references do not count).
//!
//! Removal rewrites statements in place at the same byte length (newlines kept), so positions are
//! unchanged: diagnostics, source maps and resume symbol ids agree with the unstripped server
//! compile. Kept code reaching server-only code is an error, never silently kept.

use oxc_allocator::Allocator;
use oxc_ast::{AstKind, ast::*};
use oxc_parser::{ParseOptions, Parser};
use oxc_semantic::{NodeId, SemanticBuilder, SymbolId};
use oxc_span::{GetSpan, Span};

use crate::compile::{Diagnostic, Diags};
use crate::tree::Tree;

/// Server exports of a route module.
pub struct Server {
    /// The browser source (server code rewritten away; same length and lines as the input).
    pub browser: Option<String>,
    pub exports: Vec<String>,
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
        return Server { browser: None, exports: Vec::new(), imports: Vec::new(), diagnostics: Vec::new() };
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
        imports: result.imports,
        diagnostics: diags.list,
    }
}

pub const HANDLERS: &[&str] = &["onRequest", "onGet", "onPost", "onPut", "onPatch", "onDelete", "onOptions"];

/// A server-only export name.
pub fn is_server_export(name: &str) -> bool {
    HANDLERS.contains(&name) || name.strip_prefix("server").is_some_and(|rest| rest.starts_with(|c: char| c.is_ascii_uppercase()))
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

/// Analyze a module. `resume`: removed code may not hold JSX (server exports are not resumable).
pub fn split(tree: &Tree, resume: bool) -> Split {
    let program = tree.program;
    let scoping = tree.sem.scoping();
    let mut out = Split { exports: Vec::new(), imports: Vec::new(), edits: Vec::new(), errors: Vec::new() };
    let mut removed: Vec<Span> = Vec::new();
    let mut roots: Vec<(String, SymbolId)> = Vec::new();
    let mut candidates: Vec<Candidate> = Vec::new();
    let mut imports: Vec<ImportDecl> = Vec::new();
    for statement in &program.body {
        match statement {
            Statement::ExportNamedDeclaration(e) => {
                let span = e.span;
                if let Some(declaration) = &e.declaration {
                    let names = declared_names(declaration);
                    let server = names.iter().filter(|(n, _)| is_server_export(n)).count();
                    if server == 0 {
                        continue;
                    }
                    if server != names.len() {
                        out.errors.push((
                            "Declare server exports (serverLoad, onGet, …) in their own export statement".into(),
                            tree.id_of(&**e),
                        ));
                        continue;
                    }
                    for (name, symbol) in names {
                        out.exports.push(name.clone());
                        roots.push((name, symbol));
                    }
                    removed.push(span);
                    out.edits.push((span, ";".into()));
                } else {
                    // `export { a as serverLoad }` / `export { serverLoad } from "…"`.
                    let server: Vec<bool> = e.specifiers.iter().map(|s| is_server_export(&s.exported.name())).collect();
                    if !server.contains(&true) {
                        continue;
                    }
                    for (s, &is) in e.specifiers.iter().zip(&server) {
                        if is {
                            out.exports.push(s.exported.name().to_string());
                            removed.push(s.span);
                        }
                    }
                    let kept: Vec<&str> =
                        e.specifiers.iter().zip(&server).filter(|(_, is)| !**is).map(|(s, _)| tree.text_of(s.span)).collect();
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
                let mut names = Vec::new();
                for d in &v.declarations {
                    binding_symbols(&d.id, &mut names);
                }
                if !names.is_empty() {
                    candidates.push(Candidate {
                        symbols: names.iter().map(|(_, s)| *s).collect(),
                        own: v.span,
                        import: None,
                        name: names.iter().map(|(n, _)| n.as_str()).collect::<Vec<_>>().join(", "),
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
    if out.exports.is_empty() {
        return Split { exports: Vec::new(), imports: Vec::new(), edits: Vec::new(), errors: out.errors };
    }
    // Value references of a symbol (type queries such as `typeof serverLoad` do not count).
    let references = |symbol: SymbolId| -> Vec<(Span, NodeId)> {
        scoping
            .get_resolved_references(symbol)
            .filter(|r| r.flags().is_value() && !r.flags().is_value_as_type())
            .map(|r| (tree.span(r.node_id()), r.node_id()))
            .collect()
    };
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
