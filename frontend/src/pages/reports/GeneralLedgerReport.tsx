import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';

// Types match the SQLite v_ledger view output (API returns strings, we coerce to numbers)
type LedgerEntry = {
  Type: string;
  Date: string;
  Account: string;
  Description: string;
  Debit: number;
  Credit: number;
  Balance: number;
  Customer: string;
  Unit: string;
  'Account Type': string;
};

type AccountData = { beginningBalance: number; entries: LedgerEntry[] };
type PreGrouped = Record<string, Record<string, LedgerEntry[]>>;

// ---- Shared singletons (avoid per-call allocation) ----

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

function formatCurrency(val: number) {
  return currencyFormatter.format(val);
}

function formatDate(dateStr: string) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { timeZone: 'UTC', month: '2-digit', day: '2-digit', year: 'numeric' });
}

/** Normalise API string values to numbers – the Datasette JSON returns "0.0" etc. */
function coerceEntry(raw: Record<string, unknown>): LedgerEntry {
  const toNum = (v: unknown) => {
    if (v == null) return 0;
    return typeof v === 'number' ? v : Number(v);
  };
  return {
    Type: String(raw.Type ?? ''),
    Date: String(raw.Date ?? ''),
    Account: String(raw.Account ?? ''),
    Description: String(raw.Description ?? ''),
    Debit: toNum(raw.Debit),
    Credit: toNum(raw.Credit),
    Balance: toNum(raw.Balance),
    Customer: String(raw.Customer ?? ''),
    Unit: String(raw.Unit ?? ''),
    'Account Type': String(raw['Account Type'] ?? ''),
  };
}

// ---- API helpers ----

const DATASETTE = '/extracted.json';

/** Fetch the distinct list of GL accounts that have real transactions (excludes placeholder-only accounts). */
async function fetchAccountList(): Promise<string[]> {
  // 460 of 501 accounts only have "No activity in the period" — skip those
  const sql = `SELECT DISTINCT "Account" FROM v_ledger WHERE "Description" != 'No activity in the period' ORDER BY "Account"`;
  const res = await fetch(
    `${DATASETTE}?_shape=array&sql=${encodeURIComponent(sql)}`
  );
  if (!res.ok) throw new Error('Failed to fetch account list');
  const rows = (await res.json()) as Array<{ Account: string }>;
  return rows.map(r => r.Account);
}

/** Fetch ledger entries for selected accounts (server-side filter).
 *  When accounts is empty, fetches ALL rows (use sparingly – 9,782 rows). */
async function fetchLedgerData(accounts: string[]): Promise<LedgerEntry[]> {
  let url: string;

  if (accounts.length === 0) {
    // "All Accounts" mode – use the view endpoint which supports _size=max
    url = '/extracted/v_ledger.json?_shape=array&_size=max';
  } else {
    // Build a parameterised SQL query with WHERE Account IN (...)
    const params = new URLSearchParams();
    const placeholders = accounts.map((_, i) => `:a${i}`).join(', ');
    params.set('_shape', 'array');
    params.set(
      'sql',
      `SELECT * FROM v_ledger WHERE "Account" IN (${placeholders}) ORDER BY Date ASC, "Account Type"`
    );
    accounts.forEach((acc, i) => params.set(`a${i}`, acc));
    url = `${DATASETTE}?${params.toString()}`;
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ledger data (HTTP ${res.status})`);
  const raw = (await res.json()) as Record<string, unknown>[];
  return raw.map(coerceEntry);
}

// ---- Debounce hook (for account toggles) ----

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    timerRef.current = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timerRef.current);
  }, [value, delay]);

  return debounced;
}

// ---- Filter panel (separate component to avoid re-rendering the report on every keystroke) ----

type FilterPanelProps = {
  availableAccounts: string[];
  selectedAccounts: string[];
  setSelectedAccounts: React.Dispatch<React.SetStateAction<string[]>>;
  startDate: string;
  setStartDate: React.Dispatch<React.SetStateAction<string>>;
  endDate: string;
  setEndDate: React.Dispatch<React.SetStateAction<string>>;
};

function FilterPanel({
  availableAccounts,
  selectedAccounts,
  setSelectedAccounts,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
}: FilterPanelProps) {
  const [accountSearch, setAccountSearch] = useState('');

  const toggleAccount = useCallback(
    (acc: string) => {
      setSelectedAccounts(prev =>
        prev.includes(acc) ? prev.filter(a => a !== acc) : [...prev, acc]
      );
    },
    [setSelectedAccounts]
  );

  const filteredAvailableAccounts = useMemo(() => {
    const searchLower = accountSearch.toLowerCase();
    return availableAccounts.filter(acc =>
      acc.toLowerCase().includes(searchLower)
    );
  }, [availableAccounts, accountSearch]);

  return (
    <div className="mb-8 p-6 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg print:hidden space-y-4 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">
        Report Parameters
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
        <div className="md:col-span-1 flex flex-col h-full">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            GL Account(s)
          </label>
          <input
            type="text"
            placeholder="Search accounts..."
            value={accountSearch}
            onChange={e => setAccountSearch(e.target.value)}
            className="mb-2 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
          />
          <div className="max-h-48 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 shadow-inner divide-y divide-gray-100 dark:divide-gray-700 flex-1">
            {accountSearch === '' && (
              <label className="flex items-center space-x-3 p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={selectedAccounts.length === 0}
                  onChange={() => setSelectedAccounts([])}
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">All Accounts</span>
              </label>
            )}
            {filteredAvailableAccounts.map(acc => (
              <label
                key={acc}
                className="flex items-center space-x-3 p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedAccounts.includes(acc)}
                  onChange={() => toggleAccount(acc)}
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate" title={acc}>
                  {acc}
                </span>
              </label>
            ))}
            {filteredAvailableAccounts.length === 0 && (
              <div className="p-2 text-sm text-gray-500 dark:text-gray-400 text-center italic">
                No accounts match search.
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {startDate ? formatDate(startDate) : 'All available data'}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {endDate ? formatDate(endDate) : 'All available data'}
          </p>
        </div>
      </div>
    </div>
  );
}

// ---- Limit helpers for large datasets ----

const RENDER_CHUNK = 500;

/** Truncate grouped data to at most `limit` entries (keeps account structure intact) */
function limitGroupedEntries(
  grouped: Record<string, Record<string, AccountData>>,
  limit: number
): Record<string, Record<string, AccountData>> {
  let count = 0;
  const result: Record<string, Record<string, AccountData>> = {};

  for (const [accType, accounts] of Object.entries(grouped)) {
    for (const [accName, data] of Object.entries(accounts)) {
      if (count >= limit) return result;

      if (data.entries.length <= limit - count) {
        ((result[accType] ??= {}) as Record<string, AccountData>)[accName] = data;
        count += data.entries.length;
      } else {
        const sliced = data.entries.slice(0, limit - count);
        ((result[accType] ??= {}) as Record<string, AccountData>)[accName] = {
          beginningBalance: data.beginningBalance,
          entries: sliced,
        };
        count += sliced.length;
        return result;
      }
    }
  }

  return result;
}

function countGroupedEntries(grouped: Record<string, Record<string, AccountData>>): number {
  let total = 0;
  for (const accounts of Object.values(grouped)) {
    for (const data of Object.values(accounts)) {
      total += data.entries.length;
    }
  }
  return total;
}

// ---- Main report component ----

export default function GeneralLedgerReport() {
  // ---- Data fetching ----

  const { data: accountList } = useQuery({
    queryKey: ['ledger-accounts'],
    queryFn: fetchAccountList,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  // ---- Filter state ----

  const [startDate, setStartDate] = useState('2013-12-01');
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);

  // Debounce account toggles so rapid checking doesn't fire N queries
  const debouncedAccounts = useDebounce(selectedAccounts, 200);

  const {
    data: ledgerData,
    isLoading,
    isFetching,
    isError,
    error,
  } = useQuery({
    queryKey: ['ledger-data', debouncedAccounts],
    queryFn: () => fetchLedgerData(debouncedAccounts),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
    enabled: accountList !== undefined,
  });

  // ---- Render limit (prevents DOM bloat on large result sets) ----

  const [showAll, setShowAll] = useState(false);

  // Reset showAll whenever filters change
  useEffect(() => {
    setShowAll(false);
  }, [debouncedAccounts, startDate, endDate]);

  // ---- Computations (all memoised) ----

  // 1. Data is pre-sorted by SQL – no client-side sort needed

  // 2. Pre-group ALL entries by AccountType → AccountName
  const preGrouped = useMemo(() => {
    if (!ledgerData) return {};
    const groups: PreGrouped = {};
    for (const entry of ledgerData) {
      const accName = entry.Account || 'Unknown Account';
      const accType = entry['Account Type'] || 'Other';
      (groups[accType] ??= {})[accName] ??= [];
      groups[accType][accName].push(entry);
    }
    return groups;
  }, [ledgerData]);

  // 3. Apply date filters + compute beginning balances (client-side – fast on reduced data)
  const groupedData = useMemo(() => {
    const result: Record<string, Record<string, AccountData>> = {};

    for (const [accType, accounts] of Object.entries(preGrouped)) {
      for (const [accName, entries] of Object.entries(accounts)) {
        let beginningBalance = 0;
        const visible: LedgerEntry[] = [];

        for (const entry of entries) {
          const entryDate = entry.Date?.split('T')[0] || entry.Date?.split(' ')[0];

          if (startDate && entryDate && entryDate < startDate) {
            beginningBalance = entry.Balance;
            continue;
          }
          if (endDate && entryDate && entryDate > endDate) {
            continue;
          }
          visible.push(entry);
        }

        if (visible.length === 0 && beginningBalance === 0) continue;

        (result[accType] ??= {})[accName] = { beginningBalance, entries: visible };
      }
    }

    return result;
  }, [preGrouped, startDate, endDate]);

  // 4. Apply render limit
  const totalEntries = useMemo(() => countGroupedEntries(groupedData), [groupedData]);
  const displayData = useMemo(
    () => (showAll ? groupedData : limitGroupedEntries(groupedData, RENDER_CHUNK)),
    [groupedData, showAll]
  );

  // ---- Render ----

  if (isLoading) return <div className="text-gray-500 print:hidden">Loading account list…</div>;
  if (isError) return <div className="text-red-500 print:hidden">Error: {(error as Error).message}</div>;

  return (
    <div className="bg-white dark:bg-gray-900 p-8 max-w-5xl mx-auto border border-gray-200 dark:border-gray-700 shadow-sm print:shadow-none print:border-none print:p-0">
      {/* Filters — own component so search keystrokes don't re-render the report body */}
      <FilterPanel
        availableAccounts={accountList ?? []}
        selectedAccounts={selectedAccounts}
        setSelectedAccounts={setSelectedAccounts}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
      />

      {/* Header */}
      <div className="mb-8 border-b pb-4">
        <h1 className="text-2xl font-bold uppercase tracking-wide text-gray-900 dark:text-gray-100 border-b-2 border-black dark:border-gray-300 inline-block mb-2">
          GENERAL LEDGER
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500">Generated Report</p>
        {(startDate || endDate) ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Period: {startDate ? formatDate(startDate) : 'Beginning'} –{' '}
            {endDate ? formatDate(endDate) : 'End'}
          </p>
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1 italic">
            Showing all available data (no date filter applied)
          </p>
        )}
      </div>

      {/* Loading overlay for in-flight queries */}
      <div className="space-y-8 relative" style={{ opacity: isFetching ? 0.6 : 1, transition: 'opacity 150ms' }}>
        {isFetching && (
          <div className="absolute inset-0 flex items-start justify-center pt-8 z-10">
            <span className="text-sm text-gray-500 dark:text-gray-300 bg-white/80 dark:bg-gray-800/80 px-3 py-1 rounded-full shadow">
              Updating…
            </span>
          </div>
        )}

        {Object.entries(displayData).map(([accountType, accounts]) => (
          <div key={accountType} className="break-inside-avoid">
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">{accountType}</h2>

            {Object.entries(accounts).map(([accountName, { beginningBalance, entries }]) => {
              const totalDebit = entries.reduce((sum, e) => sum + e.Debit, 0);
              const totalCredit = entries.reduce((sum, e) => sum + e.Credit, 0);
              const isNoActivity =
                entries.length === 1 && entries[0].Description === 'No activity in the period';

              if (entries.length === 0 && beginningBalance === 0) return null;
              if (isNoActivity && beginningBalance === 0) return null;

              const displayEntries = isNoActivity ? [] : entries;
              const endingBalance =
                displayEntries.length > 0
                  ? displayEntries[displayEntries.length - 1].Balance
                  : beginningBalance;

              return (
                <div key={accountName} className="mb-6 pl-4 border-l-2 border-gray-100">
                  <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">{accountName}</h3>
                  <table className="min-w-full text-sm font-mono">
                    <thead>
                      <tr className="border-b border-gray-300 dark:border-gray-600 text-left text-gray-500 dark:text-gray-400 dark:text-gray-500">
                        <th className="py-1 w-24">Date</th>
                        <th className="py-1 w-20">Type</th>
                        <th className="py-1">Description</th>
                        <th className="py-1 text-right w-24">Debit</th>
                        <th className="py-1 text-right w-24">Credit</th>
                        <th className="py-1 text-right w-32">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {startDate && (
                        <tr className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 italic">
                          <td colSpan={5} className="py-1 text-right pr-4">
                            Beginning Balance:
                          </td>
                          <td className="py-1 text-right">
                            {formatCurrency(beginningBalance)}
                          </td>
                        </tr>
                      )}

                      {displayEntries.map((e, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                          <td className="py-1 whitespace-nowrap">{formatDate(e.Date)}</td>
                          <td className="py-1">{e.Type}</td>
                          <td className="py-1" title={e.Description}>
                            {e.Description}
                          </td>
                          <td className="py-1 text-right">
                            {e.Debit !== 0 ? formatCurrency(e.Debit) : ''}
                          </td>
                          <td className="py-1 text-right">
                            {e.Credit !== 0 ? formatCurrency(e.Credit) : ''}
                          </td>
                          <td className="py-1 text-right font-semibold">
                            {formatCurrency(e.Balance)}
                          </td>
                        </tr>
                      ))}

                      {displayEntries.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-2 text-center text-gray-400 italic">
                            No activity matching criteria.
                          </td>
                        </tr>
                      )}

                      <tr className="border-t border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 font-semibold">
                        <td colSpan={3} className="py-1 text-right pr-4">
                          Period Change / Ending Bal:
                        </td>
                        <td className="py-1 text-right">
                          {totalDebit !== 0 ? formatCurrency(totalDebit) : ''}
                        </td>
                        <td className="py-1 text-right">
                          {totalCredit !== 0 ? formatCurrency(totalCredit) : ''}
                        </td>
                        <td className="py-1 text-right">
                          {formatCurrency(endingBalance)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        ))}

        {Object.keys(displayData).length === 0 && (
          <div className="text-gray-500 text-center py-8">
            {ledgerData && ledgerData.length > 0
              ? 'No results match the selected date range.'
              : 'Select one or more GL accounts to view the ledger.'}
          </div>
        )}
      </div>

      {/* "Show all" toggle when data exceeds render chunk */}
      {!showAll && totalEntries > RENDER_CHUNK && (
        <div className="text-center py-4 print:hidden">
          <button
            onClick={() => setShowAll(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            Show all {totalEntries.toLocaleString()} entries
          </button>
          <p className="text-xs text-gray-500 mt-1">
            Showing first {RENDER_CHUNK.toLocaleString()} entries for performance.
          </p>
        </div>
      )}
    </div>
  );
}