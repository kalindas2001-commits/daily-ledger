import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import {
  LayoutDashboard,
  PlusCircle,
  CalendarDays,
  List,
  LogOut,
  Menu,
  FileDown,
  ExternalLink,
  X,
  Tag,
  Repeat,
  Target,
  Database,
  Moon,
  Sun,
  HandCoins,
  StickyNote,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const mainNav = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/add', label: 'Add', icon: PlusCircle },
  { path: '/calendar', label: 'Calendar', icon: CalendarDays },
  { path: '/transactions', label: 'Transactions', icon: List },
  { path: '/export', label: 'Export', icon: FileDown },
];

const moreNav = [
  { path: '/loans', label: 'Loans', icon: HandCoins },
  { path: '/notes', label: 'Notes', icon: StickyNote },
  { path: '/categories', label: 'Categories', icon: Tag },
  { path: '/recurring', label: 'Recurring', icon: Repeat },
  { path: '/budgets', label: 'Budgets', icon: Target },
  { path: '/backup', label: 'Backup', icon: Database },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const allNav = [...mainNav, ...moreNav];
  const currentLabel = allNav.find((i) => i.path === location.pathname)?.label ?? 'CungaCash';

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="flex items-center gap-3 p-6 border-b border-sidebar-border">
          <img src="/icon-192.png" alt="CungaCash" className="w-9 h-9 rounded-xl" />
          <span className="text-lg font-bold text-sidebar-primary-foreground tracking-tight">CungaCash</span>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">Main</p>
          {mainNav.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  active ? 'bg-sidebar-accent text-sidebar-primary shadow-sm' : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
                }`}>
                <item.icon className="w-[18px] h-[18px]" />{item.label}
              </Link>
            );
          })}

          <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">Manage</p>
          {moreNav.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  active ? 'bg-sidebar-accent text-sidebar-primary shadow-sm' : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
                }`}>
                <item.icon className="w-[18px] h-[18px]" />{item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border space-y-1">
          <button onClick={toggle}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 transition-colors w-full">
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          <a href="https://rossets.rw" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 transition-colors">
            <ExternalLink className="w-3.5 h-3.5" /><span>Developed by <strong>rossets.rw</strong></span>
          </a>
          <Button variant="ghost" className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-destructive" onClick={signOut}>
            <LogOut className="w-4 h-4" />Sign Out
          </Button>
        </div>
      </aside>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />
          <aside className="fixed inset-y-0 left-0 z-50 w-72 bg-sidebar text-sidebar-foreground shadow-2xl lg:hidden animate-fade-in">
            <div className="flex items-center justify-between p-5 border-b border-sidebar-border">
              <div className="flex items-center gap-3">
                <img src="/icon-192.png" alt="CungaCash" className="w-8 h-8 rounded-xl" />
                <span className="font-bold text-sidebar-primary-foreground">CungaCash</span>
              </div>
              <button onClick={() => setMobileOpen(false)} className="p-1 text-sidebar-foreground"><X className="w-5 h-5" /></button>
            </div>
            <nav className="p-3 space-y-0.5 overflow-y-auto max-h-[calc(100dvh-180px)]">
              <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">Manage</p>
              {moreNav.map((item) => {
                const active = location.pathname === item.path;
                return (
                  <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                      active ? 'bg-sidebar-accent text-sidebar-primary' : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
                    }`}>
                    <item.icon className="w-5 h-5" />{item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-sidebar-border space-y-1">
              <button onClick={toggle}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors w-full">
                {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
              </button>
              <a href="https://rossets.rw" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors">
                <ExternalLink className="w-3.5 h-3.5" /><span>Developed by <strong>rossets.rw</strong></span>
              </a>
              <Button variant="ghost" className="w-full justify-start gap-3 text-sidebar-foreground hover:text-destructive" onClick={signOut}>
                <LogOut className="w-4 h-4" />Sign Out
              </Button>
            </div>
          </aside>
        </>
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="sticky top-0 z-30 flex items-center gap-3 px-4 sm:px-6 py-3 bg-background/80 backdrop-blur-md border-b shrink-0">
          <button className="lg:hidden p-1.5 rounded-lg hover:bg-muted transition-colors" onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-base sm:text-lg font-semibold truncate">{currentLabel}</h1>
        </header>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 animate-fade-in">{children}</div>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden flex border-t bg-background/95 backdrop-blur-md shrink-0 safe-bottom shadow-[0_-1px_3px_rgba(0,0,0,0.05)]">
          {mainNav.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors ${
                  active ? 'text-primary' : 'text-muted-foreground'
                }`}>
                <item.icon className={`w-5 h-5 ${active ? 'scale-110' : ''} transition-transform`} />{item.label}
              </Link>
            );
          })}
        </nav>
      </main>
    </div>
  );
}
