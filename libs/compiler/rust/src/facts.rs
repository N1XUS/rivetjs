//! Static facts of one module for resume chunk grouping: imports, lazy edges, components and what
//! they render, chunk groups (`ChunkGroup`), module preload. Maps and sets are insertion-ordered pairs/lists.

use oxc_allocator::Allocator;
use oxc_ast::{AstKind, ast::*};
use oxc_parser::{ParseOptions, Parser};
use oxc_semantic::{NodeId, SemanticBuilder};
use oxc_span::GetSpan;
use serde::Serialize;
use serde_json::{Value, json};

use crate::compile::{attr_name, attr_string};
use crate::tree::Tree;

#[derive(Serialize)]
struct Imported {
    from: String,
    imported: String,
}

#[derive(Serialize)]
struct Group {
    key: String,
    preload: Option<String>,
    tags: Vec<String>,
}

fn component(name: &str) -> bool {
    name.starts_with(|c: char| c.is_ascii_uppercase())
}

fn add(set: &mut Vec<String>, value: &str) {
    if !set.iter().any(|v| v == value) {
        set.push(value.to_string());
    }
}

fn set_pair<T>(map: &mut Vec<(String, T)>, key: &str, value: T) {
    match map.iter_mut().find(|(k, _)| k == key) {
        Some(entry) => entry.1 = value,
        None => map.push((key.to_string(), value)),
    }
}

struct Facts<'t, 'a> {
    tree: &'t Tree<'a>,
    filename: &'t str,
    imports: Vec<(String, Imported)>,
    statics: Vec<String>,
    dynamics: Vec<String>,
    components: Vec<(String, Vec<String>)>,
    groups: Vec<Group>,
    preload: Option<String>,
    default_name: Option<String>,
}

/// `attribute(element, name)`: Some(Some(text)) for a string, Some(None) otherwise, None if absent.
fn literal_attribute<'a>(tree: &Tree<'a>, el: &JSXElement<'a>, name: &str) -> Option<String> {
    for item in &el.opening_element.attributes {
        let JSXAttributeItem::Attribute(attr) = item else { continue };
        if attr_name(tree, attr) == name {
            return attr_string(tree, attr).map(str::to_string);
        }
    }
    None
}

impl<'t, 'a> Facts<'t, 'a> {
    fn tags(&self, node: NodeId, into: &mut Vec<String>) {
        let tree = self.tree;
        tree.walk(node, &mut |n| {
            if let AstKind::JSXElement(el) = tree.kind(n) {
                let name = tree.text_of(el.opening_element.name.span());
                if component(name) {
                    add(into, name);
                }
            }
            true
        });
    }

    fn top_level(&self, id: NodeId) -> bool {
        let tree = self.tree;
        match tree.parent(id).map(|p| (p, tree.kind(p))) {
            Some((_, AstKind::Program(_))) => true,
            Some((p, AstKind::ExportNamedDeclaration(_) | AstKind::ExportDefaultDeclaration(_))) => {
                matches!(tree.parent(p).map(|g| tree.kind(g)), Some(AstKind::Program(_)))
            }
            _ => false,
        }
    }

    fn group_tag(&self, el: &JSXElement<'a>) -> bool {
        let name = self.tree.text_of(el.opening_element.name.span());
        self.imports
            .iter()
            .find(|(k, _)| k == name)
            .is_some_and(|(_, i)| i.imported == "ChunkGroup" && i.from.starts_with("@rivetjs/runtime"))
    }

    fn visit(&mut self, id: NodeId, owner: Option<String>) {
        let tree = self.tree;
        let kind = tree.kind(id);
        match kind {
            AstKind::ImportDeclaration(d) => {
                let from = d.source.value.to_string();
                add(&mut self.statics, &from);
                for specifier in d.specifiers.iter().flatten() {
                    match specifier {
                        ImportDeclarationSpecifier::ImportDefaultSpecifier(s) => set_pair(
                            &mut self.imports,
                            &s.local.name,
                            Imported { from: from.clone(), imported: "default".into() },
                        ),
                        ImportDeclarationSpecifier::ImportSpecifier(s) => set_pair(
                            &mut self.imports,
                            &s.local.name,
                            Imported { from: from.clone(), imported: s.imported.name().to_string() },
                        ),
                        ImportDeclarationSpecifier::ImportNamespaceSpecifier(_) => {}
                    }
                }
            }
            AstKind::ExportNamedDeclaration(d) => {
                if let Some(source) = &d.source {
                    add(&mut self.statics, &source.value);
                }
            }
            AstKind::ExportAllDeclaration(d) => add(&mut self.statics, &d.source.value),
            AstKind::ImportExpression(e) => {
                if let Expression::StringLiteral(s) = &e.source {
                    add(&mut self.dynamics, &s.value);
                }
            }
            _ => {}
        }
        let mut next = owner.clone();
        let mut default_function = false;
        match kind {
            AstKind::Function(f) if f.r#type == FunctionType::FunctionDeclaration && self.top_level(id) => {
                if let Some(name) = f.id.as_ref().filter(|i| component(&i.name)) {
                    next = Some(name.name.to_string());
                    default_function = matches!(tree.parent_kind(id), Some(AstKind::ExportDefaultDeclaration(_)));
                }
            }
            AstKind::VariableDeclarator(d) => {
                let top = tree
                    .raw_parent(id)
                    .is_some_and(|declaration| self.top_level(declaration));
                if let (BindingPatternKind::BindingIdentifier(name), Some(init)) = (&d.id.kind, &d.init) {
                    if component(&name.name)
                        && matches!(init, Expression::ArrowFunctionExpression(_) | Expression::FunctionExpression(_))
                        && top
                    {
                        next = Some(name.name.to_string());
                    }
                }
            }
            _ => {}
        }
        if next != owner {
            if let Some(name) = &next {
                let mut rendered = Vec::new();
                self.tags(id, &mut rendered);
                set_pair(&mut self.components, name, rendered);
                if default_function {
                    self.default_name = Some(name.clone());
                }
            }
        }
        if let AstKind::JSXElement(el) = kind {
            if self.group_tag(el) {
                let mut inside = Vec::new();
                if el.closing_element.is_some() || !el.children.is_empty() {
                    for &child in tree.children(id) {
                        if matches!(tree.kind(child), AstKind::JSXOpeningElement(_) | AstKind::JSXClosingElement(_)) {
                            continue;
                        }
                        self.tags(child, &mut inside);
                    }
                }
                let name = literal_attribute(tree, el, "name");
                let key = format!(
                    "{}#{}",
                    self.filename,
                    name.unwrap_or_else(|| format!("group@{}", tree.full_start(id)))
                );
                self.groups.push(Group { key, preload: literal_attribute(tree, el, "preload"), tags: inside });
            }
        }
        if let AstKind::VariableDeclaration(v) = kind {
            if matches!(tree.parent_kind(id), Some(AstKind::ExportNamedDeclaration(_))) && self.top_level(id) {
                for d in &v.declarations {
                    if let (BindingPatternKind::BindingIdentifier(name), Some(Expression::StringLiteral(s))) =
                        (&d.id.kind, &d.init)
                    {
                        if name.name == "preload" {
                            self.preload = Some(s.value.to_string());
                        }
                    }
                }
            }
        }
        if let AstKind::ExportDefaultDeclaration(d) = kind {
            if let ExportDefaultDeclarationKind::Identifier(i) = &d.declaration {
                self.default_name = Some(i.name.to_string());
            }
        }
        for &child in tree.children(id) {
            self.visit(child, next.clone());
        }
    }
}

pub fn module_facts(source: &str, filename: &str) -> Value {
    let allocator = Allocator::default();
    let parsed = Parser::new(&allocator, source, crate::source_type::of(filename))
        .with_options(ParseOptions { preserve_parens: true, ..ParseOptions::default() })
        .parse();
    let program = allocator.alloc(parsed.program);
    let semantic = SemanticBuilder::new().with_check_syntax_error(false).build(program).semantic;
    let tree = Tree::new(source, program, semantic);
    let mut facts = Facts {
        tree: &tree,
        filename,
        imports: Vec::new(),
        statics: Vec::new(),
        dynamics: Vec::new(),
        components: Vec::new(),
        groups: Vec::new(),
        preload: None,
        default_name: None,
    };
    facts.visit(tree.root(), None);
    json!({
        "imports": facts.imports.iter().map(|(k, v)| json!([k, v])).collect::<Vec<_>>(),
        "statics": facts.statics,
        "dynamics": facts.dynamics,
        "components": facts.components.iter().map(|(k, v)| json!([k, v])).collect::<Vec<_>>(),
        "groups": facts.groups,
        "preload": facts.preload,
        "defaultName": facts.default_name,
    })
}

/// Derived model (M2 C1): per module-level component boundary facts (`moduleFacts(…, { boundaries: true })`); runs the
/// resume analysis (its diagnostics are not facts and are dropped).
pub fn boundary_facts(source: &str, filename: &str) -> Value {
    let allocator = Allocator::default();
    let parsed = Parser::new(&allocator, source, crate::source_type::of(filename))
        .with_options(ParseOptions { preserve_parens: true, ..ParseOptions::default() })
        .parse();
    if parsed.panicked {
        return Value::Array(Vec::new());
    }
    let program = allocator.alloc(parsed.program);
    let semantic = SemanticBuilder::new().with_check_syntax_error(false).build(program).semantic;
    let tree = Tree::new(source, program, semantic);
    let mut scratch = crate::compile::Diags { tree: Some(&tree), filename: filename.to_string(), list: Vec::new() };
    let resumed = crate::resume::analyze(&tree, filename, &mut scratch, &Default::default(), &[], &Default::default());
    crate::resume::derived::facts_json(&tree, &resumed)
}

/// Shell cache H-holes (PPR-T6): every streamed boundary element and whether a stored shell may re-run only its content
/// (`moduleFacts(…, { holes: true })`, `crate::holes`).
pub fn hole_facts(source: &str, filename: &str) -> Value {
    let allocator = Allocator::default();
    let parsed = Parser::new(&allocator, source, crate::source_type::of(filename))
        .with_options(ParseOptions { preserve_parens: true, ..ParseOptions::default() })
        .parse();
    if parsed.panicked {
        return Value::Array(Vec::new());
    }
    let program = allocator.alloc(parsed.program);
    let semantic = SemanticBuilder::new().with_check_syntax_error(false).build(program).semantic;
    let tree = Tree::new(source, program, semantic);
    crate::holes::facts_json(&tree)
}
