// Framework panes: router, i18n and forms state, read only through what those libraries expose for
// development (their `development` export façades report describers to the hook; the i18n plugin
// serves `<base>__rivet/i18n.json` on the dev server). Never imports the libraries themselves.
import type { RawEvent } from "./hook.ts";
import type { Model } from "./model.ts";
import type { FormInfo, I18nInfo, RouterInfo } from "../protocol.ts";

interface Issue {
  key: string;
  message?: string;
}
interface FormRecord {
  store: WeakRef<object>;
  owner: WeakRef<object> | null;
  describe: () => Record<string, unknown>;
}
interface AutosaveRecord {
  owner: WeakRef<object> | null;
  describe: () => Record<string, unknown>;
}
const MISSING = "rivet i18n: missing message ";
const text = (issue: Issue): string => issue.message ?? issue.key;

export class Libs {
  private router: (() => Record<string, unknown>) | null = null;
  private forms: FormRecord[] = [];
  private autosaves: AutosaveRecord[] = [];
  private missing = new Map<string, number>();
  private i18n: Promise<Record<string, unknown> | null> | null = null;
  /** Called when a pane's data changed (the agent forwards `lib.changed`). */
  onChange: ((lib: "router" | "forms" | "i18n") => void) | null = null;
  private model: Model;
  private base: string;

  constructor(model: Model, base: string) {
    this.model = model;
    this.base = base;
  }

  /** Hook events of the libraries' development façades. */
  handle(event: RawEvent): void {
    const d = event.d;
    switch (event.t) {
      case "lib.register":
        if (d.lib === "router") this.router = d.describe as () => Record<string, unknown>;
        this.onChange?.("router");
        break;
      case "lib.changed":
        this.onChange?.(d.lib as "router");
        break;
      case "lib.form":
        this.forms.push({ store: new WeakRef(d.store as object), owner: d.owner ? new WeakRef(d.owner as object) : null, describe: d.describe as () => Record<string, unknown> });
        if (this.forms.length > 200) this.forms.shift();
        this.onChange?.("forms");
        break;
      case "lib.autosave":
        this.autosaves.push({ owner: d.owner ? new WeakRef(d.owner as object) : null, describe: d.describe as () => Record<string, unknown> });
        if (this.autosaves.length > 200) this.autosaves.shift();
        this.onChange?.("forms");
        break;
    }
  }
  /** Dev `t()` lookups of unknown prefixed keys warn `rivet i18n: missing message <key>`: count them. */
  watchConsole(): void {
    const original = console.warn;
    console.warn = (...args: unknown[]) => {
      if (typeof args[0] === "string" && args[0].startsWith(MISSING)) {
        const key = args[0].slice(MISSING.length);
        this.missing.set(key, (this.missing.get(key) ?? 0) + 1);
        if (this.missing.size > 500) this.missing.delete(this.missing.keys().next().value!);
        this.onChange?.("i18n");
      }
      return original.apply(console, args as []);
    };
  }

  private i18nConfig(): Promise<Record<string, unknown> | null> {
    this.i18n ??= fetch(this.base + "__rivet/i18n.json", { headers: { accept: "application/json" } })
      .then((response) => (response.ok && (response.headers.get("content-type") ?? "").includes("json") ? (response.json() as Promise<Record<string, unknown>>) : null))
      .catch(() => null);
    return this.i18n;
  }
  async available(): Promise<{ router: boolean; i18n: boolean; forms: boolean }> {
    return { router: this.router !== null, i18n: (await this.i18nConfig()) !== null, forms: this.live().length > 0 || this.autosaves.length > 0 };
  }

  routerInfo(): RouterInfo | null {
    if (!this.router) return null;
    const raw = this.router() as unknown as Omit<RouterInfo, "data"> & { data: { id: string; value: unknown }[] };
    return { ...raw, data: raw.data.map((entry) => ({ id: entry.id, value: this.model.preview(entry.value) })) };
  }

  async i18nInfo(): Promise<I18nInfo | null> {
    // Refetched per request: catalog edits re-register the table on the dev server.
    this.i18n = null;
    const config = await this.i18nConfig();
    if (!config) return null;
    const locales = config.locales as string[], fallback = config.defaultLocale as string, param = (config.param as string) ?? "rivet-locale";
    // The page's locale: its client modules carry `?rivet-locale=` (non-default locales), else <html lang>.
    let locale: string | null = null;
    try {
      for (const entry of performance.getEntriesByType("resource")) {
        const found = new URL(entry.name).searchParams.get(param);
        if (found && locales.includes(found)) {
          locale = found;
          break;
        }
      }
    } catch {}
    const lang = document.documentElement.lang;
    locale ??= locales.includes(lang) ? lang : fallback;
    const dir = (document.documentElement.dir || getComputedStyle(document.documentElement).direction) === "rtl" ? "rtl" : "ltr";
    return {
      locales,
      defaultLocale: fallback,
      locale,
      dir,
      catalogs: (config.catalogs as I18nInfo["catalogs"]) ?? [],
      keys: (config.keys as number) ?? 0,
      fallbacks: (config.fallbacks as string[]) ?? [],
      missing: [...this.missing].map(([key, count]) => ({ key, count })),
    };
  }

  /** Forms whose creating owner is still live. */
  private live(): FormRecord[] {
    this.forms = this.forms.filter((form) => {
      if (!form.store.deref()) return false;
      const owner = form.owner?.deref();
      return !owner || !this.model.disposed(owner);
    });
    return this.forms;
  }
  formsInfo(): FormInfo[] {
    const out: FormInfo[] = [];
    const used = new Set<AutosaveRecord>();
    for (const form of this.live()) {
      let raw: Record<string, unknown>;
      try {
        raw = form.describe();
      } catch {
        continue;
      }
      const owner = form.owner?.deref() ?? null;
      const comp = owner ? this.model.compRef(owner) : null;
      const auto = this.autosaves.find((a) => {
        const at = a.owner?.deref();
        return at && owner && (at === owner || this.model.compRef(at)?.id === comp?.id);
      });
      if (auto) used.add(auto);
      const autosave = auto ? this.autosave(auto) : undefined;
      const errors = raw.errors as Record<string, Issue[]>;
      out.push({
        id: raw.id as string,
        name: raw.name as string,
        ...(comp ? { component: comp } : {}),
        mounted: raw.mounted as boolean,
        values: this.model.preview(raw.values),
        errors: Object.entries(errors).map(([path, issues]) => ({ path, issues: issues.map(text) })),
        formErrors: (raw.formErrors as Issue[]).map(text),
        touched: raw.touched as string[],
        dirty: raw.dirty as string[],
        submitting: raw.submitting as boolean,
        submitted: raw.submitted as boolean,
        validating: raw.validating as boolean,
        enhanced: raw.enhanced as boolean,
        submitCount: raw.submitCount as number,
        ...("result" in raw ? { result: this.model.preview(raw.result) } : {}),
        ...(autosave ? { autosave } : {}),
      });
    }
    // Autosave states without a form store in their component (plain `<form>` + `onAutosave`).
    this.autosaves = this.autosaves.filter((a) => {
      const owner = a.owner?.deref();
      return !owner || !this.model.disposed(owner);
    });
    for (const auto of this.autosaves) {
      if (used.has(auto)) continue;
      const autosave = this.autosave(auto);
      if (!autosave) continue;
      const owner = auto.owner?.deref();
      const comp = owner ? this.model.compRef(owner) : null;
      out.push({
        id: autosave.draft ?? "autosave",
        name: "autosave",
        ...(comp ? { component: comp } : {}),
        mounted: true,
        values: this.model.preview(undefined),
        errors: [],
        formErrors: [],
        touched: [],
        dirty: [],
        submitting: false,
        submitted: false,
        validating: false,
        enhanced: false,
        submitCount: 0,
        autosave,
        autosaveOnly: true,
      });
    }
    return out;
  }
  private autosave(auto: AutosaveRecord): FormInfo["autosave"] | undefined {
    try {
      const a = auto.describe() as { status: string; version?: string | number; unsavedFields: number; savedAt?: number; error?: Issue; conflict?: { version: string | number }; draft?: string };
      return {
        status: a.status,
        unsavedFields: a.unsavedFields,
        ...(a.version !== undefined ? { version: a.version } : {}),
        ...(a.savedAt !== undefined ? { savedAt: a.savedAt } : {}),
        ...(a.error ? { error: text(a.error) } : {}),
        ...(a.conflict ? { conflict: a.conflict.version } : {}),
        ...(a.draft ? { draft: a.draft } : {}),
      };
    } catch {
      return undefined;
    }
  }
}
