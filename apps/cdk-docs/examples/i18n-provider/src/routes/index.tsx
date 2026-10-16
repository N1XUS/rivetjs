import { signal } from "@rivetjs/reactivity";
import { I18nProvider, useLocale } from "@rivetjs/cdk/i18n-provider";
import { getDateFormatter } from "@rivetjs/cdk/i18n";

export const head = { title: "I18nProvider" };

const launch = new Date(Date.UTC(2026, 0, 15));

// #region demo
// Reads the nearest I18nProvider (React Aria useLocale), else <html lang> / navigator.language ("en-US" on the server).
function LaunchDate(props: { id: string }) {
  const { locale, direction } = useLocale();
  const formatter = getDateFormatter(locale, { dateStyle: "full", timeZone: "UTC" });
  return (
    <p id={props.id} dir={direction} lang={locale} class="rounded bg-slate-100 px-2 py-1">
      <span class="font-mono text-xs text-slate-500">{locale}</span> {formatter.format(launch)}
    </p>
  );
}

export default function Locales() {
  const locale = signal("de-DE");
  return (
    <section class="m-4 grid max-w-md gap-2 text-sm">
      <div role="group" aria-label="Locale" class="flex gap-2">
        {["de-DE", "ja-JP", "ar-EG"].map((option) => (
          <button
            id={`set-${option}`}
            type="button"
            aria-pressed={locale() === option ? "true" : "false"}
            class="rounded-md border border-slate-300 px-3 py-1 aria-pressed:bg-teal-700 aria-pressed:text-white"
            onClick={() => locale.set(option)}
          >
            {option}
          </button>
        ))}
      </div>
      {/* A function child runs inside the provider; one branch per locale re-creates it on change. */}
      {locale() === "de-DE" ? (
        <I18nProvider locale="de-DE">{() => <LaunchDate id="inside" />}</I18nProvider>
      ) : locale() === "ja-JP" ? (
        <I18nProvider locale="ja-JP">{() => <LaunchDate id="inside" />}</I18nProvider>
      ) : (
        <I18nProvider locale="ar-EG">{() => <LaunchDate id="inside" />}</I18nProvider>
      )}
      <LaunchDate id="outside" />
    </section>
  );
}
// #endregion
