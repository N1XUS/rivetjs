//! JSX character reference decoding, ported from `entities` 7.0.0 `decodeHTML` in **strict** mode
//! (C14: JSX — TypeScript, Babel, esbuild — decodes only `;`-terminated references; the legacy HTML
//! mode turned `&notanentity;` into `¬anentity;`, so editor text ≠ rendered text): named references
//! from the HTML trie, numeric references with the HTML replacement table, both requiring `;`.
//! Works on UTF-16 code units so consumed lengths match the JS original.

use crate::entities_data::HTML_DECODE_TREE as TREE;

const VALUE_LENGTH: u16 = 0b1100_0000_0000_0000;
const FLAG13: u16 = 0b0010_0000_0000_0000;
const BRANCH_LENGTH: u16 = 0b0001_1111_1000_0000;
const JUMP_TABLE: u16 = 0b0000_0000_0111_1111;

const NUM: u16 = b'#' as u16;
const SEMI: u16 = b';' as u16;
const TO_LOWER_BIT: u16 = 0b10_0000;

#[derive(Clone, Copy, PartialEq)]
enum State {
    EntityStart,
    NumericStart,
    NumericDecimal,
    NumericHex,
    NamedEntity,
}

struct Decoder<'o> {
    state: State,
    consumed: usize,
    result: u64,
    tree_index: i64,
    excess: usize,
    out: &'o mut Vec<u16>,
}

fn is_number(c: u16) -> bool {
    (b'0' as u16..=b'9' as u16).contains(&c)
}

fn is_hex(c: u16) -> bool {
    (b'A' as u16..=b'F' as u16).contains(&c) || (b'a' as u16..=b'f' as u16).contains(&c)
}

fn replace_code_point(cp: u64) -> u32 {
    if (0xd800..=0xdfff).contains(&cp) || cp > 0x10_ffff {
        return 0xfffd;
    }
    match cp {
        0 => 65533,
        128 => 8364,
        130 => 8218,
        131 => 402,
        132 => 8222,
        133 => 8230,
        134 => 8224,
        135 => 8225,
        136 => 710,
        137 => 8240,
        138 => 352,
        139 => 8249,
        140 => 338,
        142 => 381,
        145 => 8216,
        146 => 8217,
        147 => 8220,
        148 => 8221,
        149 => 8226,
        150 => 8211,
        151 => 8212,
        152 => 732,
        153 => 8482,
        154 => 353,
        155 => 8250,
        156 => 339,
        158 => 382,
        159 => 376,
        _ => cp as u32,
    }
}

fn push_code_point(out: &mut Vec<u16>, cp: u32) {
    if cp > 0xffff {
        let c = cp - 0x1_0000;
        out.push((((c >> 10) & 0x3ff) | 0xd800) as u16);
        out.push((0xdc00 | (c & 0x3ff)) as u16);
    } else {
        out.push(cp as u16);
    }
}

fn tree(i: i64) -> u16 {
    usize::try_from(i).ok().and_then(|i| TREE.get(i).copied()).unwrap_or(0)
}

fn determine_branch(current: u16, node_index: i64, c: u16) -> i64 {
    let branch_count = ((current & BRANCH_LENGTH) >> 7) as i64;
    let jump_offset = (current & JUMP_TABLE) as i64;
    if branch_count == 0 {
        return if jump_offset != 0 && c as i64 == jump_offset { node_index } else { -1 };
    }
    if jump_offset != 0 {
        let value = c as i64 - jump_offset;
        return if value < 0 || value >= branch_count { -1 } else { tree(node_index + value) as i64 - 1 };
    }
    let packed_key_slots = (branch_count + 1) >> 1;
    let (mut lo, mut hi) = (0i64, branch_count - 1);
    while lo <= hi {
        let mid = (lo + hi) >> 1;
        let packed = tree(node_index + (mid >> 1));
        let key = (packed >> ((mid & 1) * 8)) & 0xff;
        match key.cmp(&c) {
            std::cmp::Ordering::Less => lo = mid + 1,
            std::cmp::Ordering::Greater => hi = mid - 1,
            std::cmp::Ordering::Equal => return tree(node_index + packed_key_slots + mid) as i64,
        }
    }
    -1
}

impl Decoder<'_> {
    fn start(&mut self) {
        self.state = State::EntityStart;
        self.result = 0;
        self.tree_index = 0;
        self.excess = 1;
        self.consumed = 1;
    }

    /// Returns the consumed length, 0 for no entity, -1 for an entity cut off by the input end.
    fn write(&mut self, input: &[u16], offset: usize) -> i64 {
        if input.get(offset) == Some(&NUM) {
            self.state = State::NumericStart;
            self.consumed += 1;
            return self.numeric_start(input, offset + 1);
        }
        self.state = State::NamedEntity;
        self.named_entity(input, offset)
    }

    fn numeric_start(&mut self, input: &[u16], offset: usize) -> i64 {
        let Some(&c) = input.get(offset) else { return -1 };
        if c | TO_LOWER_BIT == b'x' as u16 {
            self.state = State::NumericHex;
            self.consumed += 1;
            return self.numeric(input, offset + 1, 16);
        }
        self.state = State::NumericDecimal;
        self.numeric(input, offset, 10)
    }

    fn numeric(&mut self, input: &[u16], mut offset: usize, base: u64) -> i64 {
        while let Some(&c) = input.get(offset) {
            let digit = if is_number(c) {
                (c - b'0' as u16) as u64
            } else if base == 16 && is_hex(c) {
                ((c | TO_LOWER_BIT) - b'a' as u16 + 10) as u64
            } else {
                return self.emit_numeric(c, if base == 16 { 3 } else { 2 });
            };
            // Saturate: anything past U+10FFFF decodes to U+FFFD either way.
            self.result = self.result.saturating_mul(base).saturating_add(digit).min(0x1_0000_0000);
            self.consumed += 1;
            offset += 1;
        }
        -1
    }

    fn emit_numeric(&mut self, last: u16, expected_length: usize) -> i64 {
        if self.consumed <= expected_length {
            return 0;
        }
        if last != SEMI {
            return 0;
        }
        self.consumed += 1;
        push_code_point(self.out, replace_code_point(self.result));
        self.consumed as i64
    }

    fn named_entity(&mut self, input: &[u16], mut offset: usize) -> i64 {
        let mut current = tree(self.tree_index);
        let mut value_length = (current & VALUE_LENGTH) >> 14;
        while offset < input.len() {
            // Compact run: valueLength == 0 with FLAG13 set.
            if value_length == 0 && current & FLAG13 != 0 {
                let run_length = ((current & BRANCH_LENGTH) >> 7) as usize;
                let first = current & JUMP_TABLE;
                if offset + run_length > input.len() {
                    return -1;
                }
                if input[offset] != first {
                    return if self.result == 0 { 0 } else { self.emit_not_terminated() };
                }
                offset += 1;
                self.excess += 1;
                let remaining = run_length - 1;
                let mut run_pos = 1;
                while run_pos < run_length {
                    let packed = tree(self.tree_index + 1 + ((run_pos as i64 - 1) >> 1));
                    let low = packed & 0xff;
                    if input.get(offset) != Some(&low) {
                        return if self.result == 0 { 0 } else { self.emit_not_terminated() };
                    }
                    offset += 1;
                    self.excess += 1;
                    let high = (packed >> 8) & 0xff;
                    if run_pos + 1 < run_length {
                        if input.get(offset) != Some(&high) {
                            return if self.result == 0 { 0 } else { self.emit_not_terminated() };
                        }
                        offset += 1;
                        self.excess += 1;
                    }
                    run_pos += 2;
                }
                self.tree_index += 1 + ((remaining as i64 + 1) >> 1);
                current = tree(self.tree_index);
                value_length = (current & VALUE_LENGTH) >> 14;
            }
            if offset >= input.len() {
                break;
            }
            let c = input[offset];
            if c == SEMI && value_length != 0 && current & FLAG13 != 0 {
                return self.emit_named(self.tree_index, value_length, self.consumed + self.excess);
            }
            self.tree_index = determine_branch(current, self.tree_index + (value_length.max(1) as i64), c);
            if self.tree_index < 0 {
                return if self.result == 0 { 0 } else { self.emit_not_terminated() };
            }
            current = tree(self.tree_index);
            value_length = (current & VALUE_LENGTH) >> 14;
            if value_length != 0 {
                if c == SEMI {
                    return self.emit_named(self.tree_index, value_length, self.consumed + self.excess);
                }
                // Strict mode: no semicolon-optional (legacy) matches are kept.
            }
            offset += 1;
            self.excess += 1;
        }
        -1
    }

    fn emit_not_terminated(&mut self) -> i64 {
        let result = self.result as i64;
        let value_length = (tree(result) & VALUE_LENGTH) >> 14;
        self.emit_named(result, value_length, self.consumed);
        self.consumed as i64
    }

    fn emit_named(&mut self, result: i64, value_length: u16, consumed: usize) -> i64 {
        let first = if value_length == 1 { tree(result) & !(VALUE_LENGTH | FLAG13) } else { tree(result + 1) };
        self.out.push(first);
        if value_length == 3 {
            self.out.push(tree(result + 2));
        }
        consumed as i64
    }

    fn end(&mut self) -> i64 {
        match self.state {
            State::NamedEntity => {
                if self.result != 0 {
                    self.emit_not_terminated()
                } else {
                    0
                }
            }
            State::NumericDecimal => self.emit_numeric(0, 2),
            State::NumericHex => self.emit_numeric(0, 3),
            State::NumericStart | State::EntityStart => 0,
        }
    }
}

/// `decodeHTML(text, DecodingMode.Strict)` from `entities`: JSX text / attribute string decoding.
pub fn decode_html(text: &str) -> String {
    if !text.contains('&') {
        return text.to_string();
    }
    let input: Vec<u16> = text.encode_utf16().collect();
    let mut out: Vec<u16> = Vec::with_capacity(input.len());
    let mut last = 0usize;
    let mut offset = 0usize;
    loop {
        let Some(found) = input[offset.min(input.len())..].iter().position(|&c| c == b'&' as u16) else { break };
        offset += found;
        out.extend_from_slice(input.get(last..offset).unwrap_or_default());
        let mut decoder =
            Decoder { state: State::EntityStart, consumed: 1, result: 0, tree_index: 0, excess: 1, out: &mut out };
        decoder.start();
        let length = decoder.write(&input, offset + 1);
        if length < 0 {
            last = offset + decoder.end() as usize;
            break;
        }
        last = offset + length as usize;
        offset = if length == 0 { last + 1 } else { last };
        if offset > input.len() {
            break;
        }
    }
    out.extend_from_slice(&input[last.min(input.len())..]);
    String::from_utf16_lossy(&out)
}
