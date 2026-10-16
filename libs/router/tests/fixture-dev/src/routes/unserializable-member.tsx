// Function Bridge T19 fix 1: a member-narrowed capture (`o.a`, parameter `o$a`) is named as written in the error and the overlay (`#token`: not a data class, T24).
import { signal } from "@rivetjs/reactivity";

class Session {
  #token = 1; user = "ada";
}

function Panel(props: { session: Session }) {
  const count = signal(0);
  const o = { a: props.session, k: 1 };
  return (
    <button id="panel" onClick={() => count.set(count() + o.a.user.length + o.k)}>
      Hi {count()}
    </button>
  );
}

export default function UnserializableMember() {
  return <Panel session={new Session()} />;
}
