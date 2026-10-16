// Resume recorder failure the compiler cannot prove: a handler captures a class instance received as a prop (`#token`: not a data class, T24).
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
