import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '../components/DataTable';

type HistoryNote = {
  Date: string;
  Note: string;
  Files: string;
  Author: string;
};

const columns: ColumnDef<HistoryNote>[] = [
  {
    accessorKey: 'Date',
    header: 'Date',
  },
  {
    accessorKey: 'Author',
    header: 'Author',
  },
  {
    accessorKey: 'Note',
    header: 'Note',
    cell: ({ row }) => {
      const val = row.getValue('Note') as string;
      return (
        <div className="max-w-md whitespace-pre-wrap break-words">
          {val}
        </div>
      );
    }
  },
  {
    accessorKey: 'Files',
    header: 'Files',
    cell: ({ row }) => {
      const val = row.getValue('Files') as string;
      if (!val) return <span className="text-gray-400 dark:text-gray-500">—</span>;
      
      const filesArr = val.split(',').map(f => f.trim()).filter(Boolean);
      return (
        <div className="flex flex-col gap-1">
          {filesArr.map((f, i) => (
            <a
              key={i}
              href={`/files/${encodeURIComponent(f)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
              title={f}
            >
              {f}
            </a>
          ))}
        </div>
      );
    }
  },
];

export default function HistoryNotesPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['historyNotes'],
    queryFn: async () => {
      const res = await fetch('/extracted/v_history.json?_shape=array&_size=max');
      if (!res.ok) {
        throw new Error('Network response was not ok');
      }
      return (await res.json()) as HistoryNote[];
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });

  if (isLoading) return <div className="text-gray-500 dark:text-gray-400 dark:text-gray-500">Loading history notes...</div>;
  if (isError) return <div className="text-red-500">Error: {(error as Error).message}. (Is Datasette running on port 8001?)</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Notes</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Chronological notes with file attachments</p>
        </div>
      </div>
      
      {data && <DataTable columns={columns} data={data} sortBy="Date" />}
    </div>
  );
}
