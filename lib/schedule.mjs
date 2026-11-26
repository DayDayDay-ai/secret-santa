export const defaultDate = '2026-12-01T00:00:00+05:00';
export function schedule(s) {
  const planned = s.date || defaultDate;
  const full = s.people.length === 6 && s.people.every(p => p.uid);
  return {planned, reveal:planned, full};
}
export function due(s, now=Date.now()) {
  const {full,reveal} = schedule(s);
  return !s.draw && full && Date.parse(reveal) <= now;
}
