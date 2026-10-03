import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '../components/DataTable';

// Types match the SQLite v_bills view output
type Bill = {
  Payee: string;
  Property: string;
  'Bill Date': string;
  'Due Date': string;
  Paid: string;
  'Check #': string;
  Amount: number;
  Remaining: number;
  Allocated: number;
  Reference: string;
  'Bill ID': number;
  'Check ID': number;
};

const columns: ColumnDef<Bill>[] = [
  {
    accessorKey: 'Payee',
    header: 'Payee',
    cell: ({ row }) => {
      const name = row.getValue('Payee') as string;
      if (!name) return '';
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
    accessorKey: 'Bill Date',
    header: 'Bill Date',
    cell: ({ row }) => {
      const val = row.getValue('Bill Date') as string;
      return val ? val.split(' ')[0] : '';
    }
  },
  {
    accessorKey: 'Due Date',
    header: 'Due Date',
    cell: ({ row }) => {
      const val = row.getValue('Due Date') as string;
      return val ? val.split(' ')[0] : '';
    }
  },
  {
    accessorKey: 'Paid',
    header: 'Paid',
    cell: ({ row }) => {
      const val = row.getValue('Paid') as string;
      return (
        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${val === 'Yes' ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-400' : 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-400'}`}>
          {val}
        </span>
      );
    }
  },
  {
    accessorKey: 'Check #',
    header: 'Check #',
  },
  {
    accessorKey: 'Amount',
    header: 'Amount',
    cell: ({ row }) => {
      const amount = row.getValue('Amount') ? parseFloat(row.getValue('Amount')) : 0;
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(amount);
    }
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
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parseFloat(val as string));
    }
  },
  {
    accessorKey: 'Allocated',
    header: 'Allocated',
    cell: ({ row }) => {
      const val = row.getValue('Allocated');
      if (val == null) return '';
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parseFloat(val as string));
    }
  },
  {
    accessorKey: 'Bill ID',
    header: 'Bill ID',
  },
  {
    accessorKey: 'Check ID',
    header: 'Check ID',
  },
];

export default function BillsPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['bills'],
    queryFn: async () => {
      const res = await fetch('/extracted/v_bills.json?_shape=array&_size=max');
      if (!res.ok) {
        throw new Error('Network response was not ok');
      }
      return (await res.json()) as Bill[];
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });

  if (isLoading) return <div className="text-gray-500 dark:text-gray-400 dark:text-gray-500">Loading bills...</div>;
  if (isError) return <div className="text-red-500">Error: {(error as Error).message}. (Is Datasette running on port 8001?)</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Bills</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">All bills with payee, dates, amounts, and payment status</p>
        </div>
      </div>
      
      {data && <DataTable columns={columns} data={data} sortBy="Bill Date" />}
    </div>
  );
}
