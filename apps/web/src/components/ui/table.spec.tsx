// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../../test/support/render';
import { Table } from './table';

const rows = [
  { id: '1', name: 'Aïssatou Ba', email: 'aissatou@example.org' },
  { id: '2', name: 'Kofi Mensah', email: 'kofi@example.org' },
];

function Members() {
  return (
    <Table
      caption="Membres"
      columns={[
        { key: 'name', header: 'Nom', rowHeader: true, cell: (row) => row.name },
        { key: 'email', header: 'Email', cell: (row) => row.email },
        {
          key: 'actions',
          header: 'Actions',
          actions: true,
          cell: (row) => <button type="button">Inviter {row.name}</button>,
        },
      ]}
      rows={rows}
      rowKey={(row) => row.id}
    />
  );
}

describe('Table', () => {
  it('has a card per row for a phone, its title then each column as a term and its value', () => {
    renderWithProviders(<Members />);
    const cards = screen.getAllByRole('listitem');
    expect(cards).toHaveLength(2);
    const [first] = cards;
    expect(first?.textContent).toContain('Aïssatou Ba');
    expect(within(first!).getByRole('term').textContent).toBe('Email');
    expect(within(first!).getByRole('definition').textContent).toBe('aissatou@example.org');
    expect(within(first!).getByRole('button', { name: 'Inviter Aïssatou Ba' })).toBeTruthy();
  });

  it('keeps the table for a wider screen, its first column sticky', () => {
    renderWithProviders(<Members />);
    const table = screen.getByRole('table');
    const [firstHeader] = within(table).getAllByRole('columnheader');
    expect(firstHeader?.className).toContain('sticky');
    expect(within(table).getAllByRole('rowheader')[0]?.className).toContain('sticky');
  });
});
