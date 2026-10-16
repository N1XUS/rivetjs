//! TypeScript syntax removal for emitted modules (the `ts.transpileModule` step): types, type-only
//! imports and, for TypeScript files, value imports that are never referenced.

use std::path::Path;

use oxc_allocator::{Allocator, TakeIn};
use oxc_ast::{AstBuilder, ast::Expression};
use oxc_ast_visit::{VisitMut, walk_mut};
use oxc_codegen::{Codegen, CodegenOptions};
use oxc_parser::{ParseOptions, Parser};
use oxc_semantic::SemanticBuilder;
use oxc_transformer::{JsxOptions, TransformOptions, Transformer, TypeScriptOptions};

/// JavaScript files keep every value import (TypeScript never elides imports in JS files). With `map`
/// (the original source and the marks extracted from `text`), also returns the source map JSON.
pub fn strip_types(
    text: &str,
    filename: &str,
    javascript: bool,
    map: Option<(&str, &[crate::map::Segment])>,
) -> Result<(String, Option<String>), String> {
    let allocator = Allocator::default();
    let parsed = Parser::new(&allocator, text, crate::source_type::of_output(filename))
        .with_options(ParseOptions { preserve_parens: true, ..ParseOptions::default() })
        .parse();
    if parsed.panicked || !parsed.errors.is_empty() {
        return Err(parsed.errors.first().map_or_else(|| "parse failed".to_string(), |e| e.message.to_string()));
    }
    let mut program = parsed.program;
    let scoping = SemanticBuilder::new().build(&program).semantic.into_scoping();
    let options = TransformOptions {
        typescript: TypeScriptOptions { only_remove_type_imports: javascript, ..TypeScriptOptions::default() },
        jsx: JsxOptions::disable(),
        ..TransformOptions::default()
    };
    let result = Transformer::new(&allocator, Path::new(filename), &options).build_with_scoping(scoping, &mut program);
    if let Some(error) = result.errors.first() {
        return Err(error.message.to_string());
    }
    KeepFunctionParens { ast: AstBuilder::new(&allocator) }.visit_program(&mut program);
    let Some((original, segments)) = map else { return Ok((Codegen::new().build(&program).code, None)) };
    let options = CodegenOptions { source_map_path: Some(filename.into()), ..CodegenOptions::default() };
    let output = Codegen::new().with_options(options).build(&program);
    let json = output.map.map(|map| {
        let tokens = map.get_tokens().map(|t| crate::map::Token {
            dst_line: t.get_dst_line(),
            dst_col: t.get_dst_col(),
            src_line: t.get_src_line(),
            src_col: t.get_src_col(),
            name: t.get_name_id().and_then(|id| map.get_name(id)),
        });
        crate::map::compose(tokens, text, segments, original, filename)
    });
    Ok((output.code, json))
}

/// Codegen drops source parentheses; TypeScript's printer keeps them, and esbuild keeps them around
/// function expressions (V8 eager-compile hint). Re-wrap parenthesized functions as one-element
/// sequences, which codegen parenthesizes in every operand position.
struct KeepFunctionParens<'a> {
    ast: AstBuilder<'a>,
}

impl<'a> VisitMut<'a> for KeepFunctionParens<'a> {
    fn visit_expression(&mut self, it: &mut Expression<'a>) {
        walk_mut::walk_expression(self, it);
        let Expression::ParenthesizedExpression(paren) = it else { return };
        let span = paren.span;
        let mut inner = &mut paren.expression;
        while let Expression::ParenthesizedExpression(nested) = inner {
            inner = &mut nested.expression;
        }
        if matches!(inner, Expression::ArrowFunctionExpression(_) | Expression::FunctionExpression(_)) {
            let function = inner.take_in(self.ast.allocator);
            *it = self.ast.expression_sequence(span, self.ast.vec1(function));
        }
    }
}
