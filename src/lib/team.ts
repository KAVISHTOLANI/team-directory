export interface Person {
  id: string;
  name: string;
  role: string;
  team: string;
  timeZone: string; // IANA, e.g. Europe/Lisbon
  city: string;
  hours: [number, number]; // local working hours, minutes from midnight (start, end)
  workDays: number[]; // 0=Mon … 6=Sun
  managerId: string | null;
  skills: { name: string; level: 1 | 2 | 3 }[];
  away: { from: string; to: string; note: string } | null;
  email: string;
  demo?: boolean;
}

export const LEVEL = { 1: 'Learning', 2: 'Working', 3: 'Expert' } as const;

export const ZONES = [
  'Pacific/Honolulu', 'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York', 'America/Sao_Paulo',
  'Europe/London', 'Europe/Lisbon', 'Europe/Berlin', 'Europe/Athens', 'Africa/Lagos', 'Africa/Nairobi', 'Asia/Dubai',
  'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland',
];

export function isValidZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Wall-clock parts of `at` in a time zone. */
export function zonedParts(tz: string, at: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday'));
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')), weekday: wd };
}

/** UTC offset of a zone at an instant, in minutes (e.g. +60 for Berlin in winter). */
export function offsetMinutes(tz: string, at: Date): number {
  const p = zonedParts(tz, at);
  const [y, m, d] = p.date.split('-').map(Number);
  const asUTC = Date.UTC(y, m - 1, d, Math.floor(p.minutes / 60), p.minutes % 60);
  const actual = Math.floor(at.getTime() / 60000) * 60000;
  return Math.round((asUTC - actual) / 60000);
}

export const formatOffset = (min: number) => `UTC${min >= 0 ? '+' : '−'}${String(Math.floor(Math.abs(min) / 60)).padStart(2, '0')}:${String(Math.abs(min) % 60).padStart(2, '0')}`;
export const hhmm = (min: number) => `${String(Math.floor((((min % 1440) + 1440) % 1440) / 60)).padStart(2, '0')}:${String((((min % 1440) + 1440) % 1440) % 60).padStart(2, '0')}`;

export type Availability = 'working' | 'off' | 'away';

export function availability(p: Person, at: Date): Availability {
  const z = zonedParts(p.timeZone, at);
  if (p.away && z.date >= p.away.from && z.date <= p.away.to) return 'away';
  if (!p.workDays.includes(z.weekday)) return 'off';
  return z.minutes >= p.hours[0] && z.minutes < p.hours[1] ? 'working' : 'off';
}

/**
 * Working-hour overlap for a set of people on a given UTC date, as UTC minute ranges.
 * Each person's local hours are converted using their offset at noon UTC that day (good enough for a planning view).
 */
export function overlapUTC(people: Person[], utcDate: string): [number, number][] {
  if (!people.length) return [];
  const noon = new Date(`${utcDate}T12:00:00Z`);
  let ranges: [number, number][] = [[-1440, 2880]];
  for (const p of people) {
    const off = offsetMinutes(p.timeZone, noon);
    const mine: [number, number][] = [-1, 0, 1].map((d) => [p.hours[0] - off + d * 1440, p.hours[1] - off + d * 1440] as [number, number]);
    const next: [number, number][] = [];
    for (const [a, b] of ranges) for (const [c, d] of mine) { const s = Math.max(a, c), e = Math.min(b, d); if (e > s) next.push([s, e]); }
    ranges = next;
  }
  // Clip to the UTC day and merge.
  const clipped = ranges.map(([a, b]) => [Math.max(0, a), Math.min(1440, b)] as [number, number]).filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const merged: [number, number][] = [];
  for (const r of clipped) { const last = merged[merged.length - 1]; if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]); else merged.push([...r]); }
  return merged;
}

export interface OrgNode {
  person: Person;
  reports: OrgNode[];
}

/** Builds the reporting tree. People whose manager is missing become roots. */
export function orgTree(people: Person[]): OrgNode[] {
  const ids = new Set(people.map((p) => p.id));
  const build = (p: Person, seen: Set<string>): OrgNode => ({ person: p, reports: people.filter((x) => x.managerId === p.id && !seen.has(x.id)).sort((a, b) => a.name.localeCompare(b.name)).map((x) => build(x, new Set([...seen, x.id]))) });
  return people.filter((p) => !p.managerId || !ids.has(p.managerId)).sort((a, b) => a.name.localeCompare(b.name)).map((p) => build(p, new Set([p.id])));
}

/** True if making `managerId` the manager of `personId` would create a reporting loop. */
export function createsCycle(people: Person[], personId: string, managerId: string | null): boolean {
  let cur = managerId;
  const guard = new Set<string>();
  while (cur) {
    if (cur === personId) return true;
    if (guard.has(cur)) return true;
    guard.add(cur);
    cur = people.find((p) => p.id === cur)?.managerId ?? null;
  }
  return false;
}

export function chain(people: Person[], id: string): Person[] {
  const out: Person[] = [];
  let cur = people.find((p) => p.id === id)?.managerId ?? null;
  while (cur && out.length < 20) {
    const m = people.find((p) => p.id === cur);
    if (!m) break;
    out.push(m);
    cur = m.managerId;
  }
  return out;
}

export function skillMatrix(people: Person[]) {
  const skills = [...new Set(people.flatMap((p) => p.skills.map((s) => s.name)))].sort((a, b) => {
    const ca = people.filter((p) => p.skills.some((s) => s.name === a)).length;
    const cb = people.filter((p) => p.skills.some((s) => s.name === b)).length;
    return cb - ca || a.localeCompare(b);
  });
  return { skills, rows: people.map((p) => ({ person: p, levels: skills.map((s) => p.skills.find((x) => x.name === s)?.level ?? 0) })) };
}

/** Skills with nobody at expert level, or only one person at all — a "bus factor" warning. */
export function thinSkills(people: Person[]) {
  const { skills } = skillMatrix(people);
  return skills.map((s) => ({ skill: s, people: people.filter((p) => p.skills.some((x) => x.name === s)), experts: people.filter((p) => p.skills.some((x) => x.name === s && x.level === 3)).length })).filter((x) => x.people.length === 1 || x.experts === 0);
}

export function parseTime(t: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function validatePerson(d: { name: string; timeZone: string; start: string; end: string; email: string; workDays: number[] }) {
  const e: Partial<Record<'name' | 'timeZone' | 'start' | 'end' | 'email' | 'workDays', string>> = {};
  if (!d.name.trim()) e.name = 'Enter a name.';
  if (!isValidZone(d.timeZone)) e.timeZone = 'Choose a valid time zone.';
  const s = parseTime(d.start), en = parseTime(d.end);
  if (s == null) e.start = 'Use HH:MM.';
  if (en == null) e.end = 'Use HH:MM.';
  else if (s != null && en <= s) e.end = 'End must be after start.';
  if (d.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) e.email = 'That doesn’t look like an email address.';
  if (!d.workDays.length) e.workDays = 'Pick at least one working day.';
  return e;
}
