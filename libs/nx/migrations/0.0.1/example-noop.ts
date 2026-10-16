// Example migration (`migrations.json` "example-noop", version 0.0.1: below every release, so `nx migrate` never
// selects it for a real workspace). It is the template for future breaking releases: a migration is a generator
// `(tree) => void | callback` that rewrites user code / config in the tree, with a test in `tests/migrations.test.ts`.
import type { Tree } from "@nx/devkit";

export default async function exampleNoopMigration(_tree: Tree): Promise<void> {
  // A real migration edits files here, e.g. `visitNotIgnoredFiles(tree, ".", (path) => …)` + `formatFiles(tree)`.
}
