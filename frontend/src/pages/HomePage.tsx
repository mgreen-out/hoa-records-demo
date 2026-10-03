import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '../components/DataTable';

// ---- Types ----

type RentRollRow = {
  '#': number;
  Unit: string;
  Homeowner: string;
  'Sq Ft': string;
  Fee: number;
};

// ---- Shared ----

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

// ---- Rent Roll columns ----

const rentRollColumns: ColumnDef<RentRollRow>[] = [
  {
    accessorKey: '#',
    header: '#',
    cell: ({ row }) => (
      <span className="text-gray-400 dark:text-gray-500 tabular-nums">{row.getValue('#')}</span>
    ),
  },
  {
    accessorKey: 'Unit',
    header: 'Unit',
    cell: ({ row }) => (
      <span className="font-medium text-gray-900 dark:text-gray-100">{row.getValue('Unit')}</span>
    ),
  },
  {
    accessorKey: 'Homeowner',
    header: 'Homeowner',
  },
  {
    accessorKey: 'Sq Ft',
    header: 'Sq Ft',
    cell: ({ row }) => {
      const val = row.getValue('Sq Ft') as string;
      return val ? Number(val).toLocaleString() : '';
    },
  },
  {
    accessorKey: 'Fee',
    header: 'Monthly Fee',
    cell: ({ row }) => {
      const val = row.getValue('Fee') as number;
      return <span className="font-medium">{currency.format(val)}</span>;
    },
  },
];

// ---- Stat fetch helper ----

async function fetchCount(sql: string): Promise<number> {
  const url = `/extracted.json?sql=${encodeURIComponent(sql)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  const data = await res.json();
  return data.rows[0][0] as number;
}

// ---- Main component ----

export default function HomePage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['rent-roll'],
    queryFn: async () => {
      const res = await fetch('/extracted/v_rent_roll.json?_shape=array');
      if (!res.ok) throw new Error('Failed to fetch rent roll');
      return (await res.json()) as RentRollRow[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const statsQuery = useQuery({
    queryKey: ['overview-stats'],
    queryFn: async () => {
      const [ledgerTxCount, glAccountCount, billCount, checkCount, serviceCount, historyCount, vendorCount, moveCount] =
        await Promise.all([
          fetchCount('SELECT COUNT(*) FROM v_ledger WHERE Description != \'No activity in the period\''),
          fetchCount('SELECT COUNT(DISTINCT Account) FROM v_ledger WHERE Description != \'No activity in the period\''),
          fetchCount('SELECT COUNT(*) FROM v_bills'),
          fetchCount('SELECT COUNT(*) FROM v_checks'),
          fetchCount('SELECT COUNT(*) FROM v_service_issues'),
          fetchCount('SELECT COUNT(*) FROM history WHERE HasFile = \'True\''),
          fetchCount('SELECT COUNT(*) FROM (SELECT v.Name FROM vendors v JOIN (SELECT DISTINCT Payee FROM bills UNION SELECT DISTINCT Payee FROM checks) t ON v.Name = t.Payee)'),
          fetchCount('SELECT COUNT(*) FROM rpt_move_in_move_out_grid1'),
        ]);
      return { ledgerTxCount, glAccountCount, billCount, checkCount, serviceCount, historyCount, vendorCount, moveCount };
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <div className="text-gray-500 dark:text-gray-400 dark:text-gray-500">Loading…</div>;
  if (isError) return <div className="text-red-500">Error loading data. (Is Datasette running?)</div>;

  const rentRoll = data ?? [];
  const s = statsQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Overview</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Current snapshot of units, homeowners, and fees</p>
        </div>
      </div>

      {/* Data summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        <Stat label="Transactions" value={s?.ledgerTxCount} />
        <Stat label="General Ledger Accounts" value={s?.glAccountCount} />
        <Stat label="Bills" value={s?.billCount} />
        <Stat label="Checks" value={s?.checkCount} />
        <Stat label="Service Requests" value={s?.serviceCount} />
        <Stat label="Notes w/ Files" value={s?.historyCount} />
        <Stat label="Tenant Turnovers" value={s?.moveCount} />
        <Stat label="Vendors" value={s?.vendorCount} />
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">Rent Roll</h3>
        {rentRoll.length > 0 ? (
          <DataTable columns={rentRollColumns} data={rentRoll} />
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">No rent roll data available.</p>
        )}
      </div>
    </div>
  );
}

// ---- Stat component ----

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3 shadow-sm">
      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
        {value != null ? value.toLocaleString() : '…'}
      </p>
    </div>
  );
}