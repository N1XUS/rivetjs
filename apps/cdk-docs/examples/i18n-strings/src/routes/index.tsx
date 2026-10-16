import { signal } from "@rivetjs/reactivity";
import { formatString, getStringsForLocale, isRTL, type LocalizedStrings } from "@rivetjs/cdk/i18n";

export const head = { title: "Localized strings" };

// Plain {name} templates per locale (React Aria compiles its JSON into functions instead).
const strings: LocalizedStrings<"selected" | "clear"> = {
  "en-US": { selected: "{count} items selected", clear: "Clear selection" },
  de: { selected: "{count} Elemente ausgewählt", clear: "Auswahl löschen" },
  "pt-BR": { selected: "{count} itens selecionados", clear: "Limpar seleção" },
  "sr-Latn": { selected: "Izabrano stavki: {count}", clear: "Poništi izbor" },
  he: { selected: "{count} פריטים נבחרו", clear: "נקה בחירה" },
};

// #region demo
export default function Strings() {
  const locale = signal("de-AT");
  const count = signal(3);
  const table = () => getStringsForLocale(strings, locale());
  return (
    <section class="m-4 grid max-w-md gap-2 text-sm">
      <label class="grid gap-1">
        Locale
        <input
          id="locale"
          class="rounded border border-slate-300 px-2 py-1 font-mono"
          value={locale()}
          onInput={(event) => locale.set(event.currentTarget.value)}
        />
      </label>
      <button id="more" type="button" class="justify-self-start rounded-md border border-slate-300 px-3 py-1" onClick={() => count.update((n) => n + 1)}>
        Select one more
      </button>
      <p id="selected" dir={isRTL(locale()) ? "rtl" : "ltr"}>
        {formatString(table().selected, { count: count() })}
      </p>
      <p id="clear">{table().clear}</p>
    </section>
  );
}
// #endregion
