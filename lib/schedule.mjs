export const defaultDate = '2026-12-01T00:00:00+05:00';
export function schedule(s) {
  const planned = s.date || defaultDate;
  if (s.draw) return {planned, reveal: planned, full:true};
  const full = s.people.length === 6 && s.people.every(p => p.uid);
  const last = Math.max(0, ...s.people.map(p => Date.parse(p.joinedAt) || 0));
  const reveal = full && last > Date.parse(planned) ? new Date(last + 86400000).toISOString() : planned;
  return {planned, reveal, full};
}
export function due(s, now=Date.now()) {
  const {full,reveal} = schedule(s);
  return !s.draw && full && Date.parse(reveal) <= now;
}
