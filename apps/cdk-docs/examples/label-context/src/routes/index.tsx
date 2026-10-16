import { signal } from "@rivetjs/reactivity";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { Provider } from "@rivetjs/cdk/slots";
import { Label, LabelContext, Text, TextContext, fieldProps } from "@rivetjs/cdk/label";
import { Input, InputContext } from "@rivetjs/cdk/input";

export const head = { title: "Label and Input contexts" };

// #region demo
function EmailField(props: { id: string; children?: Content }) {
  const value = signal("");
  const ids = fieldProps({ id: props.id, label: true, description: true });
  const children = props.children;
  return (
    <div class="field">
      <Provider
        values={[
          [LabelContext, ids.labelProps],
          [
            InputContext,
            {
              ...ids.fieldProps,
              type: "email",
              "aria-describedby": ids.descriptionId,
              "aria-invalid": () => value() !== "" && !value().includes("@"),
              onInput: (e: Event) => value.set((e.currentTarget as HTMLInputElement).value),
            },
          ],
          [TextContext, { slots: { description: { id: ids.descriptionId } } }],
        ]}
      >
        {children}
      </Provider>
    </div>
  );
}

export default function LabelContextDemo() {
  return (
    <div class="demo">
      <EmailField id="lc-input">
        <Label>Email</Label>
        <Input />
        <Text slot="description">Work address</Text>
      </EmailField>
    </div>
  );
}
// #endregion
