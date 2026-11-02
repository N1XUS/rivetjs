export const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
export async function request<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  // A non-JSON body (proxy error page, empty 204) must not hide the status behind a SyntaxError.
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw Error(`${response.status}: ${data.error ?? "Request failed"}`);
  return data as T;
}
