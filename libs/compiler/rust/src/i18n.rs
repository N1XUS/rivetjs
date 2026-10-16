//! Static-call hook data (i18n): message tables registered once per build (`registerTable`) and
//! looked up by id at compile time, plus pure helpers that print a message variant as JavaScript.
//! The compiler knows nothing about catalogs or ICU syntax: a table maps a key to one `Variant`
//! per variant index (locale), in the IR produced by `@rivetjs/i18n`.

use std::{cell::RefCell, collections::BTreeMap, rc::Rc};

use rustc_hash::FxHashMap;
use serde::Deserialize;
use serde_json::Value;

use crate::ir::quote;

/// One message part. Field names are disjoint, so untagged matching picks the right variant.
#[derive(Deserialize, Clone, Debug)]
#[serde(untagged)]
pub enum Part {
    Text { t: String },
    Arg { a: String },
    Number { n: String, #[serde(default)] f: Option<Value> },
    Date { d: String, #[serde(default)] f: Option<Value> },
    Plural { p: String, #[serde(default)] ord: Option<bool>, cases: BTreeMap<String, Vec<Part>> },
    Select { s: String, cases: BTreeMap<String, Vec<Part>> },
    Tag { tag: String, c: Vec<Part> },
}

#[derive(Deserialize, Clone, Debug)]
#[serde(untagged)]
pub enum Variant {
    Text(String),
    Parts(Vec<Part>),
}

pub type Table = FxHashMap<String, Vec<Variant>>;

thread_local! {
    static TABLES: RefCell<FxHashMap<String, Rc<Table>>> = RefCell::new(FxHashMap::default());
}

pub fn register(id: String, table: Table) {
    TABLES.with(|t| {
        t.borrow_mut().insert(id, Rc::new(table));
    });
}

pub fn table(id: &str) -> Option<Rc<Table>> {
    TABLES.with(|t| t.borrow().get(id).cloned())
}

impl Variant {
    /// Parts view: plain text is one text part.
    pub fn parts(&self) -> Vec<Part> {
        match self {
            Variant::Text(t) if t.is_empty() => Vec::new(),
            Variant::Text(t) => vec![Part::Text { t: t.clone() }],
            Variant::Parts(parts) => parts.clone(),
        }
    }
    pub fn text(&self) -> Option<&str> {
        match self {
            Variant::Text(t) => Some(t),
            Variant::Parts(_) => None,
        }
    }
}

/// How a message uses one param: as a top-level argument (written as a slot), inside a
/// formatter/plural/select (read by generated code), or as a rich-text tag.
#[derive(Default, Clone, Copy, Debug)]
pub struct Usage {
    pub top: bool,
    pub inner: bool,
    pub tag: bool,
}

/// Params of `parts` (tag children count as top level; case bodies as inner).
pub fn usage(parts: &[Part], inner: bool, out: &mut BTreeMap<String, Usage>) {
    for part in parts {
        match part {
            Part::Text { .. } => {}
            Part::Arg { a } => {
                let u = out.entry(a.clone()).or_default();
                if inner { u.inner = true } else { u.top = true }
            }
            Part::Number { n: name, .. } | Part::Date { d: name, .. } => out.entry(name.clone()).or_default().inner = true,
            Part::Plural { p: name, cases, .. } | Part::Select { s: name, cases } => {
                out.entry(name.clone()).or_default().inner = true;
                for case in cases.values() {
                    usage(case, true, out);
                }
            }
            Part::Tag { tag, c } => {
                out.entry(tag.clone()).or_default().tag = true;
                usage(c, inner, out);
            }
        }
    }
}

/// A formatter part (anything that is not text, an argument or a tag): computed at render time.
pub fn is_formatter(part: &Part) -> bool {
    matches!(part, Part::Number { .. } | Part::Date { .. } | Part::Plural { .. } | Part::Select { .. })
}

/// `parts` holds a rich-text tag at any depth (plural/select cases included).
pub fn has_tag(parts: &[Part]) -> bool {
    parts.iter().any(part_has_tag)
}

pub fn part_has_tag(part: &Part) -> bool {
    match part {
        Part::Tag { .. } => true,
        Part::Plural { cases, .. } | Part::Select { cases, .. } => cases.values().any(|c| has_tag(c)),
        _ => false,
    }
}

/// Which message runtime helpers `parts` needs: [plural, select, number, date].
pub fn runtime_uses(parts: &[Part], out: &mut [bool; 4]) {
    for part in parts {
        match part {
            Part::Plural { cases, .. } => {
                out[0] = true;
                cases.values().for_each(|c| runtime_uses(c, out));
            }
            Part::Select { cases, .. } => {
                out[1] = true;
                cases.values().for_each(|c| runtime_uses(c, out));
            }
            Part::Number { .. } => out[2] = true,
            Part::Date { .. } => out[3] = true,
            Part::Tag { c, .. } => runtime_uses(c, out),
            Part::Text { .. } | Part::Arg { .. } => {}
        }
    }
}

/// Local names of the `@rivetjs/i18n/runtime` helpers in this module (empty when unused).
#[derive(Default, Clone)]
pub struct Names {
    pub plural: String,
    pub select: String,
    pub number: String,
    pub date: String,
}

/// JavaScript string expression for `parts` in `locale`; `param(name)` prints the param's value.
/// Err: a tag, which only JSX children support.
pub fn string_expr(
    parts: &[Part],
    locale: &str,
    param: &dyn Fn(&str) -> String,
    names: &Names,
    tz: Option<&str>,
) -> Result<String, String> {
    let mut out: Vec<String> = Vec::new();
    for part in parts {
        out.push(part_expr(part, locale, param, names, tz)?);
    }
    Ok(match out.len() {
        0 => "\"\"".into(),
        // A leading text part already makes the concatenation a string.
        _ if matches!(parts[0], Part::Text { .. }) => out.join(" + "),
        _ => format!("\"\" + {}", out.join(" + ")),
    })
}

/// JavaScript expression for one part; text parts are string literals.
pub fn part_expr(part: &Part, locale: &str, param: &dyn Fn(&str) -> String, names: &Names, tz: Option<&str>) -> Result<String, String> {
    let l = quote(locale);
    Ok(match part {
        Part::Text { t } => quote(t),
        Part::Arg { a } => format!("({})", param(a)),
        Part::Number { n, f } => match f {
            Some(f) => format!("{}({l}, {}, {f})", names.number, param(n)),
            None => format!("{}({l}, {})", names.number, param(n)),
        },
        Part::Date { d, f } => {
            let f = f.as_ref().map_or_else(|| "undefined".to_string(), Value::to_string);
            match tz {
                Some(tz) => format!("{}({l}, {}, {f}, {})", names.date, param(d), quote(tz)),
                None => format!("{}({l}, {}, {f})", names.date, param(d)),
            }
        }
        Part::Plural { p, ord, cases } => format!(
            "{}({l}, {}, {{ {} }}{})",
            names.plural,
            param(p),
            case_object(cases, locale, param, names, tz)?,
            if ord.unwrap_or(false) { ", true" } else { "" }
        ),
        Part::Select { s, cases } => {
            format!("{}({}, {{ {} }})", names.select, param(s), case_object(cases, locale, param, names, tz)?)
        }
        Part::Tag { tag, .. } => return Err(format!("<{tag}>")),
    })
}

fn case_object(
    cases: &BTreeMap<String, Vec<Part>>,
    locale: &str,
    param: &dyn Fn(&str) -> String,
    names: &Names,
    tz: Option<&str>,
) -> Result<String, String> {
    let mut out = Vec::new();
    for (k, v) in cases {
        out.push(format!("{}: () => {}", quote(k), string_expr(v, locale, param, names, tz)?));
    }
    Ok(out.join(", "))
}
