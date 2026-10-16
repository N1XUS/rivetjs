// Module-scope names a resumed DOM module already exports, so the compiler appends `export { … }`
// only for the scope values its symbol modules reference that are not exported yet.
use oxc_ast::ast::*;
use rustc_hash::{FxHashMap, FxHashSet};

/// `(covered, clashing)`: `covered` = names the module exports as the same binding the local name
/// refers to — local declarations (`export function` / `const` / `class`, `export { a }`) and re-exports
/// (`export { a as b } from "src"`) whose exported name is also imported from the same source and imported
/// name (`import { a as b } from "src"`). Default exports are not covered (`export default function a`
/// exports `default`, not `a`: the compiler appends `export { a }`). `clashing` = exported names that are
/// NOT the binding of the same local name (`export { a as b }`, a re-export of another binding): a local
/// `b` cannot be exported (the bundler reports a duplicated export) and the symbol modules importing `b`
/// by name would get the other binding.
pub(super) fn covered(program: &Program) -> (FxHashSet<String>, FxHashSet<String>) {
    let mut covered = FxHashSet::default();
    let mut clashing = FxHashSet::default();
    // local name → (source, imported name) of `import { imported as local } from "source"`.
    let mut imports: FxHashMap<String, (String, String)> = FxHashMap::default();
    for statement in &program.body {
        if let Statement::ImportDeclaration(i) = statement {
            for s in i.specifiers.iter().flatten() {
                if let ImportDeclarationSpecifier::ImportSpecifier(s) = s {
                    imports.insert(s.local.name.to_string(), (i.source.value.to_string(), s.imported.name().to_string()));
                }
            }
        }
    }
    for statement in &program.body {
        match statement {
            Statement::ExportNamedDeclaration(e) => {
                match &e.declaration {
                    Some(Declaration::FunctionDeclaration(f)) => {
                        if let Some(id) = &f.id {
                            covered.insert(id.name.to_string());
                        }
                    }
                    Some(Declaration::ClassDeclaration(c)) => {
                        if let Some(id) = &c.id {
                            covered.insert(id.name.to_string());
                        }
                    }
                    Some(Declaration::VariableDeclaration(v)) => {
                        for d in &v.declarations {
                            if let BindingPatternKind::BindingIdentifier(id) = &d.id.kind {
                                covered.insert(id.name.to_string());
                            }
                        }
                    }
                    _ => {}
                }
                match &e.source {
                    None => {
                        for s in &e.specifiers {
                            let exported = s.exported.name().to_string();
                            if exported == s.local.name().as_str() {
                                covered.insert(exported);
                            } else {
                                clashing.insert(exported);
                            }
                        }
                    }
                    Some(source) => {
                        for s in &e.specifiers {
                            let exported = s.exported.name().to_string();
                            let same = imports
                                .get(&exported)
                                .is_some_and(|(from, imported)| from == source.value.as_str() && imported == s.local.name().as_str());
                            if same {
                                covered.insert(exported);
                            } else {
                                clashing.insert(exported);
                            }
                        }
                    }
                }
            }
            _ => {}
        }
    }
    (covered, clashing)
}

/// Local names bound by imports from packages (any source not starting with `.` or `/`): symbol modules
/// re-import those from the package themselves (`resume.rs` `import_source`), so the resumed module never
/// re-exports them — a DOM v2 lowering may drop the import (`For` → `_for`), leaving the name undefined.
pub(super) fn package_imports(program: &Program) -> FxHashSet<String> {
    let mut names = FxHashSet::default();
    for statement in &program.body {
        if let Statement::ImportDeclaration(i) = statement {
            if i.source.value.starts_with('.') || i.source.value.starts_with('/') {
                continue;
            }
            for s in i.specifiers.iter().flatten() {
                let local = match s {
                    ImportDeclarationSpecifier::ImportSpecifier(s) => &s.local,
                    ImportDeclarationSpecifier::ImportDefaultSpecifier(s) => &s.local,
                    ImportDeclarationSpecifier::ImportNamespaceSpecifier(s) => &s.local,
                };
                names.insert(local.name.to_string());
            }
        }
    }
    names
}
