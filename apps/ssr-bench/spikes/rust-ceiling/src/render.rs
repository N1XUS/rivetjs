//! Hand-written stand-in for what a Rivet "native" compile target would emit for adapters/rivet-compiled.jsx:
//! every static run between two holes is one pre-encoded `&[u8]` constant, every hole is one call into a tiny
//! runtime (`rt::*`: HTML escaping + integer formatting), and `.map()` over rows becomes a resumable loop that
//! yields a chunk whenever the pooled buffer passes CHUNK bytes (backpressure = hyper not polling the body).
use crate::page::{Page, Row, Value};
use bytes::{Bytes, BytesMut};
use std::borrow::Borrow;
use std::cell::RefCell;

pub const CHUNK: usize = 32 * 1024;

/// Runtime support library (what `libs/runtime/server.ts` escape/attribute helpers become natively).
pub mod rt {
    use super::Value;
    use bytes::{BufMut, BytesMut};

    /// Text position: `&`, `<`, `>` (same set as fixture/emitter.ts escapeText and Rivet's server runtime).
    #[inline]
    pub fn text(buf: &mut BytesMut, s: &str) {
        let b = s.as_bytes();
        let mut start = 0;
        for i in memchr::memchr3_iter(b'&', b'<', b'>', b) {
            buf.put_slice(&b[start..i]);
            buf.put_slice(match b[i] {
                b'&' => b"&amp;",
                b'<' => b"&lt;",
                _ => b"&gt;",
            });
            start = i + 1;
        }
        buf.put_slice(&b[start..]);
    }

    /// Double-quoted attribute: `&`, `<`, `>`, `"`.
    #[inline]
    pub fn attr(buf: &mut BytesMut, s: &str) {
        let b = s.as_bytes();
        let mut start = 0;
        for (i, &c) in b.iter().enumerate() {
            let rep: &[u8] = match c {
                b'&' => b"&amp;",
                b'<' => b"&lt;",
                b'>' => b"&gt;",
                b'"' => b"&quot;",
                _ => continue,
            };
            buf.put_slice(&b[start..i]);
            buf.put_slice(rep);
            start = i + 1;
        }
        buf.put_slice(&b[start..]);
    }

    /// Integers never need escaping (String(n) is [-0-9]); a typed hole skips the scan.
    #[inline]
    pub fn int(buf: &mut BytesMut, v: i32) {
        let mut f = itoa::Buffer::new();
        buf.put_slice(f.format(v).as_bytes());
    }

    /// `{expr}` whose static type is `number | string`.
    #[inline]
    pub fn text_value(buf: &mut BytesMut, v: Value<'_>) {
        match v {
            Value::Int(i) => int(buf, i),
            Value::Str(s) => text(buf, s),
        }
    }
}

// ---- emitted template constants (adapters/rivet-compiled.jsx + renderPage shell) ----
const S_HEAD_0: &[u8] = b"<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>";
const S_HEAD_1: &[u8] = b"</title><style>body{font:16px system-ui;margin:24px;color:#172033;background:#f8fafc}section[data-grid]{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}article{background:white;border:1px solid #cbd5e1;padding:12px;border-radius:6px}dl>div{display:flex;justify-content:space-between}dt,dd{margin:0}footer{display:flex;gap:12px}</style></head><body><main data-token=\"";
const S_HEAD_2: &[u8] = b"\"><h1>";
const S_HEAD_3: &[u8] = b"</h1><section data-grid=\"\">";
const S_ROW_0: &[u8] = b"<article data-row=\"";
const S_ROW_1: &[u8] = b"\" data-state=\"even\"><header><h2>Record</h2><p>Static description and supporting HTML.</p></header><section><dl><div><dt>Field 0</dt><dd>";
const S_ROW_F: [&[u8]; 9] = [
    b"</dd></div><div><dt>Field 1</dt><dd>",
    b"</dd></div><div><dt>Field 2</dt><dd>",
    b"</dd></div><div><dt>Field 3</dt><dd>",
    b"</dd></div><div><dt>Field 4</dt><dd>",
    b"</dd></div><div><dt>Field 5</dt><dd>",
    b"</dd></div><div><dt>Field 6</dt><dd>",
    b"</dd></div><div><dt>Field 7</dt><dd>",
    b"</dd></div><div><dt>Field 8</dt><dd>",
    b"</dd></div><div><dt>Field 9</dt><dd>",
];
const S_ROW_END: &[u8] = b"</dd></div></dl></section><footer><button type=\"button\" disabled>Increment</button><label>Selected<input type=\"checkbox\" readonly></label></footer></article>";
// renderPage tail + server.ts `res.end("<!--complete-->")`.
const S_TAIL: &[u8] = b"</section></main><!--complete--></body></html><!--complete-->";

#[derive(Debug)]
pub struct RenderError(&'static str);
impl std::fmt::Display for RenderError {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        f.write_str(self.0)
    }
}
impl std::error::Error for RenderError {}

/// `function Row({ row })` — the guard is the component's own `throw`.
#[inline]
fn row_component(b: &mut BytesMut, row: &Row) -> Result<(), RenderError> {
    if row.len() != 10 {
        return Err(RenderError("A row requires ten field values"));
    }
    b.extend_from_slice(S_ROW_0);
    rt::int(b, row.id); // attribute hole, static type number → no escape scan
    b.extend_from_slice(S_ROW_1);
    rt::text_value(b, row.value(0));
    for i in 0..9 {
        b.extend_from_slice(S_ROW_F[i]);
        rt::text_value(b, row.value(i + 1));
    }
    b.extend_from_slice(S_ROW_END);
    Ok(())
}

thread_local! {
    static POOL: RefCell<Vec<BytesMut>> = const { RefCell::new(Vec::new()) };
}
fn take_buffer() -> BytesMut {
    POOL.with(|p| p.borrow_mut().pop()).unwrap_or_else(|| BytesMut::with_capacity(CHUNK + 4096))
}
fn give_buffer(mut b: BytesMut) {
    b.clear();
    // `reserve` reclaims the original allocation once every frozen chunk has been written and dropped.
    b.reserve(CHUNK + 4096);
    POOL.with(|p| {
        let mut p = p.borrow_mut();
        if p.len() < 256 {
            p.push(b)
        }
    });
}

/// Resumable page renderer: `next_chunk` emits until CHUNK bytes or the end.
pub struct PageRender<P: Borrow<Page>> {
    page: P,
    pos: usize, // 0 = shell head, 1..=rows = row pos-1, rows+1 = tail, beyond = done
    buf: Option<BytesMut>,
}

impl<P: Borrow<Page>> PageRender<P> {
    pub fn new(page: P) -> Self {
        PageRender { page, pos: 0, buf: Some(take_buffer()) }
    }
    pub fn done(&self) -> bool {
        self.pos > self.page.borrow().rows.len() + 1
    }
    pub fn next_chunk(&mut self) -> Result<Option<Bytes>, RenderError> {
        let page = self.page.borrow();
        let rows = page.rows.len();
        if self.pos > rows + 1 {
            return Ok(None);
        }
        let b = self.buf.as_mut().expect("buffer");
        b.reserve(CHUNK + 4096);
        while self.pos <= rows + 1 {
            if self.pos == 0 {
                b.extend_from_slice(S_HEAD_0);
                rt::text(b, &page.title);
                b.extend_from_slice(S_HEAD_1);
                rt::attr(b, &page.token);
                b.extend_from_slice(S_HEAD_2);
                rt::text(b, &page.title);
                b.extend_from_slice(S_HEAD_3);
            } else if self.pos == rows + 1 {
                b.extend_from_slice(S_TAIL);
            } else {
                row_component(b, &page.rows[self.pos - 1])?;
            }
            self.pos += 1;
            if b.len() >= CHUNK {
                break;
            }
        }
        Ok(Some(b.split().freeze()))
    }
}

impl<P: Borrow<Page>> Drop for PageRender<P> {
    fn drop(&mut self) {
        if let Some(b) = self.buf.take() {
            give_buffer(b)
        }
    }
}
