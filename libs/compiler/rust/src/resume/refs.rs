//! Function Bridge C3 / T3 (2026-10-09, spec `docs/design/specs/2026-10-09-function-bridge-design.md` §3.1 / §3.2): module
//! references. A module-level function / `const` function or a static import used as a value inside a component of a
//! resume module (`const api = { inc }`, `[double]`, `signal(fmt)`, `ns.member`) is stamped once per module load by the
//! server epilogue `_rMod(() => value, "id"[, 1])` (a thunk: an import binding may still be in its TDZ while an import
//! cycle evaluates; the runtime reads it before the first encode), after the module's last statement; the browser symbol
//! `() => (g)` returns the module's own binding (the encoder writes `{f: id, a: []}` wherever a render reaches the value).
//!
//! Ids `<unit>#<name>$<h>$ref` (`$ref` is a reserved hash suffix, so no closure symbol shares it):
//! - `unit`: the module itself (own functions) or the imported module — its RESOLVED module id when the bundler passed one
//!   (`resolvedImports`: `./util`, `./util.js`, `./util.ts` from any importer → `src/util.ts`; `util.ts` and
//!   `util/index.ts` stay two units), else the specifier (packages) or the specifier resolved against the importing
//!   module's directory. One id per value whatever module imports it: state never depends on which importers loaded.
//! - `name`: the EXPORTED name — an import's imported name (`ns.member` → `member`, a default import's member →
//!   `default_member`), an own function's name in the module's exports (`export { plus as inc }` → `inc` for `plus`,
//!   `export default inc` → `default`) — so an import of an own export gets the own id (same unit + name) and the same
//!   value; an own function the module does not export gets `<local>$l` with the digest salted (`unit, "\0local",
//!   local`): no import can name it, so a local `inc` next to `export { plus as inc }` / `export { inc } from "./o"`
//!   never shares an id with that export (fix round 2, N1a). Non-identifier characters → `_`; `h` = 5 base-36 digits of
//!   FNV-1a over unit + name, so two values never share an export name in one symbol module (two `default` imports,
//!   `fmt` from two packages, own `double` + `u.double`).
//! - flag `1` on the stamp = an import: the runtime keeps an own-module stamp over import stamps.
//!
//! DIET-STATE 1 (2026-10-22): module static data. A module-level `const` whose initializer is static data (`module_data`:
//! object / array / primitive / template literals, nested, other such consts, `Array.from({ length: n }, (v, i) => …)`
//! over the same, no other call / `new` / function / `this`) and that no statement of the module mutates (assigns /
//! updates / deletes a member, calls a mutating method on it or a member, `Object.assign(X, …)`, …) is a module reference
//! too: the server value equals the browser module's own (same deterministic code), so state carries `{f: id}` instead of
//! the data (generated route tables, demo row arrays). Its symbol takes a key path (`(...p) => p.reduce((o, k) => o[k],
//! X)`) and its stamp the flag `2`: the runtime stamps every nested object with its path, so an element reached on its
//! own (a row item, a selected value) resumes as the module's object too (identity kept). An alias mutated elsewhere is
//! not seen here: development warns when a stamped value changed (`dev/on.ts` `moduleData`).

use oxc_ast::{
    AstKind,
    ast::{
        BinaryOperator, BindingPatternKind, Declaration, ExportDefaultDeclarationKind, Expression, IdentifierReference, ObjectPropertyKind, PropertyKind,
        Statement, UnaryOperator, VariableDeclarationKind,
    },
};
use oxc_semantic::{NodeId, SymbolId};
use oxc_span::GetSpan;
use rustc_hash::{FxHashMap, FxHashSet};

use super::{Analysis, Import, ModuleRef, Symbol, content_digest, import_source, is_function, unwrap, value_positions};
use crate::compile::Diags;
use crate::tree::Tree;

/// The first value use (inside a component) of a module function / import (+ member of a namespace / default import).
pub(super) struct RefUse {
    decl: NodeId,
    member: Option<String>,
    component: String,
    /// Every component using it (source order; `component` first).
    components: Vec<String>,
    node: NodeId,
}

/// Digits of the unit hash in a reference name.
const UNIT_HASH: usize = 5;

/// `from` mapped to its resolved module id (`resolved`), else resolved against the directory of `module` when relative
/// (`.` / `..` segments folded), else `from` itself.
fn unit(module: &str, resolved: &FxHashMap<String, String>, from: &str) -> String {
    if let Some(id) = resolved.get(from) {
        return id.clone();
    }
    if !(from == "." || from == ".." || from.starts_with("./") || from.starts_with("../")) {
        return from.to_string();
    }
    let mut parts: Vec<&str> = module.split('/').collect();
    parts.pop();
    for segment in from.split('/') {
        match segment {
            "" | "." => {}
            ".." if parts.last().is_some_and(|p| !p.is_empty() && *p != "..") => {
                parts.pop();
            }
            segment => parts.push(segment),
        }
    }
    parts.join("/")
}

/// `name` with every character an identifier cannot hold replaced by `_` (`"a-b"` → `a_b`).
fn identifier_part(name: &str) -> String {
    name.chars().map(|c| if c == '_' || c == '$' || c.is_alphanumeric() { c } else { '_' }).collect()
}

/// A context token by convention (`ButtonContext`): PascalCase ending in `Context`. Context ids are Function Bridge
/// T14 / T16; a token never needs a module reference (a provided value encodes as `{x}`).
fn context_token(name: &str) -> bool {
    name.len() > "Context".len() && name.ends_with("Context") && name.starts_with(|c: char| c.is_ascii_uppercase())
}

/// A context lookup (`useContext(X)`, `useSlottedContext(X)`, `useContextProps(p, ref, X)`): its arguments are tokens.
fn context_call(callee: &Expression) -> bool {
    matches!(unwrap(callee), Expression::Identifier(i) if i.name.as_str().starts_with("use") && i.name.as_str().contains("Context"))
}

impl<'t, 'a> Analysis<'t, 'a> {
    /// `scan` hook (outside sites): module functions / imports in value positions — property values, call / new
    /// arguments, assigned / returned / initial values, concise arrow bodies, yields.
    pub(super) fn scan_refs(&mut self, kind: AstKind<'a>) {
        match kind {
            AstKind::ObjectProperty(p) if p.kind == PropertyKind::Init && !p.method => self.module_refs(&p.value),
            AstKind::ReturnStatement(r) => {
                if let Some(argument) = &r.argument {
                    self.module_refs(argument);
                }
            }
            AstKind::VariableDeclarator(d) => {
                if let Some(init) = &d.init {
                    self.module_refs(init);
                }
            }
            AstKind::AssignmentExpression(assign) => self.module_refs(&assign.right),
            AstKind::CallExpression(call) if !context_call(&call.callee) => {
                for argument in &call.arguments {
                    if let Some(value) = argument.as_expression() {
                        self.module_refs(value);
                    }
                }
            }
            AstKind::NewExpression(call) => {
                for argument in &call.arguments {
                    if let Some(value) = argument.as_expression() {
                        self.module_refs(value);
                    }
                }
            }
            AstKind::ArrowFunctionExpression(f) if f.expression => {
                if let Some(Statement::ExpressionStatement(s)) = f.body.statements.first() {
                    self.module_refs(&s.expression);
                }
            }
            AstKind::YieldExpression(y) => {
                if let Some(argument) = &y.argument {
                    self.module_refs(argument);
                }
            }
            _ => {}
        }
    }

    /// Module references among `e`'s values (conditional / logical / sequence branches, parentheses, TS casts, array
    /// elements): an identifier or a static member of a namespace / default import (`ns.member`), see `module_ref_target`.
    pub(super) fn module_refs(&mut self, e: &'a Expression<'a>) {
        let mut values = Vec::new();
        value_positions(e, &mut values);
        for value in values {
            match value {
                Expression::Identifier(ident) => self.module_ref(ident, None),
                Expression::StaticMemberExpression(m) if !m.optional => {
                    if let Expression::Identifier(object) = unwrap(&m.object) {
                        self.module_ref(object, Some(m.property.name.as_str()));
                    }
                }
                Expression::ArrayExpression(array) => {
                    for element in &array.elements {
                        if let Some(element) = element.as_expression() {
                            self.module_refs(element);
                        }
                    }
                }
                _ => {}
            }
        }
    }

    /// `ident` (`.member`) as a module reference: a module function or an import (not `@rivetjs/*` framework packages,
    /// static-call bindings, `#` subpath imports or context tokens), read inside a component (PascalCase top-level
    /// function or the default export). Returns the declaration and the component.
    fn module_ref_target(&self, ident: &IdentifierReference<'a>, member: Option<&str>) -> Option<(NodeId, String)> {
        let tree = self.tree;
        let decl = tree.resolve(ident, true)?;
        let reference = match (member, tree.kind(decl)) {
            (None, AstKind::ImportNamespaceSpecifier(_)) => false,
            (None, _) => self.module_function(decl) || self.module_data(decl),
            (Some(_), AstKind::ImportNamespaceSpecifier(_) | AstKind::ImportDefaultSpecifier(_)) => true,
            _ => false,
        };
        if !reference || self.statics.contains(&decl) || context_token(member.unwrap_or(ident.name.as_str())) {
            return None;
        }
        if let Some(from) = import_source(tree, decl) {
            let package = |p: &str| from == p || from.strip_prefix(p).is_some_and(|rest| rest.starts_with('/'));
            if from.contains('#') || (from.starts_with("@rivetjs/") && !self.source_packages.iter().any(|p| package(p))) {
                return None;
            }
        }
        let node = self.id(ident)?;
        let top = self.top_function(node)?;
        let default_export = matches!(tree.parent_kind(top), Some(AstKind::ExportDefaultDeclaration(_)));
        if !self.component_function(top) && !default_export {
            return None;
        }
        Some((decl, self.component_of(node)?))
    }

    /// DIET-STATE 1: a module-level `const` holding static data that the module never mutates (module doc).
    pub(super) fn module_data(&self, decl: NodeId) -> bool {
        self.data_decl(decl, 0)
    }

    fn data_decl(&self, decl: NodeId, depth: u32) -> bool {
        let tree = self.tree;
        let AstKind::VariableDeclarator(d) = tree.kind(decl) else { return false };
        if d.kind != VariableDeclarationKind::Const || depth > 4 || !self.module_scoped(decl) {
            return false;
        }
        let BindingPatternKind::BindingIdentifier(binding) = &d.id.kind else { return false };
        let Some(init) = d.init.as_ref() else { return false };
        // Primitives are not references (nothing to save); an object / array / `Array.from` result is.
        if depth == 0 && !matches!(unwrap(init), Expression::ArrayExpression(_) | Expression::ObjectExpression(_) | Expression::CallExpression(_)) {
            return false;
        }
        if depth == 0 && data_size(init) < MIN_MODULE_DATA_SIZE {
            return false;
        }
        let mut params = Vec::new();
        self.static_data(init, &mut params, depth, false) && binding.symbol_id.get().is_some_and(|symbol| !self.data_mutated(symbol))
    }

    /// DIET-STATE 1c: a component-local `const` captured by a resumed site whose initializer is a pure literal (static
    /// data with no identifier but `undefined` and `Array.from` mapper parameters), declared in the component's own body
    /// (not a nested function: one value per render) and never mutated — hoisted to module scope (`__rivetData<n>_<x>`,
    /// both targets) and stamped as module static data, so state carries `{f: id}` instead of the literal.
    fn local_literal(&self, decl: NodeId) -> bool {
        let tree = self.tree;
        let AstKind::VariableDeclarator(d) = tree.kind(decl) else { return false };
        if d.kind != VariableDeclarationKind::Const {
            return false;
        }
        let BindingPatternKind::BindingIdentifier(binding) = &d.id.kind else { return false };
        let Some(init) = d.init.as_ref() else { return false };
        if !matches!(unwrap(init), Expression::ArrayExpression(_) | Expression::ObjectExpression(_) | Expression::CallExpression(_)) {
            return false;
        }
        let mut n = tree.raw_parent(decl);
        let mut nearest = None;
        while let Some(id) = n {
            if is_function(tree, id) {
                nearest = Some(id);
                break;
            }
            n = tree.raw_parent(id);
        }
        let Some(function) = nearest else { return false };
        if self.top_function(decl) != Some(function) {
            return false;
        }
        let default_export = matches!(tree.parent_kind(function), Some(AstKind::ExportDefaultDeclaration(_)));
        if !self.component_function(function) && !default_export {
            return false;
        }
        if data_size(init) < MIN_DATA_SIZE {
            return false;
        }
        let mut params = Vec::new();
        self.static_data(init, &mut params, 0, true) && binding.symbol_id.get().is_some_and(|symbol| !self.data_mutated(symbol))
    }

    /// DIET-STATE 1c: hoisted names of the pure-literal locals the `queue` sites capture (`local_literal`), with their
    /// module static data references (symbols + stamps). Names `__rivetData<n>_<local>`, source order.
    pub(super) fn local_data(&self, module: &str, queue: &[usize], symbols: &mut Vec<Symbol>, scope: &mut Vec<String>) -> (FxHashMap<NodeId, String>, Vec<ModuleRef>) {
        let tree = self.tree;
        let mut decls: Vec<NodeId> = Vec::new();
        let mut seen = FxHashSet::default();
        for &index in queue {
            for &decl in &self.sites[index].capture_decls {
                if seen.insert(decl) && self.local_literal(decl) {
                    decls.push(decl);
                }
            }
        }
        decls.sort_by_key(|&decl| tree.span(decl).start);
        let mut hoisted = FxHashMap::default();
        let mut refs = Vec::new();
        for decl in decls {
            let AstKind::VariableDeclarator(d) = tree.kind(decl) else { continue };
            let BindingPatternKind::BindingIdentifier(binding) = &d.id.kind else { continue };
            let Some(component) = self.component_of(decl) else { continue };
            let value = format!("__rivetData{}_{}", hoisted.len(), binding.name);
            let digest = content_digest(&[module, "\0local", value.as_str()]);
            let name = format!("{value}$l${}$ref", &digest[..UNIT_HASH]);
            let id = format!("{module}#{name}");
            if symbols.iter().any(|s| s.name == name) {
                continue;
            }
            symbols.push(Symbol {
                source: format!("export const {name} = (...p) => p.reduce((o, k) => o[k], {value});\n"),
                name,
                id: id.clone(),
                kind: "ref",
                component,
                captures: Vec::new(),
                labels: Vec::new(),
                scope: vec![value.clone()],
                imports: Vec::new(),
                locals: vec![value.clone()],
                uses: Vec::new(),
                aliases: Vec::new(),
            });
            if !scope.contains(&value) {
                scope.push(value.clone());
            }
            refs.push(ModuleRef { value: value.clone(), id, imported: false, data: true });
            hoisted.insert(decl, value);
        }
        (hoisted, refs)
    }

    /// `e` evaluates to the same static data on the server and in the browser (module doc); `params` = the parameters of
    /// the enclosing `Array.from` mappers.
    fn static_data(&self, e: &Expression<'a>, params: &mut Vec<String>, depth: u32, pure: bool) -> bool {
        let tree = self.tree;
        match unwrap(e) {
            Expression::StringLiteral(_) | Expression::NumericLiteral(_) | Expression::BooleanLiteral(_) | Expression::NullLiteral(_) | Expression::BigIntLiteral(_) => true,
            Expression::TemplateLiteral(t) => t.expressions.iter().all(|x| self.static_data(x, params, depth, pure)),
            Expression::Identifier(ident) => {
                if params.iter().any(|p| p == ident.name.as_str()) {
                    return true;
                }
                match tree.resolve(ident, true) {
                    None => ident.name == "undefined",
                    Some(decl) => !pure && self.data_decl(decl, depth + 1),
                }
            }
            Expression::ArrayExpression(array) => array.elements.iter().all(|element| match element.as_expression() {
                Some(x) => self.static_data(x, params, depth, pure),
                None => element.is_elision(),
            }),
            Expression::ObjectExpression(object) => object.properties.iter().all(|p| {
                let ObjectPropertyKind::ObjectProperty(p) = p else { return false };
                p.kind == PropertyKind::Init
                    && !p.method
                    && !p.computed
                    && p.key.static_name().is_some_and(|key| key != "__proto__")
                    && self.static_data(&p.value, params, depth, pure)
            }),
            Expression::UnaryExpression(u) => u.operator != UnaryOperator::Delete && self.static_data(&u.argument, params, depth, pure),
            Expression::BinaryExpression(b) => {
                !matches!(b.operator, BinaryOperator::In | BinaryOperator::Instanceof)
                    && self.static_data(&b.left, params, depth, pure)
                    && self.static_data(&b.right, params, depth, pure)
            }
            Expression::LogicalExpression(l) => self.static_data(&l.left, params, depth, pure) && self.static_data(&l.right, params, depth, pure),
            Expression::ConditionalExpression(c) => {
                self.static_data(&c.test, params, depth, pure) && self.static_data(&c.consequent, params, depth, pure) && self.static_data(&c.alternate, params, depth, pure)
            }
            Expression::StaticMemberExpression(m) => !m.optional && self.static_data(&m.object, params, depth, pure),
            Expression::ComputedMemberExpression(m) => !m.optional && self.static_data(&m.object, params, depth, pure) && self.static_data(&m.expression, params, depth, pure),
            // `Array.from({ length: n }[, (value, index) => static])`.
            Expression::CallExpression(c) => {
                if c.optional || c.arguments.is_empty() || c.arguments.len() > 2 {
                    return false;
                }
                let Expression::StaticMemberExpression(m) = unwrap(&c.callee) else { return false };
                let Expression::Identifier(array) = unwrap(&m.object) else { return false };
                if m.optional || m.property.name != "from" || array.name != "Array" || tree.resolve(array, false).is_some() {
                    return false;
                }
                let Some(Expression::ObjectExpression(length)) = c.arguments[0].as_expression().map(unwrap) else { return false };
                let [ObjectPropertyKind::ObjectProperty(p)] = length.properties.as_slice() else { return false };
                if p.kind != PropertyKind::Init || p.method || p.computed || !p.key.static_name().is_some_and(|key| key == "length") {
                    return false;
                }
                if !self.static_data(&p.value, params, depth, pure) {
                    return false;
                }
                let Some(mapper) = c.arguments.get(1) else { return true };
                let Some(Expression::ArrowFunctionExpression(f)) = mapper.as_expression().map(unwrap) else { return false };
                if f.r#async || !f.expression || f.params.rest.is_some() {
                    return false;
                }
                let before = params.len();
                for param in &f.params.items {
                    let BindingPatternKind::BindingIdentifier(b) = &param.pattern.kind else {
                        params.truncate(before);
                        return false;
                    };
                    params.push(b.name.to_string());
                }
                let ok = matches!(f.body.statements.first(), Some(Statement::ExpressionStatement(s)) if self.static_data(&s.expression, params, depth, pure));
                params.truncate(before);
                ok
            }
            _ => false,
        }
    }

    /// Some statement of the module may change the data `symbol` holds (module doc).
    fn data_mutated(&self, symbol: SymbolId) -> bool {
        let tree = self.tree;
        tree.sem.scoping().get_resolved_references(symbol).any(|reference| {
            let node = reference.node_id();
            if tree.in_type_name(node) || matches!(tree.parent_kind(node), Some(AstKind::TSTypeQuery(_))) {
                return false;
            }
            reference.flags().is_write() || self.mutating_use(node)
        })
    }

    /// `reference` (or a member chain of it: `X.a[0]`) is written, deleted, a loop target, the callee of a possibly
    /// mutating method (`X.push(…)`, `X.a.sort()`, a computed callee) or the target of `Object.assign` / `Reflect.set` / ….
    fn mutating_use(&self, reference: NodeId) -> bool {
        const MUTATING: [&str; 13] = ["push", "pop", "shift", "unshift", "splice", "sort", "reverse", "fill", "copyWithin", "set", "add", "delete", "clear"];
        let tree = self.tree;
        let mut at = tree.span(reference);
        let mut depth = 0;
        let mut method: Option<String> = None;
        let mut n = tree.parent(reference);
        while let Some(id) = n {
            match tree.kind(id) {
                AstKind::StaticMemberExpression(m) if m.object.span() == at => {
                    depth += 1;
                    method = Some(m.property.name.to_string());
                    at = m.span;
                }
                AstKind::ComputedMemberExpression(m) if m.object.span() == at => {
                    depth += 1;
                    method = match unwrap(&m.expression) {
                        Expression::StringLiteral(s) => Some(s.value.to_string()),
                        _ => None,
                    };
                    at = m.span;
                }
                AstKind::ParenthesizedExpression(p) if p.expression.span() == at => at = p.span,
                AstKind::TSNonNullExpression(p) if p.expression.span() == at => at = p.span,
                AstKind::TSAsExpression(p) if p.expression.span() == at => at = p.span,
                AstKind::TSSatisfiesExpression(p) if p.expression.span() == at => at = p.span,
                _ => break,
            }
            n = tree.parent(id);
        }
        let Some(outer) = n else { return false };
        match tree.kind(outer) {
            AstKind::AssignmentExpression(a) => depth > 0 && a.left.span() == at,
            AstKind::UpdateExpression(_) | AstKind::ArrayAssignmentTarget(_) | AstKind::ObjectAssignmentTarget(_) | AstKind::AssignmentTargetWithDefault(_) => depth > 0,
            AstKind::UnaryExpression(u) => depth > 0 && u.operator == UnaryOperator::Delete,
            AstKind::ForInStatement(f) => depth > 0 && f.left.span() == at,
            AstKind::ForOfStatement(f) => depth > 0 && f.left.span() == at,
            AstKind::CallExpression(c) if depth > 0 && c.callee.span() == at => method.as_deref().is_none_or(|m| MUTATING.contains(&m)),
            AstKind::CallExpression(c) => {
                let first = c.arguments.first().and_then(|a| a.as_expression()).is_some_and(|a| a.span() == at);
                let Expression::StaticMemberExpression(m) = unwrap(&c.callee) else { return false };
                let Expression::Identifier(object) = unwrap(&m.object) else { return false };
                first
                    && tree.resolve(object, false).is_none()
                    && matches!(
                        (object.name.as_str(), m.property.name.as_str()),
                        ("Object", "assign" | "defineProperty" | "defineProperties" | "setPrototypeOf")
                            | ("Reflect", "set" | "defineProperty" | "deleteProperty" | "setPrototypeOf")
                    )
            }
            _ => false,
        }
    }

    /// A value a module reference covers (CORE-GAPS (d) prop / alias `_rFn` sites and `equals` sites skip it: the
    /// `_rMod` stamp wins over a per-render `_rFn` anyway, so their symbols would be unreachable).
    pub(super) fn ref_covered(&self, ident: &IdentifierReference<'a>) -> bool {
        self.module_ref_target(ident, None).is_some()
    }

    /// Function Bridge C9 / T10: the callee of a captured `f.bind(…)` const as a module reference (`_rMod` stamp), when it
    /// is one (a module function / import read inside a component).
    pub(super) fn bind_module_ref(&mut self, ident: &'a IdentifierReference<'a>) -> bool {
        if self.module_ref_target(ident, None).is_none() {
            return false;
        }
        self.module_ref(ident, None);
        true
    }

    /// Record a module reference use; the first use per binding + member wins, later ones add their component.
    fn module_ref(&mut self, ident: &IdentifierReference<'a>, member: Option<&str>) {
        let Some((decl, component)) = self.module_ref_target(ident, member) else { return };
        if let Some(r) = self.refs.iter_mut().find(|r| r.decl == decl && r.member.as_deref() == member) {
            if !r.components.contains(&component) {
                r.components.push(component);
            }
            return;
        }
        let Some(node) = self.id(ident) else { return };
        self.refs.push(RefUse { decl, member: member.map(str::to_string), components: vec![component.clone()], component, node });
    }

    /// One `() => (g)` symbol per module reference id, after the closure symbols (its id is not a content hash); the
    /// symbol module export names are unique (`<name>$<h>$ref`): a name another value already took (a unit hash
    /// collision) is a named error, never a silent skip. Extends `scope` with own functions.
    pub(super) fn module_ref_symbols(&self, module: &str, symbols: &mut Vec<Symbol>, scope: &mut Vec<String>, diags: &mut Diags) -> Vec<ModuleRef> {
        let mut module_refs = Vec::new();
        for r in &self.refs {
            let data = r.member.is_none() && self.module_data(r.decl);
            let Some((mut symbol, reference)) = reference(self.tree, module, self.resolved, r.decl, r.member.as_deref(), &r.component, data) else {
                debug_assert!(false, "module reference without a name");
                continue;
            };
            if symbols.iter().any(|s| s.id == symbol.id) {
                // Another binding of the same value (`import { a }` + `import { a as b }` from one module).
                continue;
            }
            if let Some(other) = symbols.iter().find(|s| s.name == symbol.name) {
                diags.add(
                    format!(
                        "Cannot resume {module}: module references `{}` and `{}` share the browser name `{}`; rename one import",
                        other.id, symbol.id, symbol.name
                    ),
                    Some(r.node),
                );
                continue;
            }
            if r.components.len() > 1 {
                symbol.uses = r.components.clone();
            }
            for name in &symbol.scope {
                if !scope.contains(name) {
                    scope.push(name.clone());
                }
            }
            symbols.push(symbol);
            module_refs.push(reference);
        }
        module_refs
    }
}

/// The symbol + server stamp of the module reference `decl` (`.member` of a namespace / default import). None only for a
/// declaration no identifier can name (unreachable: `module_ref_target` resolved one).
fn reference(
    tree: &Tree,
    module: &str,
    resolved: &FxHashMap<String, String>,
    decl: NodeId,
    member: Option<&str>,
    component: &str,
    data: bool,
) -> Option<(Symbol, ModuleRef)> {
    let (local, imported) = match tree.kind(decl) {
        AstKind::ImportSpecifier(s) => (s.local.name.to_string(), Some(s.imported.name().to_string())),
        AstKind::ImportDefaultSpecifier(s) => (s.local.name.to_string(), Some("default".to_string())),
        AstKind::ImportNamespaceSpecifier(s) => (s.local.name.to_string(), Some("*".to_string())),
        AstKind::Function(f) => (f.id.as_ref()?.name.to_string(), None),
        AstKind::VariableDeclarator(d) => match &d.id.kind {
            BindingPatternKind::BindingIdentifier(b) => (b.name.to_string(), None),
            _ => return None,
        },
        _ => return None,
    };
    let from = import_source(tree, decl);
    // (exported name, unit, server value); an own function the module does not export: salted (`None`).
    // Every name the module exports `local` under; the id uses the smallest (code-unit order), the others are `aliases`
    // (fix round 3, L2: `export { inc, inc as plus }` / `export default inc` + `export { inc }` → one id for the value).
    let mut exported = if imported.is_none() { own_exports(tree, &local) } else { Vec::new() };
    let own = (!exported.is_empty()).then(|| exported.remove(0));
    let (export, unit, value) = match (&imported, member) {
        (None, _) => (own.clone().unwrap_or_else(|| format!("{local}$l")), module.to_string(), local.clone()),
        (Some(imported), None) => (imported.clone(), unit(module, resolved, from?), local.clone()),
        (Some(imported), Some(member)) if imported == "*" => (member.to_string(), unit(module, resolved, from?), format!("{local}.{member}")),
        (Some(_), Some(member)) => (format!("default.{member}"), unit(module, resolved, from?), format!("{local}.{member}")),
    };
    let digest = if imported.is_none() && own.is_none() {
        content_digest(&[unit.as_str(), "\0local", local.as_str()])
    } else {
        content_digest(&[unit.as_str(), export.as_str()])
    };
    let name = format!("{}${}$ref", identifier_part(&export), &digest[..UNIT_HASH]);
    let id = format!("{unit}#{name}");
    let (source, imports, locals, scope) = match (from, &imported) {
        // An import: the symbol module imports only that value from its module (never the importer's module graph).
        (Some(from), Some(imported)) => {
            let alias = format!("__rivetRef_{name}");
            let (imported, read) = match member {
                Some(member) if imported == "*" => (member.to_string(), alias.clone()),
                Some(member) => ("default".to_string(), format!("{alias}.{member}")),
                None => (imported.clone(), alias.clone()),
            };
            let import = Import { local: alias, imported, from: from.to_string() };
            (format!("export const {name} = () => ({read});\n"), vec![import], Vec::new(), Vec::new())
        }
        // Own module static data (DIET-STATE 1): the value at a key path (a nested object stamped on its own).
        _ if data => (format!("export const {name} = (...p) => p.reduce((o, k) => o[k], {value});\n"), Vec::new(), vec![local.clone()], vec![local]),
        // Own module function: from the source module (its DOM output exports it: `scope`).
        _ => (format!("export const {name} = () => ({value});\n"), Vec::new(), vec![local.clone()], vec![local]),
    };
    let symbol = Symbol {
        source,
        name,
        id: id.clone(),
        kind: "ref",
        component: component.to_string(),
        captures: Vec::new(),
        labels: Vec::new(),
        scope,
        imports,
        locals,
        uses: Vec::new(),
        aliases: exported,
    };
    Some((symbol, ModuleRef { value, id, imported: imported.is_some(), data }))
}

/// Every name under which the module exports its own binding `local` (`export function inc` / `export { inc }` → `inc`,
/// `export { plus as inc }` → `inc` for `plus`, `export default inc` / `export default function inc` → `default`),
/// sorted in code-unit order, without duplicates. Empty: not exported (re-exports `export { x } from "…"` name another
/// module's binding, never `local`).
pub(super) fn own_exports(tree: &Tree, local: &str) -> Vec<String> {
    let mut names: Vec<String> = Vec::new();
    for statement in &tree.program.body {
        match statement {
            Statement::ExportNamedDeclaration(e) if e.source.is_none() => {
                match &e.declaration {
                    Some(Declaration::FunctionDeclaration(f)) if f.id.as_ref().is_some_and(|id| id.name.as_str() == local) => {
                        names.push(local.to_string());
                    }
                    Some(Declaration::VariableDeclaration(v)) => {
                        for d in &v.declarations {
                            if matches!(&d.id.kind, BindingPatternKind::BindingIdentifier(b) if b.name.as_str() == local) {
                                names.push(local.to_string());
                            }
                        }
                    }
                    _ => {}
                }
                for s in &e.specifiers {
                    if s.local.name().as_str() == local {
                        names.push(s.exported.name().to_string());
                    }
                }
            }
            Statement::ExportDefaultDeclaration(e) => match &e.declaration {
                ExportDefaultDeclarationKind::FunctionDeclaration(f) if f.id.as_ref().is_some_and(|id| id.name.as_str() == local) => {
                    names.push("default".to_string());
                }
                ExportDefaultDeclarationKind::Identifier(i) if i.name.as_str() == local => names.push("default".to_string()),
                _ => {}
            },
            _ => {}
        }
    }
    names.sort_by(|a, b| a.encode_utf16().cmp(b.encode_utf16()));
    names.dedup();
    names
}

/// Smallest estimated size (source bytes) of a component-local literal worth hoisting (1c): below it the literal by value
/// is about as small as the `{f: id, a: []}` entry plus its chunk symbol (cdk / ui story pages: +256 / +404 B br state
/// without it). Module consts take a smaller one (`MIN_MODULE_DATA_SIZE`): their nested key-path references are shared
/// by every use on the page (200 there cost cdk /select +274 B br, cdk total +1.1 KB).
const MIN_DATA_SIZE: usize = 200;

/// Smallest module const worth a reference (estimated source bytes): a one-route table `["/"]` by value is shorter than
/// `{f: id}` plus its symbol (size report: every starter page +19 B state, +50 B page JS without it).
const MIN_MODULE_DATA_SIZE: usize = 64;

/// Estimated serialized size of a data initializer: its source length; `Array.from({ length: n }[, f])` with a literal
/// `n` counts `n` × the mapper body (4 without one).
fn data_size(init: &Expression) -> usize {
    if let Expression::CallExpression(c) = unwrap(init) {
        let n = c.arguments.first().and_then(|a| match a.as_expression().map(unwrap) {
            Some(Expression::ObjectExpression(o)) => match o.properties.first() {
                Some(ObjectPropertyKind::ObjectProperty(p)) => match unwrap(&p.value) {
                    Expression::NumericLiteral(n) if n.value >= 0.0 => Some(n.value as usize),
                    _ => None,
                },
                _ => None,
            },
            _ => None,
        });
        if let Some(n) = n {
            let body = c.arguments.get(1).map_or(4, |a| match a.as_expression().map(unwrap) {
                Some(Expression::ArrowFunctionExpression(f)) => f.body.span.size() as usize,
                _ => 4,
            });
            return n.saturating_mul(body);
        }
    }
    init.span().size() as usize
}
