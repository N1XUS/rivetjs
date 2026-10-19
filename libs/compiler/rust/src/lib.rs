//! Rivet JSX compiler (oxc-based) exposed as a raw WebAssembly module: JSON request in, JSON
//! response out. Exports: `alloc(len) -> ptr`, `dealloc(ptr, len)`, `run(ptr, len) -> ptr`
//! (consumes the request buffer) and `result_len() -> len` for the last response. A panic aborts
//! (`panic = "abort"`: the call traps with `unreachable`); its message is kept for the loader in
//! `panic_ptr()` / `panic_len()` (empty before any panic), which then replaces the instance.

mod compile;
mod diagnostics;
mod entities;
mod entities_data;
mod events_data;
mod facts;
mod html;
mod i18n;
mod ir;
mod map;
mod resume;
mod server_split;
mod slots;
mod source_type;
mod strip;
mod styling;
mod styles;
mod tree;

use std::cell::RefCell;
use std::sync::Once;
use std::sync::atomic::{AtomicUsize, Ordering};

use serde::Deserialize;
use serde_json::{Map, Value, json};

pub use compile::{Options, compile};

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct CompileOptions {
    target: Option<String>,
    filename: Option<String>,
    server_list_mounts: Option<bool>,
    resume: Option<Value>,
    source_map: Option<bool>,
    static_calls: Option<Vec<compile::StaticCall>>,
    variants: Option<Vec<String>>,
    variant: Option<usize>,
    time_zone: Option<String>,
    dev: Option<bool>,
    styles: Option<Value>,
    /// Route module: server exports are checked, and removed from the DOM target.
    server_exports: Option<bool>,
    /// Resume: `@rivetjs/*` source packages whose components are user components.
    source_packages: Option<Vec<String>>,
    /// Internal (`_compileSymbolModule`): a resume symbol module (`Options::symbols`).
    symbols: Option<bool>,
    /// Resume (Function Bridge T3): import specifier → resolved module id (`Options::resolved_imports`).
    resolved_imports: Option<std::collections::HashMap<String, String>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct FactsOptions {
    server_exports: Option<bool>,
    resume: Option<bool>,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct CheckOptions {
    filename: Option<String>,
    resume: Option<Value>,
    targets: Option<Vec<String>>,
    source_packages: Option<Vec<String>>,
}

#[derive(Deserialize)]
#[serde(tag = "op", rename_all = "camelCase")]
enum Request {
    // Options stay raw JSON here: a malformed option is a diagnostic (RV7001), not "invalid request".
    Compile { source: String, options: Option<Value> },
    RegisterTable { id: String, table: i18n::Table },
    ModuleFacts { source: String, filename: String, options: Option<FactsOptions> },
    Check { source: String, options: Option<Value> },
    DecodeHtml { text: String },
    /// Loader self-test: panics with `message` (exercises the panic hook + instance replacement).
    Panic { message: String },
}

/// The `filename` of raw options (for diagnostics about the options themselves).
fn raw_filename(options: &Option<Value>) -> String {
    options.as_ref().and_then(|o| o.get("filename")).and_then(Value::as_str).unwrap_or("module.tsx").to_string()
}

/// Typed options from raw JSON; a wrong type is an `Invalid compiler option` message (RV7001).
fn parse_options<T: serde::de::DeserializeOwned + Default>(options: Option<Value>) -> Result<T, String> {
    match options {
        None | Some(Value::Null) => Ok(T::default()),
        Some(value) => serde_json::from_value(value).map_err(|error| format!("Invalid compiler option: {error}")),
    }
}

fn option_diagnostic(message: &str, filename: &str) -> Value {
    let code = diagnostics::classify(message);
    json!({ "category": "error", "code": code, "severity": diagnostics::severity(code), "message": message, "filename": filename })
}

/// `styles: { scope: string, names?: "readable" | "short", layer?: string | null | false }`; anything
/// else is an error (P4: `{}` / `{ scope: 1 }` / `layer: 5` used to disable or unlayer silently).
fn styles_option(value: &Option<Value>) -> Result<Option<compile::Styles>, String> {
    let value = match value {
        None | Some(Value::Null) => return Ok(None),
        Some(Value::Object(map)) => map,
        Some(_) => return Err("Invalid compiler option `styles`: expected an object `{ scope, names?, layer? }`".into()),
    };
    let Some(Value::String(scope)) = value.get("scope") else {
        return Err("Invalid compiler option `styles.scope`: expected a string".into());
    };
    let names = match value.get("names") {
        None | Some(Value::Null) => styles::Names::Readable,
        Some(Value::String(n)) if n == "readable" => styles::Names::Readable,
        Some(Value::String(n)) if n == "short" => styles::Names::Short,
        Some(_) => return Err("Invalid compiler option `styles.names`: expected \"readable\" or \"short\"".into()),
    };
    let layer = match value.get("layer") {
        None => Some("components".to_string()),
        Some(Value::String(layer)) => Some(layer.clone()),
        Some(Value::Null) | Some(Value::Bool(false)) => None,
        Some(_) => return Err("Invalid compiler option `styles.layer`: expected a string, null or false".into()),
    };
    Ok(Some(compile::Styles { scope: scope.clone(), names, layer }))
}

fn compile_json(source: &str, raw: Option<Value>) -> Value {
    let invalid = |message: String, filename: &str| json!({ "code": "", "diagnostics": [option_diagnostic(&message, filename)] });
    let filename = raw_filename(&raw);
    let options: CompileOptions = match parse_options(raw) {
        Ok(options) => options,
        Err(message) => return invalid(message, &filename),
    };
    let filename = options.filename.clone().unwrap_or_else(|| "module.tsx".into());
    // `resume`: `{ module? }` or `true` on; absent / `null` / `false` / `0` / `""` off.
    let resume = match resume_module(&options.resume, &filename) {
        Ok(resume) => resume,
        Err(message) => return invalid(message, &filename),
    };
    let styles = match styles_option(&options.styles) {
        Ok(styles) => styles,
        Err(message) => return invalid(message, &filename),
    };
    let server = options.server_exports.unwrap_or(false).then(|| server_split::run(source, &filename, resume.is_some()));
    let dom = options.target.as_deref() == Some("dom");
    let browser = server.as_ref().and_then(|s| if dom { s.browser.as_deref() } else { None });
    let mut output = compile(
        browser.unwrap_or(source),
        Options {
            target: options.target.unwrap_or_else(|| "server".into()),
            filename,
            server_list_mounts: options.server_list_mounts.unwrap_or(true),
            resume,
            source_map: options.source_map.unwrap_or(false),
            static_calls: options.static_calls.unwrap_or_default(),
            variants: options.variants.unwrap_or_default(),
            variant: options.variant,
            time_zone: options.time_zone,
            dev: options.dev.unwrap_or(false),
            styles,
            check: false,
            source_packages: options.source_packages.unwrap_or_default(),
            symbols: options.symbols.unwrap_or(false),
            resolved_imports: options.resolved_imports.unwrap_or_default().into_iter().collect(),
        },
    );
    if let Some(server) = &server {
        if server.diagnostics.iter().any(|d| !d.warning) {
            output.code = String::new();
            output.map = None;
            output.resumed = None;
            output.diagnostics.splice(0..0, server.diagnostics.iter().cloned());
        }
    }
    // T10 fix 2: warnings (never suppressing the code) go under `warnings`; `diagnostics` stays errors only.
    let (warned, errors): (Vec<_>, Vec<_>) = output.diagnostics.iter().partition(|d| d.warning);
    let entry_of = |d: &compile::Diagnostic| {
            let code = d.code.unwrap_or_else(|| diagnostics::classify(&d.message));
            let mut entry = Map::new();
            entry.insert("category".into(), json!(if d.warning { "warning" } else { "error" }));
            entry.insert("code".into(), json!(code));
            entry.insert("severity".into(), json!(if d.warning { "warning" } else { diagnostics::severity(code) }));
            entry.insert("message".into(), json!(d.message));
            entry.insert("filename".into(), json!(d.filename));
            if let (Some(line), Some(column)) = (d.line, d.column) {
                entry.insert("line".into(), json!(line));
                entry.insert("column".into(), json!(column));
            }
            Value::Object(entry)
    };
    let diagnostics: Vec<Value> = errors.into_iter().map(entry_of).collect();
    let warnings: Vec<Value> = warned.into_iter().map(entry_of).collect();
    let mut result = Map::new();
    // Moved, not re-serialized into a copy (`json!` clones through `to_value`).
    result.insert("code".into(), Value::String(output.code));
    result.insert("diagnostics".into(), Value::Array(diagnostics));
    if !warnings.is_empty() {
        result.insert("warnings".into(), Value::Array(warnings));
    }
    if let Some(map) = output.map {
        result.insert("map".into(), Value::String(map));
    }
    if let Some(styles) = output.css {
        result.insert("css".into(), Value::String(styles.css));
        let mut classes = Map::new();
        for (binding, map) in styles.classes {
            let entries: Map<String, Value> = map.into_iter().map(|(local, scoped)| (local, json!(scoped))).collect();
            classes.insert(binding, Value::Object(entries));
        }
        result.insert("cssClasses".into(), Value::Object(classes));
    }
    // LAZY-ROWS T2: per structural `<For>` lazy-rows verdict (resume mode; absent when the module has none).
    if !output.for_rows.is_empty() {
        let rows: Vec<Value> = output.for_rows.iter().map(|f| for_row_json(f, None)).collect();
        result.insert("forRows".into(), Value::Array(rows));
    }
    if let Some((symbols, scope)) = output.resumed {
        result.insert("symbols".into(), json!(symbols));
        result.insert("scope".into(), json!(scope));
    }
    if let Some(server) = server {
        result.insert("serverExports".into(), json!(server.exports));
        result.insert("serverImports".into(), json!(server.imports));
    }
    Value::Object(result)
}

/// Module facts; route modules (`serverExports`) report facts of their browser source plus the
/// server export names, dropped imports and server-split errors.
fn module_facts(source: &str, filename: &str, options: Option<FactsOptions>) -> Value {
    let Some(options) = options.filter(|o| o.server_exports.unwrap_or(false)) else {
        return facts::module_facts(source, filename);
    };
    let server = server_split::run(source, filename, options.resume.unwrap_or(false));
    let mut facts = facts::module_facts(server.browser.as_deref().unwrap_or(source), filename);
    if let Value::Object(map) = &mut facts {
        map.insert("serverExports".into(), json!(server.exports));
        map.insert("serverImports".into(), json!(server.imports));
        let errors: Vec<Value> = server
            .diagnostics
            .iter()
            .map(|d| json!({ "message": d.message, "line": d.line, "column": d.column }))
            .collect();
        map.insert("serverErrors".into(), Value::Array(errors));
    }
    facts
}

/// Resume module id from a `resume` option: `{ module?: string }` or `true` turn resume mode on
/// (`module` defaults to the filename); JS-falsy values (`null`, `false`, `0`, `""`) leave it off;
/// anything else is an error (P4: `0` / `""` used to turn it on).
fn resume_module(resume: &Option<Value>, filename: &str) -> Result<Option<String>, String> {
    match resume {
        None | Some(Value::Null) | Some(Value::Bool(false)) => Ok(None),
        Some(Value::Number(n)) if n.as_f64() == Some(0.0) => Ok(None),
        Some(Value::String(s)) if s.is_empty() => Ok(None),
        Some(Value::Bool(true)) => Ok(Some(filename.to_string())),
        Some(Value::Object(map)) => match map.get("module") {
            None | Some(Value::Null) => Ok(Some(filename.to_string())),
            Some(Value::String(module)) => Ok(Some(module.clone())),
            Some(_) => Err("Invalid compiler option `resume.module`: expected a string".into()),
        },
        Some(_) => Err("Invalid compiler option `resume`: expected `{ module?: string }`, true or false".into()),
    }
}

/// Editor check: diagnostics of every target (merged, deduplicated, with codes and UTF-16 ranges)
/// plus resume sites. No code is generated.
fn check_json(source: &str, raw: Option<Value>) -> Value {
    let invalid = |message: String, filename: &str| {
        let code = diagnostics::classify(&message);
        let entry = json!({ "code": code, "severity": diagnostics::severity(code), "message": message, "filename": filename, "start": 0, "end": 0, "targets": ["server", "dom"] });
        json!({ "diagnostics": [entry], "sites": [] })
    };
    let filename = raw_filename(&raw);
    let options: CheckOptions = match parse_options(raw) {
        Ok(options) => options,
        Err(message) => return invalid(message, &filename),
    };
    let filename = options.filename.unwrap_or_else(|| "module.tsx".into());
    let resume = match resume_module(&options.resume, &filename) {
        Ok(resume) => resume,
        Err(message) => return invalid(message, &filename),
    };
    let targets = options.targets.unwrap_or_else(|| vec!["server".into(), "dom".into()]);
    if let Some(bad) = targets.iter().find(|t| *t != "server" && *t != "dom") {
        return invalid(format!("Invalid compiler option `targets`: unknown target \"{bad}\""), &filename);
    }
    let line_starts: Vec<usize> =
        std::iter::once(0).chain(source.match_indices('\n').map(|(i, _)| i + 1)).collect();
    let index = diagnostics::Utf16Index::new(source);
    let utf16 = |pos: u32| index.offset(pos);
    let mut entries: Vec<(String, Option<(u32, u32)>, Map<String, Value>)> = Vec::new();
    // (message, span) → entry index: merging stays linear in the diagnostic count.
    let mut seen: std::collections::HashMap<(String, Option<(u32, u32)>), usize> = std::collections::HashMap::new();
    let mut sites = Vec::new();
    let mut classes: Vec<(String, bool)> = Vec::new();
    let mut for_rows = Vec::new();
    for target in &targets {
        let output = compile(
            source,
            Options {
                target: target.clone(),
                filename: filename.clone(),
                server_list_mounts: true,
                resume: resume.clone(),
                source_map: false,
                static_calls: Vec::new(),
                variants: Vec::new(),
                variant: None,
                time_zone: None,
                dev: false,
                styles: None,
                check: true,
                source_packages: options.source_packages.clone().unwrap_or_default(),
                symbols: false,
                resolved_imports: Default::default(),
            },
        );
        if sites.is_empty() || target == "dom" {
            sites = output.sites;
        }
        if classes.is_empty() {
            classes = output.classes;
        }
        if for_rows.is_empty() {
            for_rows = output.for_rows;
        }
        for d in output.diagnostics {
            if let Some(&at) = seen.get(&(d.message.clone(), d.span)) {
                if let Some(Value::Array(list)) = entries[at].2.get_mut("targets") {
                    list.push(json!(target));
                }
                continue;
            }
            let code = d.code.unwrap_or_else(|| diagnostics::classify(&d.message));
            let mut entry = Map::new();
            entry.insert("code".into(), json!(code));
            entry.insert("severity".into(), json!(if d.warning { "warning" } else { diagnostics::severity(code) }));
            entry.insert("message".into(), json!(d.message));
            entry.insert("filename".into(), json!(d.filename));
            let (start, end) = d.span.unwrap_or((0, 0));
            entry.insert("start".into(), json!(utf16(start)));
            entry.insert("end".into(), json!(utf16(end)));
            if d.span.is_some() {
                let line = line_starts.partition_point(|&s| s <= start as usize).saturating_sub(1);
                entry.insert("line".into(), json!(line + 1));
                entry.insert("column".into(), json!(utf16(start) - utf16(line_starts[line] as u32) + 1));
            }
            entry.insert("targets".into(), json!([target]));
            seen.insert((d.message.clone(), d.span), entries.len());
            entries.push((d.message, d.span, entry));
        }
    }
    let diagnostics: Vec<Value> = entries.into_iter().map(|(_, _, entry)| Value::Object(entry)).collect();
    let classes: Vec<Value> = classes.into_iter().map(|(name, revive)| json!({ "name": name, "kind": if revive { "revive" } else { "data" } })).collect();
    let mut result = json!({ "diagnostics": diagnostics, "sites": sites, "classes": classes });
    if !for_rows.is_empty() {
        let rows: Vec<Value> = for_rows.iter().map(|f| for_row_json(f, Some(&utf16 as &dyn Fn(u32) -> u32))).collect();
        result["forRows"] = Value::Array(rows);
    }
    result
}

/// LAZY-ROWS T2: one `forRows` entry — `{ line, column, lazy, reason?, symbol?, key?, by?, index? }`; `check` adds the
/// element's UTF-16 `start` / `end`.
fn for_row_json(fact: &crate::resume::ForRowFact, utf16: Option<&dyn Fn(u32) -> u32>) -> Value {
    let mut entry = Map::new();
    if let Some(utf16) = utf16 {
        entry.insert("start".into(), json!(utf16(fact.span.0)));
        entry.insert("end".into(), json!(utf16(fact.span.1)));
    }
    entry.insert("line".into(), json!(fact.line));
    entry.insert("column".into(), json!(fact.column));
    entry.insert("lazy".into(), json!(fact.lazy));
    if let Some(reason) = fact.reason {
        entry.insert("reason".into(), json!(reason));
    }
    if let Some(symbol) = &fact.symbol {
        entry.insert("symbol".into(), json!(symbol));
    }
    if let Some(key) = &fact.key {
        entry.insert("key".into(), json!(key));
    }
    if fact.by_fn {
        entry.insert("by".into(), json!(true));
    }
    if fact.index {
        entry.insert("index".into(), json!(true));
    }
    Value::Object(entry)
}

/// Handle one JSON request.
pub fn handle(request: &[u8]) -> Vec<u8> {
    // `{ "ok": value }` built by moving `value` (`json!` would deep-copy it through `to_value`,
    // generated code included).
    let ok = |value: Value| {
        let mut map = Map::new();
        map.insert("ok".into(), value);
        Value::Object(map)
    };
    let response = match serde_json::from_slice::<Request>(request) {
        Ok(Request::Compile { source, options }) => ok(compile_json(&source, options)),
        Ok(Request::RegisterTable { id, table }) => {
            i18n::register(id, table);
            ok(Value::Null)
        }
        Ok(Request::ModuleFacts { source, filename, options }) => ok(module_facts(&source, &filename, options)),
        Ok(Request::Check { source, options }) => ok(check_json(&source, options)),
        Ok(Request::DecodeHtml { text }) => ok(Value::String(entities::decode_html(&text))),
        Ok(Request::Panic { message }) => panic!("{message}"),
        Err(error) => json!({ "error": format!("invalid request: {error}") }),
    };
    serde_json::to_vec(&response).unwrap_or_else(|_| br#"{"error":"serialization failed"}"#.to_vec())
}

thread_local! {
    static RESULT: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) };
}

// Last panic message (leaked UTF-8 bytes). Plain atomics: readable after the trap, whatever state
// the aborted call left behind (a `RefCell` could still be borrowed).
static PANIC_PTR: AtomicUsize = AtomicUsize::new(0);
static PANIC_LEN: AtomicUsize = AtomicUsize::new(0);
static HOOK: Once = Once::new();

/// Keep the panic message (payload + location) for `panic_ptr` / `panic_len`; the abort follows.
fn install_panic_hook() {
    HOOK.call_once(|| {
        std::panic::set_hook(Box::new(|info| {
            let payload = info.payload();
            let text = payload
                .downcast_ref::<&str>()
                .map(|s| s.to_string())
                .or_else(|| payload.downcast_ref::<String>().cloned())
                .unwrap_or_else(|| "unknown panic payload".into());
            let message = match info.location() {
                Some(at) => format!("{text} (at {}:{}:{})", at.file(), at.line(), at.column()),
                None => text,
            };
            let bytes: &'static mut [u8] = Box::leak(message.into_bytes().into_boxed_slice());
            PANIC_LEN.store(bytes.len(), Ordering::SeqCst);
            PANIC_PTR.store(bytes.as_ptr() as usize, Ordering::SeqCst);
        }));
    });
}

/// Address of the last panic message (0 before any panic).
#[unsafe(no_mangle)]
pub extern "C" fn panic_ptr() -> usize {
    PANIC_PTR.load(Ordering::SeqCst)
}

/// Byte length of the last panic message.
#[unsafe(no_mangle)]
pub extern "C" fn panic_len() -> usize {
    PANIC_LEN.load(Ordering::SeqCst)
}

#[unsafe(no_mangle)]
pub extern "C" fn alloc(len: usize) -> *mut u8 {
    let mut buffer = Vec::<u8>::with_capacity(len.max(1));
    let ptr = buffer.as_mut_ptr();
    std::mem::forget(buffer);
    ptr
}

/// # Safety
/// `ptr`/`len` must come from `alloc(len)` and not be used afterwards.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn dealloc(ptr: *mut u8, len: usize) {
    if !ptr.is_null() {
        // SAFETY: allocated by `alloc` with capacity `len.max(1)`.
        drop(unsafe { Vec::from_raw_parts(ptr, 0, len.max(1)) });
    }
}

/// # Safety
/// `ptr`/`len` must be a request buffer from `alloc(len)` filled by the caller; it is consumed.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn run(ptr: *mut u8, len: usize) -> *const u8 {
    // SAFETY: the caller transfers a buffer allocated by `alloc(len)` with `len` initialized bytes.
    let request = unsafe { Vec::from_raw_parts(ptr, len, len.max(1)) };
    install_panic_hook();
    let response = handle(&request);
    drop(request);
    RESULT.with(|cell| {
        *cell.borrow_mut() = response;
        cell.borrow().as_ptr()
    })
}

/// sha256 of the crate sources this module was built from (`build.sh`; empty for other builds).
const SOURCE_HASH: &str = match option_env!("RIVET_SOURCE_HASH") {
    Some(hash) => hash,
    None => "",
};

/// Address of the source hash (ASCII hex; staleness guard, X2).
#[unsafe(no_mangle)]
pub extern "C" fn source_hash_ptr() -> *const u8 {
    SOURCE_HASH.as_ptr()
}

/// Byte length of the source hash (0 when built outside `build.sh`).
#[unsafe(no_mangle)]
pub extern "C" fn source_hash_len() -> usize {
    SOURCE_HASH.len()
}

#[unsafe(no_mangle)]
pub extern "C" fn result_len() -> usize {
    RESULT.with(|cell| cell.borrow().len())
}
