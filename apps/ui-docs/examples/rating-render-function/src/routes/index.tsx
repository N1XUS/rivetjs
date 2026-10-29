// Rivet-authored Rating demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Rating } from "@rivetjs/ui/rating";

export const head = { title: "Rating: render function" };

// #region demo
export function RenderFunction() {
  return (
    <Rating
      id="rt-render"
      defaultValue={7}
      maxValue={10}
      aria-label="How likely are you to recommend us"
      renderItem={(item) => (
        <span
          class={`flex size-full items-center justify-center rounded-md text-xs font-medium ${item.isActive ? "bg-accent text-accent-foreground" : "bg-default text-muted"}`}
        >
          {item.value}
        </span>
      )}
      class="[--rating-size:1.75rem]"
    />
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <RenderFunction />
    </div>
  );
}
