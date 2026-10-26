//! PLACE decision algorithm (spec §5). Variables: the call sites with more than one legal backend. The objective is
//! separable by page; a variable touches the pages whose instance trees hold it. Regions = connected components of the
//! variable–page incidence graph: a region with at most `EXACT` variables is solved exactly (enumeration), a larger one by
//! local search (single flips, then group flips of every variable with the same caller / callee — the fixed charges of a
//! parent record and of a page runtime need all of a group at once) from two starts: today's assignment and the
//! conservative one (no `site`). The search accepts strictly improving moves only, so the result never costs more than
//! today's assignment under the table; ties keep today's choice.

use super::cost::{Breakdown, Prepared, Scratch, Table, eval_page};
use super::ir::{Graph, PageTree};

/// Regions up to this many variables are enumerated (2^EXACT assignments × the region's pages).
pub const EXACT: usize = 12;
/// …and only while 2^k × the region's pages stays below this many page evaluations.
pub const EXACT_WORK: u64 = 1 << 18;
const MAX_PASSES: usize = 50;
const EPS: f64 = 1e-9;

pub struct Problem<'g> {
    pub g: &'g Graph,
    pub trees: Vec<PageTree>,
    pub prep: Vec<Prepared>,
    /// Variable → site index.
    pub vars: Vec<u32>,
    /// Variable → pages holding it.
    pub pages_of: Vec<Vec<u32>>,
    pub table: &'g Table,
}

pub struct Solution {
    /// Per site index: `site` chosen.
    pub site_on: Vec<bool>,
    pub method: &'static str,
    pub regions: usize,
    pub largest_region: usize,
    pub evaluations: u64,
    pub cost_today: f64,
    pub cost_chosen: f64,
    pub cost_conservative: f64,
}

struct Eval<'p, 'g> {
    p: &'p Problem<'g>,
    scratch: Scratch,
    page_ms: Vec<f64>,
    evaluations: u64,
}

impl<'p, 'g> Eval<'p, 'g> {
    fn page(&mut self, page: usize, site_on: &[bool]) -> Breakdown {
        self.evaluations += 1;
        eval_page(self.p.g, &self.p.trees[page], &self.p.prep[page], site_on, self.p.table, &mut self.scratch)
    }
    fn weighted(&mut self, page: usize, site_on: &[bool]) -> f64 {
        let w = self.p.g.pages[page].weight;
        w * self.page(page, site_on).ms
    }
    /// Full objective (pages + per-choice bonus).
    fn total(&mut self, site_on: &[bool]) -> f64 {
        let mut sum = 0.0;
        if self.p.table.prices_pages() {
            for page in 0..self.p.trees.len() {
                sum += self.weighted(page, site_on);
            }
        }
        sum - self.p.table.site_bonus * self.p.vars.iter().filter(|&&v| site_on[v as usize]).count() as f64
    }
    /// Objective change of flipping `vars` (variable ids), evaluated on their pages only.
    fn delta(&mut self, site_on: &mut [bool], vars: &[usize]) -> f64 {
        let mut pages: Vec<u32> = vars.iter().flat_map(|&v| self.p.pages_of[v].iter().copied()).collect();
        pages.sort_unstable();
        pages.dedup();
        let prices = self.p.table.prices_pages();
        let mut before = 0.0;
        if prices {
            for &pg in &pages {
                before += self.page_ms[pg as usize];
            }
        }
        let mut bonus = 0.0;
        for &v in vars {
            let s = self.p.vars[v] as usize;
            bonus += if site_on[s] { self.p.table.site_bonus } else { -self.p.table.site_bonus };
            site_on[s] = !site_on[s];
        }
        let mut after = 0.0;
        if prices {
            for &pg in &pages {
                after += self.weighted(pg as usize, site_on);
            }
        }
        // Restore; the caller re-applies an accepted move.
        for &v in vars {
            let s = self.p.vars[v] as usize;
            site_on[s] = !site_on[s];
        }
        after - before + bonus
    }
    fn apply(&mut self, site_on: &mut [bool], vars: &[usize]) {
        for &v in vars {
            let s = self.p.vars[v] as usize;
            site_on[s] = !site_on[s];
        }
        if self.p.table.prices_pages() {
            let mut pages: Vec<u32> = vars.iter().flat_map(|&v| self.p.pages_of[v].iter().copied()).collect();
            pages.sort_unstable();
            pages.dedup();
            for pg in pages {
                self.page_ms[pg as usize] = self.weighted(pg as usize, site_on);
            }
        }
    }
    fn reset_cache(&mut self, site_on: &[bool]) {
        self.page_ms = vec![0.0; self.p.trees.len()];
        if self.p.table.prices_pages() {
            for pg in 0..self.p.trees.len() {
                self.page_ms[pg] = self.weighted(pg, site_on);
            }
        }
    }
}

/// Union-find regions over variables sharing a page.
fn regions(p: &Problem) -> Vec<Vec<usize>> {
    let n = p.vars.len();
    let mut parent: Vec<usize> = (0..n).collect();
    fn find(parent: &mut [usize], x: usize) -> usize {
        let mut r = x;
        while parent[r] != r {
            r = parent[r];
        }
        let mut y = x;
        while parent[y] != r {
            let next = parent[y];
            parent[y] = r;
            y = next;
        }
        r
    }
    let mut first_of_page: Vec<Option<usize>> = vec![None; p.trees.len()];
    for v in 0..n {
        for &pg in &p.pages_of[v] {
            match first_of_page[pg as usize] {
                None => first_of_page[pg as usize] = Some(v),
                Some(u) => {
                    let (a, b) = (find(&mut parent, u), find(&mut parent, v));
                    if a != b {
                        parent[a] = b;
                    }
                }
            }
        }
    }
    let mut groups: Vec<Vec<usize>> = Vec::new();
    let mut index: Vec<Option<usize>> = vec![None; n];
    for v in 0..n {
        let r = find(&mut parent, v);
        let gi = *index[r].get_or_insert_with(|| {
            groups.push(Vec::new());
            groups.len() - 1
        });
        groups[gi].push(v);
    }
    groups
}

/// The objective of one assignment (tests, explain).
pub fn objective(p: &Problem, x: &[bool]) -> f64 {
    let mut e = Eval { p, scratch: Scratch::default(), page_ms: Vec::new(), evaluations: 0 };
    e.total(x)
}

pub fn solve(p: &Problem, today: &[bool]) -> Solution {
    let mut e = Eval { p, scratch: Scratch::default(), page_ms: Vec::new(), evaluations: 0 };
    let mut conservative = today.to_vec();
    for &s in &p.vars {
        conservative[s as usize] = false;
    }
    let cost_today = e.total(today);
    let cost_conservative = e.total(&conservative);
    let groups = regions(p);
    let largest_region = groups.iter().map(Vec::len).max().unwrap_or(0);
    let mut best = today.to_vec();
    let mut all_exact = true;
    e.reset_cache(&best);
    for region in &groups {
        let mut region_pages: Vec<u32> = region.iter().flat_map(|&v| p.pages_of[v].iter().copied()).collect();
        region_pages.sort_unstable();
        region_pages.dedup();
        if region.len() <= EXACT && (region_pages.len() as u64) << region.len() <= EXACT_WORK {
            exact(&mut e, &mut best, region);
        } else {
            all_exact = false;
            // Start A: today's (current `best` on this region). Start B: conservative on this region.
            let mut a = best.clone();
            e.reset_cache(&a);
            search(&mut e, &mut a, region);
            let mut b = best.clone();
            for &v in region {
                b[p.vars[v] as usize] = false;
            }
            e.reset_cache(&b);
            search(&mut e, &mut b, region);
            // Compare the two ends on the region's own pages (the rest of the objective is the same for both).
            let region_cost = |e: &mut Eval, x: &[bool]| -> f64 {
                let mut sum = 0.0;
                if p.table.prices_pages() {
                    for &pg in &region_pages {
                        sum += e.weighted(pg as usize, x);
                    }
                }
                sum - p.table.site_bonus * region.iter().filter(|&&v| x[p.vars[v] as usize]).count() as f64
            };
            let (ra, rb) = (region_cost(&mut e, &a), region_cost(&mut e, &b));
            best = if rb < ra - EPS { b } else { a };
            e.reset_cache(&best);
        }
    }
    let cost_chosen = e.total(&best);
    // Never worse than today's (guard against model quirks in the search: keep today's then).
    let (site_on, cost_chosen) = if cost_chosen > cost_today + EPS { (today.to_vec(), cost_today) } else { (best, cost_chosen) };
    Solution {
        site_on,
        method: if all_exact { "exact" } else { "local-search" },
        regions: groups.len(),
        largest_region,
        evaluations: e.evaluations,
        cost_today,
        cost_chosen,
        cost_conservative,
    }
}

/// Enumerate a small region; ties keep the earliest assignment in enumeration order starting from the current one
/// (mask 0 = current), so today's choice wins a tie.
fn exact(e: &mut Eval, x: &mut [bool], region: &[usize]) {
    let k = region.len();
    if k == 0 {
        return;
    }
    let mut best_mask = 0u32;
    let mut best_delta = 0.0f64;
    let base = x.to_vec();
    for mask in 1u32..(1u32 << k) {
        let flips: Vec<usize> = (0..k).filter(|i| mask & (1 << i) != 0).map(|i| region[i]).collect();
        let mut y = base.clone();
        let d = e.delta(&mut y, &flips);
        if d < best_delta - EPS {
            best_delta = d;
            best_mask = mask;
        }
    }
    if best_mask != 0 {
        let flips: Vec<usize> = (0..k).filter(|i| best_mask & (1 << i) != 0).map(|i| region[i]).collect();
        e.apply(x, &flips);
    }
}

/// Strictly improving local search over single and group flips (from the current `x`).
fn search(e: &mut Eval, x: &mut [bool], region: &[usize]) {
    let p = e.p;
    // Groups: same caller, same callee.
    let mut by_caller: std::collections::BTreeMap<u32, Vec<usize>> = Default::default();
    let mut by_callee: std::collections::BTreeMap<u32, Vec<usize>> = Default::default();
    for &v in region {
        let s = &p.g.sites[p.vars[v] as usize];
        by_caller.entry(s.caller).or_default().push(v);
        by_callee.entry(s.callee).or_default().push(v);
    }
    let mut moves: Vec<Vec<usize>> = region.iter().map(|&v| vec![v]).collect();
    moves.extend(by_caller.into_values().filter(|g| g.len() > 1));
    moves.extend(by_callee.into_values().filter(|g| g.len() > 1));
    for _ in 0..MAX_PASSES {
        let mut improved = false;
        for m in &moves {
            // A group move sets every member to the same value: flip only those not already there (both directions).
            for target in [true, false] {
                let flips: Vec<usize> = if m.len() == 1 {
                    if target != x[p.vars[m[0]] as usize] { m.clone() } else { continue }
                } else {
                    m.iter().copied().filter(|&v| x[p.vars[v] as usize] != target).collect()
                };
                if flips.is_empty() {
                    continue;
                }
                let d = e.delta(x, &flips);
                if d < -EPS {
                    e.apply(x, &flips);
                    improved = true;
                }
            }
        }
        if !improved {
            break;
        }
    }
}
