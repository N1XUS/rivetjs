//! css`` blocks: scope class names and keyframes of one block, optionally inside a cascade layer.
//!
//! A hand-written scanner over the CSS Syntax subset that matters for rewriting: comments, strings,
//! escapes, `url(…)`, balanced `()`/`[]`/`{}` and at-rules. Selector preludes (top level, nested
//! rules, conditional group rules) get `.ident` → scoped; `:global(…)` is unwrapped untouched,
//! `:local(…)` unwrapped and scoped; attribute selectors and strings are never touched.
//! `@keyframes name` is scoped, and `animation`/`animation-name` values naming keyframes of the
//! same block follow. Everything else is copied verbatim (Vite's CSS pipeline does the rest).

/// Generated class name style.
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Names {
    /// `<local>_<hash5>` (dev default).
    Readable,
    /// `r<hash6>` (production default).
    Short,
}

pub struct Scoped {
    /// Rewritten CSS (layer-wrapped when a layer is given).
    pub css: String,
    /// Local name → scoped name, in first-appearance order (classes, then keyframes).
    pub classes: Vec<(String, String)>,
}

/// FNV-1a 64 over `scope`, a NUL separator and `local` (deterministic across builds and targets).
pub fn hash(scope: &str, local: &str) -> u64 {
    let mut h: u64 = 0xcbf2_9ce4_8422_2325;
    for byte in scope.bytes().chain(std::iter::once(0)).chain(local.bytes()) {
        h ^= u64::from(byte);
        h = h.wrapping_mul(0x0000_0100_0000_01b3);
    }
    h
}

fn base36(mut n: u64, len: usize) -> String {
    const DIGITS: &[u8; 36] = b"0123456789abcdefghijklmnopqrstuvwxyz";
    let mut out = vec![b'0'; len];
    for slot in out.iter_mut().rev() {
        *slot = DIGITS[(n % 36) as usize];
        n /= 36;
    }
    String::from_utf8(out).unwrap_or_default()
}

/// The scoped name of `local` in `scope`.
pub fn scoped_name(scope: &str, local: &str, names: Names) -> String {
    let h = hash(scope, local);
    match names {
        Names::Short => format!("r{}", base36(h, 6)),
        Names::Readable => {
            let mut readable: String =
                local.chars().map(|c| if c.is_ascii_alphanumeric() || c == '_' || c == '-' || !c.is_ascii() { c } else { '_' }).collect();
            if !readable.starts_with(|c: char| c.is_ascii_alphabetic() || c == '_' || !c.is_ascii()) {
                readable.insert(0, '_');
            }
            format!("{readable}_{}", base36(h, 5))
        }
    }
}

const HOISTED: &[&str] = &["import", "charset", "reference", "namespace", "config", "plugin"];
const GROUPS: &[&str] = &["media", "supports", "container", "layer", "scope", "document", "starting-style"];

/// Scope one css`` block.
pub fn scope_css(source: &str, scope: &str, names: Names, layer: Option<&str>) -> Result<Scoped, String> {
    let keyframes = collect_keyframes(source)?;
    let mut r = Rewriter { src: source.as_bytes(), text: source, pos: 0, scope, names, classes: Vec::new(), keyframes, hoisted: String::new() };
    let mut body = String::new();
    r.rules(&mut body, true)?;
    let mut classes = std::mem::take(&mut r.classes);
    for name in &r.keyframes {
        if !classes.iter().any(|(local, _)| local == name) {
            classes.push((name.clone(), scoped_name(scope, name, names)));
        }
    }
    let css = match layer {
        Some(layer) => format!("{}@layer {layer}{{{}}}", r.hoisted, body.trim()),
        None => format!("{}{}", r.hoisted, body.trim()),
    };
    Ok(Scoped { css, classes })
}

fn is_ident_start(b: u8) -> bool {
    b.is_ascii_alphabetic() || b == b'_' || b >= 0x80
}
fn is_ident_char(b: u8) -> bool {
    is_ident_start(b) || b.is_ascii_digit() || b == b'-'
}

/// Keyframe names declared anywhere in the block (`@keyframes` and vendor-prefixed forms).
fn collect_keyframes(source: &str) -> Result<Vec<String>, String> {
    let src = source.as_bytes();
    let mut names = Vec::new();
    let mut pos = 0;
    while pos < src.len() {
        match src[pos] {
            b'/' if src.get(pos + 1) == Some(&b'*') => pos = skip_comment(src, pos)?,
            b'"' | b'\'' => pos = skip_string(src, pos)?,
            b'\\' => pos += 2,
            b'@' => {
                let (name, end) = read_ident(source, pos + 1);
                pos = end.max(pos + 1);
                if name.to_ascii_lowercase().ends_with("keyframes") {
                    while pos < src.len() && src[pos].is_ascii_whitespace() {
                        pos += 1;
                    }
                    let (frames, end) = read_ident(source, pos);
                    if !frames.is_empty() && !names.contains(&frames) {
                        names.push(frames);
                    }
                    pos = end.max(pos);
                }
            }
            _ => pos += 1,
        }
    }
    Ok(names)
}

fn skip_comment(src: &[u8], pos: usize) -> Result<usize, String> {
    let mut i = pos + 2;
    while i + 1 < src.len() {
        if src[i] == b'*' && src[i + 1] == b'/' {
            return Ok(i + 2);
        }
        i += 1;
    }
    Err("css``: unterminated comment".into())
}

fn skip_string(src: &[u8], pos: usize) -> Result<usize, String> {
    let quote = src[pos];
    let mut i = pos + 1;
    while i < src.len() {
        match src[i] {
            b'\\' => i += 2,
            b'\n' => break,
            c if c == quote => return Ok(i + 1),
            _ => i += 1,
        }
    }
    Err("css``: unterminated string".into())
}

/// Read an identifier (with escapes) at `pos`: (decoded name, end). Empty when none starts there.
fn read_ident(text: &str, pos: usize) -> (String, usize) {
    let src = text.as_bytes();
    let mut i = pos;
    if src.get(i) == Some(&b'-') {
        i += 1;
        if src.get(i) == Some(&b'-') {
            i += 1;
        }
    }
    let starts = match src.get(i) {
        Some(&b) if is_ident_start(b) => true,
        Some(b'\\') => src.get(i + 1).is_some_and(|&b| b != b'\n'),
        _ => i > pos + 1, // `--` alone starts a custom ident
    };
    if !starts {
        return (String::new(), pos);
    }
    let mut out = String::from(&text[pos..i]);
    while i < src.len() {
        let b = src[i];
        if b == b'\\' {
            let Some(&next) = src.get(i + 1) else { break };
            if next == b'\n' {
                break;
            }
            if next.is_ascii_hexdigit() {
                let mut j = i + 1;
                while j < src.len() && j < i + 7 && src[j].is_ascii_hexdigit() {
                    j += 1;
                }
                let code = u32::from_str_radix(&text[i + 1..j], 16).unwrap_or(0xFFFD);
                out.push(char::from_u32(code).filter(|_| code != 0).unwrap_or('\u{FFFD}'));
                if j < src.len() && src[j].is_ascii_whitespace() {
                    j += 1;
                }
                i = j;
            } else {
                let ch = text[i + 1..].chars().next().unwrap_or('\u{FFFD}');
                out.push(ch);
                i += 1 + ch.len_utf8();
            }
        } else if is_ident_char(b) {
            let ch = text[i..].chars().next().unwrap_or('\u{FFFD}');
            out.push(ch);
            i += ch.len_utf8();
        } else {
            break;
        }
    }
    (out, i)
}

struct Rewriter<'s> {
    src: &'s [u8],
    text: &'s str,
    pos: usize,
    scope: &'s str,
    names: Names,
    classes: Vec<(String, String)>,
    keyframes: Vec<String>,
    hoisted: String,
}

impl Rewriter<'_> {
    fn name_of(&mut self, local: &str) -> String {
        if let Some((_, scoped)) = self.classes.iter().find(|(l, _)| l == local) {
            return scoped.clone();
        }
        let scoped = scoped_name(self.scope, local, self.names);
        self.classes.push((local.to_string(), scoped.clone()));
        scoped
    }

    /// Copy whitespace and comments.
    fn trivia(&mut self, out: &mut String) -> Result<(), String> {
        loop {
            let start = self.pos;
            while self.pos < self.src.len() && self.src[self.pos].is_ascii_whitespace() {
                self.pos += 1;
            }
            if self.src.get(self.pos) == Some(&b'/') && self.src.get(self.pos + 1) == Some(&b'*') {
                self.pos = skip_comment(self.src, self.pos)?;
            }
            out.push_str(&self.text[start..self.pos]);
            if self.pos == start {
                return Ok(());
            }
        }
    }

    /// End of the prelude/declaration at `self.pos`: index of the first `{`, `;` or `}` at depth 0.
    fn scan(&self) -> Result<usize, String> {
        let mut i = self.pos;
        let mut depth = 0usize;
        while i < self.src.len() {
            match self.src[i] {
                b'/' if self.src.get(i + 1) == Some(&b'*') => i = skip_comment(self.src, i)?,
                b'"' | b'\'' => i = skip_string(self.src, i)?,
                b'\\' => i += 2,
                b'(' | b'[' => {
                    depth += 1;
                    i += 1;
                }
                b')' | b']' => {
                    depth = depth.saturating_sub(1);
                    i += 1;
                }
                b'{' | b';' | b'}' if depth == 0 => return Ok(i),
                _ => i += 1,
            }
        }
        Ok(i)
    }

    /// Copy a balanced `{…}` block verbatim (at `self.pos` = `{`).
    fn copy_block(&mut self, out: &mut String) -> Result<(), String> {
        let start = self.pos;
        let mut depth = 0usize;
        while self.pos < self.src.len() {
            match self.src[self.pos] {
                b'/' if self.src.get(self.pos + 1) == Some(&b'*') => self.pos = skip_comment(self.src, self.pos)?,
                b'"' | b'\'' => self.pos = skip_string(self.src, self.pos)?,
                b'\\' => self.pos += 2,
                b'{' => {
                    depth += 1;
                    self.pos += 1;
                }
                b'}' => {
                    depth -= 1;
                    self.pos += 1;
                    if depth == 0 {
                        out.push_str(&self.text[start..self.pos]);
                        return Ok(());
                    }
                }
                _ => self.pos += 1,
            }
        }
        Err("css``: unclosed block".into())
    }

    /// A rule list (stylesheet or conditional group body). Stops at `}` unless `top`.
    fn rules(&mut self, out: &mut String, top: bool) -> Result<(), String> {
        loop {
            self.trivia(out)?;
            let Some(&b) = self.src.get(self.pos) else {
                return if top { Ok(()) } else { Err("css``: unclosed block".into()) };
            };
            match b {
                b'}' if top => return Err("css``: unexpected }".into()),
                b'}' => return Ok(()),
                b'@' => self.at_rule(out, top, false)?,
                _ => {
                    let end = self.scan()?;
                    if self.src.get(end) != Some(&b'{') {
                        return Err(format!("css``: expected a rule, found {:?}", self.text[self.pos..end].trim()));
                    }
                    let text = self.text;
                    let prelude = self.selector(&text[self.pos..end])?;
                    out.push_str(&prelude);
                    self.pos = end + 1;
                    out.push('{');
                    self.style_block(out)?;
                    out.push('}');
                    self.pos += 1;
                }
            }
        }
    }

    /// Declarations and nested rules of a style rule; stops at its `}`.
    fn style_block(&mut self, out: &mut String) -> Result<(), String> {
        loop {
            self.trivia(out)?;
            let Some(&b) = self.src.get(self.pos) else { return Err("css``: unclosed block".into()) };
            match b {
                b'}' => return Ok(()),
                b';' => {
                    out.push(';');
                    self.pos += 1;
                }
                b'@' => self.at_rule(out, false, true)?,
                _ => {
                    let end = self.scan()?;
                    let all = self.text;
                    let text = &all[self.pos..end];
                    if self.src.get(end) == Some(&b'{') {
                        let prelude = self.selector(text)?;
                        out.push_str(&prelude);
                        out.push('{');
                        self.pos = end + 1;
                        self.style_block(out)?;
                        out.push('}');
                        self.pos += 1;
                    } else {
                        let declaration = self.declaration(text);
                        out.push_str(&declaration);
                        self.pos = end;
                    }
                }
            }
        }
    }

    fn at_rule(&mut self, out: &mut String, top: bool, in_style: bool) -> Result<(), String> {
        let all = self.text;
        let (name, name_end) = read_ident(all, self.pos + 1);
        let lower = name.to_ascii_lowercase();
        let end = self.scan()?;
        let prelude = &all[self.pos..end];
        match self.src.get(end) {
            Some(b'{') => {
                if lower.ends_with("keyframes") {
                    // `@keyframes name {…}`: scope the name, keep the frames.
                    let rest = all[name_end..end].trim_start();
                    let (frames, after) = read_ident(rest, 0);
                    if frames.is_empty() {
                        out.push_str(prelude);
                    } else {
                        let scoped = scoped_name(self.scope, &frames, self.names);
                        out.push_str(&format!("{} {scoped}{}", &all[self.pos..name_end], &rest[after..]));
                    }
                    self.pos = end;
                    self.copy_block(out)
                } else if GROUPS.contains(&lower.as_str()) {
                    out.push_str(prelude);
                    out.push('{');
                    self.pos = end + 1;
                    if in_style { self.style_block(out)? } else { self.rules(out, false)? }
                    out.push('}');
                    self.pos += 1;
                    Ok(())
                } else {
                    out.push_str(prelude);
                    self.pos = end;
                    self.copy_block(out)
                }
            }
            Some(b';') => {
                let statement = &all[self.pos..=end];
                if top && HOISTED.contains(&lower.as_str()) {
                    self.hoisted.push_str(statement);
                } else {
                    out.push_str(statement);
                }
                self.pos = end + 1;
                Ok(())
            }
            _ => {
                out.push_str(prelude);
                self.pos = end;
                Ok(())
            }
        }
    }

    /// Rewrite `animation` / `animation-name` values naming this block's keyframes.
    fn declaration(&self, text: &str) -> String {
        let Some(colon) = text.find(':') else { return text.to_string() };
        let property = text[..colon].trim().to_ascii_lowercase();
        if self.keyframes.is_empty() || !(property.ends_with("animation") || property.ends_with("animation-name")) {
            return text.to_string();
        }
        let src = text.as_bytes();
        let mut out = String::from(&text[..=colon]);
        let mut i = colon + 1;
        while i < src.len() {
            let b = src[i];
            if b == b'"' || b == b'\'' {
                let end = skip_string(src, i).unwrap_or(src.len());
                out.push_str(&text[i..end]);
                i = end;
            } else if is_ident_start(b) || b == b'-' || b == b'\\' {
                let (ident, end) = read_ident(text, i);
                if end == i {
                    out.push(b as char);
                    i += 1;
                    continue;
                }
                if self.keyframes.contains(&ident) {
                    out.push_str(&scoped_name(self.scope, &ident, self.names));
                } else {
                    out.push_str(&text[i..end]);
                }
                i = end;
            } else if b.is_ascii_digit() || b == b'.' {
                // Numbers with units (`1s`, `.5s`) are not names.
                let start = i;
                while i < src.len() && (is_ident_char(src[i]) || src[i] == b'.' || src[i] == b'%') {
                    i += 1;
                }
                out.push_str(&text[start..i]);
            } else {
                let ch = text[i..].chars().next().unwrap_or(' ');
                out.push(ch);
                i += ch.len_utf8();
            }
        }
        out
    }

    /// Rewrite a selector list: `.ident` → scoped, `:global(…)` / `:local(…)` unwrapped.
    fn selector(&mut self, text: &str) -> Result<String, String> {
        let src = text.as_bytes();
        let mut out = String::with_capacity(text.len() + 16);
        let mut i = 0;
        while i < src.len() {
            let b = src[i];
            match b {
                b'/' if src.get(i + 1) == Some(&b'*') => {
                    let end = skip_comment(src, i)?;
                    out.push_str(&text[i..end]);
                    i = end;
                }
                b'"' | b'\'' => {
                    let end = skip_string(src, i)?;
                    out.push_str(&text[i..end]);
                    i = end;
                }
                b'[' => {
                    let end = matching(src, i, b'[', b']')?;
                    out.push_str(&text[i..end]);
                    i = end;
                }
                b'\\' => {
                    let ch = text[i + 1..].chars().next().map_or(0, char::len_utf8);
                    out.push_str(&text[i..(i + 1 + ch).min(text.len())]);
                    i += 1 + ch;
                }
                b'.' => {
                    let (local, end) = read_ident(text, i + 1);
                    if local.is_empty() {
                        out.push('.');
                        i += 1;
                    } else {
                        let scoped = self.name_of(&local);
                        out.push('.');
                        out.push_str(&scoped);
                        i = end;
                    }
                }
                b':' => {
                    let rest = &text[i + 1..];
                    let lower = rest.get(..7).map(str::to_ascii_lowercase).unwrap_or_default();
                    if lower.starts_with("global(") || lower.starts_with("local(") {
                        let global = lower.starts_with("global(");
                        let open = i + if global { 7 } else { 6 };
                        let close = matching(src, open, b'(', b')')?;
                        let inner = &text[open + 1..close - 1];
                        if global {
                            out.push_str(inner);
                        } else {
                            let scoped = self.selector(inner)?;
                            out.push_str(&scoped);
                        }
                        i = close;
                    } else if lower.starts_with("global") && !rest.as_bytes().get(6).is_some_and(|&c| is_ident_char(c)) {
                        return Err("css``: use :global(selector); bare :global is not supported".into());
                    } else {
                        out.push(':');
                        i += 1;
                    }
                }
                _ => {
                    let ch = text[i..].chars().next().unwrap_or(' ');
                    out.push(ch);
                    i += ch.len_utf8();
                }
            }
        }
        Ok(out)
    }
}

/// Index after the bracket matching the one at `pos`.
fn matching(src: &[u8], pos: usize, open: u8, close: u8) -> Result<usize, String> {
    let mut depth = 0usize;
    let mut i = pos;
    while i < src.len() {
        match src[i] {
            b'"' | b'\'' => {
                i = skip_string(src, i)?;
                continue;
            }
            b'\\' => {
                i += 2;
                continue;
            }
            c if c == open => depth += 1,
            c if c == close => {
                depth -= 1;
                if depth == 0 {
                    return Ok(i + 1);
                }
            }
            _ => {}
        }
        i += 1;
    }
    Err(format!("css``: unbalanced {}", open as char))
}
