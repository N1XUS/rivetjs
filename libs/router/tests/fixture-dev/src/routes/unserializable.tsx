// A handler captures a class instance received as a prop (`#token`: not a data class): derived resume re-runs the
// component in the browser, so the capture is rebuilt there (serialized resume failed here; M6-CUT 2026-10-22).
import { signal } from "@rivetjs/reactivity";

class Session {
  #token = 1; user = "ada";
}

function Greeter(props: { session: Session }) {
  const count = signal(0);
  const session = props.session;
  return (
    <button id="greet" onClick={() => count.set(count() + session.user.length)}>
      Hi {count()}
    </button>
  );
}

export default function Unserializable() {
  return <Greeter session={new Session()} />;
}
