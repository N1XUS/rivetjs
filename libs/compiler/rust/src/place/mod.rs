//! PLACE (phase 1, spec `docs/design/specs/2026-10-26-automatic-placement-design.md`): automatic code placement over the
//! backends that exist on main. Op `place { graph, table?, explain? }` (`lib.rs`): the build (`libs/compiler/place.ts`)
//! hands the whole-program graph (`ir.rs`), legality maps facts to backend sets (`legal.rs`), the cost model prices page
//! views (`cost.rs`), the solver picks per node (`solve.rs`). Phase 1 decision variables: the proven call sites of
//! `site_capable` components (`site` vs `with-parent`); component backends are fixed (dominance / fixpoint) and reported.
//! With the heuristic table the result is today's verdicts exactly (every proven site uses `site`).

mod cost;
mod ir;
mod legal;
mod solve;

use serde::Deserialize;
use serde_json::{Value, json};

use cost::{Breakdown, Scratch, Table, eval_page, prepare};
use ir::Graph;
use legal::{SiteBackend, component_backend, site_legal};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Request {
    pub graph: Graph,
    #[serde(default)]
    pub table: Option<Table>,
    #[serde(default)]
    pub explain: bool,
    /// Evaluate this assignment (per site: `site` chosen) instead of solving: `{ cost }` (tests: brute force).
    #[serde(default)]
    pub evaluate: Option<Vec<bool>>,
}

pub fn run(request: Request) -> Value {
    let g = &request.graph;
    let table = request.table.unwrap_or_default();
    let by_caller = g.sites_by_caller();
    let legal: Vec<(Vec<SiteBackend>, &'static str)> = g.sites.iter().map(|s| site_legal(g, s)).collect();
    let today: Vec<bool> = legal.iter().map(|(set, _)| set.contains(&SiteBackend::Site)).collect();
    let mut var_of: Vec<Option<usize>> = vec![None; g.sites.len()];
    let mut vars: Vec<u32> = Vec::new();
    for (i, (set, _)) in legal.iter().enumerate() {
        if set.len() > 1 {
            var_of[i] = Some(vars.len());
            vars.push(i as u32);
        }
    }
    let trees: Vec<_> = g.pages.iter().map(|p| g.expand(p, &by_caller)).collect();
    let prep: Vec<_> = trees.iter().map(|t| prepare(g, t)).collect();
    let mut pages_of: Vec<Vec<u32>> = vec![Vec::new(); vars.len()];
    for (pi, t) in trees.iter().enumerate() {
        for inst in &t.instances {
            if let Some(v) = inst.site.and_then(|s| var_of[s as usize]) {
                if pages_of[v].last() != Some(&(pi as u32)) {
                    pages_of[v].push(pi as u32);
                }
            }
        }
    }
    for list in &mut pages_of {
        list.sort_unstable();
        list.dedup();
    }
    let problem = solve::Problem { g, trees, prep, vars, pages_of, table: &table };
    if let Some(assignment) = &request.evaluate {
        let mut x = today.clone();
        for &v in &problem.vars {
            x[v as usize] = assignment.get(v as usize).copied().unwrap_or(false);
        }
        return json!({ "cost": solve::objective(&problem, &x) });
    }
    let solution = solve::solve(&problem, &today);
    let truncated = problem.trees.iter().filter(|t| t.truncated).count();
    let mut out = json!({
        "sites": solution.site_on.clone(),
        "legal": today,
        "method": solution.method,
        "variables": problem.vars.len(),
        "regions": solution.regions,
        "largestRegion": solution.largest_region,
        "evaluations": solution.evaluations,
        "pages": problem.trees.len(),
        "truncatedPages": truncated,
        "instances": problem.trees.iter().map(|t| t.instances.len()).sum::<usize>(),
        "cost": { "today": solution.cost_today, "chosen": solution.cost_chosen, "conservative": solution.cost_conservative },
        "table": table.kind,
    });
    if request.explain {
        out["explain"] = explain(&problem, &solution.site_on, &legal);
    }
    out
}

/// Per page totals and per variable marginals (what flipping it alone would change, summed over its pages).
fn explain(p: &solve::Problem, chosen: &[bool], legal: &[(Vec<SiteBackend>, &'static str)]) -> Value {
    let g = p.g;
    let mut scratch = Scratch::default();
    let mut page_rows = Vec::new();
    let mut base: Vec<Breakdown> = Vec::new();
    for (i, t) in p.trees.iter().enumerate() {
        let b = eval_page(g, t, &p.prep[i], chosen, p.table, &mut scratch);
        page_rows.push(json!({ "page": g.pages[i].id, "instances": t.instances.len(), "truncated": t.truncated, "cost": b }));
        base.push(b);
    }
    let mut sites = Vec::new();
    for (i, s) in g.sites.iter().enumerate() {
        let (set, why) = &legal[i];
        let Some(v) = p.vars.iter().position(|&x| x as usize == i) else {
            if set.len() == 1 && g.components.get(s.callee as usize).is_some_and(|c| c.interactive) {
                sites.push(json!({ "site": i, "backend": set[0].name(), "legal": [set[0].name()], "why": why }));
            }
            continue;
        };
        let mut flipped = chosen.to_vec();
        flipped[i] = !flipped[i];
        let (mut d_state, mut d_js, mut d_el, mut d_rec, mut d_records, mut d_ms, mut d_server) = (0f64, 0i64, 0f64, 0f64, 0i64, 0f64, 0f64);
        for &pg in &p.pages_of[v] {
            let pg = pg as usize;
            let b = eval_page(g, &p.trees[pg], &p.prep[pg], &flipped, p.table, &mut scratch);
            let a = &base[pg];
            let w = g.pages[pg].weight;
            d_state += b.state_bytes - a.state_bytes;
            d_js += b.js_bytes as i64 - a.js_bytes as i64;
            d_el += b.adopt_elements - a.adopt_elements;
            d_rec += b.adopt_records - a.adopt_records;
            d_records += b.records as i64 - a.records as i64;
            d_server += b.server_us - a.server_us;
            d_ms += w * (b.ms - a.ms);
        }
        let bonus = if chosen[i] { p.table.site_bonus } else { -p.table.site_bonus };
        let backend = if chosen[i] { SiteBackend::Site } else { SiteBackend::WithParent };
        let other = if chosen[i] { SiteBackend::WithParent } else { SiteBackend::Site };
        sites.push(json!({
            "site": i,
            "backend": backend.name(),
            "legal": set.iter().map(|b| b.name()).collect::<Vec<_>>(),
            "why": why,
            "pages": p.pages_of[v].len(),
            // Switching to `other` would change (positive = worse):
            "ifOther": {
                "backend": other.name(),
                "ms": d_ms + bonus,
                "records": d_records,
                "stateBytes": d_state,
                "jsSourceBytes": d_js,
                "adoptElements": d_el,
                "adoptRecords": d_rec,
                "serverUs": d_server,
            },
        }));
    }
    let components: Vec<Value> = g
        .components
        .iter()
        .enumerate()
        .map(|(i, c)| {
            let (backend, why) = component_backend(c);
            json!({ "component": i, "backend": backend, "why": why })
        })
        .collect();
    json!({ "pages": page_rows, "sites": sites, "components": components })
}
