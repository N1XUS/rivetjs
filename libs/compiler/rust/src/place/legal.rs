//! PLACE legality (spec §3): which backends provably preserve behaviour for a node, from facts. A backend is offered only
//! when its proof holds; otherwise the node keeps today's default. Phase 1 backends (those that exist on main):
//!
//! - component: `static` (server only, no markers: legal iff no adopt walk reaches it, `!adopted`), `standalone`
//!   (independent record: legal iff the fixpoint proved `independent`), `standalone-ctxfree` (also `free`),
//!   `with-parent` (dependent: always legal for a boundary — every ancestor of a boundary is a boundary);
//! - call site of a `site_capable` component: `site` (`_rS`: independent + context-free at this site; legal iff the
//!   call-site proof is `proven`) or `with-parent` (always legal).
//!
//! Comptime and the lite runtime are not node choices here: comptime is decided by its own pass (`comptime.ts`, legality =
//! purity + determinism, RV2108), the lite runtime per page by the server (`server-derived.ts`), predicted by
//! `cost.rs` from the `lite` fact.

use super::ir::{Component, Graph, Site};

/// Backend of a call site.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum SiteBackend {
    /// The callee adopts with its parent (today's default for an unproven site).
    WithParent,
    /// `_rS`: the instance is independent and context-free (ZERO CALLSITE `SITE`).
    Site,
}

impl SiteBackend {
    pub fn name(self) -> &'static str {
        match self {
            SiteBackend::WithParent => "with-parent",
            SiteBackend::Site => "site",
        }
    }
}

/// Backend of a component (phase 1: fixed by dominance or by the fixpoint; reported by `explain`).
pub fn component_backend(c: &Component) -> (&'static str, &'static str) {
    if !c.interactive && !c.adopted {
        ("static", "no adopt walk reaches it (ZERO A1)")
    } else if !c.interactive {
        ("with-parent", "not a boundary: rendered by an adopted component")
    } else if c.root {
        ("standalone", "route / derived root")
    } else if c.independent && c.free {
        ("standalone-ctxfree", "independent, every call site proven context-free")
    } else if c.independent {
        ("standalone", "independent (data props, no context)")
    } else if c.site_capable {
        ("site", "dependent; independent at proven call sites")
    } else {
        ("with-parent", "dependent")
    }
}

/// Legal backends of a call site and why (first reason the `site` backend is not offered).
pub fn site_legal(g: &Graph, s: &Site) -> (Vec<SiteBackend>, &'static str) {
    let Some(callee) = g.components.get(s.callee as usize) else { return (vec![SiteBackend::WithParent], "unresolved callee") };
    if !callee.interactive {
        return (vec![SiteBackend::WithParent], "callee is not a boundary");
    }
    if callee.root {
        return (vec![SiteBackend::WithParent], "callee is a root");
    }
    if callee.independent {
        return (vec![SiteBackend::WithParent], "callee is independent everywhere");
    }
    if !callee.site_capable {
        return (vec![SiteBackend::WithParent], "callee has no props object or is dependent for another reason");
    }
    if s.proof != "proven" {
        return (
            vec![SiteBackend::WithParent],
            match s.proof.as_str() {
                "not-data" => "call passes non-data",
                "touch-top" => "callee code is unprovable (TOP)",
                "above-top" => "ancestry unprovable (TOP)",
                "overlap" => "a provider above may set a context the callee reads",
                _ => "not examined",
            },
        );
    }
    (vec![SiteBackend::WithParent, SiteBackend::Site], "proven")
}
