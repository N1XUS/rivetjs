//! ZERO CALLSITE: the module-level reference graph of one module (`moduleFacts(…, { refs: true })`), for the per-call-site
//! context proof of `libs/compiler/facts-fixpoint.ts` (`contexts`). Per top-level declaration (a function, a class, one
//! declarator, an anonymous default export): the module-level bindings and imports its code references as values, as
//! JSX tags and as the direct argument of a context reader call by name (`useContext(X)`, `contextProps(…, X)`,
//! `slottedContext(X)`: `reads`, `[name, callee]`; the TS side trusts it only when the callee resolves to the real
//! reader), the modules it imports dynamically (`import("…")`: every declaration of theirs), and whether it holds code
//! the graph cannot follow (`import(expression)`, `eval`, `require`, `new Function`) or creates
//! context tokens at run time (`createContext` outside a top-level `const` initializer). Top-level statements that are no
//! declarations (`X.part = Y`, `register(a, b)`) are groups: each name they reference reaches every other one.
//! Context tokens: top-level `const X = createContext(…)` (any `…Context(…)` factory call, `resume::derived` rule).

use oxc_ast::{AstKind, ast::*};
use oxc_span::{GetSpan, Span};
use serde_json::{Value, json};

use crate::resume::derived::context_token;
use crate::resume::unwrap;
use crate::tree::Tree;

/// Entry flags: code the graph cannot follow / run-time token creation.
const OPAQUE: u32 = 1;
const DYNAMIC_TOKEN: u32 = 2;

enum Kind {
    Decl,
    Group,
    Skip,
}

struct Entry {
    span: Span,
    kind: Kind,
    names: Vec<String>,
    values: Vec<String>,
    jsx: Vec<String>,
    /// `import("literal")` specifiers (the module's every declaration is reachable).
    dynamic: Vec<String>,
    /// `[name, callee]`: a binding passed straight as an argument of a call to a plain identifier named like a context
    /// reader (`useContext`, `contextProps`, `slottedContext`); the TS side checks the callee resolves to the real one.
    reads: Vec<(String, String)>,
    flags: u32,
}

fn push(list: &mut Vec<String>, name: &str) {
    if !list.iter().any(|n| n == name) {
        list.push(name.to_string());
    }
}

fn entry(span: Span, kind: Kind, names: Vec<String>) -> Entry {
    Entry { span, kind, names, values: Vec::new(), jsx: Vec::new(), dynamic: Vec::new(), reads: Vec::new(), flags: 0 }
}

fn variable_entries(v: &VariableDeclaration<'_>, out: &mut Vec<Entry>, tokens: &mut Vec<String>) {
    for declarator in &v.declarations {
        if let (BindingPatternKind::BindingIdentifier(id), Some(init)) = (&declarator.id.kind, &declarator.init) {
            if v.kind == VariableDeclarationKind::Const && context_token(init) {
                push(tokens, &id.name);
            }
        }
        out.push(entry(declarator.span, Kind::Decl, Vec::new()));
    }
}

fn declaration_entries(d: &Declaration<'_>, out: &mut Vec<Entry>, tokens: &mut Vec<String>) {
    match d {
        Declaration::VariableDeclaration(v) => variable_entries(v, out, tokens),
        Declaration::FunctionDeclaration(f) => out.push(entry(f.span, Kind::Decl, Vec::new())),
        Declaration::ClassDeclaration(c) => out.push(entry(c.span, Kind::Decl, Vec::new())),
        Declaration::TSEnumDeclaration(e) => out.push(entry(e.span, Kind::Decl, Vec::new())),
        _ => out.push(entry(d.span(), Kind::Skip, Vec::new())),
    }
}

/// `createContext(…)` / `resumableContext(…)` / `create…Context(…)` calls (a token factory).
fn token_factory(call: &CallExpression<'_>) -> bool {
    matches!(unwrap(&call.callee), Expression::Identifier(i) if {
        let n = i.name.as_str();
        n == "createContext" || n == "resumableContext" || (n.starts_with("create") && n.ends_with("Context"))
    })
}

fn inside_function(tree: &Tree<'_>, mut id: oxc_semantic::NodeId) -> bool {
    while let Some(p) = tree.raw_parent(id) {
        if matches!(tree.kind(p), AstKind::Function(_) | AstKind::ArrowFunctionExpression(_) | AstKind::Class(_)) {
            return true;
        }
        id = p;
    }
    false
}

/// Context readers by name (the TS side resolves the callee before it trusts the classification).
const READERS: [&str; 3] = ["useContext", "contextProps", "slottedContext"];

/// The callee name when reference `node` is a direct argument of `reader(…)`.
fn reader_call(tree: &Tree<'_>, node: oxc_semantic::NodeId) -> Option<String> {
    let AstKind::CallExpression(call) = tree.parent(node).map(|p| tree.kind(p))? else { return None };
    let Expression::Identifier(callee) = &call.callee else { return None };
    if !READERS.contains(&callee.name.as_str()) {
        return None;
    }
    let span = tree.span(node);
    call.arguments.iter().any(|a| a.as_expression().is_some_and(|x| matches!(x, Expression::Identifier(i) if i.span == span))).then(|| callee.name.to_string())
}

pub fn ref_facts(tree: &Tree<'_>) -> Value {
    let program = tree.program;
    let scoping = tree.sem.scoping();
    let root = scoping.root_scope_id();
    let mut entries: Vec<Entry> = Vec::new();
    let mut tokens: Vec<String> = Vec::new();
    for statement in &program.body {
        match statement {
            Statement::ImportDeclaration(_) | Statement::ExportAllDeclaration(_) => entries.push(entry(statement.span(), Kind::Skip, Vec::new())),
            Statement::ExportNamedDeclaration(e) => match &e.declaration {
                Some(d) => declaration_entries(d, &mut entries, &mut tokens),
                None => entries.push(entry(statement.span(), Kind::Skip, Vec::new())),
            },
            Statement::ExportDefaultDeclaration(e) => match &e.declaration {
                ExportDefaultDeclarationKind::Identifier(_) => entries.push(entry(statement.span(), Kind::Skip, Vec::new())),
                ExportDefaultDeclarationKind::FunctionDeclaration(f) if f.id.is_some() => entries.push(entry(statement.span(), Kind::Decl, Vec::new())),
                ExportDefaultDeclarationKind::ClassDeclaration(c) if c.id.is_some() => entries.push(entry(statement.span(), Kind::Decl, Vec::new())),
                ExportDefaultDeclarationKind::TSInterfaceDeclaration(_) => entries.push(entry(statement.span(), Kind::Skip, Vec::new())),
                _ => entries.push(entry(statement.span(), Kind::Decl, vec!["default".to_string()])),
            },
            Statement::VariableDeclaration(v) => variable_entries(v, &mut entries, &mut tokens),
            Statement::FunctionDeclaration(f) => entries.push(entry(f.span, Kind::Decl, Vec::new())),
            Statement::ClassDeclaration(c) => entries.push(entry(c.span, Kind::Decl, Vec::new())),
            Statement::TSEnumDeclaration(e) => entries.push(entry(e.span, Kind::Decl, Vec::new())),
            Statement::TSTypeAliasDeclaration(_)
            | Statement::TSInterfaceDeclaration(_)
            | Statement::TSModuleDeclaration(_)
            | Statement::TSImportEqualsDeclaration(_) => entries.push(entry(statement.span(), Kind::Skip, Vec::new())),
            _ => entries.push(entry(statement.span(), Kind::Group, Vec::new())),
        }
    }
    let spans: Vec<Span> = entries.iter().map(|e| e.span).collect();
    let at = |pos: u32| -> Option<usize> {
        let i = spans.partition_point(|s| s.start <= pos);
        (i > 0 && pos < spans[i - 1].end).then(|| i - 1)
    };
    // Declared names (module scope) and namespace imports.
    let mut namespaces: Vec<(String, String)> = Vec::new();
    let symbols: Vec<_> = scoping.symbol_ids().filter(|&s| scoping.symbol_scope_id(s) == root).collect();
    for &symbol in &symbols {
        let name = scoping.symbol_name(symbol);
        let decl = scoping.symbol_declaration(symbol);
        if let AstKind::ImportNamespaceSpecifier(_) = tree.kind(decl) {
            if let Some(AstKind::ImportDeclaration(d)) = tree.raw_parent(decl).map(|p| tree.kind(p)) {
                namespaces.push((name.to_string(), d.source.value.to_string()));
            }
            continue;
        }
    }
    // (By binding identifier, not the symbol's declaration: `interface X` + `const X = …` share one symbol.)
    for node in tree.sem.nodes().iter() {
        let AstKind::BindingIdentifier(b) = node.kind() else { continue };
        let Some(symbol) = b.symbol_id.get() else { continue };
        if scoping.symbol_scope_id(symbol) != root {
            continue;
        }
        if let Some(i) = at(b.span.start) {
            if matches!(entries[i].kind, Kind::Decl) {
                push(&mut entries[i].names, &b.name);
            }
        }
    }
    // References (values; JSX tags apart), by the entry they sit in.
    for &symbol in &symbols {
        let name = scoping.symbol_name(symbol);
        for r in scoping.get_resolved_references(symbol) {
            if !r.flags().is_value() || r.flags().is_value_as_type() {
                continue;
            }
            let node = r.node_id();
            let Some(i) = at(tree.span(node).start) else { continue };
            let e = &mut entries[i];
            match e.kind {
                Kind::Skip => {}
                Kind::Group => push(&mut e.values, name),
                Kind::Decl => {
                    if e.names.iter().any(|n| n == name) {
                        continue;
                    }
                    let jsx = matches!(
                        tree.parent(node).map(|p| tree.kind(p)),
                        Some(AstKind::JSXOpeningElement(_) | AstKind::JSXClosingElement(_) | AstKind::JSXMemberExpression(_))
                    );
                    if jsx {
                        push(&mut e.jsx, name)
                    } else if let Some(callee) = reader_call(tree, node) {
                        if !e.reads.iter().any(|(n, c)| n == name && *c == callee) {
                            e.reads.push((name.to_string(), callee));
                        }
                    } else {
                        push(&mut e.values, name)
                    }
                }
            }
        }
    }
    // Code the graph cannot follow, run-time token creation.
    for node in tree.sem.nodes().iter() {
        let flag = match node.kind() {
            AstKind::ImportExpression(e) => match &e.source {
                Expression::StringLiteral(spec) => {
                    if let Some(i) = at(e.span.start) {
                        push(&mut entries[i].dynamic, &spec.value);
                    }
                    0
                }
                _ => OPAQUE,
            },
            AstKind::CallExpression(c) => match unwrap(&c.callee) {
                Expression::Identifier(i) if (i.name == "eval" || i.name == "require") && tree.symbol_of_ref(i).is_none() => OPAQUE,
                _ if token_factory(c) => {
                    // A token made by a top-level `const` initializer is a module token; anywhere else, one per run.
                    let top = matches!(tree.parent(node.id()).map(|p| tree.kind(p)), Some(AstKind::VariableDeclarator(d)) if d.init.as_ref().is_some_and(|x| unwrap(x).span() == c.span))
                        && !inside_function(tree, node.id());
                    if top { 0 } else { DYNAMIC_TOKEN }
                }
                _ => 0,
            },
            AstKind::NewExpression(n) => match unwrap(&n.callee) {
                Expression::Identifier(i) if i.name == "Function" && tree.symbol_of_ref(i).is_none() => OPAQUE,
                _ => 0,
            },
            _ => 0,
        };
        if flag != 0 {
            if let Some(i) = at(node.kind().span().start) {
                entries[i].flags |= flag;
            }
        }
    }
    let decls: Vec<Value> = entries
        .iter()
        .filter(|e| matches!(e.kind, Kind::Decl) && !e.names.is_empty())
        .map(|e| json!([e.names, e.values, e.jsx, e.flags, e.dynamic, e.reads.iter().map(|(n, c)| json!([n, c])).collect::<Vec<_>>()]))
        .collect();
    let groups: Vec<Value> = entries
        .iter()
        .filter(|e| matches!(e.kind, Kind::Group) && (e.values.len() > 1 || e.flags != 0 || !e.dynamic.is_empty()))
        .map(|e| json!([e.values, e.flags, e.dynamic]))
        .collect();
    json!({
        "tokens": tokens,
        "decls": decls,
        "groups": groups,
        "namespaces": namespaces.iter().map(|(l, f)| json!([l, f])).collect::<Vec<_>>(),
    })
}
