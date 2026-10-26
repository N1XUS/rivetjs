//! PLACE cost model (spec §4): the expected cost of one page view under an assignment of backends, in milliseconds of
//! client time (server CPU converted by `server_ms_per_us`). The page is simulated with the runtime's own rules
//! (`server-derived.ts` record keeping, `dom-derived.ts` adopt climb), so the model prices what the runtime does:
//!
//! - an instance is independent when its component is (fixpoint), when it is a root, or when its call site uses `site`;
//!   context-free when `free` or `site`;
//! - a record is kept for a boundary with a source of its own, or live inputs (a `live` callee at a call that is not
//!   data-only: literal props are static, `COND` per instance), or with a dependent kept boundary below it; an
//!   independent kept child never keeps its parent;
//! - the client fetches the chunks of every module in the subtree of a top kept record (the adopt runs the components'
//!   DOM functions; `data-fo` fetch-ahead loads them), plus the runtime (lite when every kept record is independent and
//!   lite, else full; none without records);
//! - a first interaction on a source instance adopts from its record up to the first independent context-free record
//!   (the intake-3 "enclosing records" rule; dependent records climb to their kept ancestor): the work is that record's
//!   subtree (elements, records), averaged over the page's source instances, times `p_interact`;
//! - state bytes = kept independent records × `record_bytes` + dependent ones × `dependent_record_bytes` + props of
//!   independent records (`props_ratio` × call-site props bytes); a `site` at a call with element children is demoted by
//!   the server (its props are not data) and prices as `with-parent`;
//!   HTML bytes are priced by `html_ms_per_byte`, chunk source bytes by `js_ms_per_byte` (both carry the network profile,
//!   compression and parse ratios, `scripts/place/calibrate.ts`).
//!
//! The heuristic table (`kind: "heuristic"`) prices nothing but a constant `site_bonus` per `site` choice: today's rule
//! "use every proven site" is its unique optimum.

use serde::{Deserialize, Serialize};

use super::ir::{Graph, PageTree};

#[derive(Deserialize, Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct Table {
    /// `heuristic` (today's rules) | `measured` (calibrated) | `custom`.
    pub kind: String,
    /// Per `site` choice (negative cost). Heuristic: 1; measured: 0.
    pub site_bonus: f64,
    /// ms per raw HTML byte (state / records): transfer under the profile × HTML compression ratio.
    pub html_ms_per_byte: f64,
    /// ms per module source byte of a fetched chunk: compiled-gz-bytes ratio × transfer + compiled-raw ratio × parse.
    pub js_ms_per_byte: f64,
    /// ms for the lite / full runtime (transfer + parse), when a page has records.
    pub runtime_lite_ms: f64,
    pub runtime_full_ms: f64,
    /// Raw tail bytes of one kept independent record (id, parent, flags, unit, props slot) / of one dependent record
    /// (no props: sibling runs of one unit share an entry, tail v2).
    pub record_bytes: f64,
    pub dependent_record_bytes: f64,
    /// Recorded props bytes per call-site props source byte.
    pub props_ratio: f64,
    /// First-interaction adopt cost per element / per record of the adopted subtree.
    pub adopt_ms_per_element: f64,
    pub adopt_ms_per_record: f64,
    /// Probability that a page view interacts at all (interaction frequency prior).
    pub p_interact: f64,
    /// Server render cost per kept record / per state byte (µs), and its weight in client ms per µs.
    pub server_us_per_record: f64,
    pub server_us_per_state_byte: f64,
    pub server_ms_per_us: f64,
}

impl Default for Table {
    fn default() -> Self {
        Table::heuristic()
    }
}

impl Table {
    /// Today's hand-made rules as a cost table.
    pub fn heuristic() -> Table {
        Table {
            kind: "heuristic".into(),
            site_bonus: 1.0,
            html_ms_per_byte: 0.0,
            js_ms_per_byte: 0.0,
            runtime_lite_ms: 0.0,
            runtime_full_ms: 0.0,
            record_bytes: 0.0,
            dependent_record_bytes: 0.0,
            props_ratio: 0.0,
            adopt_ms_per_element: 0.0,
            adopt_ms_per_record: 0.0,
            p_interact: 0.0,
            server_us_per_record: 0.0,
            server_us_per_state_byte: 0.0,
            server_ms_per_us: 0.0,
        }
    }

    /// Prices pages at all (the heuristic table does not: only the per-choice bonus).
    pub fn prices_pages(&self) -> bool {
        [
            self.html_ms_per_byte,
            self.js_ms_per_byte,
            self.runtime_lite_ms,
            self.runtime_full_ms,
            self.adopt_ms_per_element * self.p_interact,
            self.adopt_ms_per_record * self.p_interact,
            self.server_ms_per_us,
        ]
        .iter()
        .any(|v| *v != 0.0)
    }
}

/// Decision-independent facts of one page tree.
pub struct Prepared {
    /// Subtree size (instances, preorder ranges) and subtree elements per instance.
    pub size: Vec<u32>,
    pub elements: Vec<u64>,
    /// Source instances (first-interaction targets).
    pub targets: Vec<u32>,
}

pub fn prepare(g: &Graph, tree: &PageTree) -> Prepared {
    let n = tree.instances.len();
    let mut size = vec![1u32; n];
    let mut elements = vec![0u64; n];
    for i in (0..n).rev() {
        let inst = &tree.instances[i];
        elements[i] += g.components[inst.component as usize].elements as u64;
        if let Some(p) = inst.parent {
            size[p as usize] += size[i];
            elements[p as usize] += elements[i];
        }
    }
    let targets = (0..n as u32)
        .filter(|&i| {
            let c = &g.components[tree.instances[i as usize].component as usize];
            c.interactive && c.source
        })
        .collect();
    Prepared { size, elements, targets }
}

/// Cost breakdown of one page view (unweighted).
#[derive(Serialize, Default, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Breakdown {
    pub records: u32,
    pub state_bytes: f64,
    /// Source bytes of the fetched modules.
    pub js_bytes: u64,
    /// 0 none, 1 lite, 2 full.
    pub runtime: u8,
    /// Expected adopted elements / records at the first interaction.
    pub adopt_elements: f64,
    pub adopt_records: f64,
    pub server_us: f64,
    pub ms: f64,
}

/// Scratch buffers reused across evaluations.
#[derive(Default)]
pub struct Scratch {
    indep: Vec<bool>,
    ctxfree: Vec<bool>,
    kept: Vec<bool>,
    kept_prefix: Vec<u32>,
    module_seen: Vec<bool>,
    touched: Vec<u32>,
}

/// Evaluate one page under `site_on` (per site index: the `site` backend chosen).
pub fn eval_page(g: &Graph, tree: &PageTree, prep: &Prepared, site_on: &[bool], t: &Table, s: &mut Scratch) -> Breakdown {
    let n = tree.instances.len();
    let mut b = Breakdown::default();
    if n == 0 {
        return b;
    }
    s.indep.clear();
    s.ctxfree.clear();
    s.kept.clear();
    s.indep.resize(n, false);
    s.ctxfree.resize(n, false);
    s.kept.resize(n, false);
    for (i, inst) in tree.instances.iter().enumerate() {
        let c = &g.components[inst.component as usize];
        let on = inst.site.is_some_and(|x| site_on.get(x as usize).copied().unwrap_or(false) && !g.sites[x as usize].demoted);
        s.indep[i] = c.root || c.independent || on;
        s.ctxfree[i] = (c.independent && c.free) || on;
    }
    // Kept records (reverse preorder: children first).
    for i in (0..n).rev() {
        let inst = &tree.instances[i];
        let c = &g.components[inst.component as usize];
        if !c.interactive {
            continue;
        }
        let below = inst.children.iter().any(|&j| {
            let cj = &g.components[tree.instances[j as usize].component as usize];
            cj.interactive && !s.indep[j as usize] && s.kept[j as usize]
        });
        let live = c.live && inst.site.map_or(true, |x| !g.sites[x as usize].data);
        s.kept[i] = c.source || live || below;
    }
    s.kept_prefix.clear();
    s.kept_prefix.push(0);
    let mut all_lite = true;
    for i in 0..n {
        let k = s.kept[i];
        s.kept_prefix.push(s.kept_prefix[i] + k as u32);
        if !k {
            continue;
        }
        let inst = &tree.instances[i];
        let c = &g.components[inst.component as usize];
        b.records += 1;
        b.state_bytes += if s.indep[i] { t.record_bytes } else { t.dependent_record_bytes };
        if s.indep[i] && !c.root {
            if let Some(site) = inst.site {
                b.state_bytes += t.props_ratio * g.sites[site as usize].bytes as f64;
            }
        }
        if !(c.lite && s.indep[i]) {
            all_lite = false;
        }
    }
    // Chunks: modules in the subtrees of top kept records.
    if s.module_seen.len() < g.modules.len() {
        s.module_seen.resize(g.modules.len(), false);
    }
    s.touched.clear();
    let mut i = 0usize;
    while i < n {
        if s.kept[i] {
            let end = i + prep.size[i] as usize;
            for j in i..end {
                let m = g.components[tree.instances[j].component as usize].module as usize;
                if m < s.module_seen.len() && !s.module_seen[m] {
                    s.module_seen[m] = true;
                    s.touched.push(m as u32);
                    b.js_bytes += g.modules[m].bytes as u64;
                }
            }
            i = end;
        } else {
            i += 1;
        }
    }
    for &m in &s.touched {
        s.module_seen[m as usize] = false;
    }
    b.runtime = if b.records == 0 {
        0
    } else if all_lite {
        1
    } else {
        2
    };
    // First interaction: climb from each target's record.
    if !prep.targets.is_empty() {
        let (mut el, mut rec) = (0f64, 0f64);
        for &target in &prep.targets {
            let mut r = target as usize;
            loop {
                if s.indep[r] && s.ctxfree[r] {
                    break;
                }
                let mut p = tree.instances[r].parent;
                while let Some(x) = p {
                    if s.kept[x as usize] {
                        break;
                    }
                    p = tree.instances[x as usize].parent;
                }
                match p {
                    Some(x) => r = x as usize,
                    None => break,
                }
            }
            el += prep.elements[r] as f64;
            rec += (s.kept_prefix[r + prep.size[r] as usize] - s.kept_prefix[r]) as f64;
        }
        b.adopt_elements = el / prep.targets.len() as f64;
        b.adopt_records = rec / prep.targets.len() as f64;
    }
    b.server_us = b.records as f64 * t.server_us_per_record + b.state_bytes * t.server_us_per_state_byte;
    let runtime_ms = match b.runtime {
        1 => t.runtime_lite_ms,
        2 => t.runtime_full_ms,
        _ => 0.0,
    };
    b.ms = t.html_ms_per_byte * b.state_bytes
        + t.js_ms_per_byte * b.js_bytes as f64
        + runtime_ms
        + t.p_interact * (t.adopt_ms_per_element * b.adopt_elements + t.adopt_ms_per_record * b.adopt_records)
        + t.server_ms_per_us * b.server_us;
    b
}
