import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '../components/DataTable';

// Columns from rpt_unit_transaction_listing_grid1
type UnitTransaction = {
  Date: string;
  Unit: string;
  Customer: string;
  Description: string;
  Reference: string;
  Comment: string;
  Amount: number;
  Balance: number;
};

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

type FilterBarProps = {
  units: string[];
  selectedUnit: string;
  setSelectedUnit: (v: string) => void;
};

function FilterBar({
  units,
  selectedUnit,
  setSelectedUnit,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap gap-4 mb-6 print:hidden">
      <select
        value={selectedUnit}
        onChange={e => {
          setSelectedUnit(e.target.value);
        }}
        className="rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
      >
        <option value="">All Units</option>
        {units.map(u => (
          <option key={u} value={u}>Unit {u}</option>
        ))}
      </select>
    </div>
  );
}

const columns: ColumnDef<UnitTransaction>[] = [
  {
    accessorKey: 'Date',
    header: 'Date',
    cell: ({ row }) => {
      const val = row.getValue('Date') as string;
      return val ? val.split('T')[0] : '';
    },
  },
  {
    accessorKey: 'Unit',
    header: 'Unit',
  },
  {
    accessorKey: 'Customer',
    header: 'Customer',
  },
  {
    accessorKey: 'Description',
    header: 'Description',
    cell: ({ row }) => {
      const desc = row.getValue('Description') as string;
      const comment = row.getValue('Comment') as string;
      return (
        <div>
          <span>{desc}</span>
          {comment && <span className="text-gray-400 text-xs ml-2">— {comment}</span>}
        </div>
      );
    },
  },
  {
    accessorKey: 'Reference',
    header: 'Ref',
  },
  {
    accessorKey: 'Amount',
    header: 'Amount',
    cell: ({ row }) => {
      const val = row.getValue('Amount') as number;
      if (!val) return <span className="text-gray-400 dark:text-gray-500">—</span>;
      const cls = val < 0 ? 'text-green-700' : 'text-gray-900';
      return <span className={cls}>{currency.format(val)}</span>;
    },
  },
  {
    accessorKey: 'Balance',
    header: 'Balance',
    cell: ({ row }) => {
      const val = row.getValue('Balance') as number;
      if (val == null) return '';
      const cls = val < 0 ? 'text-red-700 dark:text-red-400' : 'text-gray-900 dark:text-gray-100';
      return <span className={`font-semibold ${cls}`}>{currency.format(val)}</span>;
    },
  },
];

export default function UnitTransactionListing() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['unit-transactions'],
    queryFn: async () => {
      const sql = `SELECT
        REPLACE("TransactionDate", 'T00:00:00', '') AS "Date",
        "UnitName" AS "Unit",
        "CustomerName" AS "Customer",
        COALESCE("Description", '') AS "Description",
        COALESCE("Reference", '') AS "Reference",
        COALESCE("Comment", '') AS "Comment",
        CAST("Amount" AS REAL) AS "Amount",
        CAST("Balance" AS REAL) AS "Balance"
      FROM rpt_unit_transaction_listing_grid1
      ORDER BY "UnitName", "TransactionDate"`;
      const url = `/extracted.json?_shape=array&sql=${encodeURIComponent(sql)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch unit transactions');
      return (await res.json()) as UnitTransaction[];
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const [selectedUnit, setSelectedUnit] = useState('');

  // Derive filter options from data
  const units = useMemo(() => {
    if (!data) return [];
    const set = new Set(data.map(d => d.Unit));
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [data]);

  // Apply filters
  const filtered = useMemo(() => {
    if (!data) return [];
    if (!selectedUnit) return data;
    return data.filter(d => d.Unit === selectedUnit);
  }, [data, selectedUnit]);

  if (isLoading) return <div className="text-gray-500 dark:text-gray-400 dark:text-gray-500">Loading unit transactions…</div>;
  if (isError) return <div className="text-red-500">Error: {(error as Error).message}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Unit Transaction Listing</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {filtered.length} transaction{filtered.length !== 1 ? 's' : ''} across {units.length} units
          </p>
        </div>
      </div>

      <FilterBar
        units={units}
        selectedUnit={selectedUnit}
        setSelectedUnit={setSelectedUnit}
      />

      {data && <DataTable columns={columns} data={filtered} sortBy="Date" />}
    </div>
  );
}
