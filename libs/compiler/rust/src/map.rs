//! Source maps. Lowering splices source text: with maps on, every copied source chunk is preceded by
//! a provenance mark (`\u{E000}start:len\u{E001}`, byte offsets into the original) and every
//! generated replacement by a zero-length anchor at the replaced node. `extract` removes the marks
//! before the final parse; `compose` maps codegen's tokens (output → spliced text) back through
//! them to the original source.

use std::fmt::Write;

pub const MARK: char = '\u{E000}';
const END: char = '\u{E001}';

/// Append a provenance mark for `len` bytes copied from original offset `start`.
pub fn mark(out: &mut String, start: u32, len: u32) {
    let _ = write!(out, "{MARK}{start}:{len}{END}");
}

/// Text without marks (for inspecting spliced text, e.g. "is this a plain identifier?").
pub fn unmarked(text: &str) -> std::borrow::Cow<'_, str> {
    if !text.contains(MARK) {
        return std::borrow::Cow::Borrowed(text);
    }
    std::borrow::Cow::Owned(extract(text).0)
}

/// One mark: spliced (clean) byte offset, original byte offset, copied length.
#[derive(Clone, Copy)]
pub struct Segment {
    at: u32,
    src: u32,
    len: u32,
}

/// Remove marks; returns the clean text and its segments in order.
pub fn extract(text: &str) -> (String, Vec<Segment>) {
    let mut clean = String::with_capacity(text.len());
    let mut segments = Vec::new();
    let mut rest = text;
    while let Some(i) = rest.find(MARK) {
        clean.push_str(&rest[..i]);
        let after = &rest[i + MARK.len_utf8()..];
        let Some(j) = after.find(END) else {
            rest = after;
            continue;
        };
        let (src, len) = after[..j].split_once(':').unwrap_or(("0", "0"));
        segments.push(Segment { at: clean.len() as u32, src: src.parse().unwrap_or(0), len: len.parse().unwrap_or(0) });
        rest = &after[j + END.len_utf8()..];
    }
    clean.push_str(rest);
    (clean, segments)
}

/// Byte offset ↔ (line, UTF-16 column) for one text.
struct Lines<'s> {
    text: &'s str,
    starts: Vec<u32>,
}

impl<'s> Lines<'s> {
    fn new(text: &'s str) -> Self {
        let mut starts = vec![0];
        let bytes = text.as_bytes();
        let mut i = 0;
        while i < bytes.len() {
            match bytes[i] {
                b'\n' => starts.push(i as u32 + 1),
                b'\r' if bytes.get(i + 1) != Some(&b'\n') => starts.push(i as u32 + 1),
                0xE2 if bytes.get(i + 1) == Some(&0x80) && matches!(bytes.get(i + 2), Some(0xA8 | 0xA9)) => {
                    starts.push(i as u32 + 3);
                    i += 2;
                }
                _ => {}
            }
            i += 1;
        }
        Lines { text, starts }
    }

    fn offset(&self, line: u32, column: u32) -> Option<u32> {
        let start = *self.starts.get(line as usize)?;
        let end = self.starts.get(line as usize + 1).copied().unwrap_or(self.text.len() as u32);
        let mut units = 0;
        for (i, c) in self.text[start as usize..end as usize].char_indices() {
            if units >= column {
                return Some(start + i as u32);
            }
            units += c.len_utf16() as u32;
        }
        Some(end)
    }

    fn position(&self, offset: u32) -> (u32, u32) {
        let line = self.starts.partition_point(|&s| s <= offset).saturating_sub(1);
        let start = self.starts[line] as usize;
        let end = (offset as usize).min(self.text.len());
        let column = self.text.get(start..end).map_or(0, |s| s.encode_utf16().count());
        (line as u32, column as u32)
    }
}

/// A decoded codegen token: generated position, spliced-source position, optional name.
pub struct Token<'n> {
    pub dst_line: u32,
    pub dst_col: u32,
    pub src_line: u32,
    pub src_col: u32,
    pub name: Option<&'n str>,
}

/// Source map v3 JSON for `tokens` (positions in `clean`) mapped back to `original`.
pub fn compose<'n>(
    tokens: impl Iterator<Item = Token<'n>>,
    clean: &str,
    segments: &[Segment],
    original: &str,
    filename: &str,
) -> String {
    let clean_lines = Lines::new(clean);
    let original_lines = Lines::new(original);
    let mut names: Vec<&str> = Vec::new();
    let mut mappings = String::new();
    let (mut line, mut prev_col, mut prev_src_line, mut prev_src_col, mut prev_name) = (0u32, 0i64, 0i64, 0i64, 0i64);
    let mut first_in_line = true;
    let mut last: Option<(u32, u32)> = None;
    for token in tokens {
        let Some(at) = clean_lines.offset(token.src_line, token.src_col) else { continue };
        // The last mark at or before `at`: inside a copied chunk the offset maps exactly; generated
        // code after it maps to the chunk's end (or to the replaced node for an anchor).
        let index = segments.partition_point(|s| s.at <= at);
        if index == 0 {
            continue;
        }
        let segment = segments[index - 1];
        let src = segment.src + (at - segment.at).min(segment.len);
        let (src_line, src_col) = original_lines.position(src);
        if last == Some((token.dst_line, token.dst_col)) {
            continue;
        }
        last = Some((token.dst_line, token.dst_col));
        while line < token.dst_line {
            mappings.push(';');
            line += 1;
            prev_col = 0;
            first_in_line = true;
        }
        if !first_in_line {
            mappings.push(',');
        }
        first_in_line = false;
        vlq(&mut mappings, i64::from(token.dst_col) - prev_col);
        prev_col = i64::from(token.dst_col);
        vlq(&mut mappings, 0);
        vlq(&mut mappings, i64::from(src_line) - prev_src_line);
        prev_src_line = i64::from(src_line);
        vlq(&mut mappings, i64::from(src_col) - prev_src_col);
        prev_src_col = i64::from(src_col);
        if let Some(name) = token.name {
            let id = names.iter().position(|n| *n == name).unwrap_or_else(|| {
                names.push(name);
                names.len() - 1
            }) as i64;
            vlq(&mut mappings, id - prev_name);
            prev_name = id;
        }
    }
    serde_json::json!({
        "version": 3,
        "sources": [filename],
        "sourcesContent": [original],
        "names": names,
        "mappings": mappings,
    })
    .to_string()
}

fn vlq(out: &mut String, value: i64) {
    const DIGITS: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut v = if value < 0 { ((-value) << 1) | 1 } else { value << 1 } as u64;
    loop {
        let mut digit = (v & 31) as usize;
        v >>= 5;
        if v > 0 {
            digit |= 32;
        }
        out.push(DIGITS[digit] as char);
        if v == 0 {
            break;
        }
    }
}
