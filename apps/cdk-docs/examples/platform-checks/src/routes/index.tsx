import { signal } from "@rivetjs/reactivity";
import {
  getPlatform,
  getSupportedInputTypes,
  isAndroid,
  isAppleDevice,
  isChrome,
  isFirefox,
  isIOS,
  isMac,
  isSafari,
  isWebKit,
  supports,
  supportsScrollBehavior,
} from "@rivetjs/cdk/platform";

export const head = { title: "Platform checks" };

// #region demo
export default function PlatformChecks() {
  // Server HTML is cached and shared between browsers: never branch markup on these.
  // Read them in a handler (or a client effect) and keep the result in a signal.
  const rows = signal<[string, string][]>([]);
  const detect = () => {
    const platform = getPlatform();
    rows.set([
      ["isMac()", String(isMac())],
      ["isIOS()", String(isIOS())],
      ["isAppleDevice()", String(isAppleDevice())],
      ["isAndroid()", String(isAndroid())],
      ["isChrome()", String(isChrome())],
      ["isWebKit()", String(isWebKit())],
      ["isSafari()", String(isSafari())],
      ["isFirefox()", String(isFirefox())],
      ['supports("field-sizing")', String(supports("field-sizing"))],
      ['supports("base-select")', String(supports("base-select"))],
      ["getPlatform().BLINK", String(platform.BLINK)],
      ["getPlatform().isBrowser", String(platform.isBrowser)],
      ["supportsScrollBehavior()", String(supportsScrollBehavior())],
      ['getSupportedInputTypes().has("date")', String(getSupportedInputTypes().has("date"))],
    ]);
  };
  return (
    <section class="m-4 grid max-w-md gap-2 text-sm">
      <button id="detect" type="button" class="justify-self-start rounded-md bg-teal-700 px-3 py-1 font-semibold text-white" onClick={detect}>
        Detect
      </button>
      <table id="results" class="w-full text-left">
        <tbody>
          {rows().length === 0 ? (
            <tr>
              <td id="empty" class="text-slate-500">
                Not detected yet (the server cannot know)
              </td>
            </tr>
          ) : (
            rows().map(([check, value]) => (
              <tr data-check={check}>
                <th scope="row" class="py-0.5 pe-4 font-mono font-normal">
                  {check}
                </th>
                <td class="font-mono">{value}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
// #endregion
