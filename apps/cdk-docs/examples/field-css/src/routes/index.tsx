import { Provider } from "@rivetjs/runtime/dom";
import { FieldError, FieldErrorContext } from "@rivetjs/cdk/form";
import { Label, Text, fieldProps } from "@rivetjs/cdk/label";
import { getValidationResult } from "@rivetjs/cdk/state/form-validation";
import { TriangleAlert } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Field parts with plain CSS" };

// #region demo
export default function CssParts() {
  const ids = fieldProps({ id: "css-code", label: true, description: true });
  const field = { validation: () => getValidationResult(["This code has expired."])! };
  return (
    <div class="field">
      <Label id={ids.labelProps.id} for={ids.labelProps.for}>
        Voucher code
      </Label>
      <input
        id={ids.fieldProps.id}
        aria-labelledby={ids.fieldProps["aria-labelledby"]}
        aria-describedby={`${ids.descriptionId} ${ids.errorMessageId}`}
        aria-invalid="true"
      />
      <Text id={ids.descriptionId} slot="description">
        Printed on your receipt.
      </Text>
      <Provider token={FieldErrorContext} value={field.validation}>
        <FieldError id={ids.errorMessageId}>
          {({ validationErrors }) => (
            <>
              <Icon icon={TriangleAlert} size={12} /> {validationErrors().join(" ")}
            </>
          )}
        </FieldError>
      </Provider>
    </div>
  );
}
// #endregion
