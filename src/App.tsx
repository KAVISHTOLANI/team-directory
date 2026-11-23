import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { DemoTag, EmptyState, Field, Landing, NotFound, Notice, PageHead, Shell, uid, useFlash, usePersistentState, useRoute } from './shared/ui';
import { addDays, todayISO } from './shared/dates';
import { LEVEL, ZONES, availability, chain, createsCycle, formatOffset, hhmm, offsetMinutes, orgTree, overlapUTC, parseTime, skillMatrix, thinSkills, validatePerson, zonedParts, type OrgNode, type Person } from './lib/team';

const KEY = 'people-patch:store';
const NAV = [
  { to: '/', label: 'Overview' },
  { to: '/people', label: 'People' },
  { to: '/org', label: 'Org chart' },
  { to: '/overlap', label: 'Shared hours' },
  { to: '/skills', label: 'Skills' },
];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const AV_LABEL = { working: 'Working now', off: 'Off hours', away: 'Away' } as const;

interface Store {
  people: Person[];
}

export function demoPeople(today: string): Person[] {
  const mk = (id: string, name: string, role: string, team: string, timeZone: string, city: string, hours: [string, string], managerId: string | null, skills: [string, 1 | 2 | 3][], extra: Partial<Person> = {}): Person => ({ id: `demo-${id}`, name, role, team, timeZone, city, hours: [parseTime(hours[0])!, parseTime(hours[1])!], workDays: [0, 1, 2, 3, 4], managerId: managerId && `demo-${managerId}`, skills: skills.map(([n, level]) => ({ name: n, level })), away: null, email: `${id}@example.com`, demo: true, ...extra });
  return [
    mk('noor', 'Noor Haddad', 'Head of Product', 'Leadership', 'Europe/London', 'London', ['09:00', '17:30'], null, [['Product strategy', 3], ['Facilitation', 3], ['SQL', 1]]),
    mk('mateo', 'Mateo Silva', 'Engineering Lead', 'Platform', 'Europe/Lisbon', 'Lisbon', ['09:30', '18:00'], 'noor', [['TypeScript', 3], ['React', 3], ['Postgres', 2], ['Accessibility', 1]]),
    mk('aiko', 'Aiko Tanaka', 'Frontend Engineer', 'Platform', 'Asia/Tokyo', 'Tokyo', ['10:00', '19:00'], 'mateo', [['React', 3], ['TypeScript', 2], ['Accessibility', 3]]),
    mk('kwame', 'Kwame Asante', 'Backend Engineer', 'Platform', 'Africa/Lagos', 'Lagos', ['08:30', '17:00'], 'mateo', [['Postgres', 3], ['Go', 3], ['TypeScript', 1]], { away: { from: addDays(today, -1), to: addDays(today, 4), note: 'Annual leave' } }),
    mk('lena', 'Lena Vogel', 'Product Designer', 'Design', 'Europe/Berlin', 'Berlin', ['08:00', '16:30'], 'noor', [['Figma', 3], ['User research', 2], ['Accessibility', 2], ['Facilitation', 2]]),
    mk('jamal', 'Jamal Reed', 'Data Analyst', 'Insights', 'America/New_York', 'New York', ['09:00', '17:00'], 'noor', [['SQL', 3], ['Python', 2], ['Product strategy', 1]]),
    mk('priya', 'Priya Raman', 'Support Specialist', 'Customer', 'Asia/Kolkata', 'Bengaluru', ['10:00', '18:30'], 'noor', [['Customer support', 3], ['SQL', 1]]),
    mk('sam', 'Sam O’Connor-Whitfield', 'Developer Advocate and Community Programme Manager', 'Customer', 'America/Los_Angeles', 'Los Angeles', ['08:00', '16:00'], 'mateo', [['Writing', 3], ['TypeScript', 2], ['Facilitation', 2]], { workDays: [0, 1, 2, 3] }),
  ];
}

export default function App() {
  const [route, navigate] = useRoute();
  const today = todayISO();
  const [store, setStore] = usePersistentState<Store>(KEY, () => ({ people: demoPeople(today) }));
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(t); }, []);
  const ctx = { store, setStore, now, navigate, today };
  const edit = route.match(/^\/person\/([^/]+)\/edit$/);
  const view = route.match(/^\/person\/([^/]+)$/);
  let page: ReactNode;
  if (route === '/') page = <Home />;
  else if (route === '/people') page = <People {...ctx} />;
  else if (route === '/person/new') page = <Editor {...ctx} />;
  else if (edit) page = <Editor {...ctx} id={edit[1]} />;
  else if (view) page = <Profile {...ctx} id={view[1]} />;
  else if (route === '/org') page = <Org {...ctx} />;
  else if (route === '/overlap') page = <Overlap {...ctx} />;
  else if (route === '/skills') page = <Skills {...ctx} />;
  else page = <NotFound />;
  return (
    <Shell name="People Patch" wordmark={['People', 'Patch']} nav={NAV} route={route} cta={{ to: '/overlap', label: 'Find a meeting time' }} footerNote="The directory stays in this browser. Local times use your device’s time-zone database.">
      {page}
    </Shell>
  );
}

type Ctx = { store: Store; setStore: (s: Store) => void; now: Date; navigate: (to: string) => void; today: string };

const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const localTime = (p: Person, at: Date) => new Intl.DateTimeFormat(undefined, { timeZone: p.timeZone, hour: '2-digit', minute: '2-digit' }).format(at);

function Status({ p, now }: { p: Person; now: Date }) {
  const a = availability(p, now);
  return <span className={`status st-${a}`}><i aria-hidden="true" />{AV_LABEL[a]}</span>;
}

function PersonCard({ p, now, compact }: { p: Person; now: Date; compact?: boolean }) {
  return (
    <a className={`pcard ${compact ? 'is-compact' : ''}`} href={`#/person/${p.id}`}>
      <span className="pc-avatar" aria-hidden="true">{initials(p.name)}</span>
      <span className="pc-main">
        <strong>{p.name}</strong>
        <span className="small muted">{p.role}</span>
        <span className="small">{p.city} · <span className="mono">{localTime(p, now)}</span></span>
      </span>
      <Status p={p} now={now} />
    </a>
  );
}

function HeroPreview() {
  const now = new Date();
  const people = demoPeople(todayISO());
  return (
    <div className="hero-pp">
      <ul className="hero-pp-list">{people.slice(0, 5).map((p, i) => <li key={p.id} style={{ ['--i' as string]: i }}><PersonCard p={p} now={now} compact /></li>)}</ul>
      <p className="small muted">Live local times · {people.filter((p) => availability(p, now) === 'working').length} of {people.length} working right now</p>
    </div>
  );
}

function Home() {
  return (
    <Landing
      eyebrow="Team directory"
      title={<>Who’s who, <em>and who’s awake.</em></>}
      lead="A small-team directory that understands time zones: everyone’s role, skills and reporting line, their local time and whether they’re working now — plus the hours a group of people actually share."
      primary={{ href: '#/people', label: 'Browse the team' }}
      secondary={{ href: '#/overlap', label: 'Find shared hours' }}
      previewLabel="Right now — demo team"
      preview={<HeroPreview />}
      steps={[
        { title: 'Add people', body: 'Role, team, city, time zone, working hours and days, manager and skills.' },
        { title: 'See the shape', body: 'An org chart from reporting lines and a skills matrix that flags single points of failure.' },
        { title: 'Plan across zones', body: 'Pick people and see the hours their working days overlap, in UTC and your own time.' },
      ]}
      stepsIntro="People Patch opens with eight labelled, fictional teammates across seven time zones. Clear them when you’re ready."
      features={[
        { title: 'Real time zones', body: 'Local times and daylight saving come from your browser’s time-zone database, not fixed offsets.' },
        { title: 'Working now', body: 'Working, off hours or away (with dates), updated every half minute.' },
        { title: 'Safe org chart', body: 'Reporting lines can’t loop back on themselves; anyone without a manager becomes a top-level node.' },
        { title: 'Skills coverage', body: 'See who knows what, and which skills rest on one person or have no expert.' },
      ]}
      note="People Patch keeps the directory in this browser. Only add details your colleagues are happy to share."
      closing={{ title: <>Stop scheduling meetings <em>at 3 a.m.</em></>, action: { href: '#/overlap', label: 'Find shared hours' } }}
    />
  );
}

/* ---------- People ---------- */
function People({ store, setStore, now, today }: Ctx) {
  const [q, setQ] = useState('');
  const [team, setTeam] = useState('');
  const [onlyNow, setOnlyNow] = useState(false);
  const [flash, setFlash] = useFlash();
  const teams = [...new Set(store.people.map((p) => p.team))].sort();
  const rows = useMemo(() => store.people.filter((p) => (!team || p.team === team) && (!onlyNow || availability(p, now) === 'working') && `${p.name} ${p.role} ${p.city} ${p.skills.map((s) => s.name).join(' ')}`.toLowerCase().includes(q.trim().toLowerCase())).sort((a, b) => a.name.localeCompare(b.name)), [store, team, onlyNow, q, now]);
  if (!store.people.length) return <EmptyState title="No one here yet" actions={<><a className="btn btn-primary" href="#/person/new">Add a person</a><button type="button" className="btn" onClick={() => setStore({ people: demoPeople(today) })}>Load demo team</button></>}>Add your teammates to see their local times.</EmptyState>;
  return (
    <div className="stack">
      <PageHead eyebrow={`${store.people.length} people · ${store.people.filter((p) => availability(p, now) === 'working').length} working now`} title={<>The <em>team.</em></>} actions={<a className="btn btn-primary" href="#/person/new">Add person</a>} />
      {flash && <Notice kind={flash.kind} onDismiss={() => setFlash(null)}>{flash.text}</Notice>}
      <div className="card filters">
        <Field label="Search" className="grow">{(p) => <input {...p} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, role, city or skill" />}</Field>
        <Field label="Team">{(p) => <select {...p} value={team} onChange={(e) => setTeam(e.target.value)}><option value="">All teams</option>{teams.map((t) => <option key={t}>{t}</option>)}</select>}</Field>
        <button type="button" className="btn" aria-pressed={onlyNow} onClick={() => setOnlyNow(!onlyNow)}>Working now</button>
      </div>
      <p className="small" data-testid="count" aria-live="polite">{rows.length} shown</p>
      {rows.length === 0 ? <EmptyState title="Nobody matches" actions={<button type="button" className="btn" onClick={() => { setQ(''); setTeam(''); setOnlyNow(false); }}>Clear filters</button>} /> : (
        <ul className="pgrid">{rows.map((p, i) => <li key={p.id} data-reveal style={{ ['--i' as string]: i }}><PersonCard p={p} now={now} />{p.demo && <DemoTag />}</li>)}</ul>
      )}
      {store.people.some((p) => p.demo) && <div><button type="button" className="btn btn-ghost btn-sm" onClick={() => { setStore({ people: store.people.filter((p) => !p.demo) }); setFlash({ kind: 'success', text: 'Demo team removed.' }); }}>Clear demo team</button></div>}
    </div>
  );
}

function Profile({ store, setStore, now, navigate, id }: Ctx & { id: string }) {
  const p = store.people.find((x) => x.id === id);
  if (!p) return <EmptyState title="Person not found" actions={<a className="btn btn-primary" href="#/people">Back to the team</a>} />;
  const reports = store.people.filter((x) => x.managerId === p.id);
  const up = chain(store.people, p.id);
  const off = offsetMinutes(p.timeZone, now);
  return (
    <div className="stack">
      <div className="profile-head">
        <span className="pc-avatar big" aria-hidden="true">{initials(p.name)}</span>
        <div>
          <p className="eyebrow"><a href="#/people">Team</a> / {p.team}</p>
          <h1>{p.name}</h1>
          <p className="muted">{p.role}</p>
        </div>
        <div className="row"><a className="btn" href={`#/person/${p.id}/edit`}>Edit</a><button type="button" className="btn btn-danger" onClick={() => { if (window.confirm(`Remove ${p.name}? Their reports will have no manager.`)) { setStore({ people: store.people.filter((x) => x.id !== p.id).map((x) => (x.managerId === p.id ? { ...x, managerId: null } : x)) }); navigate('/people'); } }}>Remove</button></div>
      </div>
      {p.demo && <p><DemoTag /> <span className="small muted">A fictional demo teammate.</span></p>}
      {p.away && availability(p, now) === 'away' && <Notice kind="info">{p.away.note || 'Away'} until {p.away.to}.</Notice>}
      <div className="stats">
        <div className="stat"><span className="stat-label">Local time</span><span className="stat-value mono" data-testid="local">{localTime(p, now)}</span><span className="small muted">{p.city} · {formatOffset(off)}</span></div>
        <div className="stat"><span className="stat-label">Status</span><span className="stat-value"><Status p={p} now={now} /></span></div>
        <div className="stat"><span className="stat-label">Hours</span><span className="stat-value small-val">{hhmm(p.hours[0])}–{hhmm(p.hours[1])}</span><span className="small muted">{p.workDays.map((d) => DAYS[d]).join(', ')}</span></div>
      </div>
      <div className="grid-2">
        <section className="card stack"><h2 className="h3">Skills</h2>{p.skills.length === 0 ? <p className="muted small">None listed.</p> : <ul className="skills">{p.skills.map((s) => <li key={s.name}><span>{s.name}</span><span className={`lvl l${s.level}`} aria-label={LEVEL[s.level]}>{'●'.repeat(s.level)}{'○'.repeat(3 - s.level)}</span><span className="small muted">{LEVEL[s.level]}</span></li>)}</ul>}</section>
        <section className="card stack"><h2 className="h3">Reporting line</h2>
          {up.length ? <ol className="chain">{[...up].reverse().map((m) => <li key={m.id}><a href={`#/person/${m.id}`}>{m.name}</a> <span className="small muted">{m.role}</span></li>)}<li><strong>{p.name}</strong></li></ol> : <p className="small muted">Top of the org chart.</p>}
          {reports.length > 0 && <><h3 className="label">Reports ({reports.length})</h3><ul className="list">{reports.map((r) => <li key={r.id}><a href={`#/person/${r.id}`}>{r.name}</a> <span className="small muted">· {r.role}</span></li>)}</ul></>}
          {p.email && <p className="small">Email: <a href={`mailto:${p.email}`}>{p.email}</a></p>}
        </section>
      </div>
    </div>
  );
}

function Editor({ store, setStore, navigate, id }: Ctx & { id?: string }) {
  const ex = id ? store.people.find((p) => p.id === id) : undefined;
  const guess = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [d, setD] = useState({ name: ex?.name ?? '', role: ex?.role ?? '', team: ex?.team ?? '', city: ex?.city ?? '', timeZone: ex?.timeZone ?? guess, start: hhmm(ex?.hours[0] ?? 540), end: hhmm(ex?.hours[1] ?? 1020), workDays: ex?.workDays ?? [0, 1, 2, 3, 4], managerId: ex?.managerId ?? '', email: ex?.email ?? '', skills: ex?.skills.map((s) => `${s.name}:${s.level}`).join(', ') ?? '', awayFrom: ex?.away?.from ?? '', awayTo: ex?.away?.to ?? '', awayNote: ex?.away?.note ?? '' });
  const [submitted, setSubmitted] = useState(false);
  if (id && !ex) return <EmptyState title="Person not found" actions={<a className="btn btn-primary" href="#/people">Back</a>} />;
  const base = validatePerson(d);
  const pid = ex?.id ?? 'new';
  const cycle = d.managerId && createsCycle(store.people, pid, d.managerId) ? 'That would make a reporting loop.' : null;
  const awayErr = (d.awayFrom || d.awayTo) && (!d.awayFrom || !d.awayTo || d.awayTo < d.awayFrom) ? 'Give both dates, with the end on or after the start.' : null;
  const errors = submitted ? { ...base, ...(cycle ? { managerId: cycle } : {}), ...(awayErr ? { away: awayErr } : {}) } : {};
  const zones = [...new Set([d.timeZone, ...ZONES])];
  function save(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(base).length || cycle || awayErr) return;
    const skills = d.skills.split(',').map((s) => s.trim()).filter(Boolean).map((s) => { const [n, l] = s.split(':'); const lv = Math.min(3, Math.max(1, Number(l) || 2)) as 1 | 2 | 3; return { name: n.trim(), level: lv }; });
    const v = { name: d.name.trim(), role: d.role.trim(), team: d.team.trim() || 'Unassigned', city: d.city.trim(), timeZone: d.timeZone, hours: [parseTime(d.start)!, parseTime(d.end)!] as [number, number], workDays: [...d.workDays].sort(), managerId: d.managerId || null, email: d.email.trim(), skills, away: d.awayFrom ? { from: d.awayFrom, to: d.awayTo, note: d.awayNote.trim() } : null };
    if (ex) { setStore({ people: store.people.map((p) => (p.id === ex.id ? { ...ex, ...v, demo: false } : p)) }); navigate(`/person/${ex.id}`); }
    else { const nid = uid('person'); setStore({ people: [...store.people, { ...v, id: nid }] }); navigate(`/person/${nid}`); }
  }
  return (
    <div className="stack">
      <PageHead eyebrow={ex ? 'Edit person' : 'New person'} title={ex ? <>Edit <em>{ex.name}</em></> : <>Add a <em>teammate.</em></>} />
      <form className="card stack" onSubmit={save} noValidate>
        <div className="form-grid">
          <Field label="Name" error={errors.name}>{(p) => <input {...p} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />}</Field>
          <Field label="Role">{(p) => <input {...p} value={d.role} onChange={(e) => setD({ ...d, role: e.target.value })} />}</Field>
          <Field label="Team">{(p) => <input {...p} list="teams" value={d.team} onChange={(e) => setD({ ...d, team: e.target.value })} />}</Field>
          <Field label="City">{(p) => <input {...p} value={d.city} onChange={(e) => setD({ ...d, city: e.target.value })} />}</Field>
          <Field label="Time zone" error={errors.timeZone}>{(p) => <select {...p} value={d.timeZone} onChange={(e) => setD({ ...d, timeZone: e.target.value })}>{zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}</select>}</Field>
          <Field label="Manager" error={errors.managerId}>{(p) => <select {...p} value={d.managerId} onChange={(e) => setD({ ...d, managerId: e.target.value })}><option value="">No manager (top level)</option>{store.people.filter((x) => x.id !== ex?.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}</Field>
          <Field label="Starts work (local)" error={errors.start}>{(p) => <input {...p} className="mono" value={d.start} onChange={(e) => setD({ ...d, start: e.target.value })} />}</Field>
          <Field label="Finishes work (local)" error={errors.end}>{(p) => <input {...p} className="mono" value={d.end} onChange={(e) => setD({ ...d, end: e.target.value })} />}</Field>
          <Field label="Email" error={errors.email}>{(p) => <input {...p} type="email" value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} />}</Field>
        </div>
        <datalist id="teams">{[...new Set(store.people.map((p) => p.team))].map((t) => <option key={t} value={t} />)}</datalist>
        <fieldset><legend className="label">Working days</legend><div className="row">{DAYS.map((n, i) => <label key={n} className="check"><input type="checkbox" checked={d.workDays.includes(i)} onChange={(e) => setD({ ...d, workDays: e.target.checked ? [...d.workDays, i] : d.workDays.filter((x) => x !== i) })} /> {n}</label>)}</div>{errors.workDays && <span className="error-text">{errors.workDays}</span>}</fieldset>
        <Field label="Skills" hint="Comma separated, with an optional level 1–3, e.g. React:3, SQL:1">{(p) => <input {...p} value={d.skills} onChange={(e) => setD({ ...d, skills: e.target.value })} />}</Field>
        <fieldset className="stack"><legend className="label">Away (optional)</legend>
          <div className="form-grid">
            <Field label="From">{(p) => <input {...p} type="date" value={d.awayFrom} onChange={(e) => setD({ ...d, awayFrom: e.target.value })} />}</Field>
            <Field label="To">{(p) => <input {...p} type="date" value={d.awayTo} onChange={(e) => setD({ ...d, awayTo: e.target.value })} />}</Field>
            <Field label="Note">{(p) => <input {...p} value={d.awayNote} onChange={(e) => setD({ ...d, awayNote: e.target.value })} placeholder="e.g. Parental leave" />}</Field>
          </div>
          {'away' in errors && <span className="error-text">{(errors as Record<string, string>).away}</span>}
        </fieldset>
        <div className="row"><button className="btn btn-primary" type="submit">{ex ? 'Save changes' : 'Save person'}</button><a className="btn btn-ghost" href={ex ? `#/person/${ex.id}` : '#/people'}>Cancel</a></div>
      </form>
    </div>
  );
}

/* ---------- Org chart ---------- */
function OrgBranch({ node, now }: { node: OrgNode; now: Date }) {
  return (
    <li>
      {node.reports.length ? (
        <details open>
          <summary><span className="org-card"><a href={`#/person/${node.person.id}`}><strong>{node.person.name}</strong></a><span className="small muted">{node.person.role}</span><Status p={node.person} now={now} /></span><span className="small muted org-n">{node.reports.length} report{node.reports.length === 1 ? '' : 's'}</span></summary>
          <ul>{node.reports.map((r) => <OrgBranch key={r.person.id} node={r} now={now} />)}</ul>
        </details>
      ) : (
        <a className="org-card leaf" href={`#/person/${node.person.id}`}><strong>{node.person.name}</strong><span className="small muted">{node.person.role}</span><Status p={node.person} now={now} /></a>
      )}
    </li>
  );
}

function Org({ store, now }: Ctx) {
  const tree = orgTree(store.people);
  if (!store.people.length) return <EmptyState title="No one here yet" actions={<a className="btn btn-primary" href="#/person/new">Add a person</a>} />;
  return (
    <div className="stack">
      <PageHead eyebrow="Org chart" title={<>Who reports <em>to whom.</em></>} description="Built from each person’s manager. Expand or collapse any branch." />
      <ul className="org" aria-label="Organisation chart">{tree.map((n) => <OrgBranch key={n.person.id} node={n} now={now} />)}</ul>
    </div>
  );
}

/* ---------- Shared hours ---------- */
function Overlap({ store, now }: Ctx) {
  const [sel, setSel] = useState<string[]>(() => store.people.slice(0, 3).map((p) => p.id));
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const chosen = store.people.filter((p) => sel.includes(p.id));
  const ranges = overlapUTC(chosen, date);
  const myOff = -new Date(`${date}T12:00:00Z`).getTimezoneOffset();
  const noon = new Date(`${date}T12:00:00Z`);
  const pct = (m: number) => `${(m / 1440) * 100}%`;
  return (
    <div className="stack">
      <PageHead eyebrow="Shared hours" title={<>When everyone’s <em>at work.</em></>} description="Choose people and a date. Bars show each person’s working hours on a 24-hour UTC line." />
      <div className="card stack">
        <div className="filters"><Field label="Date">{(p) => <input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value || date)} />}</Field></div>
        <fieldset><legend className="label">People</legend><div className="row pick">{store.people.map((p) => <label key={p.id} className="check"><input type="checkbox" checked={sel.includes(p.id)} onChange={(e) => setSel(e.target.checked ? [...sel, p.id] : sel.filter((x) => x !== p.id))} /> {p.name.split(' ')[0]} <span className="muted small">({p.city || p.timeZone})</span></label>)}</div></fieldset>
      </div>
      {chosen.length < 2 ? <Notice kind="info">Pick at least two people to compare.</Notice> : (
        <>
          {ranges.length ? (
            <Notice kind="success">
              <span data-testid="overlap">Shared hours: {ranges.map(([a, b]) => `${hhmm(a)}–${hhmm(b)} UTC (${hhmm(a + myOff)}–${hhmm(b + myOff)} your time)`).join(', ')} — {Math.round(ranges.reduce((s, [a, b]) => s + b - a, 0) / 6) / 10} h in total.</span>
            </Notice>
          ) : <Notice kind="warn"><span data-testid="overlap">No shared working hours on this date. Consider an async update or rotating the meeting time.</span></Notice>}
          <section className="card stack" aria-labelledby="tl-t">
            <h2 id="tl-t" className="h3">Working hours on {date} (UTC)</h2>
            <div className="tl">
              <div className="tl-row tl-axis" aria-hidden="true"><span /><div className="tl-track">{[0, 3, 6, 9, 12, 15, 18, 21].map((h) => <span key={h} className="tl-tick" style={{ left: pct(h * 60) }}>{String(h).padStart(2, '0')}</span>)}</div></div>
              {chosen.map((p) => {
                const off = offsetMinutes(p.timeZone, noon);
                const segs = [-1, 0, 1].map((dd) => [p.hours[0] - off + dd * 1440, p.hours[1] - off + dd * 1440]).map(([a, b]) => [Math.max(0, a), Math.min(1440, b)]).filter(([a, b]) => b > a);
                const workday = p.workDays.includes(zonedParts(p.timeZone, noon).weekday);
                return (
                  <div key={p.id} className="tl-row">
                    <span className="tl-name"><strong>{p.name.split(' ')[0]}</strong><span className="small muted">{hhmm(p.hours[0])}–{hhmm(p.hours[1])} {formatOffset(off).replace('UTC', '')}</span></span>
                    <div className="tl-track">
                      {ranges.map(([a, b]) => <span key={a} className="tl-overlap" style={{ left: pct(a), width: pct(b - a) }} />)}
                      {segs.map(([a, b]) => <span key={a} className={`tl-seg ${workday ? '' : 'is-off'}`} style={{ left: pct(a), width: pct(b - a) }} title={`${p.name}: ${hhmm(a)}–${hhmm(b)} UTC${workday ? '' : ' (not a working day)'}`} />)}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="legend"><span><i className="k-seg" />Working hours</span><span><i className="k-ov" />Shared by everyone selected</span><span><i className="k-off" />Not a working day for them</span><span className="muted">· now {now.toISOString().slice(11, 16)} UTC</span></p>
          </section>
        </>
      )}
    </div>
  );
}

/* ---------- Skills ---------- */
function Skills({ store }: Ctx) {
  const { skills, rows } = skillMatrix(store.people);
  const thin = thinSkills(store.people);
  if (!skills.length) return <EmptyState title="No skills recorded" actions={<a className="btn btn-primary" href="#/people">Go to the team</a>}>Add skills to people to see coverage.</EmptyState>;
  return (
    <div className="stack">
      <PageHead eyebrow="Skills" title={<>Who knows <em>what.</em></>} />
      {thin.length > 0 && <Notice kind="warn">Thin coverage: {thin.map((t) => `${t.skill} (${t.people.length === 1 ? `only ${t.people[0].name.split(' ')[0]}` : 'no expert'})`).join(', ')}.</Notice>}
      <div className="card">
        <div className="table-wrap">
          <table className="table matrix-t">
            <caption className="sr-only">Skill levels by person: 1 learning, 2 working, 3 expert</caption>
            <thead><tr><th scope="col">Person</th>{skills.map((s) => <th key={s} scope="col" className="sk-h"><span>{s}</span></th>)}</tr></thead>
            <tbody>{rows.map((r) => <tr key={r.person.id}><th scope="row"><a href={`#/person/${r.person.id}`}>{r.person.name}</a></th>{r.levels.map((l, i) => <td key={skills[i]} className={`cell l${l}`} aria-label={l ? `${skills[i]}: ${LEVEL[l as 1 | 2 | 3]}` : `${skills[i]}: none`}>{l ? l : ''}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <p className="legend"><span><i className="cell l1" />1 Learning</span><span><i className="cell l2" />2 Working</span><span><i className="cell l3" />3 Expert</span></p>
      </div>
    </div>
  );
}
