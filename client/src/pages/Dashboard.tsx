import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  AlertOctagon,
  CheckCircle2,
  Users,
  ArrowUpRight,
  ArrowDownLeft,
  Sparkles,
  Phone,
  MessageSquare,
  Clock,
  ChevronRight,
  ShieldAlert,
  Calendar,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { getDashboard, formatPaise, formatDate } from '../lib/api';
import TransactionModal from '../components/TransactionModal';

export default function Dashboard() {
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txModalType, setTxModalType] = useState<'CREDIT' | 'PAYMENT'>('CREDIT');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>();
  const [selectedCustomerName, setSelectedCustomerName] = useState<string | undefined>();

  const { data: dashboardRes, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
  });

  const dashboard = dashboardRes?.data;
  const stats = dashboard?.stats || {
    totalOutstandingPaise: 0,
    totalOverduePaise: 0,
    collectedThisMonthPaise: 0,
    creditExtendedThisMonthPaise: 0,
    customersWithBalance: 0,
    overdueAccounts: 0,
  };

  const recentTransactions = dashboard?.recentTransactions || [];
  const followUpCustomers = dashboard?.followUpCustomers || [];
  const trend = dashboard?.trend || [];
  const insights = dashboard?.insights || [];

  const handleOpenTx = (type: 'CREDIT' | 'PAYMENT', custId?: string, custName?: string) => {
    setTxModalType(type);
    setSelectedCustomerId(custId);
    setSelectedCustomerName(custName);
    setTxModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-stone-500 font-medium">Loading UdhaarOS Ledger Dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700">
        <h3 className="font-bold">Error loading dashboard</h3>
        <p className="text-sm mt-1">{(error as any)?.message || 'Could not connect to server'}</p>
      </div>
    );
  }

  // Format trend data for chart
  const formattedTrend = trend.map((t: any) => ({
    date: new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    amount: Math.round(t.outstandingPaise / 100),
  }));

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome */}
      <div className="pb-2 border-b border-stone-200">
        <h2 className="text-2xl font-black text-stone-900 tracking-tight">
          Ledger & Payment Overview
        </h2>
        <p className="text-xs sm:text-sm text-stone-500 font-medium mt-0.5">
          Real-time credit tracking, repayment velocity & automated risk alerts
        </p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Outstanding */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Udhaar Owed</span>
            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-stone-900 tracking-tight">
            {formatPaise(stats.totalOutstandingPaise)}
          </div>
          <p className="text-xs text-stone-500 mt-2 flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-stone-400" />
            <span className="font-semibold text-stone-700">{stats.customersWithBalance}</span>{' '}
            customers currently owe money
          </p>
        </div>

        {/* Card 2: Total Overdue */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
              Overdue Dues
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertOctagon className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-700 tracking-tight">
            {formatPaise(stats.totalOverduePaise)}
          </div>
          <p className="text-xs text-stone-500 mt-2 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span className="font-semibold text-amber-800">{stats.overdueAccounts}</span> accounts
            past promised due date
          </p>
        </div>

        {/* Card 3: Collected this month */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Jama Received (Month)
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-700 tracking-tight">
            {formatPaise(stats.collectedThisMonthPaise)}
          </div>
          <p className="text-xs text-stone-500 mt-2 flex items-center gap-1">
            <span className="text-emerald-700 font-semibold">Active Inflow</span> from payments
          </p>
        </div>

        {/* Card 4: Credit Extended this month */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Credit Given (Month)</span>
            <div className="w-8 h-8 rounded-lg bg-stone-100 text-stone-700 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-stone-800 tracking-tight">
            {formatPaise(stats.creditExtendedThisMonthPaise)}
          </div>
          <p className="text-xs text-stone-500 mt-2">
            Net:{' '}
            <span
              className={`font-bold ${
                stats.collectedThisMonthPaise >= stats.creditExtendedThisMonthPaise
                  ? 'text-emerald-600'
                  : 'text-red-600'
              }`}
            >
              {formatPaise(stats.collectedThisMonthPaise - stats.creditExtendedThisMonthPaise)}
            </span>
          </p>
        </div>
      </div>

      {/* AI Intelligence & Insights Pill Banner */}
      {insights.length > 0 && (
        <div className="bg-gradient-to-r from-emerald-900 to-teal-900 text-white p-5 rounded-2xl shadow-sm border border-emerald-800">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-emerald-300" />
            </div>
            <h3 className="font-bold text-sm tracking-wide text-emerald-100 uppercase">
              AI Payment Intelligence & Health Audit
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs leading-relaxed text-emerald-100/90">
            {insights.map((insight: string, idx: number) => (
              <div
                key={idx}
                className="flex items-start gap-2 bg-white/5 p-2.5 rounded-xl border border-white/10"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                <span>{insight}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Grid: Outstanding Trend & Follow-Up Priority */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Chart (2 Cols) */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-stone-900 text-base">Outstanding Credit Trend</h3>
              <p className="text-xs text-stone-500">Total ledger debt over the last 30 days</p>
            </div>
            <span className="text-xs font-semibold px-2 py-1 bg-stone-100 text-stone-700 rounded-lg">
              Daily Snapshot
            </span>
          </div>

          <div className="h-64 w-full">
            {formattedTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={formattedTrend}>
                  <defs>
                    <linearGradient id="debtGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#dc2626" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#dc2626" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
                  <XAxis dataKey="date" stroke="#a8a29e" fontSize={11} tickLine={false} />
                  <YAxis stroke="#a8a29e" fontSize={11} tickLine={false} tickFormatter={(v) => `₹${v}`} />
                  <Tooltip
                    formatter={(val: any) => [`₹${val.toLocaleString()}`, 'Outstanding']}
                    contentStyle={{
                      backgroundColor: '#1c1917',
                      borderRadius: '8px',
                      color: '#fafaf9',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="#dc2626"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#debtGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-stone-400">
                No trend data recorded yet
              </div>
            )}
          </div>
        </div>

        {/* Priority Follow-Up List (1 Col) */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <h3 className="font-bold text-stone-900 text-base">Overdue Recovery</h3>
              </div>
              <Link
                to="/reminders"
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-0.5"
              >
                Send Reminders <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <p className="text-xs text-stone-500 mb-4">
              Debtors requiring immediate payment follow-up
            </p>

            <div className="space-y-3">
              {followUpCustomers.length === 0 ? (
                <div className="text-center py-8 text-stone-400 text-xs">
                  🎉 No overdue debts! All customers are current.
                </div>
              ) : (
                followUpCustomers.slice(0, 5).map((cust: any) => (
                  <div
                    key={cust.id}
                    className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 hover:bg-stone-100/70 transition-colors flex items-center justify-between"
                  >
                    <div className="min-w-0 pr-2">
                      <Link
                        to={`/customers/${cust.id}`}
                        className="font-bold text-sm text-stone-900 hover:text-emerald-700 block truncate"
                      >
                        {cust.name}
                      </Link>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-black text-red-600">
                          {formatPaise(cust.overdueAmountPaise || cust.balancePaise || 0)}
                        </span>
                        {cust.phone && (
                          <span className="text-[10px] text-stone-500 flex items-center gap-0.5">
                            <Phone className="w-2.5 h-2.5" /> {cust.phone}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Link
                        to={`/reminders?customerId=${cust.id}`}
                        className="p-2 rounded-lg bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition-colors"
                        title="Send WhatsApp Reminder"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-stone-100 mt-4">
            <Link
              to="/customers"
              className="text-xs text-center block font-semibold text-stone-600 hover:text-stone-900"
            >
              View all {stats.customersWithBalance} debtor accounts →
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Ledger Activity Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-stone-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-stone-900 text-base">Recent Ledger Entries</h3>
            <p className="text-xs text-stone-500">Live journal of credits and payments</p>
          </div>
          <Link
            to="/transactions"
            className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-0.5"
          >
            Full Ledger Book <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 text-stone-500 font-bold uppercase tracking-wider border-b border-stone-100">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Description / Items</th>
                <th className="py-3 px-4 text-right">Amount (₹)</th>
                <th className="py-3 px-4 text-center">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-700">
              {recentTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-stone-400">
                    No transactions yet. Click "+ Udhaar Dena" to make your first entry.
                  </td>
                </tr>
              ) : (
                recentTransactions.map((tx: any) => {
                  const isCredit = tx.type === 'CREDIT';
                  const isPayment = tx.type === 'PAYMENT';
                  const isAdjustment = tx.type === 'ADJUSTMENT';

                  return (
                    <tr key={tx.id} className="hover:bg-stone-50/70 transition-colors">
                      <td className="py-3 px-4 text-stone-500 whitespace-nowrap">
                        {formatDate(tx.date)}
                      </td>
                      <td className="py-3 px-4 font-bold text-stone-900 whitespace-nowrap">
                        {tx.customer ? (
                          <Link
                            to={`/customers/${tx.customer.id}`}
                            className="hover:text-emerald-700 hover:underline"
                          >
                            {tx.customer.name}
                          </Link>
                        ) : (
                          'Unknown'
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            isCredit
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : isPayment
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {isCredit ? (
                            <>
                              <ArrowUpRight className="w-3 h-3" /> Udhaar
                            </>
                          ) : isPayment ? (
                            <>
                              <ArrowDownLeft className="w-3 h-3" /> Jama
                            </>
                          ) : (
                            'Adjustment'
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-stone-600">
                        {tx.description}
                      </td>
                      <td className="py-3 px-4 text-right font-black whitespace-nowrap">
                        <span className={isCredit ? 'text-red-600' : 'text-emerald-600'}>
                          {isCredit ? '+' : isPayment ? '-' : ''}
                          {formatPaise(tx.amountPaise)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className="text-[10px] font-medium text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded">
                          {tx.source}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Modal */}
      {txModalOpen && (
        <TransactionModal
          isOpen={txModalOpen}
          initialType={txModalType}
          defaultCustomerId={selectedCustomerId}
          defaultCustomerName={selectedCustomerName}
          onClose={() => setTxModalOpen(false)}
        />
      )}
    </div>
  );
}
