//! Function Bridge C6 / T8 (2026-10-11): boxed `let` declarations on the server resume target. Which `let`s box and
//! how each reference is rewritten (`x.v`) is decided by `resume/cells.rs` (`Resumed.cells` / `cell_refs`, shared with
//! the symbol texts of both targets); this module only turns the declaration itself into `const`.

use super::Compiler;
use crate::ir::Expr;
use oxc_ast::ast::{VariableDeclaration, VariableDeclarationKind};
use oxc_semantic::NodeId;
use oxc_span::Span;

impl<'t, 'a> Compiler<'t, 'a> {
    /// `let a = 0, b = 1;` whose every declarator is boxed → `const a = _rCell(0), b = _rCell(1);` (the declarators
    /// lower in `resume_node`). A declaration that also holds a plain declarator keeps `let` (cells are never
    /// reassigned, so either keyword is right).
    pub(super) fn cell_declaration(&mut self, id: NodeId, v: &'a VariableDeclaration<'a>) -> Option<Expr> {
        let resumed = self.resumed.as_ref()?;
        if v.kind != VariableDeclarationKind::Let || resumed.cells.is_empty() {
            return None;
        }
        let tree = self.tree;
        if !v.declarations.iter().all(|d| tree.id_of(d).is_some_and(|d| resumed.cells.contains(&d))) {
            return None;
        }
        let span = tree.span(id);
        if !tree.text(id).starts_with("let") {
            return None;
        }
        let mut reps = self.visit_children(id);
        // The keyword as one more replacement (render keeps source-map marks right).
        reps.insert(0, (Span::new(span.start, span.start + 3), Expr::Raw("const".into())));
        Some(Expr::Stmts(self.render(span, &reps)))
    }
}
