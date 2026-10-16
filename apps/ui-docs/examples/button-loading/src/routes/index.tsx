// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/button/loading.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { Spinner } from "@rivetjs/ui/spinner";

export const head = { title: "Button: Loading" };

// #region demo
export function Loading() {
  return (
    <Button isPending>
      {({ isPending }) => (
        <>
          {isPending() ? <Spinner color="current" size="sm" /> : null}
          Uploading...
        </>
      )}
    </Button>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Loading />
    </div>
  );
}
