import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BillsPage from './pages/BillsPage';
import ChecksPage from './pages/ChecksPage';
import ServiceIssuesPage from './pages/ServiceIssuesPage';
import HistoryNotesPage from './pages/HistoryNotesPage';
import VendorsPage from './pages/VendorsPage';
import VendorDetailPage from './pages/VendorDetailPage';
import GeneralLedgerReport from './pages/reports/GeneralLedgerReport';
import UnitTransactionListing from './pages/UnitTransactionListing';
import MoveInOutPage from './pages/MoveInOutPage';
import HomePage from './pages/HomePage';
import DarkModeToggle from './components/DarkModeToggle';

const queryClient = new QueryClient();

function navClass({ isActive }: { isActive: boolean }) {
  return `text-sm font-medium px-3 py-2 rounded-md transition-colors ${
    isActive
      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800'
  }`;
}

const NAV = [
  ['General Ledger', '/reports/general-ledger'],
  ['Unit Transactions', '/unit-transactions'],
  ['Bills', '/bills'],
  ['Checks', '/checks'],
  ['Service Requests', '/service-issues'],
  ['Notes', '/history'],
  ['Tenant History', '/move-history'],
  ['Vendors', '/vendors'],
] as const;

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col font-sans text-gray-900 dark:text-gray-100 transition-colors">
          <header className="bg-white dark:bg-gray-900 shadow-sm ring-1 ring-gray-900/5 dark:ring-gray-800 transition-colors print:hidden">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="flex h-16 items-center justify-between">
                <div className="flex gap-8 items-center">
                  <NavLink to="/" end className="hover:opacity-80 transition-opacity">
                    <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">HOA Data</h1>
                  </NavLink>
                  <nav className="flex gap-4">
                    {NAV.map(([label, path]) => (
                      <NavLink key={path} to={path} end className={navClass}>
                        {label}
                      </NavLink>
                    ))}
                  </nav>
                </div>
                <DarkModeToggle />
              </div>
            </div>
          </header>
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 print:p-0 print:m-0 print:max-w-none">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/bills" element={<BillsPage />} />
              <Route path="/checks" element={<ChecksPage />} />
              <Route path="/service-issues" element={<ServiceIssuesPage />} />
              <Route path="/history" element={<HistoryNotesPage />} />
              <Route path="/vendors" element={<VendorsPage />} />
              <Route path="/vendors/:name" element={<VendorDetailPage />} />
              <Route path="/move-history" element={<MoveInOutPage />} />
              <Route path="/unit-transactions" element={<UnitTransactionListing />} />
              <Route path="/reports/general-ledger" element={<GeneralLedgerReport />} />
            </Routes>
          </main>
        </div>
      </Router>
    </QueryClientProvider>
  );
}