// Type-level field paths: dotted template-literal unions mirroring the FormData names.
import type { StandardSchemaV1 } from "./standard-schema.ts";

/** Values that end a path (no deeper fields). */
type Leaf = string | number | boolean | bigint | symbol | null | undefined | Date | Blob | FileList | RegExp | ((...args: never[]) => unknown);
type Depth = [never, 0, 1, 2, 3, 4, 5, 6, 7];

/**
 * Every field path of `T`: `"email" | "address" | "address.city" | "tags" | `tags.${number}` | …`
 * (arrays as `${number}`, depth capped at 8). Optional/nullable parents are traversed.
 */
export type FieldPath<T, D extends number = 8> = [D] extends [never]
  ? never
  : T extends Leaf
    ? never
    : T extends readonly (infer U)[]
      ? `${number}` | `${number}.${FieldPath<NonNullable<U>, Depth[D]>}`
      : { [K in keyof T & string]: K | `${K}.${FieldPath<NonNullable<T[K]>, Depth[D]>}` }[keyof T & string];

type Step<T, K extends string> = T extends readonly (infer U)[] ? (K extends `${number}` ? U : undefined) : K extends keyof T ? T[K] : undefined;
/** The value type at path `P` of `T`. */
export type PathValue<T, P extends string> = P extends `${infer Head}.${infer Rest}` ? PathValue<NonNullable<Step<NonNullable<T>, Head>>, Rest> : Step<NonNullable<T>, P>;
/** Paths of `T` whose value is an array (field arrays). */
export type FieldArrayPath<T> = { [P in FieldPath<T>]: NonNullable<PathValue<T, P>> extends readonly unknown[] ? P : never }[FieldPath<T>];

/** A validation issue: `key` is an i18n message key or a literal message; serializable. */
export interface Issue {
  readonly key: string;
  readonly params?: Readonly<Record<string, string | number>>;
  readonly message?: string;
}
/** Issue input accepted by `invalid()` / `setIssues()`: a key/message string or an issue. */
export type IssueLike = string | Issue;

/** Schema-typed pieces of a definition, for inference. */
export interface Schematic<S extends StandardSchemaV1 = StandardSchemaV1> {
  readonly schema: S;
}
/** Input type (what the form edits; paths are typed against it). */
export type InferInput<D> = D extends Schematic<infer S> ? StandardSchemaV1.InferInput<S> : never;
/** Output type (what the action receives after parsing). */
export type InferOutput<D> = D extends Schematic<infer S> ? StandardSchemaV1.InferOutput<S> : never;
