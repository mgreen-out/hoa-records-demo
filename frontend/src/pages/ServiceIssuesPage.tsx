import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '../components/DataTable';

type ServiceIssue = {
  'Issue #': number;
  'Open Date': string;
  Closed: string | null;
  Status: string;
  Title: string;
  Description: string;
  Property: string;
  'Due Date': string | null;
  Resolution: string;
};

const columns: ColumnDef<ServiceIssue>[] = [
  {
    accessorKey: 'Issue #',
    header: 'Issue #',
  },
  {
    accessorKey: 'Open Date',
    header: 'Open Date',
    cell: ({ row }) => {
      const val = row.getValue('Open Date') as string;
      return val ? val.split('T')[0] : '';
    }
  },
  {
    accessorKey: 'Closed',
    header: 'Closed',
    cell: ({ row }) => {
      const val = row.getValue('Closed') as string;
      return val ? val.split('T')[0] : '';
    }
  },
  {
    accessorKey: 'Title',
    header: 'Title',
    cell: ({ row }) => {
      const val = row.getValue('Title') as string;
      return (
        <div className="max-w-xs whitespace-normal break-words" title={val}>
          {val}
        </div>
      );
    }
  },
  {
    accessorKey: 'Description',
    header: 'Description',
    cell: ({ row }) => {
      const val = row.getValue('Description') as string;
      return (
        <div className="max-w-sm whitespace-normal break-words" title={val}>
          {val}
        </div>
      );
    }
  },
  {
    accessorKey: 'Property',
    header: 'Property',
  },
  {
    accessorKey: 'Due Date',
    header: 'Due Date',
    cell: ({ row }) => {
      const val = row.getValue('Due Date') as string;
      return val ? val.split('T')[0] : '';
    }
  },
  {
    accessorKey: 'Resolution',
    header: 'Resolution',
    cell: ({ row }) => {
      const val = row.getValue('Resolution') as string;
      return (
        <div className="max-w-sm whitespace-normal break-words" title={val}>
          {val}
        </div>
      );
    }
  },
];

export default function ServiceIssuesPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['serviceIssues'],
    queryFn: async () => {
      const res = await fetch('/extracted/v_service_issues.json?_shape=array&_size=max');
      if (!res.ok) {
        throw new Error('Network response was not ok');
      }
      return (await res.json()) as ServiceIssue[];
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });

  if (isLoading) return <div className="text-gray-500 dark:text-gray-400 dark:text-gray-500">Loading service requests...</div>;
  if (isError) return <div className="text-red-500">Error: {(error as Error).message}. (Is Datasette running on port 8001?)</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Service Requests</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Work orders with status, description, resolution, and dates</p>
        </div>
      </div>
      
      {data && <DataTable columns={columns} data={data} sortBy="Open Date" />}
    </div>
  );
}
