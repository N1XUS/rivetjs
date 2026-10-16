// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/button/loading-state.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { Icon } from "@rivetjs/kit/icon";
import { Paperclip } from "lucide";
import { Button } from "@rivetjs/ui/button";
import { Spinner } from "@rivetjs/ui/spinner";

export const head = { title: "Button: Loading State" };

// #region demo
export function LoadingState() {
  const isLoading = signal(false);

  return (
    <Button
      isPending={() => isLoading()}
      onPress={() => {
        isLoading.set(true);
        setTimeout(() => isLoading.set(false), 2000);
      }}
    >
      {({ isPending }) => (
        <>
          {isPending() ? <Spinner color="current" size="sm" /> : <Icon icon={Paperclip} size={16} />}
          {isPending() ? "Uploading..." : "Upload File"}
        </>
      )}
    </Button>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <LoadingState />
    </div>
  );
}
