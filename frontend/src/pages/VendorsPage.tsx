import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '../components/DataTable';

type Vendor = {
  Name: string;
  Active: string;
  Category: string;
  'Tax ID': string;
  'Account #': string;
  Notes: string;
  Bills: number;
  Checks: number;
  'Total Bill Amt': number;
  'Total Check Amt': number;
};

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

const columns: ColumnDef<Vendor>[] = [
  {
    accessorKey: 'Name',
    header: 'Name',
    cell: ({ row }) => {
      const name = row.getValue('Name') as string;
      const hasActivity = (row.getValue('Bills') as number) > 0 || (row.getValue('Checks') as number) > 0;
      if (!hasActivity) return <span className="text-gray-700 dark:text-gray-300">{name}</span>;
      return (
        <Link
          to={`/vendors/${encodeURIComponent(name)}`}
          className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
        >
          {name}
        </Link>
      );
    },
  },
  {
    accessorKey: 'Active',
    header: 'Active',
    cell: ({ row }) => {
      const val = row.getValue('Active') as string;
      return (
        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${val === 'Yes' ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-400'}`}>
          {val}
        </span>
      );
    },
  },
  {
    accessorKey: 'Bills',
    header: 'Bills',
    cell: ({ row }) => {
      const val = row.getValue('Bills') as number;
      return val > 0 ? (
        <span className="font-medium text-gray-900 dark:text-gray-100">{val}</span>
      ) : (
        <span className="text-gray-400 dark:text-gray-500">—</span>
      );
    },
  },
  {
    accessorKey: 'Total Bill Amt',
    header: 'Bill Total',
    cell: ({ row }) => {
      const val = row.getValue('Total Bill Amt') as number;
      return val > 0 ? currency.format(val) : <span className="text-gray-400 dark:text-gray-500">—</span>;
    },
  },
  {
    accessorKey: 'Checks',
    header: 'Checks',
    cell: ({ row }) => {
      const val = row.getValue('Checks') as number;
      return val > 0 ? (
        <span className="font-medium text-gray-900 dark:text-gray-100">{val}</span>
      ) : (
        <span className="text-gray-400 dark:text-gray-500">—</span>
      );
    },
  },
  {
    accessorKey: 'Total Check Amt',
    header: 'Check Total',
    cell: ({ row }) => {
      const val = row.getValue('Total Check Amt') as number;
      return val > 0 ? currency.format(val) : <span className="text-gray-400 dark:text-gray-500">—</span>;
    },
  },
  {
    accessorKey: 'Category',
    header: 'Category',
  },
  {
    accessorKey: 'Tax ID',
    header: 'Tax ID',
  },
  {
    accessorKey: 'Account #',
    header: 'Account #',
  },
  {
    accessorKey: 'Notes',
    header: 'Notes',
    cell: ({ row }) => {
      const val = row.getValue('Notes') as string;
      return (
        <div className="leading-relaxed" title={val}>
          {val || <span className="text-gray-400 dark:text-gray-500">—</span>}
        </div>
      );
    },
  },
];

export default function VendorsPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      // Use subqueries to avoid cartesian-product inflation from dual LEFT JOINs.
      // Bills and checks match vendors by Payee/Name — no FK exists, it's purely name-based.
      // Default sort: most active vendors first (bills + checks), then alphabetical.
      const sql = `SELECT
        v."Name" AS "Name",
        CASE WHEN v."IsActive" = 'True' THEN 'Yes' ELSE 'No' END AS "Active",
        COALESCE(v."Category", '') AS "Category",
        COALESCE(v."TaxID", '') AS "Tax ID",
        COALESCE(v."AccountNumber", '') AS "Account #",
        COALESCE(v."Comment", '') AS "Notes",
        COALESCE(bc."BillCount", 0) AS "Bills",
        COALESCE(cc."CheckCount", 0) AS "Checks",
        COALESCE(bc."TotalBillAmount", 0) AS "Total Bill Amt",
        COALESCE(cc."TotalCheckAmount", 0) AS "Total Check Amt"
      FROM vendors v
      LEFT JOIN (
        SELECT "Payee", COUNT(DISTINCT "BillID") AS "BillCount",
               SUM(CAST("Amount" AS REAL)) AS "TotalBillAmount"
        FROM bills GROUP BY "Payee"
      ) bc ON v."Name" = bc."Payee"
      LEFT JOIN (
        SELECT "Payee", COUNT(DISTINCT "CheckDetailID") AS "CheckCount",
               SUM(CAST("Amount" AS REAL)) AS "TotalCheckAmount"
        FROM checks GROUP BY "Payee"
      ) cc ON v."Name" = cc."Payee"
      ORDER BY ("Bills" + "Checks") DESC, v."Name"`;

      const res = await fetch(
        `/extracted.json?_shape=array&sql=${encodeURIComponent(sql)}`
      );
      if (!res.ok) throw new Error('Network response was not ok');
      return (await res.json()) as Vendor[];
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });

  if (isLoading) return <div className="text-gray-500 dark:text-gray-400 dark:text-gray-500">Loading vendors…</div>;
  if (isError) return <div className="text-red-500">Error: {(error as Error).message}. (Is Datasette running on port 8001?)</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Vendors</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Full vendor directory with transaction counts and totals</p>
        </div>
        {data && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {data.filter(v => v.Bills > 0 || v.Checks > 0).length} with activity / {data.length} total
          </span>
        )}
      </div>

      {data && <DataTable columns={columns} data={data} />}
    </div>
  );
}
