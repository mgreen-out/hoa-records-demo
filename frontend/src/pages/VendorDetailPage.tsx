import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '../components/DataTable';
import { ArrowLeft } from 'lucide-react';

// ---- Types ----

type Bill = {
  Property: string;
  'Bill Date': string;
  'Due Date': string;
  Paid: string;
  'Check #': string;
  Amount: number;
  Remaining: number;
  Reference: string;
};

type Check = {
  Reference: string;
  Date: string;
  Comment: string;
  Amount: number;
  Reversed: string;
  Property: string;
};

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

// ---- Bill columns (Payee column removed — implied by context) ----

const billColumns: ColumnDef<Bill>[] = [
  {
    accessorKey: 'Property',
    header: 'Property',
  },
  {
    accessorKey: 'Bill Date',
    header: 'Bill Date',
    cell: ({ row }) => {
      const val = row.getValue('Bill Date') as string;
      return val ? val.split(' ')[0] : '';
    },
  },
  {
    accessorKey: 'Due Date',
    header: 'Due Date',
    cell: ({ row }) => {
      const val = row.getValue('Due Date') as string;
      return val ? val.split(' ')[0] : '';
    },
  },
  {
    accessorKey: 'Paid',
    header: 'Paid',
    cell: ({ row }) => {
      const val = row.getValue('Paid') as string;
      return (
        <span
          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
            val === 'Yes' ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-400' : 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-400'
          }`}
        >
          {val}
        </span>
      );
    },
  },
  {
    accessorKey: 'Check #',
    header: 'Check #',
  },
  {
    accessorKey: 'Amount',
    header: 'Amount',
    cell: ({ row }) => {
      const amount = row.getValue('Amount');
      if (amount == null) return '';
      return currency.format(Number(amount));
    },
  },
  {
    accessorKey: 'Reference',
    header: 'Reference',
  },
  {
    accessorKey: 'Remaining',
    header: 'Remaining',
    cell: ({ row }) => {
      const val = row.getValue('Remaining');
      if (val == null) return '';
      return currency.format(Number(val));
    },
  },
];

// ---- Check columns (Payee column removed) ----

const checkColumns: ColumnDef<Check>[] = [
  {
    accessorKey: 'Reference',
    header: 'Reference',
  },
  {
    accessorKey: 'Date',
    header: 'Date',
    cell: ({ row }) => {
      const val = row.getValue('Date') as string;
      return val ? val.split(' ')[0] : '';
    },
  },
  {
    accessorKey: 'Comment',
    header: 'Comment',
  },
  {
    accessorKey: 'Amount',
    header: 'Amount',
    cell: ({ row }) => {
      const amount = row.getValue('Amount');
      if (amount == null) return '';
      return currency.format(Number(amount));
    },
  },
  {
    accessorKey: 'Reversed',
    header: 'Reversed',
    cell: ({ row }) => {
      const val = row.getValue('Reversed') as string;
      return (
        <span
          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
            val === 'True' ? 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-400' : 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-400'
          }`}
        >
          {val === 'True' ? 'Yes' : 'No'}
        </span>
      );
    },
  },
  {
    accessorKey: 'Property',
    header: 'Property',
  },
];

// ---- Component ----

export default function VendorDetailPage() {
  const { name } = useParams<{ name: string }>();
  const vendorName = decodeURIComponent(name ?? '');

  // Fetch bills for this vendor
  const billsQuery = useQuery({
    queryKey: ['vendor-bills', vendorName],
    queryFn: async () => {
      const sql = `SELECT
        "PropertyName" AS "Property",
        REPLACE("BillDate", 'T00:00:00', '') AS "Bill Date",
        REPLACE("DueDate", 'T00:00:00', '') AS "Due Date",
        CASE WHEN "IsFullyAllocated" = 'True' THEN 'Yes' ELSE 'No' END AS "Paid",
        "CheckReference" AS "Check #",
        CAST("Amount" AS REAL) AS "Amount",
        CAST("Amount" AS REAL) - CAST(COALESCE("AmountAllocated", '0') AS REAL) AS "Remaining",
        "CheckReference" AS "Reference"
      FROM bills
      WHERE "Payee" = :payee
      ORDER BY "BillDate" DESC`;
      const url = `/extracted.json?_shape=array&sql=${encodeURIComponent(sql)}&payee=${encodeURIComponent(vendorName)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch bills');
      return (await res.json()) as Bill[];
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!vendorName,
  });

  // Fetch checks for this vendor
  const checksQuery = useQuery({
    queryKey: ['vendor-checks', vendorName],
    queryFn: async () => {
      const sql = `SELECT
        "Reference" AS "Reference",
        REPLACE("TransactionDate", 'T00:00:00', '') AS "Date",
        COALESCE("Comment", '') AS "Comment",
        CAST("Amount" AS REAL) AS "Amount",
        COALESCE("IsReversed", 'False') AS "Reversed",
        COALESCE("PropertyName", '') AS "Property"
      FROM checks
      WHERE "Payee" = :payee
      ORDER BY "TransactionDate" DESC`;
      const url = `/extracted.json?_shape=array&sql=${encodeURIComponent(sql)}&payee=${encodeURIComponent(vendorName)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch checks');
      return (await res.json()) as Check[];
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!vendorName,
  });

  const isLoading = billsQuery.isLoading || checksQuery.isLoading;
  const isError = billsQuery.isError || checksQuery.isError;
  const error = billsQuery.error ?? checksQuery.error;

  if (isLoading) return <div className="text-gray-500 dark:text-gray-400 dark:text-gray-500">Loading vendor details…</div>;
  if (isError) return <div className="text-red-500">Error: {(error as Error).message}</div>;

  const bills = billsQuery.data ?? [];
  const checks = checksQuery.data ?? [];
  const totalBillAmt = bills.reduce((sum, b) => sum + (Number(b.Amount) || 0), 0);
  const totalCheckAmt = checks.reduce((sum, c) => sum + (Number(c.Amount) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        to="/vendors"
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Vendors
      </Link>

      {/* Vendor header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{vendorName}</h2>
        <div className="mt-2 flex gap-6 text-sm text-gray-600 dark:text-gray-400">
          <span>
            <strong className="text-gray-900 dark:text-gray-100">{bills.length}</strong> bill{bills.length !== 1 ? 's' : ''}
            {' · '}
            {currency.format(totalBillAmt)}
          </span>
          <span>
            <strong className="text-gray-900 dark:text-gray-100">{checks.length}</strong> check{checks.length !== 1 ? 's' : ''}
            {' · '}
            {currency.format(totalCheckAmt)}
          </span>
        </div>
      </div>

      {/* Bills section */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
          Bills ({bills.length})
        </h3>
        {bills.length > 0 ? (
          <DataTable columns={billColumns} data={bills} sortBy="Bill Date" />
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">No bills for this vendor.</p>
        )}
      </div>

      {/* Checks section */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
          Checks ({checks.length})
        </h3>
        {checks.length > 0 ? (
          <DataTable columns={checkColumns} data={checks} sortBy="Date" />
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">No checks for this vendor.</p>
        )}
      </div>
    </div>
  );
}
