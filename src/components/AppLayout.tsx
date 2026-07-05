import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import {
  LayoutDashboard, PlusCircle, CalendarDays, List, Menu, FileDown,
  ExternalLink, X, Tag, Repeat, Target, Database, Moon, Sun, HandCoins,
  StickyNote, Shield, UserCircle2, PiggyBank, Users, Sparkles, Wallet, Trophy,
} from 'lucide-react';
import OfflineIndicator from './OfflineIndicator';
import AlertsBell from './AlertsBell';
import LanguageSwitcher from './LanguageSwitcher';
import { Button } from '@/components/ui/button';
import InfoBanner from './InfoBanner';

const mainNavCfg = [
  { path: '/', key: 'dashboard', icon: LayoutDashboard },
  { path: '/add', key: 'add', icon: PlusCircle },
  { path: '/calendar', key: 'calendar', icon: CalendarDays },
  { path: '/transactions', key: 'transactions', icon: List },
  { path: '/export', key: 'export', icon: FileDown },
];

const moreNavCfg = [
  { path: '/accounts', key: 'accounts', icon: Wallet, fallback: 'Accounts' },
  { path: '/goals', key: 'goals', icon: Trophy, fallback: 'Goals' },
  { path: '/assist', key: 'assist', icon: Sparkles },
  { path: '/savings', key: 'savings', icon: PiggyBank },
  { path: '/loans', key: 'loans', icon: HandCoins },
  { path: '/notes', key: 'notes', icon: StickyNote },
  { path: '/categories', key: 'categories', icon: Tag },
  { path: '/recurring', key: 'recurring', icon: Repeat },
  { path: '/budgets', key: 'budgets', icon: Target },
  { path: '/backup', key: 'backup', icon: Database },
  { path: '/profile', key: 'profile', icon: UserCircle2 },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isSuperAdmin, isAdmin } = useAuth();
  const { theme, toggle } = useTheme();
  const { t } = useTranslation();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const mainNav = mainNavCfg.map(i => ({ ...i, label: t(`nav.${i.key}`) }));
  const moreNav = moreNavCfg.map(i => ({ ...i, label: (i as any).fallback ? ((t as any)(`nav.${i.key}`, { defaultValue: (i as any).fallback })) : t(`nav.${i.key}`) }));
  const extras: any[] = [];
  if (isAdmin && !isSuperAdmin) extras.push({ path: '/team', key: 'team', label: 'Team', icon: Users });
  if (isSuperAdmin) extras.push({ path: '/admin', key: 'superAdmin', label: t('nav.superAdmin'), icon: Shield });
  const moreNavWithAdmin = [...moreNav, ...extras];
  const allNav = [...mainNav, ...moreNavWithAdmin];
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
          <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">{t('nav.main')}</p>
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

          <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">{t('nav.manage')}</p>
          {moreNavWithAdmin.map((item) => {
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
            <span>{theme === 'dark' ? t('common.lightMode') : t('common.darkMode')}</span>
          </button>
          <a href="https://rossets.rw" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 transition-colors">
            <ExternalLink className="w-3.5 h-3.5" /><span>{t('common.developedBy')} <strong>rossets.rw</strong></span>
          </a>
          <Button variant="ghost" className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-destructive" onClick={signOut}>
            <LogOut className="w-4 h-4" />{t("common.signOut")}
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
              <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">{t('nav.manage')}</p>
              {moreNavWithAdmin.map((item) => {
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
                <span>{theme === 'dark' ? t('common.lightMode') : t('common.darkMode')}</span>
              </button>
              <a href="https://rossets.rw" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors">
                <ExternalLink className="w-3.5 h-3.5" /><span>{t('common.developedBy')} <strong>rossets.rw</strong></span>
              </a>
              <Button variant="ghost" className="w-full justify-start gap-3 text-sidebar-foreground hover:text-destructive" onClick={signOut}>
                <LogOut className="w-4 h-4" />{t("common.signOut")}
              </Button>
            </div>
          </aside>
        </>
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <OfflineIndicator />
        <InfoBanner />
        <header className="sticky top-0 z-30 flex items-center gap-3 px-4 sm:px-6 py-3 bg-background/80 backdrop-blur-md border-b shrink-0">
          <button className="lg:hidden p-1.5 rounded-lg hover:bg-muted transition-colors" onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-base sm:text-lg font-semibold truncate flex-1">{currentLabel}</h1>
          <LanguageSwitcher />
          <AlertsBell />
          <Link to="/profile" className="p-1.5 rounded-full hover:bg-muted transition-colors" aria-label="Profile">
            <UserCircle2 className="w-6 h-6 text-muted-foreground" />
          </Link>
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
