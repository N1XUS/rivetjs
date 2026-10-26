// Localized "Dismiss" label of `DismissButton` (34 locales).
//
// Ported from @react-aria/overlays (intl/overlays/*.json), Apache-2.0, © Adobe.

/** Locale → "Dismiss" label. */
// @rivet-locale-table
export const dismissStrings: Record<string, string> = {
  "ar-AE": "تجاهل",
  "bg-BG": "Отхвърляне",
  "cs-CZ": "Odstranit",
  "da-DK": "Luk",
  "de-DE": "Schließen",
  "el-GR": "Απόρριψη",
  "en-US": "Dismiss",
  "es-ES": "Descartar",
  "et-EE": "Lõpeta",
  "fi-FI": "Hylkää",
  "fr-FR": "Rejeter",
  "he-IL": "התעלם",
  "hr-HR": "Odbaci",
  "hu-HU": "Elutasítás",
  "it-IT": "Ignora",
  "ja-JP": "閉じる",
  "ko-KR": "무시",
  "lt-LT": "Atmesti",
  "lv-LV": "Nerādīt",
  "nb-NO": "Lukk",
  "nl-NL": "Negeren",
  "pl-PL": "Zignoruj",
  "pt-BR": "Descartar",
  "pt-PT": "Dispensar",
  "ro-RO": "Revocare",
  "ru-RU": "Пропустить",
  "sk-SK": "Zrušiť",
  "sl-SI": "Opusti",
  "sr-SP": "Odbaci",
  "sv-SE": "Avvisa",
  "tr-TR": "Kapat",
  "uk-UA": "Скасувати",
  "zh-CN": "取消",
  "zh-TW": "關閉",
};

// A locale table a production browser build trimmed to its languages (`@rivetjs/compiler` `locale-tables.ts`):
// `{ l: languages, f: () => full table }` under `Symbol.for("rivet.locales")`. The full table once loaded, else the
// trimmed one, starting the load for a language outside `l`. File-local on purpose (copies in `_adapters/intl.ts`,
// `i18n/index.ts`, `overlay/overlay-strings.ts`): a shared module became its own chunk (+1 request on 559 ui frames).
const TRIMMED = Symbol.for("rivet.locales");
function localeTable<T extends object>(strings: T, locale: string | null | undefined): T {
  const trimmed = (strings as { [TRIMMED]?: { l: readonly string[]; f(): Promise<object>; t?: object; p?: Promise<void> } })[TRIMMED];
  if (!trimmed) return strings;
  if (!trimmed.t && !trimmed.p && locale && !trimmed.l.includes(locale.split("-")[0]!.toLowerCase()))
    trimmed.p = trimmed.f().then(
      (full) => void (trimmed.t = full),
      () => void (trimmed.p = undefined),
    );
  return (trimmed.t as T | undefined) ?? strings;
}

/** The label for `locale`: exact match, then language match (`de` → `de-DE`), else English. */
export function dismissLabel(locale?: string | null): string {
  const strings = localeTable(dismissStrings, locale);
  if (locale) {
    if (strings[locale]) return strings[locale]!;
    const language = locale.split("-")[0]!.toLowerCase();
    for (const key in strings) if (key.split("-")[0]!.toLowerCase() === language) return strings[key]!;
  }
  return strings["en-US"]!;
}
