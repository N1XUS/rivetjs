//! A parsed module as a navigable tree: oxc semantic nodes with parent links, children in source
//! order, address lookup for typed AST references, TypeScript-style declaration resolution and
//! TypeScript-compatible (UTF-16) line/column positions.

use oxc_allocator::{Address, GetAddress};
use oxc_ast::{AstKind, ast::*};
use oxc_index::Idx;
use oxc_semantic::{NodeId, Semantic, SymbolId};
use oxc_span::{GetSpan, Span};
use rustc_hash::FxHashMap;

/// TypeScript declaration kinds the compiler distinguishes (`symbol.declarations[0].kind`).
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum DeclKind {
    /// `VariableDeclaration` with an identifier name (also a simple catch variable).
    Variable,
    Parameter,
    /// A name inside a destructuring pattern.
    BindingElement,
    FunctionDeclaration,
    ClassDeclaration,
    ImportSpecifier,
    ImportDefault,
    ImportNamespace,
    ImportEquals,
    Enum,
    /// Function/class expression names, types, namespaces, type parameters.
    Other,
}

impl DeclKind {
    /// resume.mjs VALUE_DECLARATIONS.
    pub fn is_value(self) -> bool {
        self != DeclKind::Other
    }
}

pub struct Tree<'a> {
    pub src: &'a str,
    pub program: &'a Program<'a>,
    pub sem: Semantic<'a>,
    /// Children of node `i`: `child_list[child_start[i]..child_start[i + 1]]`, in source order (one
    /// flat allocation instead of a `Vec` per node).
    child_start: Vec<u32>,
    child_list: Vec<NodeId>,
    /// First non-wrapper node at each AST address (`node_at`).
    by_addr: FxHashMap<Address, NodeId>,
    binding_of_symbol: FxHashMap<SymbolId, NodeId>,
    line_starts: Vec<usize>,
    comment_by_end: FxHashMap<u32, u32>,
}

fn is_wrapper(kind: &AstKind) -> bool {
    matches!(
        kind,
        AstKind::PropertyKey(_)
            | AstKind::Argument(_)
            | AstKind::AssignmentTarget(_)
            | AstKind::SimpleAssignmentTarget(_)
            | AstKind::AssignmentTargetPattern(_)
            | AstKind::ModuleDeclaration(_)
            | AstKind::TSTypeName(_)
    )
}

/// TypeScript `isLineBreak`.
fn line_break(c: char) -> bool {
    matches!(c, '\n' | '\r' | '\u{2028}' | '\u{2029}')
}

/// TypeScript `isWhiteSpaceLike` (single-line whitespace plus line breaks).
pub fn ts_whitespace(c: char) -> bool {
    matches!(
        c,
        ' ' | '\t'
            | '\u{b}'
            | '\u{c}'
            | '\u{a0}'
            | '\u{85}'
            | '\u{1680}'
            | '\u{2000}'..='\u{200b}'
            | '\u{202f}'
            | '\u{205f}'
            | '\u{3000}'
            | '\u{feff}'
    ) || line_break(c)
}

impl<'a> Tree<'a> {
    pub fn new(src: &'a str, program: &'a Program<'a>, sem: Semantic<'a>) -> Self {
        let nodes = sem.nodes();
        let len = nodes.len();
        // Counting pass, prefix sums, fill (ids ascend, so each list starts in creation order).
        let parent_of = |id: NodeId| nodes.parent_id(id).filter(|&parent| parent != id);
        let mut child_start = vec![0u32; len + 1];
        for node in nodes.iter() {
            if let Some(parent) = parent_of(node.id()) {
                child_start[parent.index() + 1] += 1;
            }
        }
        for i in 0..len {
            child_start[i + 1] += child_start[i];
        }
        let mut child_list = vec![NodeId::DUMMY; child_start[len] as usize];
        let mut fill = child_start.clone();
        let mut by_addr: FxHashMap<Address, NodeId> = FxHashMap::with_capacity_and_hasher(len, Default::default());
        let mut binding_of_symbol = FxHashMap::default();
        for node in nodes.iter() {
            let id = node.id();
            if let Some(parent) = parent_of(id) {
                child_list[fill[parent.index()] as usize] = id;
                fill[parent.index()] += 1;
            }
            let kind = node.kind();
            if !is_wrapper(&kind) {
                by_addr.entry(kind.address()).or_insert(id);
            }
            if let AstKind::BindingIdentifier(ident) = kind {
                if let Some(symbol) = ident.symbol_id.get() {
                    binding_of_symbol.insert(symbol, id);
                }
            }
        }
        for i in 0..len {
            let list = &mut child_list[child_start[i] as usize..child_start[i + 1] as usize];
            if list.len() > 1 && !list.is_sorted_by_key(|&child| nodes.kind(child).span().start) {
                list.sort_by_key(|&child| nodes.kind(child).span().start);
            }
        }
        let mut line_starts = vec![0];
        let bytes = src.as_bytes();
        let mut iter = src.char_indices().peekable();
        while let Some((i, c)) = iter.next() {
            if c == '\r' && bytes.get(i + 1) == Some(&b'\n') {
                iter.next();
                line_starts.push(i + 2);
            } else if line_break(c) {
                line_starts.push(i + c.len_utf8());
            }
        }
        let comment_by_end = program.comments.iter().map(|c| (c.span.end, c.span.start)).collect();
        Tree { src, program, sem, child_start, child_list, by_addr, binding_of_symbol, line_starts, comment_by_end }
    }

    pub fn root(&self) -> NodeId {
        self.sem.nodes().root().unwrap_or(NodeId::DUMMY)
    }

    pub fn kind(&self, id: NodeId) -> AstKind<'a> {
        self.sem.nodes().kind(id)
    }

    pub fn span(&self, id: NodeId) -> Span {
        self.kind(id).span()
    }

    pub fn text_of(&self, span: Span) -> &'a str {
        self.src.get(span.start as usize..span.end as usize).unwrap_or("")
    }

    pub fn text(&self, id: NodeId) -> &'a str {
        self.text_of(self.span(id))
    }

    pub fn children(&self, id: NodeId) -> &[NodeId] {
        match (self.child_start.get(id.index()), self.child_start.get(id.index() + 1)) {
            (Some(&start), Some(&end)) => &self.child_list[start as usize..end as usize],
            _ => &[],
        }
    }

    /// Raw parent (oxc structure, including enum wrapper nodes).
    pub fn raw_parent(&self, id: NodeId) -> Option<NodeId> {
        let parent = self.sem.nodes().parent_id(id)?;
        (parent != id).then_some(parent)
    }

    /// Parent skipping oxc enum wrapper nodes (Argument, PropertyKey, ...).
    pub fn parent(&self, id: NodeId) -> Option<NodeId> {
        let mut parent = self.raw_parent(id)?;
        while is_wrapper(&self.kind(parent)) {
            parent = self.raw_parent(parent)?;
        }
        Some(parent)
    }

    pub fn parent_kind(&self, id: NodeId) -> Option<AstKind<'a>> {
        self.parent(id).map(|p| self.kind(p))
    }

    /// Node of a typed AST reference (the first non-wrapper node at its address).
    pub fn node_at(&self, address: Address) -> Option<NodeId> {
        self.by_addr.get(&address).copied()
    }

    pub fn expr_id(&self, expression: &Expression<'a>) -> Option<NodeId> {
        self.node_at(expression.address())
    }

    pub fn id_of<T>(&self, node: &T) -> Option<NodeId> {
        self.node_at(Address::from_ptr(node))
    }

    /// Descendants (including `id`) in source pre-order.
    pub fn walk(&self, id: NodeId, f: &mut dyn FnMut(NodeId) -> bool) {
        if f(id) {
            for &child in self.children(id) {
                self.walk(child, f);
            }
        }
    }

    /// 1-based line and UTF-16 column, as TypeScript's getLineAndCharacterOfPosition.
    pub fn line_col(&self, pos: u32) -> (u32, u32) {
        let pos = (pos as usize).min(self.src.len());
        let line = self.line_starts.partition_point(|&start| start <= pos).saturating_sub(1);
        let start = self.line_starts[line];
        let column: usize = self.src.get(start..pos).map_or(0, |s| s.encode_utf16().count());
        (line as u32 + 1, column as u32 + 1)
    }

    /// TypeScript `node.getStart()`: JSX text skips leading whitespace; other nodes start at their
    /// first token.
    pub fn start(&self, id: NodeId) -> u32 {
        let span = self.span(id);
        if let AstKind::JSXText(_) = self.kind(id) {
            let text = self.text_of(span);
            let skipped = text.find(|c: char| !ts_whitespace(c)).unwrap_or(text.len());
            return span.start + skipped as u32;
        }
        span.start
    }

    /// TypeScript `node.pos`: the end of the previous token, i.e. the start with leading trivia.
    pub fn full_start(&self, id: NodeId) -> u32 {
        let span = self.span(id);
        if let Some(AstKind::JSXElement(_) | AstKind::JSXFragment(_)) = self.parent_kind(id) {
            // JSX children are preceded by JSX text (which owns the whitespace) or a token.
            return span.start;
        }
        let mut pos = span.start as usize;
        let bytes = self.src.as_bytes();
        loop {
            let before = self.src.get(..pos).unwrap_or("");
            let trimmed = before.trim_end_matches(ts_whitespace);
            pos = trimmed.len();
            match self.comment_by_end.get(&(pos as u32)) {
                Some(&start) if (start as usize) < pos => pos = start as usize,
                _ => break,
            }
        }
        let _ = bytes;
        pos as u32
    }

    pub fn symbol_of_ref(&self, ident: &IdentifierReference<'a>) -> Option<SymbolId> {
        let reference = ident.reference_id.get()?;
        self.sem.scoping().get_reference(reference).symbol_id()
    }

    /// Whether any reference writes the symbol (assignment, update, destructuring target).
    pub fn symbol_written(&self, symbol: SymbolId) -> bool {
        self.sem.scoping().get_resolved_references(symbol).any(|r| r.flags().is_write())
    }

    /// Whether the symbol is declared in the module's top-level scope (imports included).
    pub fn module_symbol(&self, symbol: SymbolId) -> bool {
        let scoping = self.sem.scoping();
        scoping.symbol_scope_id(symbol) == scoping.root_scope_id()
    }

    /// Span of a referenced symbol's binding identifier (editor capture locations).
    pub fn binding_span(&self, ident: &IdentifierReference<'a>) -> Option<Span> {
        self.symbol_of_ref(ident).map(|symbol| self.sem.scoping().symbol_span(symbol))
    }

    /// The TypeScript-equivalent declaration node of a symbol (`symbol.declarations[0]`).
    pub fn decl_of_symbol(&self, symbol: SymbolId) -> NodeId {
        let mut node = self.sem.scoping().symbol_declaration(symbol);
        // A type and a value of one name (`type X = …; const X = …`, `interface X …; const X = …`) are one symbol whose
        // first declaration is the type: resolve to the value declaration (the meaning a value reference has in TypeScript).
        let is_type = |n: NodeId| matches!(self.kind(n), AstKind::TSTypeAliasDeclaration(_) | AstKind::TSInterfaceDeclaration(_));
        if is_type(node) {
            if let Some(r) = self.sem.scoping().symbol_redeclarations(symbol).iter().find(|r| !is_type(r.declaration)) {
                node = r.declaration;
            }
        }
        let binding = self.binding_of_symbol.get(&symbol).copied();
        let direct = |pattern: &BindingPattern| match &pattern.kind {
            BindingPatternKind::BindingIdentifier(ident) => ident.symbol_id.get() == Some(symbol),
            _ => false,
        };
        let simple = match self.kind(node) {
            AstKind::VariableDeclarator(d) => direct(&d.id),
            AstKind::FormalParameter(p) => direct(&p.pattern),
            AstKind::CatchParameter(p) => direct(&p.pattern),
            AstKind::BindingRestElement(r) => {
                // `...args` parameter: a TypeScript Parameter.
                direct(&r.argument)
                    && matches!(self.raw_parent(node).map(|p| self.kind(p)), Some(AstKind::FormalParameters(_)))
            }
            _ => true,
        };
        if simple { node } else { binding.unwrap_or(node) }
    }

    pub fn decl_kind(&self, decl: NodeId) -> DeclKind {
        match self.kind(decl) {
            AstKind::VariableDeclarator(_) | AstKind::CatchParameter(_) => DeclKind::Variable,
            AstKind::FormalParameter(_) | AstKind::BindingRestElement(_) => DeclKind::Parameter,
            AstKind::BindingIdentifier(_) => DeclKind::BindingElement,
            AstKind::Function(f) => {
                if f.r#type == FunctionType::FunctionDeclaration || f.r#type == FunctionType::TSDeclareFunction {
                    DeclKind::FunctionDeclaration
                } else {
                    DeclKind::Other
                }
            }
            AstKind::Class(c) => {
                if c.r#type == ClassType::ClassDeclaration {
                    DeclKind::ClassDeclaration
                } else {
                    DeclKind::Other
                }
            }
            AstKind::ImportSpecifier(_) => DeclKind::ImportSpecifier,
            AstKind::ImportDefaultSpecifier(_) => DeclKind::ImportDefault,
            AstKind::ImportNamespaceSpecifier(_) => DeclKind::ImportNamespace,
            AstKind::TSImportEqualsDeclaration(_) => DeclKind::ImportEquals,
            AstKind::TSEnumDeclaration(_) => DeclKind::Enum,
            _ => DeclKind::Other,
        }
    }

    /// TypeScript `checker.getSymbolAtLocation(identifier)?.declarations?.[0]` for a reference.
    /// Shorthand properties resolve to their value (`getShorthandAssignmentValueSymbol`) only
    /// when `shorthand_value` is set; otherwise TypeScript sees the property symbol (no match).
    pub fn resolve(&self, ident: &IdentifierReference<'a>, shorthand_value: bool) -> Option<NodeId> {
        let id = self.id_of(ident)?;
        match self.parent_kind(id) {
            Some(AstKind::ObjectProperty(p)) if p.shorthand && !shorthand_value => return None,
            // `export { x }` names the export specifier itself; `export { x as y }` resolves `x`.
            Some(AstKind::ExportSpecifier(s)) if s.local.span() == s.exported.span() => return None,
            _ => {}
        }
        self.symbol_of_ref(ident).map(|symbol| self.decl_of_symbol(symbol))
    }

    /// Whether `node` is a type-reference name (TypeScript TypeReference / QualifiedName parent).
    pub fn in_type_name(&self, id: NodeId) -> bool {
        matches!(self.parent_kind(id), Some(AstKind::TSTypeReference(_) | AstKind::TSQualifiedName(_)))
    }

    /// TypeScript `isFunctionLike`-style test used by resume analysis (`isFunction`).
    pub fn is_function(&self, id: NodeId) -> bool {
        matches!(self.kind(id), AstKind::Function(_) | AstKind::ArrowFunctionExpression(_))
    }
}
