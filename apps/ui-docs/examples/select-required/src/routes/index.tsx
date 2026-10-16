// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/select/required.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { FieldError } from "@rivetjs/ui/field-error";
import { Form } from "@rivetjs/ui/form";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { Select } from "@rivetjs/ui/select";

export const head = { title: "Select: Required" };

// #region demo
export function Required() {
  const onSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const data: Record<string, string> = {};

    // Convert FormData to plain object
    formData.forEach((value, key) => {
      data[key] = value.toString();
    });

    alert("Form submitted successfully!");
  };

  return (
    <Form class="flex w-[256px] flex-col gap-4" onSubmit={onSubmit}>
      <Select isRequired class="w-full" name="state" placeholder="Select one">
        <Label>State</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            <ListBox.Item id="florida" textValue="Florida">
              Florida
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="delaware" textValue="Delaware">
              Delaware
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="california" textValue="California">
              California
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="texas" textValue="Texas">
              Texas
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="new-york" textValue="New York">
              New York
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="washington" textValue="Washington">
              Washington
              <ListBox.ItemIndicator />
            </ListBox.Item>
          </ListBox>
        </Select.Popover>
        <FieldError />
      </Select>
      <Select isRequired class="w-full" name="country" placeholder="Select a country">
        <Label>Country</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            <ListBox.Item id="usa" textValue="United States">
              United States
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="canada" textValue="Canada">
              Canada
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="mexico" textValue="Mexico">
              Mexico
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="uk" textValue="United Kingdom">
              United Kingdom
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="france" textValue="France">
              France
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="germany" textValue="Germany">
              Germany
              <ListBox.ItemIndicator />
            </ListBox.Item>
          </ListBox>
        </Select.Popover>
        <FieldError />
      </Select>
      <Button type="submit">Submit</Button>
    </Form>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Required />
    </div>
  );
}
