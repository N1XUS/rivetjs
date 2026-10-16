//! V2-Q4 (DOM v2-only spec, decision Q4): event handlers bind once. A native element's `onX` /
//! `onXCapture` / `on:x` / `window:onX` / `document:onX` value is evaluated once, when the element
//! renders (DOM `_on` / `_listen` / `clientEvent`, server resume `_rOn`), like Solid — no effect re-selects
//! it. A value that reads state at that moment would silently freeze on its first result, so it is the
//! RV1016 error (user decision 2026-10-07: handlers are forced to be functions or plain references):
//!
//! - a call (`getHandler()`, `makeHandler?.(id)`), except `f.bind(…)`;
//! - a conditional / logical (`?:`, `&&`, `||`, `??`) whose operands evaluate a call (`s() ? a : b`);
//! - the same as the last operand of a sequence (`(0, getHandler())`; `(track(), () => x())` is fine).
//!
//! Allowed: function literals, identifiers, member reads (`props.onClick` forwarding stays
//! bind-once), and conditionals without calls (`c ? f : undefined`, `!x && f`: the resume `present`
//! form). Calls inside nested functions or classes do not run at bind time and do not count.

use super::*;

/// Parentheses, TypeScript-only wrappers (`as`, `satisfies`, `!`, `<T>`) and sequences (their last operand is
/// the value; earlier operands are side effects).
fn unwrap<'b, 'a>(mut e: &'b Expression<'a>) -> &'b Expression<'a> {
    loop {
        e = match e {
            Expression::SequenceExpression(s) => match s.expressions.last() {
                Some(last) => last,
                None => return e,
            },
            Expression::ParenthesizedExpression(p) => &p.expression,
            Expression::TSAsExpression(t) => &t.expression,
            Expression::TSSatisfiesExpression(t) => &t.expression,
            Expression::TSNonNullExpression(t) => &t.expression,
            Expression::TSTypeAssertion(t) => &t.expression,
            _ => return e,
        };
    }
}

/// `f.bind(…)` / `f?.bind(…)`: creates the handler once by design.
fn binds(callee: &Expression) -> bool {
    matches!(unwrap(callee), Expression::StaticMemberExpression(m) if m.property.name == "bind")
}

/// Whether evaluating the node runs a call (`f()`, `new F()`, tagged template); nested functions and
/// classes are not evaluated.
fn evaluates_call(tree: &Tree, id: NodeId) -> bool {
    match tree.kind(id) {
        AstKind::CallExpression(_) | AstKind::NewExpression(_) | AstKind::TaggedTemplateExpression(_) | AstKind::ImportExpression(_) => true,
        AstKind::ArrowFunctionExpression(_) | AstKind::Function(_) | AstKind::Class(_) => false,
        _ => tree.children(id).iter().any(|&child| evaluates_call(tree, child)),
    }
}

impl<'t, 'a> Compiler<'t, 'a> {
    /// RV1016 for an event attribute whose value reads state when it binds (module doc). Reported once per
    /// attribute: a template can be walked more than once.
    pub(super) fn bind_once_handler(&mut self, name: &str, attr: &JSXAttribute<'a>, node: Option<NodeId>) {
        if event_info(name).is_none() && !matches!(global_event(name), Some(Some(_))) {
            return;
        }
        let Some(JSXAttributeValue::ExpressionContainer(c)) = &attr.value else { return };
        let Some(e) = c.expression.as_expression() else { return };
        let e = unwrap(e);
        let frozen = match e {
            Expression::CallExpression(call) => !binds(&call.callee),
            Expression::ChainExpression(chain) => match &chain.expression {
                ChainElement::CallExpression(call) => !binds(&call.callee),
                _ => false,
            },
            Expression::ConditionalExpression(_) | Expression::LogicalExpression(_) => {
                self.tree.expr_id(e).is_some_and(|id| evaluates_call(self.tree, id))
            }
            _ => false,
        };
        if !frozen {
            return;
        }
        let message = format!(
            "Event handler {name} expression is evaluated once at render (handlers bind once); wrap it in an arrow to re-evaluate it per event, e.g. `{name}={{() => (cond() ? a() : b())}}` or `{name}={{(event) => handler()?.(event)}}`"
        );
        let span = node.map(|id| (self.tree.start(id), self.tree.span(id).end));
        if self.diags.list.iter().any(|d| d.span == span && d.message == message) {
            return;
        }
        self.diag(message, node);
    }
}
