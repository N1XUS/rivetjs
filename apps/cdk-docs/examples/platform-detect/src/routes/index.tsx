import { signal } from "@rivetjs/reactivity";
import { detectPlatform, type Platform } from "@rivetjs/cdk/platform";

export const head = { title: "detectPlatform()" };

const agents = {
  "iphone-safari": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  "android-chrome": "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36",
  "desktop-firefox": "Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0",
} as const;
type Agent = keyof typeof agents;

const flags: (keyof Platform)[] = ["BLINK", "WEBKIT", "SAFARI", "IOS", "ANDROID", "FIREFOX", "EDGE", "TRIDENT"];

// #region demo
export default function DetectPlatform() {
  const agent = signal<Agent>("iphone-safari");
  // Pure: the flags for a given user agent (getPlatform() passes the browser's own).
  const platform = () => detectPlatform({ isBrowser: true, userAgent: agents[agent()], chrome: agent() === "android-chrome", hasCSS: true });
  return (
    <section class="m-4 grid max-w-lg gap-3 text-sm">
      <div role="group" aria-label="User agent" class="flex flex-wrap gap-2">
        {(Object.keys(agents) as Agent[]).map((key) => (
          <button
            id={key}
            type="button"
            aria-pressed={agent() === key ? "true" : "false"}
            class="rounded-md border border-slate-300 px-3 py-1 aria-pressed:bg-teal-700 aria-pressed:text-white"
            onClick={() => agent.set(key)}
          >
            {key}
          </button>
        ))}
      </div>
      <p class="truncate font-mono text-xs text-slate-500">{agents[agent()]}</p>
      <ul id="flags" class="flex flex-wrap gap-1">
        {flags.map((flag) => (
          <li
            data-flag={flag}
            data-on={platform()[flag] ? "" : undefined}
            class="rounded bg-slate-100 px-2 py-0.5 font-mono text-slate-400 data-[on]:bg-teal-100 data-[on]:text-teal-900"
          >
            {flag}: {String(platform()[flag])}
          </li>
        ))}
      </ul>
    </section>
  );
}
// #endregion
