// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/search-field/with-keyboard-shortcut.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { clientEffect, ref } from "@rivetjs/runtime/dom";
import { signal } from "@rivetjs/reactivity";
import { Description } from "@rivetjs/ui/description";
import { Kbd } from "@rivetjs/ui/kbd";
import { Label } from "@rivetjs/ui/label";
import { SearchField } from "@rivetjs/ui/search-field";

export const head = { title: "SearchField: With Keyboard Shortcut" };

// #region demo
export function WithKeyboardShortcut() {
  const inputRef = ref<HTMLInputElement>();
  const value = signal("");

  clientEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Shift+S
      if (e.shiftKey && e.key === "S" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        inputRef()?.focus();
      }
      // Check for ESC key to blur the input
      if (e.key === "Escape" && document.activeElement === inputRef()) {
        inputRef()?.blur();
      }
    };

    // Add global event listener
    window.addEventListener("keydown", handleKeyDown);

    // Cleanup on unmount
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  });

  return (
    <div class="flex flex-col gap-4">
      <div>
        <SearchField name="search" value={value}>
          <Label>Search</Label>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input ref={inputRef} class="w-[280px]" placeholder="Search..." />
            <SearchField.ClearButton />
          </SearchField.Group>
          <Description>Use keyboard shortcut to quickly focus this field</Description>
        </SearchField>
      </div>
      <div class="text-default-500 flex items-center gap-2 text-sm">
        <span>Press</span>
        <Kbd>
          <Kbd.Abbr keyValue="shift" />
          <Kbd.Content>S</Kbd.Content>
        </Kbd>
        <span>to focus the search field</span>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithKeyboardShortcut />
    </div>
  );
}
