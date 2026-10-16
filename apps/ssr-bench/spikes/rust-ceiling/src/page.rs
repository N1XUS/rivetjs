//! rivet.bench messages (proto/content.proto), written as prost-build would emit them (no protoc in the image),
//! plus the JSON shape a JS loader would hand over (`{token,title,markdown,rows:[{id,values:[number|string]}]}`).
use serde::de::{self, MapAccess, SeqAccess, Visitor};
use serde::ser::{SerializeSeq, SerializeStruct};
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::fmt;

#[derive(Clone, PartialEq, prost::Message)]
pub struct PageRequest {
    #[prost(int32, tag = "1")]
    pub rows: i32,
    #[prost(string, tag = "2")]
    pub token: String,
    #[prost(bool, tag = "3")]
    pub article: bool,
    #[prost(int32, tag = "4")]
    pub delay_ms: i32,
    #[prost(bool, tag = "5")]
    pub strings: bool,
}

#[derive(Clone, PartialEq, prost::Message)]
pub struct Row {
    #[prost(int32, tag = "1")]
    pub id: i32,
    #[prost(int32, repeated, tag = "2")]
    pub values: Vec<i32>,
    #[prost(string, repeated, tag = "3")]
    pub text_values: Vec<String>,
}

#[derive(Clone, PartialEq, prost::Message, Serialize, Deserialize)]
pub struct Page {
    #[prost(string, tag = "1")]
    #[serde(default)]
    pub token: String,
    #[prost(string, tag = "2")]
    #[serde(default)]
    pub title: String,
    #[prost(string, tag = "3")]
    #[serde(default)]
    pub markdown: String,
    #[prost(message, repeated, tag = "4")]
    #[serde(default)]
    pub rows: Vec<Row>,
}

/// One `{row.values[i]}` hole: the loader's `number | string` union.
#[derive(Clone, Copy)]
pub enum Value<'a> {
    Int(i32),
    Str(&'a str),
}

impl Row {
    #[inline]
    pub fn len(&self) -> usize {
        if self.text_values.is_empty() { self.values.len() } else { self.text_values.len() }
    }
    #[inline]
    pub fn value(&self, i: usize) -> Value<'_> {
        if self.text_values.is_empty() { Value::Int(self.values[i]) } else { Value::Str(&self.text_values[i]) }
    }
}

// JSON: values is a mixed number|string array, exactly like the JS DTO (page-decoder.ts folds text_values in).
impl Serialize for Row {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        struct Values<'a>(&'a Row);
        impl Serialize for Values<'_> {
            fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
                let mut seq = s.serialize_seq(Some(self.0.len()))?;
                if self.0.text_values.is_empty() {
                    for v in &self.0.values {
                        seq.serialize_element(v)?;
                    }
                } else {
                    for v in &self.0.text_values {
                        seq.serialize_element(v)?;
                    }
                }
                seq.end()
            }
        }
        let mut st = s.serialize_struct("Row", 2)?;
        st.serialize_field("id", &self.id)?;
        st.serialize_field("values", &Values(self))?;
        st.end()
    }
}

impl<'de> Deserialize<'de> for Row {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        struct RowVisitor;
        struct ValuesSeed<'r>(&'r mut Row);
        impl<'de> de::DeserializeSeed<'de> for ValuesSeed<'_> {
            type Value = ();
            fn deserialize<D: Deserializer<'de>>(self, d: D) -> Result<(), D::Error> {
                d.deserialize_seq(self)
            }
        }
        impl<'de> Visitor<'de> for ValuesSeed<'_> {
            type Value = ();
            fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
                f.write_str("array of number|string")
            }
            fn visit_seq<A: SeqAccess<'de>>(self, mut seq: A) -> Result<(), A::Error> {
                while let Some(v) = seq.next_element::<Scalar>()? {
                    match v {
                        Scalar::Int(i) => self.0.values.push(i),
                        Scalar::Str(s) => self.0.text_values.push(s),
                    }
                }
                Ok(())
            }
        }
        impl<'de> Visitor<'de> for RowVisitor {
            type Value = Row;
            fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
                f.write_str("row object")
            }
            fn visit_map<A: MapAccess<'de>>(self, mut map: A) -> Result<Row, A::Error> {
                let mut row = Row { id: 0, values: Vec::with_capacity(10), text_values: Vec::new() };
                while let Some(key) = map.next_key::<Key>()? {
                    match key {
                        Key::Id => row.id = map.next_value()?,
                        Key::Values => map.next_value_seed(ValuesSeed(&mut row))?,
                        Key::Other => {
                            map.next_value::<de::IgnoredAny>()?;
                        }
                    }
                }
                Ok(row)
            }
        }
        d.deserialize_map(RowVisitor)
    }
}

enum Key {
    Id,
    Values,
    Other,
}
impl<'de> Deserialize<'de> for Key {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        struct V;
        impl<'de> Visitor<'de> for V {
            type Value = Key;
            fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
                f.write_str("key")
            }
            fn visit_str<E: de::Error>(self, v: &str) -> Result<Key, E> {
                Ok(match v {
                    "id" => Key::Id,
                    "values" => Key::Values,
                    _ => Key::Other,
                })
            }
        }
        d.deserialize_identifier(V)
    }
}

enum Scalar {
    Int(i32),
    Str(String),
}
impl<'de> Deserialize<'de> for Scalar {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        struct V;
        impl<'de> Visitor<'de> for V {
            type Value = Scalar;
            fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
                f.write_str("number or string")
            }
            fn visit_i64<E: de::Error>(self, v: i64) -> Result<Scalar, E> {
                i32::try_from(v).map(Scalar::Int).map_err(E::custom)
            }
            fn visit_u64<E: de::Error>(self, v: u64) -> Result<Scalar, E> {
                i32::try_from(v).map(Scalar::Int).map_err(E::custom)
            }
            fn visit_str<E: de::Error>(self, v: &str) -> Result<Scalar, E> {
                Ok(Scalar::Str(v.to_owned()))
            }
            fn visit_string<E: de::Error>(self, v: String) -> Result<Scalar, E> {
                Ok(Scalar::Str(v))
            }
        }
        d.deserialize_any(V)
    }
}

/// The backend's deterministic fixture (dotnet/ContentService/Program.cs), for the in-process micro-bench.
pub fn fixture(rows: i32, token: &str, strings: bool) -> Page {
    Page {
        token: token.to_owned(),
        title: "SSR benchmark <content> & data".to_owned(),
        markdown: String::new(),
        rows: (0..rows)
            .map(|i| {
                let mut row = Row { id: i, values: Vec::new(), text_values: Vec::new() };
                for field in 0..10 {
                    let v = i * 100 + field;
                    if strings {
                        row.text_values.push(if field == 3 { format!("<b>\"{v}\"</b> & 'é€漢字𝄞'") } else { v.to_string() });
                    } else {
                        row.values.push(v);
                    }
                }
                row
            })
            .collect(),
    }
}
