//! Subtree containment for list eligibility (`Resumed::has_site_within`), built on first query only
//! (server list lowering; DOM-only compiles never allocate it). Ported from codex/hybrid-resume-hydration.
use super::{Resumed, SiteKind};
use crate::tree::Tree;

/// Non-Props site and ref-cell spans as `(start, min end over this and every later start)`, sorted by start.
/// A query `[lo, hi]` contains some span iff the first entry with `start >= lo` has a suffix-minimum end `<= hi`
/// (same inclusive bounds as the previous linear scan). O(n log n) build, O(log n) query.
pub(super) fn build(resumed: &Resumed, tree: &Tree) -> Vec<(u32, u32)> {
    let mut bounds: Vec<(u32, u32)> = resumed
        .map
        .iter()
        .filter(|&(_, site)| resumed.sites[site].kind != SiteKind::Props)
        .map(|(node, _)| node)
        .chain(resumed.ref_cells.iter().copied())
        // T10 fix 1 (F1): group sites have no map key; their members' declarations stand for them.
        .chain(resumed.group_of.keys().copied())
        .map(|node| {
            let span = tree.span(node);
            (span.start, span.end)
        })
        .collect();
    bounds.sort_unstable_by_key(|&(start, _)| start);
    let mut end = u32::MAX;
    for (_, value) in bounds.iter_mut().rev() {
        end = end.min(*value);
        *value = end;
    }
    bounds
}
