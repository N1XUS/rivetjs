import type { PageProps } from "@rivetjs/router";
import { t } from "@rivetjs/i18n";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { i18nGuard, localizeHref } from "@rivetjs/i18n/router";
import { signal } from "@rivetjs/reactivity";
import { config } from "../../../i18n.config.ts";
import { guard, entries } from "@rivetjs/router";

// Checks the `lang` segment and sets the page's language.
export const access = guard(i18nGuard(config));
// Static build: `/` is English; prerender `/uk` too.
export const paths = entries(() => [{ lang: "uk" }]);

export const head = { title: "Messages" };

const names: Record<string, string> = { en: "English", uk: "Українська" };
const sections = ["home", "shop", "help"];

// #region demo
export default function Greeting({ params, url }: PageProps) {
  const locale = params.lang ?? config.defaultLocale;
  const name = signal("Ada");
  return (
    <div class="m-4 grid max-w-sm gap-3 text-sm">
      <nav class="flex gap-3" aria-label="Language">
        {config.locales.map((lang) => (
          // A link to another language loads that page's document (its own browser build).
          <a
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
      {/* A key chosen at runtime: every key under `nav.` is compiled in. */}
      <ul id="sections" class="flex gap-3 text-slate-600">
        {sections.map((id) => (
          <li>{t(`nav.${id}`)}</li>
        ))}
      </ul>
      <label class="grid gap-1">
        {t("greet.label")}
        <input id="name" class="rounded border border-slate-300 px-2 py-1" model:value={name} placeholder={t("greet.label")} />
      </label>
      {/* A parameter that reads a signal: the text updates as you type. */}
      <p id="hello" class="text-base font-semibold">
        {t("greet.hello", { name: name() })}
      </p>
      {/* Tags in a message: <b> works as is, <link> is a parameter that returns JSX. */}
      <p id="terms">
        {t("greet.terms", {
          link: (c: Content) => (
            <a class="text-teal-700 underline" href="#terms">
              {c}
            </a>
          ),
        })}
      </p>
    </div>
  );
}
// #endregion
