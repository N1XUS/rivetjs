import type { PageProps } from "@rivetjs/router";
import { t } from "@rivetjs/i18n";
import { i18nGuard, localizeHref } from "@rivetjs/i18n/router";
import { signal } from "@rivetjs/reactivity";
import { config } from "../../../i18n.config.ts";
import { Minus, Plus } from "lucide";
import { Icon } from "../../components/Icon.tsx";
import { guard, entries } from "@rivetjs/router";

// Checks the `lang` segment and sets the page's language.
export const access = guard(i18nGuard(config));
// Static build: `/` is English; prerender `/uk` too.
export const paths = entries(() => [{ lang: "uk" }]);

export const head = { title: "Plurals" };

const names: Record<string, string> = { en: "English", uk: "Українська" };

// #region demo
export default function Cart({ params, url }: PageProps) {
  const locale = params.lang ?? config.defaultLocale;
  const count = signal(0);
  return (
    <div class="m-4 grid max-w-sm gap-3 text-sm">
      {/* Each language has its own browser build: switching loads the whole page (data-rivet-reload). */}
      <nav class="flex gap-3" aria-label="Language">
        {config.locales.map((lang) => (
          <a
            data-rivet-reload
            id={"lang-" + lang}
            href={localizeHref(url.pathname, lang, config)}
            hreflang={lang}
            aria-current={lang === locale ? "page" : undefined}
            class="text-teal-700 underline aria-[current=page]:font-semibold aria-[current=page]:no-underline"
          >
            {names[lang]}
          </a>
        ))}
      </nav>
      <div class="flex items-center gap-2">
        <button
          id="minus"
          type="button"
          aria-label={t("cart.remove")}
          class="w-8 rounded-md bg-slate-200 py-1 font-semibold"
          onClick={() => count.update((n) => Math.max(0, n - 1))}
        >
          <Icon icon={Minus} />
        </button>
        <button
          id="plus"
          type="button"
          aria-label={t("cart.add")}
          class="w-8 rounded-md bg-teal-700 py-1 font-semibold text-white"
          onClick={() => count.update((n) => n + 1)}
        >
          <Icon icon={Plus} />
        </button>
        <p id="count">{t("cart.count", { n: count() })}</p>
        {/* The plural category the language's rules pick for this number. */}
        <span id="form" class="rounded bg-slate-100 px-1.5 font-mono text-xs text-slate-600">
          {new Intl.PluralRules(locale).select(count())}
        </span>
      </div>
    </div>
  );
}
// #endregion
