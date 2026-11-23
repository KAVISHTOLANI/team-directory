import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

const KEY = 'people-patch:store';

describe('People Patch', () => {
  it('lists the team with local times and filters by skill text', async () => {
    window.location.hash = '/people';
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByTestId('count')).toHaveTextContent('8 shown');
    await user.type(screen.getByLabelText('Search'), 'accessibility');
    expect(screen.getByTestId('count')).toHaveTextContent('3 shown');
  });

  it('builds the org chart from managers', () => {
    window.location.hash = '/org';
    render(<App />);
    const tree = screen.getByRole('list', { name: 'Organisation chart' });
    expect(within(tree).getByText('Noor Haddad')).toBeInTheDocument();
    expect(within(tree).getByText('4 reports')).toBeInTheDocument();
  });

  it('refuses a reporting loop', async () => {
    window.location.hash = '/person/demo-noor/edit';
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(screen.getByLabelText('Manager'), 'Aiko Tanaka');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByText('That would make a reporting loop.')).toBeInTheDocument();
  });

  it('finds shared hours for chosen people on a date', async () => {
    window.location.hash = '/overlap';
    const user = userEvent.setup();
    render(<App />);
    const date = screen.getByLabelText('Date');
    await user.clear(date);
    await user.type(date, '2026-11-23');
    // Default selection: Noor (London), Mateo (Lisbon), Aiko (Tokyo, 10:00–19:00 = 01:00–10:00 UTC)
    expect(screen.getByTestId('overlap')).toHaveTextContent('Shared hours: 09:30–10:00 UTC');
    await user.click(screen.getByRole('checkbox', { name: /Aiko/ }));
    expect(screen.getByTestId('overlap')).toHaveTextContent('Shared hours: 09:30–17:30 UTC');
  });

  it('adds a person with validation and shows skills coverage', async () => {
    localStorage.setItem(KEY, JSON.stringify({ people: [] }));
    window.location.hash = '/person/new';
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await user.clear(screen.getByLabelText('Finishes work (local)'));
    await user.type(screen.getByLabelText('Finishes work (local)'), '08:00');
    await user.click(screen.getByRole('button', { name: 'Save person' }));
    expect(screen.getByText('Enter a name.')).toBeInTheDocument();
    expect(screen.getByText('End must be after start.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Name'), 'Rosa Diaz');
    await user.clear(screen.getByLabelText('Finishes work (local)'));
    await user.type(screen.getByLabelText('Finishes work (local)'), '17:00');
    await user.type(screen.getByLabelText(/^Skills/), 'Rust:3, Docs:1');
    await user.click(screen.getByRole('button', { name: 'Save person' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Rosa Diaz' })).toBeInTheDocument();
    unmount();
    window.location.hash = '/skills';
    render(<App />);
    expect(screen.getByText(/Thin coverage: Docs \(only Rosa\), Rust \(only Rosa\)/)).toBeInTheDocument();
  });
});
