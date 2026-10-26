//! PLACE graph IR (spec `docs/design/specs/2026-10-26-automatic-placement-design.md` §2): the whole-program graph the
//! build hands the placement pass. Phase 1 nodes are component instances (expanded per page from components + resolved
//! call sites); the decision variables are the backends of nodes whose legal set has more than one member.
//!
//! The graph is built by `libs/compiler/place.ts` from the derived facts fixpoint (`facts-fixpoint.ts`) and the call-site
//! proof (`facts-callsite.ts`): proofs are facts here, legality (`legal.rs`) maps them to backend sets.

use serde::Deserialize;

/// One module of the walk (its chunk is what an adopt of one of its components fetches).
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Module {
    /// File id (read by the build's explain output, not by the solver).
    #[allow(dead_code)]
    pub id: String,
    /// Source bytes (a chunk size feature; `cost.rs` scales it by the calibrated compiled-bytes ratio).
    #[serde(default)]
    pub bytes: u32,
}

/// One component (module-level function) with its derived-model facts.
#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct Component {
    /// `file?Name`.
    pub id: String,
    pub module: u32,
    /// Native elements written in it (`moduleFacts` `elements`).
    pub elements: u32,
    /// A boundary (`BoundaryVerdict.interactive`).
    pub interactive: bool,
    /// A change source of its own (`source` or `listens`): its record is always kept; its instances are first-interaction
    /// targets.
    pub source: bool,
    /// Kept whatever its children do (live props / live context: `because` `live-props` / `live-context`).
    pub live: bool,
    /// `BoundaryVerdict.adopted` (false: `static`, no markers, never adopted).
    pub adopted: bool,
    /// `BoundaryVerdict.independent` (fixed in phase 1).
    pub independent: bool,
    /// ZERO CALLSITE `free` (fixed in phase 1).
    pub free: bool,
    /// Route / derived root (always independent).
    pub root: bool,
    /// A props object parameter and `dependentBecause` `context` / `call-site`: may be independent at a proven site.
    pub site_capable: bool,
    /// The lite runtime can adopt it (a lite symbol; absent before compile: false).
    pub lite: bool,
}

/// One resolved call site (`calls[index]` of `caller`).
#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct Site {
    pub caller: u32,
    pub callee: u32,
    pub index: u32,
    /// Props bytes (`moduleFacts` calls[5]).
    pub bytes: u32,
    /// The call-site context proof result (`facts-callsite.ts` `Unproven` or `proven`; empty: not examined).
    pub proof: String,
    /// The call has element children: the server demotes a `site` instance here (`DEMOTED`), so `site` prices as
    /// `with-parent` (still legal: today's marks include it).
    pub demoted: bool,
    /// Its attributes and expression children are data (`moduleFacts` calls[4] `inputs`; element children are calls of their own). A `live` (conditional) callee instance at a data-only
    /// site is static (props are live only when the caller passes a reactive value): the server drops its record unless a
    /// dependent kept boundary sits below it.
    pub data: bool,
}

/// One page: a root component and its weight (traffic share; default 1).
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Page {
    pub id: String,
    pub root: u32,
    #[serde(default = "one")]
    pub weight: f64,
}

fn one() -> f64 {
    1.0
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct Graph {
    pub modules: Vec<Module>,
    pub components: Vec<Component>,
    pub sites: Vec<Site>,
    pub pages: Vec<Page>,
}

/// One instance of a component on a page (owner tree: the caller that wrote the JSX is the parent).
pub struct Instance {
    pub component: u32,
    pub parent: Option<u32>,
    /// The call site that created it (None: the page root).
    pub site: Option<u32>,
    /// Children, source order.
    pub children: Vec<u32>,
}

/// Instance tree of one page (depth-first preorder: a parent precedes its children).
pub struct PageTree {
    pub instances: Vec<Instance>,
    /// Truncated (depth / size cap): the tree is a prefix, costs are a lower bound. Recursion (a component a third time on
    /// the path) is cut without the flag: its copies past the second are not priced.
    pub truncated: bool,
}

/// Depth and size caps of the expansion (recursive components, very large pages).
pub const MAX_DEPTH: usize = 64;
pub const MAX_INSTANCES: usize = 20_000;
pub const MAX_REPEAT: usize = 2;

impl Graph {
    /// Sites by caller component (source order of `index`).
    pub fn sites_by_caller(&self) -> Vec<Vec<u32>> {
        let mut by = vec![Vec::new(); self.components.len()];
        for (i, s) in self.sites.iter().enumerate() {
            if (s.caller as usize) < by.len() && (s.callee as usize) < self.components.len() {
                by[s.caller as usize].push(i as u32);
            }
        }
        for list in &mut by {
            list.sort_by_key(|&i| self.sites[i as usize].index);
        }
        by
    }

    /// Expand one page into its instance tree. A component already twice on the path (recursion) is not expanded again.
    pub fn expand(&self, page: &Page, by_caller: &[Vec<u32>]) -> PageTree {
        let mut out: Vec<Instance> = Vec::new();
        let mut truncated = false;
        if (page.root as usize) >= self.components.len() {
            return PageTree { instances: out, truncated: true };
        }
        let mut path: Vec<u32> = Vec::new();
        visit(self, by_caller, page.root, None, None, 0, &mut path, &mut out, &mut truncated);
        PageTree { instances: out, truncated }
    }
}

#[allow(clippy::too_many_arguments)]
fn visit(g: &Graph, by: &[Vec<u32>], c: u32, parent: Option<u32>, site: Option<u32>, depth: usize, path: &mut Vec<u32>, out: &mut Vec<Instance>, truncated: &mut bool) {
    if out.len() >= MAX_INSTANCES {
        *truncated = true;
        return;
    }
    let me = out.len() as u32;
    out.push(Instance { component: c, parent, site, children: Vec::new() });
    if let Some(p) = parent {
        out[p as usize].children.push(me);
    }
    if depth >= MAX_DEPTH {
        *truncated = true;
        return;
    }
    path.push(c);
    for &s in &by[c as usize] {
        let callee = g.sites[s as usize].callee;
        // The same component nests legitimately (`<Stack><Stack/></Stack>`); a third copy on the path is recursion.
        if path.iter().filter(|&&c| c == callee).count() >= MAX_REPEAT {
            continue;
        }
        visit(g, by, callee, Some(me), Some(s), depth + 1, path, out, truncated);
    }
    path.pop();
}
