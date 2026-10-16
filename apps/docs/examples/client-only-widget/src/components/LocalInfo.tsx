// This module only ever runs in the browser, so it may read browser globals anywhere.
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const language = navigator.language;

export default function LocalInfo() {
  return (
    <p id="widget" class="rounded-lg bg-teal-50 p-3 text-teal-900">
      Browser language: {language} · Time zone: {zone}
    </p>
  );
}
