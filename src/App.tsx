import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import AddTransaction from "./pages/AddTransaction";
import CalendarView from "./pages/CalendarView";
import TransactionsList from "./pages/TransactionsList";
import ExportPage from "./pages/ExportPage";
import Categories from "./pages/Categories";
import RecurringTransactions from "./pages/RecurringTransactions";
import BudgetsPage from "./pages/Budgets";
import BackupRestore from "./pages/BackupRestore";
import Loans from "./pages/Loans";
import DailyNotes from "./pages/DailyNotes";
import Admin from "./pages/Admin";
import AppLayout from "./components/AppLayout";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">
        <img src="/icon-192.png" alt="CungaCash" className="w-12 h-12 rounded-xl animate-pulse" />
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Auth />;

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/add" element={<AddTransaction />} />
        <Route path="/calendar" element={<CalendarView />} />
        <Route path="/transactions" element={<TransactionsList />} />
        <Route path="/export" element={<ExportPage />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/recurring" element={<RecurringTransactions />} />
        <Route path="/budgets" element={<BudgetsPage />} />
        <Route path="/loans" element={<Loans />} />
        <Route path="/notes" element={<DailyNotes />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/backup" element={<BackupRestore />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
