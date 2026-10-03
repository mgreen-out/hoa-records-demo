import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
} from '@tanstack/react-table';
import type { ColumnDef, SortingState } from '@tanstack/react-table';
import { useState } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  sortBy?: string;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  sortBy,
}: DataTableProps<TData, TValue>) {
  const [globalFilter, setGlobalFilter] = useState('');

  const initialSorting: SortingState = sortBy ? [{ id: sortBy, desc: true }] : [];

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      pagination: {
        pageSize: 100,
      },
      sorting: initialSorting,
    },
    state: {
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
  });

  const btnClass =
    'px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400 dark:text-gray-500" />
          </div>
          <input
            type="text"
            value={globalFilter ?? ''}
            onChange={e => setGlobalFilter(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-800 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900 dark:text-gray-100"
            placeholder="Search all columns..."
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden text-xs">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <th
                        key={header.id}
                        className="px-2.5 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <div className="flex items-center gap-1">
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                          {{
                            asc: <ChevronUp className="h-4 w-4" />,
                            desc: <ChevronDown className="h-4 w-4" />,
                          }[header.column.getIsSorted() as string] ?? (
                            header.column.getCanSort() ? <div className="w-4 h-4" /> : null
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-2.5 py-1 text-xs text-gray-900 dark:text-gray-100 align-top leading-relaxed break-words">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length} className="px-2.5 py-2 text-center text-gray-500 dark:text-gray-400">
                    No results.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-700 dark:text-gray-300">
          Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{' '}
          {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, table.getPrePaginationRowModel().rows.length)}{' '}
          of {table.getPrePaginationRowModel().rows.length} entries
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className={btnClass}
          >
            Previous
          </button>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className={btnClass}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}