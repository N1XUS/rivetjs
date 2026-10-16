//! THROWAWAY SPIKE — native Rust SSR lane for apps/ssr-bench (same contract as server.ts: /page, /health, /metrics).
//!
//! Env: PORT (8080), GRPC_URL (http://backend:8081), LANE (label), WORKERS (1 = tokio current_thread, N = multi_thread),
//! INPUT = proto (default: protobuf → structs → render) | json-serde | json-simd (protobuf → JSON string, standing in for
//! the string a JS loader would hand over → parse → render; serialize time is counted separately as serializeMs).
//! `rust-ceiling bench` = in-process single-thread micro-bench (render / JSON / protobuf decode ns per page).
mod page;
mod render;

use bytes::Bytes;
use http::uri::PathAndQuery;
use http::{Request, Response, StatusCode};
use http_body::{Body, Frame};
use http_body_util::{BodyExt, Full, combinators::BoxBody};
use hyper::body::Incoming;
use hyper::server::conn::http1;
use hyper::service::service_fn;
use hyper_util::rt::TokioIo;
use page::{Page, PageRequest};
use render::PageRender;
use std::convert::Infallible;
use std::pin::Pin;
use std::sync::OnceLock;
use std::sync::atomic::{AtomicU64, Ordering::Relaxed};
use std::task::{Context, Poll};
use std::time::{Duration, Instant};
use tonic::client::Grpc;
use tonic::codec::ProstCodec;
use tonic::transport::Channel;

type BoxError = Box<dyn std::error::Error + Send + Sync>;
type ResBody = BoxBody<Bytes, BoxError>;

static COMPLETED: AtomicU64 = AtomicU64::new(0);
static FAILED: AtomicU64 = AtomicU64::new(0);
static CANCELLED: AtomicU64 = AtomicU64::new(0);
static RPC_NS: AtomicU64 = AtomicU64::new(0);
static SERIALIZE_NS: AtomicU64 = AtomicU64::new(0);
static PARSE_NS: AtomicU64 = AtomicU64::new(0);
static RENDER_NS: AtomicU64 = AtomicU64::new(0);

#[derive(Clone, Copy, PartialEq, Debug)]
enum Input {
    Proto,
    JsonSerde,
    JsonSimd,
}
struct Config {
    lane: String,
    workers: usize,
    input: Input,
}
static CONFIG: OnceLock<Config> = OnceLock::new();
fn config() -> &'static Config {
    CONFIG.get().unwrap()
}

/// Streaming response body: one resumable render step per poll (hyper polls only when the socket can take more).
struct PageBody {
    render: PageRender<Page>,
    finished: bool,
}
impl Body for PageBody {
    type Data = Bytes;
    type Error = BoxError;
    fn poll_frame(self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<Option<Result<Frame<Bytes>, BoxError>>> {
        let this = self.get_mut();
        let start = Instant::now();
        let next = this.render.next_chunk();
        RENDER_NS.fetch_add(start.elapsed().as_nanos() as u64, Relaxed);
        Poll::Ready(match next {
            Ok(Some(chunk)) => {
                if this.render.done() && !this.finished {
                    this.finished = true;
                    COMPLETED.fetch_add(1, Relaxed);
                }
                Some(Ok(Frame::data(chunk)))
            }
            Ok(None) => None,
            Err(e) => {
                this.finished = true;
                FAILED.fetch_add(1, Relaxed);
                Some(Err(Box::new(e)))
            }
        })
    }
    fn is_end_stream(&self) -> bool {
        self.render.done()
    }
}
impl Drop for PageBody {
    fn drop(&mut self) {
        if !self.finished {
            CANCELLED.fetch_add(1, Relaxed);
        }
    }
}

fn full(status: StatusCode, content_type: &'static str, body: impl Into<Bytes>) -> Response<ResBody> {
    let mut res = Response::new(Full::new(body.into()).map_err(|never: Infallible| match never {}).boxed());
    *res.status_mut() = status;
    if !content_type.is_empty() {
        res.headers_mut().insert(http::header::CONTENT_TYPE, http::HeaderValue::from_static(content_type));
    }
    res
}

fn rss_bytes() -> u64 {
    std::fs::read_to_string("/proc/self/statm")
        .ok()
        .and_then(|s| s.split_whitespace().nth(1).and_then(|v| v.parse::<u64>().ok()))
        .map(|pages| pages * 4096)
        .unwrap_or(0)
}

async fn get_page(mut grpc: Grpc<Channel>, request: PageRequest) -> Result<Page, BoxError> {
    grpc.ready().await?;
    let mut req = tonic::Request::new(request);
    req.set_timeout(Duration::from_secs(15));
    let codec: ProstCodec<PageRequest, Page> = ProstCodec::default();
    Ok(grpc.unary(req, PathAndQuery::from_static("/rivet.bench.Content/GetPage"), codec).await?.into_inner())
}

/// JSON boundary: the loader's result arrives as a JSON string (what a JS loader would produce) and is parsed here.
fn through_json(page: Page, input: Input) -> Result<Page, BoxError> {
    let start = Instant::now();
    let mut json = serde_json::to_vec(&page)?;
    drop(page);
    let parse = Instant::now();
    SERIALIZE_NS.fetch_add((parse - start).as_nanos() as u64, Relaxed);
    let page: Page = match input {
        Input::JsonSimd => simd_json::serde::from_slice(&mut json)?,
        _ => serde_json::from_slice(&json)?,
    };
    PARSE_NS.fetch_add(parse.elapsed().as_nanos() as u64, Relaxed);
    Ok(page)
}

async fn handle(req: Request<Incoming>, grpc: Grpc<Channel>) -> Result<Response<ResBody>, Infallible> {
    let cfg = config();
    match req.uri().path() {
        "/health" => {
            let body = format!(
                "{{\"status\":\"ready\",\"framework\":\"{}\",\"version\":\"{}\",\"variant\":\"stream\",\"implementation\":\"hand-written native Rust (spike): hyper 1 + tokio {} + tonic, input={:?}, workers={}\",\"outputMode\":\"stream\"}}",
                cfg.lane,
                env!("CARGO_PKG_VERSION"),
                if cfg.workers <= 1 { "current_thread" } else { "multi_thread" },
                cfg.input,
                cfg.workers
            );
            return Ok(full(StatusCode::OK, "application/json", body));
        }
        "/metrics" => {
            let ms = |a: &AtomicU64| a.load(Relaxed) as f64 / 1e6;
            let body = format!(
                "{{\"completed\":{},\"failed\":{},\"cancelled\":{},\"rpcMs\":{},\"serializeMs\":{},\"parseMs\":{},\"renderMs\":{},\"rss\":{}}}",
                COMPLETED.load(Relaxed),
                FAILED.load(Relaxed),
                CANCELLED.load(Relaxed),
                ms(&RPC_NS),
                ms(&SERIALIZE_NS),
                ms(&PARSE_NS),
                ms(&RENDER_NS),
                rss_bytes()
            );
            return Ok(full(StatusCode::OK, "application/json", body));
        }
        "/page" => {}
        _ => return Ok(full(StatusCode::NOT_FOUND, "", Bytes::new())),
    }
    // Same parameter contract as server.ts (URLSearchParams semantics).
    let (mut rows, mut delay, mut token, mut article, mut strings) = (Some(100i64), Some(0i64), String::new(), false, false);
    for (k, v) in form_urlencoded::parse(req.uri().query().unwrap_or("").as_bytes()) {
        match &*k {
            "rows" => rows = v.parse().ok(),
            "delay_ms" => delay = v.parse().ok(),
            "token" => token = v.into_owned(),
            "article" => article = v == "1",
            "strings" => strings = v == "1",
            _ => {}
        }
    }
    let (Some(rows), Some(delay)) = (rows, delay) else { return Ok(full(StatusCode::BAD_REQUEST, "", Bytes::new())) };
    // article=1 needs a markdown renderer (marked in the Node lanes): out of scope for a template-only native target.
    if !(0..=5000).contains(&rows) || !(0..=5000).contains(&delay) || token.encode_utf16().count() > 512 || article {
        return Ok(full(StatusCode::BAD_REQUEST, "", Bytes::new()));
    }
    let start = Instant::now();
    let fetched = get_page(grpc, PageRequest { rows: rows as i32, token, article, delay_ms: delay as i32, strings }).await;
    RPC_NS.fetch_add(start.elapsed().as_nanos() as u64, Relaxed);
    let page = match fetched.and_then(|p| if cfg.input == Input::Proto { Ok(p) } else { through_json(p, cfg.input) }) {
        Ok(p) => p,
        Err(_) => {
            FAILED.fetch_add(1, Relaxed);
            return Ok(full(StatusCode::BAD_GATEWAY, "", "SSR/backend failure"));
        }
    };
    let mut res = Response::new(PageBody { render: PageRender::new(page), finished: false }.boxed());
    let h = res.headers_mut();
    h.insert(http::header::CONTENT_TYPE, http::HeaderValue::from_static("text/html; charset=utf-8"));
    h.insert(http::header::CACHE_CONTROL, http::HeaderValue::from_static("no-store"));
    Ok(res)
}

async fn serve() -> Result<(), BoxError> {
    let grpc_url = std::env::var("GRPC_URL").unwrap_or_else(|_| "http://127.0.0.1:18100".into());
    let grpc_url = if grpc_url.starts_with("http") { grpc_url } else { format!("http://{grpc_url}") };
    let channel = Channel::from_shared(grpc_url)?.connect_lazy();
    let grpc = Grpc::new(channel).max_decoding_message_size(16 * 1024 * 1024);
    let port: u16 = std::env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8080);
    let listener = tokio::net::TcpListener::bind(("0.0.0.0", port)).await?;
    println!("SSR {} listening (workers={}, input={:?})", config().lane, config().workers, config().input);
    loop {
        let (stream, _) = listener.accept().await?;
        let _ = stream.set_nodelay(true);
        let grpc = grpc.clone();
        tokio::spawn(async move {
            let svc = service_fn(move |req| handle(req, grpc.clone()));
            let _ = http1::Builder::new().serve_connection(TokioIo::new(stream), svc).await;
        });
    }
}

// ---------------- in-process micro-bench (single thread) ----------------
fn time_ns<F: FnMut()>(mut f: F) -> f64 {
    // Calibrate to ~50 ms batches; median of 15 batches.
    let mut n = 1usize;
    loop {
        let t = Instant::now();
        for _ in 0..n {
            f()
        }
        if t.elapsed() > Duration::from_millis(50) {
            break;
        }
        n *= 2;
    }
    let mut samples: Vec<f64> = (0..15)
        .map(|_| {
            let t = Instant::now();
            for _ in 0..n {
                f()
            }
            t.elapsed().as_nanos() as f64 / n as f64
        })
        .collect();
    samples.sort_by(|a, b| a.partial_cmp(b).unwrap());
    samples[7]
}

fn bench() {
    use prost::Message;
    println!("{{\"bench\":[");
    let mut first = true;
    for strings in [false, true] {
        for rows in [100, 1000] {
            let page = page::fixture(rows, "trial-0", strings);
            let mut bytes = 0usize;
            let render = time_ns(|| {
                let mut r = PageRender::new(&page);
                bytes = 0;
                while let Some(c) = r.next_chunk().unwrap() {
                    bytes += c.len();
                    std::hint::black_box(c);
                }
            });
            let json = serde_json::to_vec(&page).unwrap();
            let serialize = time_ns(|| {
                std::hint::black_box(serde_json::to_vec(&page).unwrap());
            });
            let serde_parse = time_ns(|| {
                std::hint::black_box(serde_json::from_slice::<Page>(&json).unwrap());
            });
            let mut scratch = json.clone();
            let simd_parse = time_ns(|| {
                scratch.copy_from_slice(&json);
                std::hint::black_box(simd_json::serde::from_slice::<Page>(&mut scratch).unwrap());
            });
            let copy_only = time_ns(|| {
                scratch.copy_from_slice(&json);
                std::hint::black_box(&scratch);
            });
            let proto = page.encode_to_vec();
            let proto_decode = time_ns(|| {
                std::hint::black_box(Page::decode(proto.as_slice()).unwrap());
            });
            let drop_page = time_ns(|| {
                std::hint::black_box(page.clone());
            });
            if !first {
                println!(",");
            }
            first = false;
            print!(
                "{{\"rows\":{rows},\"strings\":{strings},\"html_bytes\":{bytes},\"json_bytes\":{},\"proto_bytes\":{},\"render_ns\":{render:.0},\"json_serialize_ns\":{serialize:.0},\"serde_json_parse_ns\":{serde_parse:.0},\"simd_json_parse_ns\":{:.0},\"protobuf_decode_ns\":{proto_decode:.0},\"clone_drop_ns\":{drop_page:.0}}}",
                json.len(),
                proto.len(),
                simd_parse - copy_only
            );
        }
    }
    println!("\n]}}");
}

fn main() -> Result<(), BoxError> {
    if std::env::args().nth(1).as_deref() == Some("bench") {
        bench();
        return Ok(());
    }
    let workers: usize = std::env::var("WORKERS").ok().and_then(|w| w.parse().ok()).unwrap_or(1);
    let input = match std::env::var("INPUT").as_deref() {
        Ok("json-serde") => Input::JsonSerde,
        Ok("json-simd") => Input::JsonSimd,
        _ => Input::Proto,
    };
    let lane = std::env::var("LANE").unwrap_or_else(|_| "rust-ceiling".into());
    CONFIG.set(Config { lane, workers, input }).ok();
    let rt = if workers <= 1 {
        tokio::runtime::Builder::new_current_thread().enable_all().build()?
    } else {
        tokio::runtime::Builder::new_multi_thread().worker_threads(workers).enable_all().build()?
    };
    rt.block_on(serve())
}
