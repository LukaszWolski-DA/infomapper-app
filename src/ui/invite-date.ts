// An invitation's expiry as the prototype writes it (slice 33, P-j): "27 Nov 2026", in the app's time zone
// (Europe/Warsaw, as the notes' dates), so the server's and the browser's text agree.
export function inviteDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Warsaw" });
}
