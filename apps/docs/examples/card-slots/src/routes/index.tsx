import { signal } from "@rivetjs/reactivity";
import { Card } from "../components/Card.tsx";

export const head = { title: "Card slots" };

// #region demo
export default function Page() {
  const likes = signal(0);
  return (
    <div id="cards" class="m-4 grid max-w-sm gap-3 text-sm">
      <Card rows={["Named slots", "Scoped slots", "Fallbacks"]} row={(text, index) => <li>{index() + 1}. {text()}</li>}>
        <h2 r:slot="header" class="font-semibold">Slots in Rivet</h2>
        <p>This paragraph goes into the default slot.</p>
        <button r:slot="footer" id="like" type="button" onClick={() => likes.update((n) => n + 1)}>
          Like ({likes()})
        </button>
      </Card>
      <Card rows={[]}>A card without named slots shows the fallbacks.</Card>
    </div>
  );
}
// #endregion
