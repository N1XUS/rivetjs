// Sub-form views: `scope(form, "billing")` roots reads, ids and names at a path, so one address
// component serves billing and shipping. One store, one submit; the app composes the schema.
import type { Form, FormView } from "./store.ts";
import { prefixOf, storeOf } from "./store.ts";
import type { FieldPath, PathValue } from "./types.ts";

/** A typed view of `form` rooted at `path` (views of views nest). Serializable: `{ s, p }`. */
export function scope<T, P extends FieldPath<T>>(form: Form<T>, path: P): FormView<NonNullable<PathValue<T, P>>> {
  return { s: storeOf(form), p: prefixOf(form) + path + "." };
}
/** The view's absolute path prefix without the trailing dot (`""` for a whole form). */
export const scopePath = (form: Form<any>): string => prefixOf(form).slice(0, -1);
