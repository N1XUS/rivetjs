import { t } from "@rivetjs/i18n";
import { alternates, i18nGuard } from "@rivetjs/i18n/router";
import { signal } from "@rivetjs/reactivity";
import { config } from "../../../i18n.config.ts";
import { guard } from "@rivetjs/router";

export const access = guard(i18nGuard(config));

export const head = ({ url }: { url: URL }) => ({ title: "Shop", links: alternates(url, config) });

// Rich messages (top-level tags) passed as props and rendered as the child's children: a value,
// and an accessor that tracks `n` (props are value snapshots).
function Help(props: { message: unknown }) {
  return <small>{props.message}</small>;
}
function Note(props: { message: () => unknown }) {
  return <aside>{props.message()}</aside>;
}

export default function Cart() {
  const n = signal(1);
  return (
    <main>
      <h1>{t("cart.title")}</h1>
      <button type="button" onClick={() => n.set(n() + 1)}>
        {t("cart.count", { n: n() })}
      </button>
      <p>{t("cart.badge", { n: n() })}</p>
      <Help message={t("cart.help", { link: (c) => <a href="/help">{c}</a> })} />
      <Note message={() => t("cart.terms", { n: n(), link: (c) => <a href="/terms">{c}</a> })} />
    </main>
  );
}
