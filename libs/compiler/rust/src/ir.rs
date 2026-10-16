//! Emitted expressions. Lowering builds these instead of text so later passes (list plans, twins)
//! can inspect what was generated, as the TypeScript implementation inspected
//! factory nodes. Source fragments stay `Raw` text (still TypeScript; types are stripped last).

use oxc_semantic::NodeId;

#[derive(Clone, Debug)]
pub enum Key {
    Str(String),
    Ident(String),
    /// `get "name"() { return value; }`: a live component prop (LIVE-PROPS), read on access.
    Getter(String),
    /// `...value` (object spread, source order).
    Spread,
}

impl Key {
    pub fn text(&self) -> &str {
        match self {
            Key::Str(s) | Key::Ident(s) | Key::Getter(s) => s,
            Key::Spread => "",
        }
    }
}

#[derive(Clone, Debug)]
pub enum Expr {
    /// Printed source expression (may need parentheses when embedded).
    Raw(String),
    /// Printed source arrow/function expression (no parentheses needed as a value).
    Func(String),
    Ident(String),
    Str(String),
    Num(usize),
    True,
    Null,
    VoidZero,
    Call(Box<Expr>, Vec<Expr>),
    Array(Vec<Expr>),
    Object(Vec<(Key, Expr)>),
    /// `(params) => body`.
    Arrow(Vec<String>, Box<Expr>),
    /// `(params) => { statements }`.
    ArrowBlock(Vec<String>, Vec<String>),
    Member(Box<Expr>, String),
    Index(Box<Expr>, Box<Expr>),
    /// `base + n`.
    Add(String, usize),
    Assign(Box<Expr>, Box<Expr>),
    /// Server `compiledTemplate(fragments, [slots])`.
    Template { callee: String, fragments: String, slots: Vec<Expr> },
    /// Server `attribute("name", value[, "namespace"])`.
    Attr { callee: String, name: String, value: Box<Expr>, namespace: Option<String> },
    /// Lowered component call `Tag({ props })`; `twin` marks a call to an inlinable component.
    Component { callee: Box<Expr>, props: Vec<(Key, Expr)>, twin: Option<NodeId> },
    /// One or more statements replacing a statement.
    Stmts(String),
}

pub fn quote(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    out.push('"');
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            '\u{2028}' => out.push_str("\\u2028"),
            '\u{2029}' => out.push_str("\\u2029"),
            c if (c as u32) < 0x20 || c == '\u{7f}' => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
    out
}

fn simple(text: &str) -> bool {
    let text = crate::map::unmarked(text);
    let mut parts = text.split('.');
    parts.all(|part| {
        let mut chars = part.chars();
        matches!(chars.next(), Some(c) if c == '_' || c == '$' || c.is_ascii_alphabetic())
            && chars.all(|c| c == '_' || c == '$' || c.is_ascii_alphanumeric())
    })
}

impl Expr {
    pub fn ident(name: &str) -> Expr {
        Expr::Ident(name.to_string())
    }

    pub fn str(value: &str) -> Expr {
        Expr::Str(value.to_string())
    }

    pub fn call(callee: &str, args: Vec<Expr>) -> Expr {
        Expr::Call(Box::new(Expr::ident(callee)), args)
    }

    pub fn thunk(value: Expr) -> Expr {
        Expr::Arrow(Vec::new(), Box::new(value))
    }

    pub fn print(&self) -> String {
        let mut out = String::new();
        self.write(&mut out);
        out
    }

    /// Embedded as a value (argument, element, property value, assigned value, arrow body). Functions
    /// stay bare: source parentheses around functions survive emission, generated ones must not.
    fn write_value(&self, out: &mut String) {
        match self {
            Expr::Func(text) => out.push_str(text),
            Expr::Arrow(..) | Expr::ArrowBlock(..) => self.write(out),
            _ => self.write_operand(out),
        }
    }

    /// Embedded as a strict operand (callee, member object, assignment target, await operand).
    fn write_operand(&self, out: &mut String) {
        match self {
            Expr::Func(text) => {
                out.push('(');
                out.push_str(text);
                out.push(')');
            }
            Expr::Raw(text) if !simple(text) => {
                out.push('(');
                out.push_str(text);
                out.push(')');
            }
            Expr::Object(_) | Expr::Arrow(..) | Expr::ArrowBlock(..) | Expr::Assign(..) | Expr::Stmts(_) => {
                out.push('(');
                self.write(out);
                out.push(')');
            }
            _ => self.write(out),
        }
    }

    fn write_list(items: &[Expr], out: &mut String) {
        for (n, item) in items.iter().enumerate() {
            if n > 0 {
                out.push_str(", ");
            }
            item.write_value(out);
        }
    }

    fn write_object(props: &[(Key, Expr)], out: &mut String) {
        out.push('{');
        for (n, (key, value)) in props.iter().enumerate() {
            out.push_str(if n > 0 { ", " } else { " " });
            match key {
                Key::Str(s) => out.push_str(&quote(s)),
                Key::Ident(s) => out.push_str(s),
                Key::Spread => {
                    out.push_str("...");
                    value.write_value(out);
                    continue;
                }
                Key::Getter(s) => {
                    out.push_str("get ");
                    out.push_str(&quote(s));
                    out.push_str("() { return ");
                    value.write_value(out);
                    out.push_str("; }");
                    continue;
                }
            }
            out.push_str(": ");
            value.write_value(out);
        }
        out.push_str(if props.is_empty() { "}" } else { " }" });
    }

    fn write(&self, out: &mut String) {
        match self {
            Expr::Raw(text) | Expr::Func(text) | Expr::Stmts(text) => out.push_str(text),
            Expr::Ident(name) => out.push_str(name),
            Expr::Str(value) => out.push_str(&quote(value)),
            Expr::Num(n) => out.push_str(&n.to_string()),
            Expr::True => out.push_str("true"),
            Expr::Null => out.push_str("null"),
            Expr::VoidZero => out.push_str("void 0"),
            Expr::Call(callee, args) => {
                callee.write_operand(out);
                out.push('(');
                Expr::write_list(args, out);
                out.push(')');
            }
            Expr::Array(items) => {
                out.push('[');
                Expr::write_list(items, out);
                out.push(']');
            }
            Expr::Object(props) => Expr::write_object(props, out),
            Expr::Arrow(params, body) => {
                out.push('(');
                out.push_str(&params.join(", "));
                out.push_str(") => ");
                body.write_value(out);
            }
            Expr::ArrowBlock(params, statements) => {
                out.push('(');
                out.push_str(&params.join(", "));
                out.push_str(") => {\n");
                for statement in statements {
                    out.push_str(statement);
                    out.push('\n');
                }
                out.push('}');
            }
            Expr::Member(object, name) => {
                object.write_operand(out);
                out.push('.');
                out.push_str(name);
            }
            Expr::Index(object, index) => {
                object.write_operand(out);
                out.push('[');
                index.write(out);
                out.push(']');
            }
            Expr::Add(base, n) => {
                out.push_str(base);
                out.push_str(" + ");
                out.push_str(&n.to_string());
            }
            Expr::Assign(target, value) => {
                target.write_operand(out);
                out.push_str(" = ");
                value.write_value(out);
            }
            Expr::Template { callee, fragments, slots } => {
                out.push_str(callee);
                out.push('(');
                out.push_str(fragments);
                out.push_str(", [");
                Expr::write_list(slots, out);
                out.push_str("])");
            }
            Expr::Attr { callee, name, value, namespace } => {
                out.push_str(callee);
                out.push('(');
                out.push_str(&quote(name));
                out.push_str(", ");
                value.write_value(out);
                if let Some(namespace) = namespace {
                    out.push_str(", ");
                    out.push_str(&quote(namespace));
                }
                out.push(')');
            }
            Expr::Component { callee, props, .. } => {
                callee.write_operand(out);
                out.push('(');
                Expr::write_object(props, out);
                out.push(')');
            }
        }
    }
}
