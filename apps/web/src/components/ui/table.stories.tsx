import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useMemo, useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { Badge } from './badge';
import { EmptyState } from './empty-state';
import { Table, type TableColumn, type TableSort } from './table';

interface Row {
  id: string;
  name: string;
  country: string;
  amount: number;
  status: 'pending' | 'paid';
}

const ROWS: Row[] = Array.from({ length: 12 }, (_, index) => ({
  id: String(index + 1),
  name: ['Aïssatou Ba', 'Kofi Mensah', 'Nadia Benali', 'Moussa Diop'][index % 4] ?? '',
  country: ['Sénégal', 'Ghana', 'France', 'Haïti'][index % 4] ?? '',
  amount: 25 * (index + 1),
  status: index % 3 === 0 ? 'pending' : 'paid',
}));

const COLUMNS: TableColumn<Row>[] = [
  { key: 'name', header: 'Contributeur', cell: (row) => row.name, sortable: true, rowHeader: true },
  { key: 'country', header: 'Pays', cell: (row) => row.country },
  {
    key: 'amount',
    header: 'Montant',
    cell: (row) => `${row.amount} €`,
    sortable: true,
    align: 'end',
  },
  {
    key: 'status',
    header: 'État',
    cell: (row) => (
      <Badge tone={row.status === 'paid' ? 'success' : 'warning'}>
        {row.status === 'paid' ? 'Payée' : 'En attente'}
      </Badge>
    ),
  },
];

const meta = { title: 'Design system/Data display/Table', component: Table } satisfies Meta<
  typeof Table
>;
export default meta;
type Story = StoryObj;

/** Sort by column (aria-sort), sticky header, cursor pagination with "load more". */
export const Sortable: Story = {
  render: function Render() {
    const [sort, setSort] = useState<TableSort>({ key: 'amount', direction: 'descending' });
    const [count, setCount] = useState(5);
    const rows = useMemo(() => {
      const sorted = [...ROWS].sort((a, b) => {
        const value = sort.key === 'amount' ? a.amount - b.amount : a.name.localeCompare(b.name);
        return sort.direction === 'ascending' ? value : -value;
      });
      return sorted.slice(0, count);
    }, [sort, count]);
    return (
      <Table
        caption="Contributions de la campagne"
        columns={COLUMNS}
        rows={rows}
        rowKey={(row) => row.id}
        sort={sort}
        onSortChange={setSort}
        hasMore={count < ROWS.length}
        onLoadMore={() => setCount(count + 5)}
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const amount = canvas.getByRole('columnheader', { name: /Montant/ });
    await expect(amount).toHaveAttribute('aria-sort', 'descending');
    await userEvent.click(canvas.getByRole('button', { name: /Trier par Montant/ }));
    await expect(amount).toHaveAttribute('aria-sort', 'ascending');
    await userEvent.click(canvas.getByRole('button', { name: 'Afficher plus' }));
    await expect(canvas.getAllByRole('row')).toHaveLength(11);
  },
};

export const Loading: Story = {
  render: () => (
    <Table
      caption="Contributions"
      columns={COLUMNS}
      rows={[]}
      rowKey={(row: Row) => row.id}
      loading
    />
  ),
};

export const Empty: Story = {
  render: () => (
    <Table
      caption="Contributions"
      columns={COLUMNS}
      rows={[]}
      rowKey={(row: Row) => row.id}
      empty={
        <EmptyState
          size="inline"
          headingLevel={3}
          title="Aucune contribution pour l’instant"
          description="Elles apparaîtront ici dès la première."
        />
      }
    />
  ),
};

/** Administration only. */
export const Compact: Story = {
  render: () => (
    <Table
      caption="Membres"
      hideCaption
      density="compact"
      columns={COLUMNS}
      rows={ROWS.slice(0, 6)}
      rowKey={(row) => row.id}
    />
  ),
};
