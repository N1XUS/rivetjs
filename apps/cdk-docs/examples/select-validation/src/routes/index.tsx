import { signal } from "@rivetjs/reactivity";
import { Select } from "@rivetjs/cdk/select";
import { Form } from "@rivetjs/cdk/form";

export const head = { title: "Select validation" };

const animals = [
  { key: "cat", label: "Cat" },
  { key: "dog", label: "Dog" },
  { key: "fox", label: "Fox" },
];

// #region demo
export default function Adopt() {
  const sent = signal("");
  return (
    <Form
      id="adopt"
      class="m-4 grid max-w-xs gap-3 text-sm"
      validationErrors={{ room: "Room 2 is booked." }}
      onSubmit={(event) => {
        event.preventDefault();
        sent.set(String(new FormData(event.currentTarget as HTMLFormElement).get("pet")));
      }}
    >
      {() => (
        <>
          {/* Native validation (the default): the hidden <select required> blocks submit. */}
          <Select id="pet" label="Pet" name="pet" items={animals} isRequired errorMessage="Choose a pet." />
          {/* validate: a function of the value; errors show after a choice or a submit. */}
          <Select id="pal" label="Second pet" name="pal" items={animals} validate={(key) => (key === "dog" ? "Dogs are sold out." : true)} />
          {/* A server error from <Form validationErrors>, until the field changes. */}
          <Select
            id="room"
            label="Room"
            name="room"
            items={[
              { key: "1", label: "Room 1" },
              { key: "2", label: "Room 2" },
            ]}
            defaultValue="2"
          />
          <button type="submit" id="adopt-submit" class="justify-self-start rounded border px-3 py-1">
            Adopt
          </button>
          <p id="adopt-out">{sent() ? "Sent: " + sent() : ""}</p>
        </>
      )}
    </Form>
  );
}
// #endregion
