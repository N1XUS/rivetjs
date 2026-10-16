// Localized "Dismiss" label of `DismissButton` (34 locales).
//
// Ported from @react-aria/overlays (intl/overlays/*.json), Apache-2.0, © Adobe.

/** Locale → "Dismiss" label. */
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

/** The label for `locale`: exact match, then language match (`de` → `de-DE`), else English. */
export function dismissLabel(locale?: string | null): string {
  if (locale) {
    if (dismissStrings[locale]) return dismissStrings[locale]!;
    const language = locale.split("-")[0]!.toLowerCase();
    for (const key in dismissStrings) if (key.split("-")[0]!.toLowerCase() === language) return dismissStrings[key]!;
  }
  return dismissStrings["en-US"]!;
}
