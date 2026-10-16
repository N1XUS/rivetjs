// Reached only through `./barrel.ts` from `barrel.server.test.tsx`: compiles for the server only when the register
// carries the server target through the relative `.ts` import (else `Provider` from `@rivetjs/runtime/dom` needs a document).
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";

const Tone = createContext("none");
const Probe = () => <i>{useContext(Tone)}</i>;

export const Toned = (props: { tone: string }) => (
  <Provider token={Tone} value={props.tone}>
    <b>
      <Probe />
    </b>
  </Provider>
);
