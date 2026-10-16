import { t } from "@rivetjs/i18n";
import { signal } from "@rivetjs/reactivity";

export default function Page() {
  const n = signal(1);
  return (
    <main>
      <h1>{t("cart.title")}</h1>
      <button onClick={() => n.set(n() + 1)}>{t("cart.count", { n: n() })}</button>
    </main>
  );
}
