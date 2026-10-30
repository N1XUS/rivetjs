import { privateToken } from "../private.server";
export default function DocumentRoute() {
  return <p id="document">{privateToken.length > 0 ? "PUBLIC_DOCUMENT_CONTROL" : "bad"}</p>;
}
