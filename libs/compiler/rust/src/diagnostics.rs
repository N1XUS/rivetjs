//! Stable diagnostic codes for `compile`, editors and `rivet check` (the `check` op). One code per
//! message family: 1xxx syntax/attributes, 2xxx resume, 3xxx imports/helpers/route modules, 4xxx
//! static calls (i18n), 5xxx styles, 6xxx slots, 9xxx internal. Codes are assigned here from the
//! message so call sites stay unchanged. Registry (titles, severities, docs URLs, reserved ranges):
//! `libs/compiler/codes.json` — `tests/codes.test.ts` fails when a code below is not registered.

/// Severity of a compiler code's errors. A compile warning (T10 fix 2: `Diags::warn`, `Diagnostic.warning`; RV2012 /
/// RV2013 / RV2014 when the receiver is not provably a function) never suppresses output: `compile` returns it under
/// `warnings`, `check` with `severity: "warning"`. Language-service warnings: RV2101, RV3101.
pub fn severity(_code: &str) -> &'static str {
    "error"
}

/// Stable code for a compiler message.
pub fn classify(message: &str) -> &'static str {
    let starts = |prefix: &str| message.starts_with(prefix);
    let contains = |part: &str| message.contains(part);
    match () {
        _ if starts("Spread attributes") => "RV1001",
        _ if starts("Spread children") => "RV1002",
        _ if starts("Unsupported namespaced tag") => "RV1003",
        _ if starts("Unsupported native tag") => "RV1004",
        _ if starts("Unsupported parser-repaired native nesting") => "RV1005",
        _ if starts("Text is not supported directly in table structure") => "RV1006",
        _ if starts("Script/style JSX content") => "RV1007",
        _ if starts("Void elements cannot have children") => "RV1008",
        _ if starts("Textarea model cannot also have children") => "RV1009",
        _ if starts("Textarea/title children") => "RV1010",
        _ if starts("Unsupported model binding") => "RV1011",
        _ if starts("Unknown native event") => "RV1012",
        _ if starts("Unsupported global event attribute") => "RV1013",
        _ if starts("Unsafe or unsupported native attribute") || starts("Unsafe URL attribute") => "RV1101",
        _ if starts("preload must be one of") => "RV1102",
        _ if starts("clientEvent target must be") => "RV1103",
        _ if starts("Event handler ") && contains(" must be a function") => "RV1015",
        _ if starts("Event handler ") && contains(" is evaluated once at render") => "RV1016",
        _ if starts("Browser global") => "RV2001",
        _ if starts("Resumable ref callbacks must assign a local") => "RV2002",
        _ if message.contains("class instances are not serializable") => "RV2003",
        _ if starts("Ref-bound locals") => "RV2005",
        _ if starts("JSX inside handlers") => "RV2006",
        _ if starts("Resumable code cannot capture `this`") => "RV2007",
        _ if starts("Cannot resume `") && contains(" or give ") && contains(" a static [revive]") => "RV2102",
        _ if starts("Cannot resume ") && contains("exports a different binding as") => "RV2008",
        _ if starts("Cannot resume ") && contains("share the browser name") => "RV2009",
        _ if starts("Mutually recursive functions ") && contains("separated by an early exit") => "RV2011",
        _ if starts("`.bind` with a spread first argument") => "RV2012",
        _ if starts("`.bind` of `") && (contains("is not resumable") || contains("may not resume")) => "RV2013",
        _ if starts("`.bind(…)` inside an object literal") => "RV2014",
        _ if starts("Component returns a function that cannot resume") => "RV2015",
        _ if starts("Keyed `For` row renders non-deterministically") => "RV2105",
        _ if starts("Keyed `For` row holds ") => "RV2106",
        _ if starts("Target helper re-exports") => "RV3001",
        _ if starts("Import target helpers as named bindings") || starts("Target runtime namespaces") => "RV3002",
        _ if starts("Import structural helpers as named bindings") => "RV3003",
        _ if starts("Structural helper aliases") => "RV3004",
        _ if starts("Server clientOnly must be called directly") => "RV3005",
        _ if starts("Server clientOnly erasure") => "RV3006",
        _ if starts("Declare server exports") || starts("`export *` is not allowed in a route module") => "RV3007",
        _ if contains("is server-only (removed from browser builds)") || contains("server-only modules cannot reach the browser") => "RV3008",
        _ if starts("Server-only code cannot render JSX") => "RV3009",
        _ if starts("Unknown message key") || starts("No message keys match prefix") => "RV4001",
        _ if starts("Unknown param") || starts("Missing param") || message.contains("needs a param") => "RV4002",
        _ if message.contains("params must be")
            || message.contains("arguments cannot be spread")
            || message.contains("takes a key")
            || message.contains("key must be a string literal")
            || starts("Prefixed keys must not take params") =>
        {
            "RV4003"
        }
        // "Message tag {t} in … cannot be lowered here" and "Message tags (…) are not supported in …".
        _ if starts("Tag param") || starts("Message tag") || starts("Tags inside plural/select") => "RV4004",
        _ if starts("Static call table") || starts("staticCalls require") || starts("DOM target with staticCalls") => "RV4005",
        _ if starts("css``: ") => "RV5001",
        _ if starts("css`` ") || (starts("Unknown class '") && contains("in css`` block")) => "RV5002",
        _ if starts("Invalid style property")
            || (starts("style:") && contains(" needs a value"))
            || starts("Unsafe style value")
            || starts("style strings are not supported")
            || starts("Use one class attribute") =>
        {
            "RV5003"
        }
        _ if starts("<slot>") || starts("<slot r:name=") => "RV6001",
        _ if starts("r:name must be") || starts("r:args must be") => "RV6002",
        _ if starts("r:slot") || starts("conditional r:slot") => "RV6003",
        _ if starts("slot \"") && (contains("is also passed as an attribute") || contains("is passed more than once")) => "RV6004",
        _ if starts("Invalid compiler option") => "RV7001",
        _ if starts("Internal error") || starts("Unknown compilation target") => "RV9001",
        _ => "RV9000",
    }
}

/// Byte → UTF-16 offset table for one source (editor/TypeScript positions): built once per source
/// in O(n), each lookup O(log k) over the k non-ASCII characters (O(1) for ASCII sources). Replaces
/// re-encoding the whole prefix per position (T2: `check` was quadratic in file size).
pub struct Utf16Index<'s> {
    source: &'s str,
    /// Byte start of every non-ASCII character, ascending.
    starts: Vec<u32>,
    /// `deltas[i]`: UTF-8 bytes minus UTF-16 units of the non-ASCII characters `0..=i`.
    deltas: Vec<u32>,
}

impl<'s> Utf16Index<'s> {
    pub fn new(source: &'s str) -> Self {
        let mut starts = Vec::new();
        let mut deltas = Vec::new();
        if !source.is_ascii() {
            let mut delta = 0u32;
            for (at, c) in source.char_indices() {
                if !c.is_ascii() {
                    delta += (c.len_utf8() - c.len_utf16()) as u32;
                    starts.push(at as u32);
                    deltas.push(delta);
                }
            }
        }
        Utf16Index { source, starts, deltas }
    }

    /// UTF-16 offset of byte position `pos` (clamped to the source, rounded down to a character boundary).
    pub fn offset(&self, pos: u32) -> u32 {
        let mut end = (pos as usize).min(self.source.len());
        if self.starts.is_empty() {
            return end as u32;
        }
        while !self.source.is_char_boundary(end) {
            end -= 1;
        }
        let k = self.starts.partition_point(|&s| (s as usize) < end);
        end as u32 - if k == 0 { 0 } else { self.deltas[k - 1] }
    }
}
