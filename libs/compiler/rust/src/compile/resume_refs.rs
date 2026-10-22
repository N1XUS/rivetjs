//! Function Bridge C3 / T3 (2026-10-09): the server epilogue of module references (ids + symbols: `resume/refs.rs`).
//! `_rMod(() => value, "id"[, 1 | 2])` per reference after the module's last statement: a thunk, because an import binding
//! read at module load may still be in its TDZ while an import cycle evaluates (the runtime reads it before the first
//! encode and retries one that still throws); the flag `1` marks an import stamp, `2` module static data (DIET-STATE 1). Function Bridge C12 / T24: then
//! `_rClass(Cls, "<module>#<Cls>$class")` per module data class.

use super::Compiler;
use crate::ir::Expr;

impl<'t, 'a> Compiler<'t, 'a> {
    /// Server resume target: `\n_rMod(() => value, "id"[, 1]);` per module reference.
    pub(super) fn module_refs_epilogue(&mut self) -> String {
        let (refs, classes): (Vec<(String, String, bool, bool)>, Vec<(String, String)>) = match &self.resumed {
            Some(resumed) => (
                resumed.module_refs.iter().map(|r| (r.value.clone(), r.id.clone(), r.imported, r.data)).collect(),
                resumed.classes.iter().map(|c| (c.name.clone(), c.id.clone())).collect(),
            ),
            None => return String::new(),
        };
        let mut out = String::new();
        for (value, id, imported, data) in refs {
            let mut args = vec![Expr::Raw(format!("() => {value}")), Expr::str(&id)];
            if imported {
                args.push(Expr::Num(1));
            } else if data {
                // DIET-STATE 1: module static data — nested objects are stamped with their key paths.
                args.push(Expr::Num(2));
            }
            out.push('\n');
            out.push_str(&self.r("mod", args).print());
            out.push(';');
        }
        // Function Bridge C12 / T24: `_rClass(Cls, "<module>#<Cls>$class")` per module data class (`resume/classes.rs`).
        for (name, id) in classes {
            out.push('\n');
            out.push_str(&self.r("class", vec![Expr::Ident(name), Expr::str(&id)]).print());
            out.push(';');
        }
        out
    }
}
