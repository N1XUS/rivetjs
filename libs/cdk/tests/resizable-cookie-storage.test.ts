// `cookieStorage` (Rivet addition to the react-resizable-panels port): a cookie of the same name that another writer left
// with a raw `%` reads as no stored layout instead of throwing `URIError` during SSR / first render.
import { test } from "vitest";
import assert from "node:assert/strict";
import { cookieStorage } from "../resizable/index.tsx";

test("resizable cookieStorage: malformed percent-encoding reads as no layout", () => {
  assert.equal(cookieStorage("a=1; mail=50%; b=2").getItem("mail"), null);
  assert.equal(cookieStorage(new Map([["mail", "%E0%A4%A"]])).getItem("mail"), null);
  // Well-formed values still decode.
  assert.equal(cookieStorage("mail=" + encodeURIComponent("[30,70]")).getItem("mail"), "[30,70]");
  assert.equal(cookieStorage(new Map([["mail", encodeURIComponent("[40,60]")]])).getItem("mail"), "[40,60]");
  assert.equal(cookieStorage("other=1").getItem("mail"), null);
});
