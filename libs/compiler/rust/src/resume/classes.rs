//! Function Bridge C12 / T24 (2026-10-12, spec `docs/design/specs/2026-10-09-function-bridge-design.md` §Data classes): resumable
//! data classes. Every class declared at module scope of a resume module that is a proven data class registers on the server
//! at module load (`_rClass(Cls, "<module>#<Cls>$class")`, epilogue after the module's last statement; review T23 M2: every
//! eligible class, so an unregistered subclass is refused at render, never decoded as its base). Its browser symbol
//! `<Cls>$class = () => (Cls)` (kind `"class"`) returns the module's own binding; the runtime (T23) encodes instances as
//! `{cls, a: [own enumerable fields]}` and restores them without running the constructor.
//!
//! Eligible (`Verdict::Data`): no instance `#private` element or `accessor` field (D-priv: `Object.create` has no private
//! brand), no `extends` other than another module-local data class (built-in and package bases keep state the browser cannot
//! restore — Map / Error internal slots, Node `EventEmitter` symbol keys; T23 re-review info), and no resource read while
//! constructing (instance field initializers / constructor body, nested functions excluded: `window`, `document`,
//! `navigator`, `globalThis`, `localStorage`, `sessionStorage`, `WebSocket`, `EventSource`, `Worker`, `BroadcastChannel`). A
//! class with a decorator (review T24 L2: decorators run constructor-time code) or a field arrow reading `super` /
//! `new.target` (review T24 M1: its symbol could not run outside the class) is ineligible too. Sound and registered: prototype
//! mutation, a reassigned class binding (the symbol reads it live), static blocks, computed keys, static `#private`, TS
//! parameter properties (the same module code runs in the browser). A
//! class with its own (or an inherited) `static [revive]` (`Verdict::Revive`, T25) registers too and is never RV2102: its
//! instances encode `{cls, a: [serialize() data], rv: 1}` and the browser rebuilds them with `Cls[revive](data)`. A captured
//! `const x = new Cls(…)` (directly or through `const` aliases) of an ineligible class is RV2102 naming the field; of a data
//! class or an import of a `.tsx` / `.jsx` module (a resume module: it registers its own classes) it is no longer RV2003.
//!
//! Class-field arrows of a registered data class (`inc = () => this.c++`; a `static [revive]` class lifts none, review T25
//! M1: its reviver constructs) are instance fields holding functions: the server wraps
//! them `_rFn("<module>#<Cls>$<h>", () => this.c++, [this])`; the symbol `(__rivetSelf) => () => __rivetSelf.c++` (`this`
//! rewritten, nested non-arrow functions keep their own). The cycle through the instance decodes two-phase (T23).

use oxc_ast::{AstKind, ast::*};
use oxc_semantic::NodeId;
use oxc_span::{GetSpan, Span};
use rustc_hash::FxHashMap;

use super::{Analysis, HASH_MIN, Import, RESERVED_SUFFIXES, Symbol, content_digest, import_source};
use crate::tree::{DeclKind, Tree};

/// Globals whose read while constructing makes an instance a resource holder (RV2102).
const RESOURCE_GLOBALS: &[&str] =
    &["window", "document", "navigator", "globalThis", "localStorage", "sessionStorage", "WebSocket", "EventSource", "Worker", "BroadcastChannel"];

#[derive(Clone)]
pub(super) enum Verdict {
    Data,
    /// Own or inherited `static [revive]` (T25).
    Revive,
    /// An instance `#private` element / `accessor` field (its name, `#c`).
    Private(String),
    /// `extends` something not a module-local data class (its source text).
    Base(String),
    /// A resource read while constructing: (field, global).
    Resource(Option<String>, String),
    /// A class or member decorator (its source text): it runs while the class is defined / constructed (T24 review L2).
    Decorated(String),
    /// A field arrow reading `super` / `new.target` (field, what): its symbol could not run outside the class (T24 review M1).
    Unliftable(String, &'static str),
}

/// A server registration `_rClass(name, id)` (module end).
pub struct ClassReg {
    pub name: String,
    pub id: String,
    /// `Verdict::Revive` (own or inherited `static [revive]`); else a data class.
    pub revive: bool,
}

/// Module-scope class declarations (statement order) with a name.
fn module_classes<'a>(tree: &Tree<'a>) -> Vec<(NodeId, &'a Class<'a>)> {
    let mut out = Vec::new();
    for statement in &tree.program.body {
        let class: Option<&'a Class<'a>> = match statement {
            Statement::ClassDeclaration(c) => Some(c),
            Statement::ExportNamedDeclaration(e) => match &e.declaration {
                Some(Declaration::ClassDeclaration(c)) => Some(c),
                _ => None,
            },
            Statement::ExportDefaultDeclaration(e) => match &e.declaration {
                ExportDefaultDeclarationKind::ClassDeclaration(c) => Some(c),
                _ => None,
            },
            _ => None,
        };
        if let Some(c) = class {
            if c.id.is_some() && !c.declare {
                if let Some(id) = tree.id_of(c) {
                    out.push((id, c));
                }
            }
        }
    }
    out
}

/// The verdict of every module-scope class (keyed by its `Class` node).
pub(super) fn verdicts(tree: &Tree) -> FxHashMap<NodeId, Verdict> {
    let classes = module_classes(tree);
    let mut out = FxHashMap::default();
    for &(id, _) in &classes {
        verdict(tree, id, &classes, &mut out, &mut Vec::new());
    }
    out
}

fn verdict<'a>(tree: &Tree<'a>, id: NodeId, classes: &[(NodeId, &'a Class<'a>)], out: &mut FxHashMap<NodeId, Verdict>, visiting: &mut Vec<NodeId>) -> Verdict {
    if let Some(v) = out.get(&id) {
        return v.clone();
    }
    let Some(&(_, class)) = classes.iter().find(|(c, _)| *c == id) else { return Verdict::Base(String::new()) };
    if visiting.contains(&id) {
        return Verdict::Base(class.id.as_ref().map_or(String::new(), |i| i.name.to_string()));
    }
    visiting.push(id);
    let v = match own_verdict(tree, class) {
        Some(v) => v,
        None => match &class.super_class {
            None => Verdict::Data,
            Some(base) => {
                let local = match base.without_parentheses() {
                    Expression::Identifier(i) => tree.resolve(i, true).filter(|d| classes.iter().any(|(c, _)| c == d)),
                    _ => None,
                };
                match local {
                    // A base's verdict carries over (its privates / resources are the subclass instance's too; an inherited
                    // `static [revive]` is the subclass's).
                    Some(b) => verdict(tree, b, classes, out, visiting),
                    None => Verdict::Base(tree.text_of(base.span()).to_string()),
                }
            }
        },
    };
    out.insert(id, v.clone());
    v
}

fn key_name(key: &PropertyKey) -> Option<String> {
    match key {
        PropertyKey::StaticIdentifier(i) => Some(i.name.to_string()),
        PropertyKey::StringLiteral(s) => Some(s.value.to_string()),
        PropertyKey::PrivateIdentifier(p) => Some(format!("#{}", p.name)),
        _ => None,
    }
}

/// `[revive]` / `[x.revive]` / `[Symbol.for("rivet.revive")]` (T25's key, exported by `@rivetjs/runtime/resume-format`).
fn revive_key<'a>(tree: &Tree<'a>, key: &PropertyKey<'a>, computed: bool) -> bool {
    if !computed {
        return false;
    }
    match key.as_expression().map(Expression::without_parentheses) {
        Some(Expression::Identifier(i)) => {
            i.name == "revive"
                || tree.resolve(i, true).is_some_and(|d| matches!(tree.kind(d), AstKind::ImportSpecifier(s) if s.imported.name() == "revive"))
        }
        Some(Expression::StaticMemberExpression(m)) => m.property.name == "revive",
        Some(e) => tree.text_of(e.span()).contains("rivet.revive"),
        None => false,
    }
}

/// The class's own verdict (None: eligible so far; its base decides).
fn own_verdict<'a>(tree: &Tree<'a>, class: &'a Class<'a>) -> Option<Verdict> {
    for element in &class.body.body {
        let revive = match element {
            ClassElement::MethodDefinition(m) => m.r#static && revive_key(tree, &m.key, m.computed),
            ClassElement::PropertyDefinition(p) => p.r#static && revive_key(tree, &p.key, p.computed),
            _ => false,
        };
        if revive {
            return Some(Verdict::Revive);
        }
    }
    // Decorators (class or member): `addInitializer` / class decorators run constructor-time code the browser skips.
    let decorator = class.decorators.first().or_else(|| {
        class.body.body.iter().find_map(|e| match e {
            ClassElement::MethodDefinition(m) => m.decorators.first(),
            ClassElement::PropertyDefinition(p) => p.decorators.first(),
            ClassElement::AccessorProperty(p) => p.decorators.first(),
            _ => None,
        })
    });
    if let Some(d) = decorator {
        return Some(Verdict::Decorated(tree.text_of(d.span()).to_string()));
    }
    for element in &class.body.body {
        match element {
            ClassElement::MethodDefinition(m) if !m.r#static => {
                if let PropertyKey::PrivateIdentifier(p) = &m.key {
                    return Some(Verdict::Private(format!("#{}", p.name)));
                }
            }
            ClassElement::PropertyDefinition(p) if !p.r#static => {
                if let PropertyKey::PrivateIdentifier(k) = &p.key {
                    return Some(Verdict::Private(format!("#{}", k.name)));
                }
            }
            // An auto-accessor stores its value in a private slot.
            ClassElement::AccessorProperty(p) if !p.r#static => return Some(Verdict::Private(key_name(&p.key).unwrap_or_else(|| "accessor".into()))),
            _ => {}
        }
    }
    for element in &class.body.body {
        let ClassElement::PropertyDefinition(p) = element else { continue };
        if p.r#static {
            continue;
        }
        let Some(value @ Expression::ArrowFunctionExpression(_)) = &p.value else { continue };
        if let Some(what) = tree.expr_id(value).and_then(|arrow| reads_super(tree, arrow)) {
            return Some(Verdict::Unliftable(key_name(&p.key).unwrap_or_else(|| "field".into()), what));
        }
    }
    for element in &class.body.body {
        match element {
            ClassElement::PropertyDefinition(p) if !p.r#static => {
                // A function-valued field reads nothing while constructing (its body runs later).
                if let Some(value) = p.value.as_ref().filter(|v| !matches!(v.without_parentheses(), Expression::ArrowFunctionExpression(_) | Expression::FunctionExpression(_))) {
                    if let Some((_, global)) = tree.expr_id(value).and_then(|v| resource(tree, v)) {
                        return Some(Verdict::Resource(key_name(&p.key), global));
                    }
                }
            }
            ClassElement::MethodDefinition(m) if m.kind == MethodDefinitionKind::Constructor => {
                let Some(function) = tree.id_of(&*m.value) else { continue };
                if let Some((at, global)) = resource(tree, function) {
                    return Some(Verdict::Resource(this_field(tree, at, function), global));
                }
            }
            _ => {}
        }
    }
    None
}

/// `super` / `new.target` read by an arrow (its own scope: nested non-arrow functions and classes excluded).
fn reads_super(tree: &Tree, arrow: NodeId) -> Option<&'static str> {
    let mut found = None;
    tree.walk(arrow, &mut |n| {
        if found.is_some() {
            return false;
        }
        match tree.kind(n) {
            AstKind::Function(_) | AstKind::Class(_) => false,
            AstKind::Super(_) => {
                found = Some("super");
                false
            }
            AstKind::MetaProperty(m) if m.meta.name == "new" => {
                found = Some("new.target");
                false
            }
            _ => true,
        }
    });
    found
}

/// The first resource global `root` reads while it runs (nested functions and classes excluded).
fn resource(tree: &Tree, root: NodeId) -> Option<(NodeId, String)> {
    let mut found = None;
    tree.walk(root, &mut |n| {
        if found.is_some() {
            return false;
        }
        match tree.kind(n) {
            AstKind::Function(_) | AstKind::ArrowFunctionExpression(_) | AstKind::Class(_) if n != root => return false,
            AstKind::IdentifierReference(i)
                if RESOURCE_GLOBALS.contains(&i.name.as_str()) && !tree.in_type_name(n) && tree.resolve(i, true).is_none() =>
            {
                found = Some((n, i.name.to_string()));
                return false;
            }
            _ => {}
        }
        true
    });
    found
}

/// The `this.<field> = …` assignment holding `at` inside the constructor `function`.
fn this_field(tree: &Tree, at: NodeId, function: NodeId) -> Option<String> {
    let mut n = tree.raw_parent(at);
    while let Some(id) = n {
        if id == function {
            break;
        }
        if let AstKind::AssignmentExpression(a) = tree.kind(id) {
            if let AssignmentTarget::StaticMemberExpression(m) = &a.left {
                if matches!(m.object, Expression::ThisExpression(_)) {
                    return Some(m.property.name.to_string());
                }
            }
        }
        n = tree.raw_parent(id);
    }
    None
}

/// What a captured `decl` holding `new Cls(…)` means: `None` = not a class this module decides (the RV2003 check applies),
/// `Some(None)` = resumable (a data class, a `static [revive]` class, an import of a `.tsx` / `.jsx` module — a resume
/// module, which registers its own classes; `.ts` modules are never compiled, so their classes stay RV2003),
/// `Some(Some(message))` = RV2102.
pub(super) fn class_capture(tree: &Tree, verdicts: &FxHashMap<NodeId, Verdict>, resolved: &FxHashMap<String, String>, decl: NodeId) -> Option<Option<String>> {
    capture_at(tree, verdicts, resolved, decl, 0)
}

fn capture_at(tree: &Tree, verdicts: &FxHashMap<NodeId, Verdict>, resolved: &FxHashMap<String, String>, decl: NodeId, depth: u8) -> Option<Option<String>> {
    let AstKind::VariableDeclarator(d) = tree.kind(decl) else { return None };
    let BindingPatternKind::BindingIdentifier(binding) = &d.id.kind else { return None };
    match d.init.as_ref().map(Expression::without_parentheses) {
        Some(Expression::NewExpression(n)) => {
            let Expression::Identifier(callee) = n.callee.without_parentheses() else { return None };
            let target = tree.resolve(callee, true)?;
            if let Some(v) = verdicts.get(&target) {
                return Some(refusal(binding.name.as_str(), callee.name.as_str(), v));
            }
            let jsx = |m: &str| m.ends_with(".tsx") || m.ends_with(".jsx");
            let component_module = matches!(tree.decl_kind(target), DeclKind::ImportSpecifier | DeclKind::ImportDefault)
                && import_source(tree, target).is_some_and(|from| {
                    (from.starts_with('.') || from.starts_with('/')) && (jsx(from) || resolved.get(from).is_some_and(|m| jsx(m)))
                });
            component_module.then_some(None)
        }
        // `const v = conn`: only an ineligible class is reported through an alias (no RV2003 there before either).
        Some(Expression::Identifier(alias)) if depth < 4 && d.kind == VariableDeclarationKind::Const => {
            let target = tree.resolve(alias, true)?;
            match capture_at(tree, verdicts, resolved, target, depth + 1) {
                Some(Some(message)) => Some(Some(message)),
                _ => None,
            }
        }
        _ => None,
    }
}

fn refusal(capture: &str, class: &str, v: &Verdict) -> Option<String> {
    // The fixes: create the instance where it is used, `reconstruct(() => new X(…))` (language-core quick fix rivetReconstruct) or a static [revive].
    let tail = format!("create it inside the handler, build it with reconstruct(() => new {class}(…)) or give {class} a static [revive]");
    Some(match v {
        Verdict::Data | Verdict::Revive => return None,
        Verdict::Private(field) => {
            format!("Cannot resume `{capture}.{field}`: {class} instance has a private field (`{field}` cannot be restored without running the constructor); {tail}")
        }
        Verdict::Resource(Some(field), global) => {
            format!("Cannot resume `{capture}.{field}`: {class} instance holds a resource (its field reads `{global}`); {tail}")
        }
        Verdict::Resource(None, global) => {
            format!("Cannot resume `{capture}`: {class} instance holds a resource (its constructor reads `{global}`); {tail}")
        }
        Verdict::Decorated(decorator) => format!(
            "Cannot resume `{capture}`: {class} is decorated (`{decorator}` runs code when the class is constructed; the browser never constructs it); {tail}"
        ),
        Verdict::Unliftable(field, what) => format!(
            "Cannot resume `{capture}.{field}`: {class} field arrow reads `{what}` (it cannot run outside the class); {tail}"
        ),
        Verdict::Base(base) => format!(
            "Cannot resume `{capture}`: {class} extends `{base}`, not a data class of this module (built-in and package bases keep state the browser cannot restore); {tail}"
        ),
    })
}

/// `this` → `__rivetSelf` in an arrow's text (nested non-arrow functions and classes keep their own `this`).
fn self_text(tree: &Tree, arrow: NodeId) -> String {
    let mut spans: Vec<Span> = Vec::new();
    tree.walk(arrow, &mut |n| match tree.kind(n) {
        AstKind::Function(_) | AstKind::Class(_) => false,
        AstKind::ThisExpression(t) => {
            spans.push(t.span);
            false
        }
        _ => true,
    });
    spans.sort_by_key(|s| s.start);
    let at = tree.span(arrow);
    let mut out = String::new();
    let mut from = at.start;
    for span in spans {
        out.push_str(tree.text_of(Span::new(from, span.start)));
        out.push_str("__rivetSelf");
        from = span.end;
    }
    out.push_str(tree.text_of(Span::new(from, at.end)));
    out
}

impl<'t, 'a> Analysis<'t, 'a> {
    /// Registrations, class symbols and class-field arrow symbols of the module's data classes; extends `scope` with the
    /// names the symbols read from the module. Returns the registrations and arrow node → symbol id.
    pub(super) fn class_symbols(
        &self,
        module: &str,
        verdicts: &FxHashMap<NodeId, Verdict>,
        symbols: &mut Vec<Symbol>,
        scope: &mut Vec<String>,
    ) -> (Vec<ClassReg>, FxHashMap<NodeId, String>) {
        let tree = self.tree;
        let mut registrations = Vec::new();
        let mut arrows = FxHashMap::default();
        let add_scope = |scope: &mut Vec<String>, name: &str| {
            if !scope.iter().any(|s| s == name) {
                scope.push(name.to_string());
            }
        };
        for (node, class) in module_classes(tree) {
            if !matches!(verdicts.get(&node), Some(Verdict::Data | Verdict::Revive)) {
                continue;
            }
            let Some(binding) = &class.id else { continue };
            let cls = binding.name.to_string();
            let name = format!("{cls}$class");
            let id = format!("{module}#{name}");
            if symbols.iter().any(|s| s.name == name) {
                continue;
            }
            symbols.push(Symbol {
                source: format!("export const {name} = () => ({cls});\n"),
                name,
                id: id.clone(),
                kind: "class",
                component: cls.clone(),
                captures: Vec::new(),
                labels: Vec::new(),
                scope: vec![cls.clone()],
                imports: Vec::new(),
                locals: vec![cls.clone()],
                uses: Vec::new(),
                aliases: Vec::new(),
            });
            add_scope(scope, &cls);
            registrations.push(ClassReg { name: cls.clone(), id, revive: matches!(verdicts.get(&node), Some(Verdict::Revive)) });
            // Review T25 M1: a `static [revive]` class lifts no field arrows: its reviver constructs, so the arrows are
            // rebuilt in the browser (and may read `#private` names or `super`, which no symbol outside the class can).
            if matches!(verdicts.get(&node), Some(Verdict::Revive)) {
                continue;
            }
            // Class-field arrows: one `fn` symbol each, `this` as the capture.
            let mut fields: Vec<(NodeId, Symbol, String)> = Vec::new();
            for element in &class.body.body {
                let ClassElement::PropertyDefinition(p) = element else { continue };
                if p.r#static || matches!(p.key, PropertyKey::PrivateIdentifier(_)) {
                    continue;
                }
                let Some(value @ Expression::ArrowFunctionExpression(_)) = &p.value else { continue };
                let Some(arrow) = tree.expr_id(value) else { continue };
                let (captures, free, _, _, _) = self.free_names(arrow);
                if !captures.is_empty() {
                    continue;
                }
                let text = self_text(tree, arrow);
                let mut imports = Vec::new();
                let mut locals = Vec::new();
                let mut names = Vec::new();
                for (local, decl) in &free {
                    names.push(local.clone());
                    match import_source(tree, *decl) {
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
                let mut content: Vec<&str> = vec!["field", cls.as_str(), text.as_str()];
                for import in &imports {
                    content.extend([import.local.as_str(), import.imported.as_str(), import.from.as_str()]);
                }
                let digest = content_digest(&content);
                let symbol = Symbol {
                    source: format!("(__rivetSelf) => {text}"),
                    name: String::new(),
                    id: String::new(),
                    kind: "fn",
                    component: cls.clone(),
                    captures: vec!["__rivetSelf".into()],
                    labels: vec!["this".into()],
                    scope: names,
                    imports,
                    locals,
                    uses: Vec::new(),
                    aliases: Vec::new(),
                };
                fields.push((arrow, symbol, digest));
            }
            // Names `<Cls>$<prefix>`: the shortest digest prefix (≥ HASH_MIN) unique among the class's arrows; twins `_k`.
            let digests: Vec<String> = fields.iter().map(|(_, _, d)| d.clone()).collect();
            let mut twins: FxHashMap<String, usize> = FxHashMap::default();
            for (arrow, mut symbol, digest) in fields {
                let mut len = HASH_MIN;
                while len < digest.len()
                    && (RESERVED_SUFFIXES.contains(&&digest[..len]) || digests.iter().any(|d| *d != digest && d[..len] == digest[..len]))
                {
                    len += 1;
                }
                let local = format!("{cls}${}", &digest[..len]);
                let twin = twins.entry(local.clone()).or_insert(0);
                let name = if *twin == 0 { local } else { format!("{local}_{twin}") };
                *twin += 1;
                let id = format!("{module}#{name}");
                symbol.source = format!("export const {name} = {};\n", symbol.source);
                symbol.name = name;
                symbol.id = id.clone();
                for local in &symbol.locals {
                    add_scope(scope, local);
                }
                symbols.push(symbol);
                arrows.insert(arrow, id);
            }
        }
        (registrations, arrows)
    }
}
