// Rivet addition (no upstream demo): SearchField shorthand, same parts as the compound form.
import { SearchField } from "@rivetjs/ui/search-field";

export const head = { title: "SearchField: Shorthand" };

// #region demo
export function Shorthand() {
  return <SearchField class="w-full max-w-72" name="shorthand-search" label="Search" placeholder="Search..." description="Titles and authors" />;
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Shorthand />
    </div>
  );
}
