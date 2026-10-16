const language = window.navigator.language;

/** Browser-only module. Server compilation replaces its supported clientOnly import with fallback. */
export default function BrowserWidget() {
  return (
    <p id="browser-widget" class="text-sm text-slate-500">
      Browser widget ready · {language}
    </p>
  );
}
