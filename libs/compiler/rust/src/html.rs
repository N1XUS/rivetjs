//! Static attribute encoding with the same boundary rules as server slots.

/// HTML boolean attributes (presence = on, `"false"` would be on too). C4 added the media / declarative
/// shadow root / color-input ones; keep in sync with `compile/dom_v2.rs` `BOOLEAN_NAMES` and
/// `libs/runtime/template.ts`.
pub const BOOLEAN_ATTRIBUTES: &[&str] = &[
    "allowfullscreen", "alpha", "async", "autofocus", "autoplay", "checked", "controls", "default", "defer", "disabled",
    "disablepictureinpicture", "disableremoteplayback", "formnovalidate", "hidden", "inert", "ismap", "itemscope", "loop",
    "multiple", "muted", "nomodule", "novalidate", "open", "playsinline", "readonly", "required", "reversed", "selected",
    "shadowrootclonable", "shadowrootdelegatesfocus", "shadowrootserializable",
];
// Same rule as libs/runtime/url.ts: one URL, or a list whose every entry is checked.
const URL_ATTRIBUTES: &[&str] = &["href", "src", "action", "formaction", "poster", "xlink:href", "data", "to", "from", "by"];
const URL_LIST_ATTRIBUTES: &[&str] = &["ping", "srcset", "imagesrcset", "values"];
/// HTML `(element, attribute)` pairs whose URL may be a `data:` image, video or audio.
const MEDIA_URLS: &[(&str, &str)] = &[
    ("img", "src"),
    ("img", "srcset"),
    ("source", "src"),
    ("source", "srcset"),
    ("video", "src"),
    ("video", "poster"),
    ("audio", "src"),
];

/// Attribute namespace for encoding: `media` on an HTML media source attribute (allows `data:`
/// image/video/audio URLs; the server runtime receives it as the attribute's namespace). A DOM
/// root's `inherit` namespace counts as HTML: these tags are HTML in every parsing context.
pub fn attribute_namespace(tag: &str, name: &str, namespace: &'static str) -> &'static str {
    if matches!(namespace, "html" | "inherit") && MEDIA_URLS.iter().any(|&(t, a)| t == tag && name.eq_ignore_ascii_case(a)) {
        "media"
    } else {
        namespace
    }
}

/// `javascript:`, `vbscript:`, or `data:` (outside an allowed media type when `media`); controls
/// and spaces are ignored as browsers do.
fn unsafe_url(url: &str, media: bool) -> bool {
    let compact: String = url.chars().filter(|&c| c > '\u{20}' && c != '\u{7f}').collect::<String>().to_ascii_lowercase();
    if compact.starts_with("javascript:") || compact.starts_with("vbscript:") {
        return true;
    }
    let Some(rest) = compact.strip_prefix("data:") else { return false };
    !(media && media_data(rest))
}

/// `image/<non-svg>`, `video/…` or `audio/…` followed by `;`, `,` or the end.
fn media_data(rest: &str) -> bool {
    let subtype = if let Some(sub) = rest.strip_prefix("image/") {
        if sub.starts_with("svg") {
            return false;
        }
        sub
    } else if let Some(sub) = rest.strip_prefix("video/").or_else(|| rest.strip_prefix("audio/")) {
        sub
    } else {
        return false;
    };
    let end = subtype.find(|c: char| !(c.is_ascii_alphanumeric() || matches!(c, '_' | '.' | '+' | '-'))).unwrap_or(subtype.len());
    end > 0 && matches!(subtype[end..].chars().next(), None | Some(';' | ','))
}

pub enum AttrValue<'s> {
    True,
    Text(&'s str),
}

/// ` name="value"` (or ` name` / nothing for boolean attributes). Err: unsafe URL attribute.
/// HTML names (any namespace but `svg` / `mathml`, like the boolean rule; a DOM root's `inherit` is
/// never a known SVG / MathML tag) are written lowercase, as the HTML parser stores them
/// (`encType` → `enctype`, `readOnly` → `readonly`; same rule as `libs/runtime/template.ts`
/// `attributeName`); SVG / MathML names keep their case (`viewBox`). `hidden` is enumerated: a
/// non-empty string is its keyword, written verbatim (`hidden="until-found"`), like the runtime.
pub fn encode_attribute(name: &str, value: AttrValue, namespace: &str) -> Result<String, &'static str> {
    let html = namespace != "svg" && namespace != "mathml";
    let mut lower = name.to_ascii_lowercase();
    // C14: React's uncontrolled defaults are the content attributes (`defaultValue` → `value`,
    // `defaultChecked` → `checked`), not bogus `defaultvalue=` attributes.
    if html && (lower == "defaultvalue" || lower == "defaultchecked") {
        lower.replace_range(..7, "");
    }
    let name = if html { lower.as_str() } else { name };
    if namespace != "svg" && namespace != "mathml" && BOOLEAN_ATTRIBUTES.contains(&lower.as_str()) {
        return Ok(match value {
            AttrValue::Text(text) if lower == "hidden" && !text.is_empty() => format!(" {name}=\"{}\"", escape(text)),
            AttrValue::True => format!(" {name}"),
            AttrValue::Text(text) if !text.is_empty() => format!(" {name}"),
            AttrValue::Text(_) => String::new(),
        });
    }
    // `popover` is enumerated: a bare attribute is the empty keyword (= `auto`, light dismiss); `"true"`
    // would be an invalid value (= `manual`). C4.
    if lower == "popover" && matches!(value, AttrValue::True) && namespace != "svg" && namespace != "mathml" {
        return Ok(format!(" {name}"));
    }
    let value = match value {
        AttrValue::True => "true",
        AttrValue::Text(text) => text,
    };
    let media = namespace == "media";
    let unsafe_value = if URL_ATTRIBUTES.contains(&lower.as_str()) {
        unsafe_url(value, media)
    } else if lower == "values" {
        // SEC3 (= libs/runtime/url.ts): SMIL `values` is a `;` list whose entries are URLs on their own
        // (the URL parser drops tab / LF / CR inside them: `java\tscript:`), so split on `;` only.
        value.split(';').any(|part| unsafe_url(part, media))
    } else if URL_LIST_ATTRIBUTES.contains(&lower.as_str()) {
        value.split(['\t', '\n', '\u{c}', '\r', ' ', ',', ';']).any(|part| unsafe_url(part, media))
    } else {
        false
    };
    if unsafe_value {
        return Err(
            "Unsafe URL attribute: javascript: / vbscript: URLs and data: URLs (except image / video / audio data on media elements) are rejected; use an http(s), relative or mailto: URL, or an event handler",
        );
    }
    Ok(format!(" {name}=\"{}\"", escape(value)))
}

/// Attribute value text, escaped for a double-quoted attribute.
fn escape(value: &str) -> String {
    let mut out = String::with_capacity(value.len() + 4);
    for c in value.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#39;"),
            _ => out.push(c),
        }
    }
    out
}

/// Scope boundaries of the HTML parser's "has an element in scope" (HTML namespace part).
const SCOPE: &[&str] = &["applet", "caption", "html", "table", "td", "th", "marquee", "object", "template"];
/// Start tags that close an open `p` in button scope (`<table>`: no-quirks documents).
const CLOSES_P: &[&str] = &[
    "address", "article", "aside", "blockquote", "center", "dd", "details", "dialog", "dir", "div", "dl", "dt", "fieldset",
    "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hgroup", "hr", "li", "listing",
    "main", "menu", "nav", "ol", "p", "plaintext", "pre", "search", "section", "summary", "table", "ul", "xmp",
];
const HEADINGS: &[&str] = &["h1", "h2", "h3", "h4", "h5", "h6"];
/// The parser's "special" category (HTML namespace): an `li` / `dd` / `dt` search stops at these
/// (except `address`, `div`, `p`).
const SPECIAL: &[&str] = &[
    "address", "applet", "area", "article", "aside", "base", "basefont", "bgsound", "blockquote", "body", "br", "button",
    "caption", "center", "col", "colgroup", "dd", "details", "dir", "div", "dl", "dt", "embed", "fieldset", "figcaption",
    "figure", "footer", "form", "frame", "frameset", "h1", "h2", "h3", "h4", "h5", "h6", "head", "header", "hgroup", "hr",
    "html", "iframe", "img", "input", "keygen", "li", "link", "listing", "main", "marquee", "menu", "meta", "nav", "noembed",
    "noframes", "noscript", "object", "ol", "p", "param", "plaintext", "pre", "script", "search", "section", "select",
    "source", "style", "summary", "table", "tbody", "td", "template", "textarea", "tfoot", "th", "thead", "title", "tr",
    "track", "ul", "wbr", "xmp",
];
/// Elements a table section accepts as children without foster parenting.
const TABLE_CONTENT: &[(&str, &[&str])] = &[
    ("table", &["caption", "colgroup", "col", "tbody", "thead", "tfoot", "tr", "td", "th", "script", "template", "style"]),
    ("tbody", &["tr", "td", "th", "script", "template", "style"]),
    ("thead", &["tr", "td", "th", "script", "template", "style"]),
    ("tfoot", &["tr", "td", "th", "script", "template", "style"]),
    ("tr", &["td", "th", "script", "template", "style"]),
];

/// C6: would the HTML parser restructure `<tag>` opened inside `ancestors` (outermost first, HTML
/// namespace)? Then a template's static walk paths no longer match the parsed DOM (RV1005). Rules
/// (HTML "in body" / "in table" insertion modes): a start tag closing a `p` in button scope; `li` /
/// `dd` / `dt` closing an open one in list-item scope; nested `a` (active formatting, up to a
/// marker); `button` in scope; `form` inside `form`; a heading directly in a heading; `option` /
/// `optgroup` directly in `option`; `table` in table mode (not inside a cell or caption); non-table
/// content directly in `table` / `tbody` / `thead` / `tfoot` / `tr` (foster parenting). Implied
/// wrappers (`tr` directly in `table` → `tbody`) are C5, not this check. Foreign content (`svg` /
/// `math` ancestors outside `foreignObject`) is not modelled.
pub fn parser_repaired(tag: &str, ancestors: &[&str]) -> bool {
    let inner = |stop: &dyn Fn(&str) -> bool, find: &dyn Fn(&str) -> bool| {
        for &a in ancestors.iter().rev() {
            if find(a) {
                return true;
            }
            if stop(a) {
                return false;
            }
        }
        false
    };
    if ancestors.iter().any(|a| *a == "svg" || *a == "math") {
        return false;
    }
    let parent = ancestors.last().copied().unwrap_or("");
    if let Some((_, allowed)) = TABLE_CONTENT.iter().find(|(t, _)| *t == parent) {
        if !allowed.contains(&tag) {
            return true;
        }
    }
    if CLOSES_P.contains(&tag) && inner(&|a| a == "button" || SCOPE.contains(&a), &|a| a == "p") {
        return true;
    }
    match tag {
        "li" => inner(&|a| a == "ol" || a == "ul" || (SPECIAL.contains(&a) && !matches!(a, "address" | "div" | "p")), &|a| a == "li"),
        "dd" | "dt" => inner(&|a| SPECIAL.contains(&a) && !matches!(a, "address" | "div" | "p"), &|a| a == "dd" || a == "dt"),
        "a" => inner(&|a| matches!(a, "td" | "th" | "caption" | "template" | "applet" | "object" | "marquee"), &|a| a == "a"),
        "button" => inner(&|a| SCOPE.contains(&a), &|a| a == "button"),
        "form" => inner(&|a| a == "template", &|a| a == "form"),
        "table" => inner(&|a| matches!(a, "td" | "th" | "caption" | "template"), &|a| a == "table"),
        "option" | "optgroup" if parent == "option" => true,
        "optgroup" => parent == "optgroup",
        _ if HEADINGS.contains(&tag) => HEADINGS.contains(&parent),
        _ => false,
    }
}
