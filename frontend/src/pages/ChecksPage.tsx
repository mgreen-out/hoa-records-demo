import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '../components/DataTable';

type Check = {
  Reference: string;
  Date: string;
  Payee: string;
  Comment: string;
  Amount: number;
  Reversed: string;
  Property: string;
  Detail: string;
  'Check ID': number;
};

const columns: ColumnDef<Check>[] = [
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
    }
  },
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
    accessorKey: 'Comment',
    header: 'Comment',
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
    accessorKey: 'Reversed',
    header: 'Reversed',
    cell: ({ row }) => {
      const val = row.getValue('Reversed') as string;
      return (
        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${val === 'True' ? 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-400' : 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-400'}`}>
          {val === 'True' ? 'Yes' : 'No'}
        </span>
      );
    }
  },
  {
    accessorKey: 'Property',
    header: 'Property',
  },
  {
    accessorKey: 'Detail',
    header: 'Detail',
  },
  {
    accessorKey: 'Check ID',
    header: 'Check ID',
  },
];

export default function ChecksPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['checks'],
    queryFn: async () => {
      const res = await fetch('/extracted/v_checks.json?_shape=array&_size=max');
      if (!res.ok) {
        throw new Error('Network response was not ok');
      }
      return (await res.json()) as Check[];
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });

  if (isLoading) return <div className="text-gray-500 dark:text-gray-400 dark:text-gray-500">Loading checks...</div>;
  if (isError) return <div className="text-red-500">Error: {(error as Error).message}. (Is Datasette running on port 8001?)</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Checks</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Every check issued with payee, amount, reference, and reversal status</p>
        </div>
      </div>
      
      {data && <DataTable columns={columns} data={data} sortBy="Date" />}
    </div>
  );
}
