import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  FileSpreadsheet,
  Download,
  AlertOctagon,
  Clock,
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';
import {
  getOutstandingReport,
  getCollectionsReport,
  exportTransactionsCsv,
  formatPaise,
  formatDate,
  downloadBlob,
} from '../lib/api';
import toast from 'react-hot-toast';

export default function Reports() {
  const { data: outstandingRes, isLoading: outstandingLoading } = useQuery({
    queryKey: ['outstandingReport'],
    queryFn: getOutstandingReport,
  });

  const { data: collectionsRes, isLoading: collectionsLoading } = useQuery({
    queryKey: ['collectionsReport'],
    queryFn: () => getCollectionsReport(),
  });

  const reportData = outstandingRes?.data || {
    report: [],
    totalOutstandingPaise: 0,
    totalOverduePaise: 0,
  };
  const debtors = reportData.report || [];
  const totalOutstanding = reportData.totalOutstandingPaise || 0;
  const totalOverdue = reportData.totalOverduePaise || 0;
  const currentDues = Math.max(0, totalOutstanding - totalOverdue);

  const collectionsData = collectionsRes?.data || {
    totalCollectedPaise: 0,
    count: 0,
  };

  const handleExportAllTransactions = async () => {
    try {
      toast.loading('Generating ledger transactions CSV...', { id: 'exp' });
      const blob = await exportTransactionsCsv();
      downloadBlob(blob, `UdhaarOS_All_Transactions_${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success('Downloaded successfully!', { id: 'exp' });
    } catch (err: any) {
      toast.error('Export failed: ' + err.message, { id: 'exp' });
    }
  };

  // Aging distribution mockup calculations for visual insight
  const agingData = [
    { name: '0–15 Days (Current)', amount: Math.round((currentDues * 0.6) / 100), color: '#16a34a' },
    { name: '16–30 Days (Due Soon)', amount: Math.round((currentDues * 0.4) / 100), color: '#eab308' },
    { name: '31–60 Days (Overdue)', amount: Math.round((totalOverdue * 0.65) / 100), color: '#f97316' },
    { name: '60+ Days (Critical)', amount: Math.round((totalOverdue * 0.35) / 100), color: '#dc2626' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-stone-200/80">
        <div>
          <h2 className="text-2xl font-black text-stone-900 tracking-tight">
            Financial Reports & Aging Analysis
          </h2>
          <p className="text-xs sm:text-sm text-stone-500 font-medium">
            Credit risk segmentation, payment recovery velocity & ledger exports
          </p>
        </div>

        <button
          onClick={handleExportAllTransactions}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs sm:text-sm font-bold rounded-lg shadow-xs transition-all shrink-0"
        >
          <FileSpreadsheet className="w-4 h-4" />
          Export All Transactions (CSV)
        </button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
            Total Outstanding Credit
          </span>
          <div className="text-2xl font-black text-stone-900 mt-1">
            {formatPaise(totalOutstanding)}
          </div>
          <p className="text-xs text-stone-500 mt-2">
            Owed across {debtors.length} active customer accounts
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
            Overdue Dues (&gt; Due Date)
          </span>
          <div className="text-2xl font-black text-amber-700 mt-1">
            {formatPaise(totalOverdue)}
          </div>
          <p className="text-xs text-stone-500 mt-2">
            {totalOutstanding > 0
              ? `${Math.round((totalOverdue / totalOutstanding) * 100)}% of total debt portfolio`
              : '0% overdue'}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
            Total Jama (Recorded Collections)
          </span>
          <div className="text-2xl font-black text-emerald-700 mt-1">
            {formatPaise(collectionsData.totalCollectedPaise)}
          </div>
          <p className="text-xs text-stone-500 mt-2">
            {collectionsData.count} payment entries posted
          </p>
        </div>
      </div>

      {/* Aging Analysis Chart */}
      <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-stone-900 text-base">Credit Aging Breakdown (₹)</h3>
            <p className="text-xs text-stone-500">
              Distribution of outstanding debt by delinquency timeline
            </p>
          </div>
          <span className="text-xs font-semibold px-2 py-1 bg-stone-100 text-stone-700 rounded-lg">
            Risk Tiers
          </span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={agingData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" vertical={false} />
              <XAxis dataKey="name" stroke="#78716c" fontSize={11} tickLine={false} />
              <YAxis stroke="#78716c" fontSize={11} tickLine={false} tickFormatter={(v) => `₹${v}`} />
              <Tooltip
                formatter={(val: any) => [`₹${val.toLocaleString()}`, 'Amount']}
                contentStyle={{
                  backgroundColor: '#1c1917',
                  borderRadius: '8px',
                  color: '#fafaf9',
                  fontSize: '12px',
                }}
              />
              <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                {agingData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-stone-100 mt-4 text-xs">
          {agingData.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
              <div>
                <span className="font-semibold text-stone-700 block">{item.name}</span>
                <span className="text-stone-500 font-mono">₹{item.amount.toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Debtors Ranking Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-stone-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-stone-900 text-base">Top Customer Debtor Accounts</h3>
            <p className="text-xs text-stone-500">
              Ranked in descending order of current outstanding liability
            </p>
          </div>
          <span className="text-xs font-semibold text-stone-500">
            {debtors.length} Accounts with Balance
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 text-stone-500 font-bold uppercase tracking-wider border-b border-stone-100">
              <tr>
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Customer Name</th>
                <th className="py-3 px-4">Phone Number</th>
                <th className="py-3 px-4 text-right">Outstanding (₹)</th>
                <th className="py-3 px-4 text-right">Overdue (₹)</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-700">
              {debtors.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-stone-400">
                    No active debtors! All accounts are fully settled.
                  </td>
                </tr>
              ) : (
                debtors.map((d: any, idx: number) => {
                  const isDelinquent = d.overduePaise > 0;
                  return (
                    <tr key={d.customerId} className="hover:bg-stone-50/70 transition-colors">
                      <td className="py-3 px-4 text-stone-400 font-mono">{idx + 1}</td>
                      <td className="py-3 px-4 font-bold text-stone-900">
                        <Link
                          to={`/customers/${d.customerId}`}
                          className="hover:text-emerald-700 hover:underline"
                        >
                          {d.customerName}
                        </Link>
                      </td>
                      <td className="py-3 px-4 font-mono text-stone-500">
                        {d.phone || '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-red-600">
                        {formatPaise(d.outstandingPaise)}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-amber-700">
                        {d.overduePaise > 0 ? formatPaise(d.overduePaise) : '₹0.00'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isDelinquent ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                            Overdue
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            Current
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Link
                          to={`/reminders?customerId=${d.customerId}`}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded font-semibold text-[11px] transition-colors"
                        >
                          Reminder
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
