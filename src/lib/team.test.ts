import { describe, expect, it } from 'vitest';
import { availability, chain, createsCycle, formatOffset, hhmm, isValidZone, offsetMinutes, orgTree, overlapUTC, skillMatrix, thinSkills, validatePerson, zonedParts, type Person } from './team';

const p = (x: Partial<Person>): Person => ({ id: 'p', name: 'P', role: '', team: 'Core', timeZone: 'Europe/London', city: '', hours: [540, 1020], workDays: [0, 1, 2, 3, 4], managerId: null, skills: [], away: null, email: '', ...x });

describe('time zones', () => {
  it('reads offsets, including daylight saving', () => {
    expect(offsetMinutes('Europe/Berlin', new Date('2026-01-15T12:00:00Z'))).toBe(60);
    expect(offsetMinutes('Europe/Berlin', new Date('2026-07-15T12:00:00Z'))).toBe(120);
    expect(offsetMinutes('Asia/Kolkata', new Date('2026-07-15T12:00:00Z'))).toBe(330);
    expect(offsetMinutes('America/New_York', new Date('2026-01-15T12:00:00Z'))).toBe(-300);
    expect(formatOffset(330)).toBe('UTC+05:30');
    expect(formatOffset(-300)).toBe('UTC−05:00');
    expect(hhmm(-30)).toBe('23:30');
  });
  it('gives local date, time and weekday', () => {
    expect(zonedParts('Asia/Tokyo', new Date('2026-11-23T20:30:00Z'))).toEqual({ date: '2026-11-24', minutes: 330, weekday: 1 });
    expect(isValidZone('Mars/Base')).toBe(false);
  });
  it('knows who is working, off or away', () => {
    const at = new Date('2026-11-23T10:00:00Z'); // Monday
    expect(availability(p({}), at)).toBe('working');
    expect(availability(p({ timeZone: 'America/Los_Angeles' }), at)).toBe('off');
    expect(availability(p({ away: { from: '2026-11-20', to: '2026-11-27', note: 'Leave' } }), at)).toBe('away');
    expect(availability(p({}), new Date('2026-11-22T10:00:00Z'))).toBe('off');
  });
  it('finds overlapping working hours in UTC', () => {
    const london = p({ id: 'l' }); // 09–17 UTC in winter
    const berlin = p({ id: 'b', timeZone: 'Europe/Berlin' }); // 08–16 UTC
    const ny = p({ id: 'n', timeZone: 'America/New_York' }); // 14–22 UTC
    expect(overlapUTC([london, berlin], '2026-11-23')).toEqual([[540, 960]]);
    expect(overlapUTC([london, berlin, ny], '2026-11-23')).toEqual([[840, 960]]);
    expect(overlapUTC([berlin, p({ id: 't', timeZone: 'Asia/Tokyo' })], '2026-11-23')).toEqual([]);
  });
});

describe('org chart', () => {
  const people = [p({ id: 'ceo', name: 'Ada' }), p({ id: 'a', name: 'Ben', managerId: 'ceo' }), p({ id: 'b', name: 'Cy', managerId: 'a' }), p({ id: 'c', name: 'Di', managerId: 'gone' })];
  it('builds a tree with orphaned people as roots', () => {
    const t = orgTree(people);
    expect(t.map((n) => n.person.id)).toEqual(['ceo', 'c']);
    expect(t[0].reports[0].reports[0].person.id).toBe('b');
  });
  it('prevents reporting loops and lists the chain', () => {
    expect(createsCycle(people, 'ceo', 'b')).toBe(true);
    expect(createsCycle(people, 'b', 'ceo')).toBe(false);
    expect(createsCycle(people, 'a', 'a')).toBe(true);
    expect(chain(people, 'b').map((x) => x.id)).toEqual(['a', 'ceo']);
  });
});

describe('skills and validation', () => {
  const people = [p({ id: '1', skills: [{ name: 'React', level: 3 }, { name: 'SQL', level: 2 }] }), p({ id: '2', skills: [{ name: 'React', level: 2 }, { name: 'Figma', level: 2 }] })];
  it('builds a matrix ordered by how common each skill is', () => {
    const m = skillMatrix(people);
    expect(m.skills).toEqual(['React', 'Figma', 'SQL']);
    expect(m.rows[1].levels).toEqual([2, 2, 0]);
  });
  it('flags skills held by one person or with no expert', () => {
    expect(thinSkills(people).map((x) => x.skill)).toEqual(['Figma', 'SQL']);
  });
  it('validates people', () => {
    expect(validatePerson({ name: '', timeZone: 'Nowhere', start: '9', end: '08:00', email: 'x', workDays: [] })).toEqual({ name: expect.any(String), timeZone: expect.any(String), start: expect.any(String), email: expect.any(String), workDays: expect.any(String) });
    expect(validatePerson({ name: 'A', timeZone: 'UTC', start: '10:00', end: '09:00', email: '', workDays: [0] }).end).toMatch(/after/);
  });
});
