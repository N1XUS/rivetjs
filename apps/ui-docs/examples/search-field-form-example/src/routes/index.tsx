// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/search-field/form-example.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Description } from "@rivetjs/ui/description";
import { FieldError } from "@rivetjs/ui/field-error";
import { Form } from "@rivetjs/ui/form";
import { Label } from "@rivetjs/ui/label";
import { SearchField } from "@rivetjs/ui/search-field";
import { Spinner } from "@rivetjs/ui/spinner";

export const head = { title: "SearchField: Form Example" };

// #region demo
export function FormExample() {
  const value = signal("");
  const isSubmitting = signal(false);
  const MIN_LENGTH = 3;
  const isInvalid = () => value().length > 0 && value().length < MIN_LENGTH;

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();

    if (value().length < MIN_LENGTH) {
      return;
    }

    isSubmitting.set(true);

    // Simulate API call
    setTimeout(() => {
      console.log("Search submitted:", { query: value() });
      value.set("");
      isSubmitting.set(false);
    }, 1500);
  };

  return (
    <Form class="flex w-[280px] flex-col gap-4" onSubmit={handleSubmit}>
      <SearchField isRequired isInvalid={isInvalid} name="search" value={value}>
        <Label>Search products</Label>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input class="w-full" placeholder="Search products..." />
          <SearchField.ClearButton />
        </SearchField.Group>
        {isInvalid() ? (
          <FieldError>Search query must be at least {MIN_LENGTH} characters</FieldError>
        ) : (
          <Description>Enter at least {MIN_LENGTH} characters to search</Description>
        )}
      </SearchField>
      <Button class="w-full" isDisabled={() => value().length < MIN_LENGTH} isPending={isSubmitting} type="submit" variant="primary">
        {isSubmitting() ? (
          <>
            <Spinner color="current" size="sm" />
            Searching...
          </>
        ) : (
          "Search"
        )}
      </Button>
    </Form>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <FormExample />
    </div>
  );
}
