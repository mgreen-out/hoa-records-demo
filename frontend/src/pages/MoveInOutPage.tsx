import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '../components/DataTable';

// ---- Types ----

type MoveEvent = {
  Unit: string;
  Tenant: string;
  'Move In': string;
  'Move Out': string;
  Status: string;
};

// ---- Utilities ----

function formatDate(dateStr: string) {
  if (!dateStr) return '—';
  return dateStr.split('T')[0];
}

function computeTenure(moveIn: string, moveOut: string): string {
  if (!moveIn) return '';
  const start = new Date(moveIn);
  const end = moveOut ? new Date(moveOut) : new Date();
  const months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth());
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0) return `${rem} mo`;
  if (rem === 0) return `${years} yr`;
  return `${years} yr ${rem} mo`;
}

// ---- Columns ----

const columns: ColumnDef<MoveEvent>[] = [
  {
    accessorKey: 'Unit',
    header: 'Unit',
    cell: ({ row }) => (
      <span className="font-medium text-gray-900 dark:text-gray-100">{row.getValue('Unit')}</span>
    ),
  },
  {
    accessorKey: 'Tenant',
    header: 'Tenant',
  },
  {
    accessorKey: 'Move In',
    header: 'Move In',
    cell: ({ row }) => formatDate(row.getValue('Move In')),
  },
  {
    accessorKey: 'Move Out',
    header: 'Move Out',
    cell: ({ row }) => formatDate(row.getValue('Move Out')),
  },
  {
    id: 'Tenure',
    header: 'Tenure',
    cell: ({ row }) => {
      const moveIn = row.getValue('Move In') as string;
      const moveOut = row.getValue('Move Out') as string;
      return <span className="text-gray-600 dark:text-gray-400 dark:text-gray-500">{computeTenure(moveIn, moveOut)}</span>;
    },
  },
  {
    accessorKey: 'Status',
    header: 'Status',
    cell: ({ row }) => {
      const val = row.getValue('Status') as string;
      return (
        <span
          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
            val === 'Current'
              ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-400'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
          }`}
        >
          {val}
        </span>
      );
    },
  },
];

// ---- Main ----

export default function MoveInOutPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['move-in-out'],
    queryFn: async () => {
      const res = await fetch(
        '/extracted/rpt_move_in_move_out_grid1.json?_shape=array&_size=max'
      );
      if (!res.ok) throw new Error('Failed to fetch move data');

      const raw = (await res.json()) as Array<Record<string, string | null>>;

      return raw.map(r => ({
        Unit: (r.SubEntitiesName as string) ?? '',
        Tenant: ((r.AccountsFirstName ?? '') + ' ' + (r.AccountsLastName ?? '')).trim(),
        'Move In': (r.LeasesMoveInDate as string) ?? '',
        'Move Out': (r.LeasesMoveOutDate as string) ?? '',
        Status: (r.CustomerStatus as string) ?? '',
      })) as MoveEvent[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Sort: current tenants first, then by move-in date descending
  const sorted = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => {
      if (a.Status === 'Current' && b.Status !== 'Current') return -1;
      if (a.Status !== 'Current' && b.Status === 'Current') return 1;
      return (b['Move In'] || '').localeCompare(a['Move In'] || '');
    });
  }, [data]);

  if (isLoading) return <div className="text-gray-500 dark:text-gray-400 dark:text-gray-500">Loading move history…</div>;
  if (isError) return <div className="text-red-500">Error: {(error as Error).message}</div>;

  const events = data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Tenant History</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">All tenant move-ins and move-outs with dates, tenure, and status</p>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
          Move History ({events.length})
        </h3>
        {sorted.length > 0 ? (
          <DataTable columns={columns} data={sorted} sortBy="Move In" />
        ) : (
          <p className="text-sm text-gray-500 italic">No move history available.</p>
        )}
      </div>
    </div>
  );
}