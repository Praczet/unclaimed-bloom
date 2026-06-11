/** Returns a local-time ISO 8601 string with UTC offset, e.g. 2026-06-11T21:09:44.509+02:00 */
export function localISOString(d: Date = new Date()): string {
  const offset = -d.getTimezoneOffset(); // minutes, positive = east of UTC
  const sign = offset >= 0 ? "+" : "-";
  const absOffset = Math.abs(offset);
  const oh = String(Math.floor(absOffset / 60)).padStart(2, "0");
  const om = String(absOffset % 60).padStart(2, "0");
  const p = (n: number) => String(n).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${ms}${sign}${oh}:${om}`;
}

/** Returns a filename-safe local timestamp, e.g. 2026-06-11T21-09-44 */
export function localTimestampForFilename(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `T${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}
