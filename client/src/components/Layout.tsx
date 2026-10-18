import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Sparkles,
  MessageSquare,
  BarChart3,
  Settings,
  PlusCircle,
  Menu,
  X,
  Store,
  Bot,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import { getBusinessProfile, getAIStatus, getDashboard } from '../lib/api';
import TransactionModal from './TransactionModal';

export default function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [defaultTxType, setDefaultTxType] = useState<'CREDIT' | 'PAYMENT'>('CREDIT');
  const location = useLocation();

  const { data: businessRes } = useQuery({
    queryKey: ['businessProfile'],
    queryFn: getBusinessProfile,
  });

  const { data: aiStatusRes } = useQuery({
    queryKey: ['aiStatus'],
    queryFn: getAIStatus,
    refetchInterval: 30000,
  });

  const { data: dashboardRes } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
  });

  const business = businessRes?.data || { name: 'UdhaarOS Store', currencySymbol: '₹' };
  const aiStatus = aiStatusRes?.data;
  const overdueCount = dashboardRes?.data?.stats?.overdueAccounts || 0;

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    {
      name: 'Customers (Khata)',
      path: '/customers',
      icon: Users,
      badge: overdueCount > 0 ? `${overdueCount} due` : null,
      badgeColor: 'bg-red-100 text-red-700',
    },
    { name: 'Ledger Book', path: '/transactions', icon: BookOpen },
    {
      name: 'AI Smart Khatabook',
      path: '/import',
      icon: Sparkles,
      highlight: true,
    },
    { name: 'Payment Reminders', path: '/reminders', icon: MessageSquare },
    { name: 'Reports & Aging', path: '/reports', icon: BarChart3 },
    { name: 'Store Settings', path: '/settings', icon: Settings },
  ];

  const handleOpenTx = (type: 'CREDIT' | 'PAYMENT') => {
    setDefaultTxType(type);
    setIsTxModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-stone-100/60 text-stone-900 flex flex-col md:flex-row antialiased">
      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-stone-200 sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-xs">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-extrabold text-stone-900 text-sm leading-tight">UdhaarOS</h1>
              <span className="text-[9px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-stone-500 font-medium truncate max-w-[130px]">{business.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenTx('CREDIT')}
            className="px-2.5 py-1.5 text-xs font-bold bg-red-600 text-white rounded-lg flex items-center gap-1 shadow-xs active:scale-95 transition-all"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            Udhaar
          </button>
          <button
            onClick={() => handleOpenTx('PAYMENT')}
            className="px-2.5 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-lg flex items-center gap-1 shadow-xs active:scale-95 transition-all"
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            Jama
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 text-stone-600 hover:text-stone-900 rounded-lg hover:bg-stone-100 ml-1"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Desktop Sidebar / Mobile Drawer */}
      <aside
        className={`fixed md:sticky top-0 left-0 h-screen w-64 bg-white border-r border-stone-200 flex flex-col justify-between z-40 transition-transform duration-200 ease-in-out shrink-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Brand header */}
          <div className="p-5 border-b border-stone-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-sm ring-2 ring-emerald-100">
                <Store className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h2 className="font-extrabold text-stone-900 tracking-tight text-lg">UdhaarOS</h2>
                  <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                    PRO
                  </span>
                </div>
                <p className="text-xs text-stone-500 font-medium truncate">
                  {business.name}
                </p>
              </div>
            </div>

            <button
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden p-1 text-stone-400 hover:text-stone-700 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.path === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.path);

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all relative ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-900 shadow-2xs font-bold border-l-4 border-emerald-600 pl-3'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive
                          ? 'text-emerald-700'
                          : item.highlight
                          ? 'text-amber-600'
                          : 'text-stone-400'
                      }`}
                    />
                    <span className="truncate">{item.name}</span>
                  </div>

                  {item.highlight && (
                    <span className="text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-0.5">
                      AI ⚡
                    </span>
                  )}

                  {item.badge && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${item.badgeColor || 'bg-stone-100 text-stone-700'}`}>
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* AI Engine Status Card */}
          <div className="p-4 border-t border-stone-100 bg-stone-50/70">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-stone-600 font-bold flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5 text-stone-500" />
                AI Intelligence
              </span>
              {aiStatus?.available ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Ollama
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                  Heuristic
                </span>
              )}
            </div>
            <p className="text-[11px] text-stone-500 leading-snug">
              {aiStatus?.available
                ? `Local: ${aiStatus.model}`
                : '100% private deterministic NLP engine active.'}
            </p>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile menu */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs z-30 md:hidden"
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Desktop Top Bar */}
        <header className="hidden md:flex items-center justify-between px-8 py-4 bg-white border-b border-stone-200 sticky top-0 z-20 shadow-2xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-400">Merchant Store</span>
              <span className="text-xs text-stone-300">•</span>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> 100% On-Device Privacy
              </span>
            </div>
            <h1 className="text-base font-extrabold text-stone-900 mt-0.5">{business.name}</h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleOpenTx('CREDIT')}
              className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all"
            >
              <ArrowUpRight className="w-4 h-4" />
              + Udhaar Dena
            </button>
            <button
              onClick={() => handleOpenTx('PAYMENT')}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all"
            >
              <ArrowDownLeft className="w-4 h-4" />
              + Jama Lena
            </button>
          </div>
        </header>

        {/* Page Container */}
        <main className="flex-1 p-5 md:p-8 max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>

      {/* Quick Transaction Modal */}
      {isTxModalOpen && (
        <TransactionModal
          isOpen={isTxModalOpen}
          initialType={defaultTxType}
          onClose={() => setIsTxModalOpen(false)}
        />
      )}
    </div>
  );
}
