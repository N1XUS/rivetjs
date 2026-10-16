//! Parser source type from a module's filename (T7): `.ts` / `.mts` / `.cts` parse as TypeScript
//! without JSX (`<T>expr` casts), `.js` / `.jsx` / `.mjs` / `.cjs` as JavaScript with JSX (no type
//! syntax), everything else (`.tsx`, virtual names, no filename) as TSX.
use oxc_span::SourceType;

/// Source type of user source named `filename` (query / hash suffixes ignored).
pub fn of(filename: &str) -> SourceType {
    match extension(filename).as_deref() {
        Some("ts" | "mts" | "cts") => SourceType::ts(),
        Some("js" | "jsx" | "mjs" | "cjs") => SourceType::jsx(),
        _ => SourceType::tsx(),
    }
}

/// Source type of code the compiler emitted for `filename` (type stripping): TypeScript sources keep
/// `<T>expr` casts, so they parse as `.ts`; every other output parses as TSX (a superset of the
/// JavaScript the compiler emits for JS sources).
pub fn of_output(filename: &str) -> SourceType {
    match extension(filename).as_deref() {
        Some("ts" | "mts" | "cts") => SourceType::ts(),
        _ => SourceType::tsx(),
    }
}

fn extension(filename: &str) -> Option<String> {
    let path = filename.split(['?', '#']).next().unwrap_or(filename);
    let name = path.rsplit(['/', '\\']).next().unwrap_or(path);
    name.rsplit_once('.').map(|(_, ext)| ext.to_ascii_lowercase())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn by_extension() {
        assert!(of("a.ts").is_typescript() && !of("a.ts").is_jsx());
        assert!(of("a.MTS").is_typescript());
        assert!(of("a.jsx").is_javascript() && of("a.jsx").is_jsx());
        assert!(of("a.js").is_javascript());
        assert!(of("a.tsx").is_typescript() && of("a.tsx").is_jsx());
        assert!(of("module").is_jsx() && of("dir.ts/file").is_jsx());
        assert!(of("a.ts?raw").is_typescript() && !of("a.ts?raw").is_jsx());
        assert!(of_output("a.jsx").is_typescript() && of_output("a.ts").is_typescript() && !of_output("a.ts").is_jsx());
    }
}
