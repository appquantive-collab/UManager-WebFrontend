/** Read a query parameter once (e.g. ?q= from Search), for a page's initial state. */
export function initialParam(name: string): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(name) ?? "";
}
