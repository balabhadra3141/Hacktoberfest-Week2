import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  Filter,
  FileSpreadsheet,
  RotateCcw,
  Clock,
  X,
  PlusCircle,
} from 'lucide-react';
import {
  getTransactions,
  reverseTransaction,
  exportTransactionsCsv,
  formatPaise,
  formatDate,
  downloadBlob,
} from '../lib/api';
import TransactionModal from '../components/TransactionModal';
import toast from 'react-hot-toast';

export default function Transactions() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txModalType, setTxModalType] = useState<'CREDIT' | 'PAYMENT'>('CREDIT');

  // Reversal state
  const [reversalTarget, setReversalTarget] = useState<any | null>(null);
  const [reversalReason, setReversalReason] = useState('');

  const { data: txRes, isLoading, error } = useQuery({
    queryKey: ['transactions', { query: searchTerm, limit: '100' }],
    queryFn: () => getTransactions({ query: searchTerm, limit: '100' }),
  });

  const transactions = txRes?.data?.items || [];

  const reverseMutation = useMutation({
    mutationFn: ({ txId, reason }: { txId: string; reason: string }) =>
      reverseTransaction(txId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Transaction reversed cleanly!');
      setReversalTarget(null);
      setReversalReason('');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to reverse transaction');
    },
  });

  const handleExportCsv = async () => {
    try {
      toast.loading('Exporting CSV...', { id: 'export-csv' });
      const blob = await exportTransactionsCsv();
      downloadBlob(blob, `UdhaarOS_Ledger_Export_${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success('Transactions CSV downloaded!', { id: 'export-csv' });
    } catch (err: any) {
      toast.error('Failed to export CSV: ' + err.message, { id: 'export-csv' });
    }
  };

  const handleReverseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversalReason.trim()) {
      toast.error('Please enter a reversal reason');
      return;
    }
    reverseMutation.mutate({ txId: reversalTarget.id, reason: reversalReason.trim() });
  };

  // Filter transactions by selected type
  const filtered = transactions.filter((tx: any) => {
    if (selectedType === 'ALL') return true;
    return tx.type === selectedType;
  });

  const totalCreditsPaise = filtered
    .filter((tx: any) => tx.type === 'CREDIT' && tx.status === 'POSTED')
    .reduce((acc: number, tx: any) => acc + tx.amountPaise, 0);

  const totalPaymentsPaise = filtered
    .filter((tx: any) => tx.type === 'PAYMENT' && tx.status === 'POSTED')
    .reduce((acc: number, tx: any) => acc + tx.amountPaise, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-stone-200/80">
        <div>
          <h2 className="text-2xl font-black text-stone-900 tracking-tight">Ledger Journal</h2>
          <p className="text-xs sm:text-sm text-stone-500 font-medium">
            Chronological audit log of all store credit, cash/UPI collections & corrections
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 text-xs sm:text-sm font-semibold rounded-lg shadow-2xs transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Export CSV
          </button>
          <button
            onClick={() => {
              setTxModalType('CREDIT');
              setIsTxModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs sm:text-sm font-bold rounded-lg shadow-xs transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            + New Ledger Entry
          </button>
        </div>
      </div>

      {/* Summary Chips */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-red-50/60 border border-red-200/80 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-red-700 uppercase tracking-wider">
              Total Udhaar Given (Filtered)
            </span>
            <div className="text-xl font-black text-red-700 mt-0.5">
              +{formatPaise(totalCreditsPaise)}
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-red-100 text-red-700 flex items-center justify-center">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
              Total Jama Collected (Filtered)
            </span>
            <div className="text-xl font-black text-emerald-700 mt-0.5">
              -{formatPaise(totalPaymentsPaise)}
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-stone-200 shadow-xs">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search by customer name, items or ref number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
          />
        </div>

        {/* Type Filter */}
        <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl overflow-x-auto">
          {['ALL', 'CREDIT', 'PAYMENT', 'ADJUSTMENT', 'REVERSAL'].map((t) => (
            <button
              key={t}
              onClick={() => setSelectedType(t)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
                selectedType === t
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {t === 'ALL'
                ? 'All'
                : t === 'CREDIT'
                ? 'Udhaar'
                : t === 'PAYMENT'
                ? 'Jama'
                : t === 'ADJUSTMENT'
                ? 'Adjustment'
                : 'Reversals'}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 text-stone-500 font-bold uppercase tracking-wider border-b border-stone-100">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Details / Items</th>
                <th className="py-3 px-4">Ref #</th>
                <th className="py-3 px-4 text-right">Amount (₹)</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Source</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-700">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-stone-400">
                    <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading transactions...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-stone-400">
                    No transactions match current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((tx: any) => {
                  const isCredit = tx.type === 'CREDIT';
                  const isPayment = tx.type === 'PAYMENT';
                  const isAdjustment = tx.type === 'ADJUSTMENT';
                  const isReversal = tx.type === 'REVERSAL';
                  const isReversed = tx.status === 'REVERSED';

                  return (
                    <tr
                      key={tx.id}
                      className={`hover:bg-stone-50/70 transition-colors ${
                        isReversed ? 'opacity-50 line-through bg-stone-50/30' : ''
                      }`}
                    >
                      <td className="py-3 px-4 whitespace-nowrap text-stone-500">
                        {formatDate(tx.date)}
                        {tx.dueDate && (
                          <div className="text-[10px] text-amber-600 flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" /> Due: {formatDate(tx.dueDate)}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-bold text-stone-900">
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
                              : isReversal
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {isCredit
                            ? 'Udhaar'
                            : isPayment
                            ? 'Jama'
                            : isReversal
                            ? 'Reversal'
                            : 'Adjustment'}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate">
                        <span className="font-medium text-stone-800">{tx.description}</span>
                        {tx.adjustmentReason && (
                          <span className="block text-[10px] text-amber-700">
                            Reason: {tx.adjustmentReason}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-stone-500 whitespace-nowrap">
                        {tx.referenceNumber || '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-black whitespace-nowrap">
                        <span
                          className={
                            isCredit
                              ? 'text-red-600'
                              : isPayment
                              ? 'text-emerald-600'
                              : isReversal
                              ? 'text-purple-600'
                              : 'text-amber-600'
                          }
                        >
                          {isCredit ? '+' : isPayment || isReversal ? '-' : ''}
                          {formatPaise(tx.amountPaise)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {isReversed ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-200 text-stone-600">
                            REVERSED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                            POSTED
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className="text-[10px] font-medium text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded">
                          {tx.source}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {!isReversed && !isReversal ? (
                          <button
                            onClick={() => {
                              setReversalTarget(tx);
                              setReversalReason('');
                            }}
                            className="p-1 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Reverse transaction entry"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="text-stone-300">—</span>
                        )}
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
      {isTxModalOpen && (
        <TransactionModal
          isOpen={isTxModalOpen}
          initialType={txModalType}
          onClose={() => setIsTxModalOpen(false)}
        />
      )}

      {/* Reversal Modal */}
      {reversalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-red-600 font-bold">
                <RotateCcw className="w-5 h-5" />
                <h3>Reverse Transaction</h3>
              </div>
              <button
                onClick={() => setReversalTarget(null)}
                className="text-stone-400 hover:text-stone-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed mb-4">
              Reversing will create a balancing audit reversal entry of{' '}
              <strong className="text-stone-900">
                {formatPaise(reversalTarget.amountPaise)}
              </strong>{' '}
              for <strong>{reversalTarget.customer?.name}</strong>.
            </p>

            <form onSubmit={handleReverseSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Reason for Reversal <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Wrong customer selected / Returned goods"
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                  required
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReversalTarget(null)}
                  className="px-4 py-2 border border-stone-300 rounded-lg text-xs font-semibold text-stone-700 hover:bg-stone-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reverseMutation.isPending}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                >
                  {reverseMutation.isPending ? 'Reversing...' : 'Confirm Reversal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
