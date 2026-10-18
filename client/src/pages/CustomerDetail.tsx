import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Phone,
  MapPin,
  Calendar,
  ArrowUpRight,
  ArrowDownLeft,
  MessageSquare,
  FileSpreadsheet,
  Edit2,
  Clock,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  X,
  ShieldAlert,
} from 'lucide-react';
import {
  getCustomer,
  getCustomerTransactions,
  reverseTransaction,
  exportCustomerStatement,
  formatPaise,
  formatDate,
  downloadBlob,
} from '../lib/api';
import TransactionModal from '../components/TransactionModal';
import CustomerModal from '../components/CustomerModal';
import toast from 'react-hot-toast';

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txModalType, setTxModalType] = useState<'CREDIT' | 'PAYMENT'>('CREDIT');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Reversal modal state
  const [reversalTarget, setReversalTarget] = useState<any | null>(null);
  const [reversalReason, setReversalReason] = useState('');

  const { data: customerRes, isLoading: customerLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => getCustomer(id!),
    enabled: !!id,
  });

  const { data: transactionsRes, isLoading: txLoading } = useQuery({
    queryKey: ['customerTransactions', id],
    queryFn: () => getCustomerTransactions(id!, { limit: '100' }),
    enabled: !!id,
  });

  const customer = customerRes?.data;
  const transactions = transactionsRes?.data?.items || [];

  const reverseMutation = useMutation({
    mutationFn: ({ txId, reason }: { txId: string; reason: string }) =>
      reverseTransaction(txId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      queryClient.invalidateQueries({ queryKey: ['customerTransactions', id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success('Transaction reversed cleanly with audit entry!');
      setReversalTarget(null);
      setReversalReason('');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to reverse transaction');
    },
  });

  const handleExportStatement = async () => {
    try {
      toast.loading('Generating ledger statement...', { id: 'export-statement' });
      const blob = await exportCustomerStatement(id!);
      downloadBlob(blob, `${customer?.name || 'Customer'}_Statement.csv`);
      toast.success('Statement downloaded successfully!', { id: 'export-statement' });
    } catch (err: any) {
      toast.error('Failed to export statement: ' + err.message, { id: 'export-statement' });
    }
  };

  const handleOpenTx = (type: 'CREDIT' | 'PAYMENT') => {
    setTxModalType(type);
    setIsTxModalOpen(true);
  };

  const handleReverseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversalReason.trim()) {
      toast.error('Please provide a reason for reversing this entry');
      return;
    }
    reverseMutation.mutate({ txId: reversalTarget.id, reason: reversalReason.trim() });
  };

  if (customerLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-stone-500">Loading customer khata ledger...</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-stone-200">
        <h3 className="font-bold text-lg text-stone-900">Customer not found</h3>
        <Link to="/customers" className="text-emerald-700 font-bold text-xs mt-2 inline-block">
          ← Back to customers
        </Link>
      </div>
    );
  }

  const balancePaise = customer.balancePaise || 0;
  const limitPaise = customer.creditLimitPaise || 0;
  const isOverdue = customer.isOverdue || (customer.overdueAmountPaise || 0) > 0;
  const utilization = limitPaise > 0 ? Math.min(100, Math.round((balancePaise / limitPaise) * 100)) : 0;

  return (
    <div className="space-y-6">
      {/* Back button & Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to="/customers"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-600 hover:text-stone-900 bg-white px-3 py-1.5 rounded-lg border border-stone-200 shadow-2xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Customers
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-stone-600 hover:text-stone-900 bg-white px-3 py-1.5 rounded-lg border border-stone-200 shadow-2xs"
          >
            <Edit2 className="w-3.5 h-3.5" /> Edit Profile
          </button>
          <button
            onClick={handleExportStatement}
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:text-emerald-900 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 shadow-2xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" /> Export Statement (CSV)
          </button>
        </div>
      </div>

      {/* Profile Overview Banner */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Customer Bio */}
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-2xl font-black text-stone-900 tracking-tight">
                {customer.name}
              </h2>
              {isOverdue && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Payment Overdue
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-stone-500 mt-2">
              {customer.phone && (
                <a
                  href={`tel:${customer.phone}`}
                  className="flex items-center gap-1 text-stone-700 font-mono font-bold hover:text-emerald-700"
                >
                  <Phone className="w-3.5 h-3.5 text-stone-400" />
                  {customer.phone}
                </a>
              )}
              {customer.address && (
                <span className="flex items-center gap-1 text-stone-600">
                  <MapPin className="w-3.5 h-3.5 text-stone-400" />
                  {customer.address}
                </span>
              )}
              <span className="flex items-center gap-1 text-stone-400">
                <Calendar className="w-3.5 h-3.5 text-stone-400" />
                Customer since {formatDate(customer.createdAt)}
              </span>
            </div>

            {customer.notes && (
              <p className="mt-3 text-xs text-stone-600 bg-stone-50 p-2.5 rounded-lg border border-stone-200/80 max-w-xl">
                <span className="font-bold text-stone-700">Notes:</span> {customer.notes}
              </p>
            )}
          </div>

          {/* Balance & Action Buttons Card */}
          <div className="bg-stone-50 p-4 rounded-xl border border-stone-200/80 lg:min-w-[320px]">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Current Due (Udhaar)
              </span>
              {limitPaise > 0 && (
                <span className="text-xs text-stone-500">
                  Limit: ₹{(limitPaise / 100).toLocaleString()}
                </span>
              )}
            </div>

            <div
              className={`text-3xl font-black ${
                balancePaise > 0 ? 'text-red-600' : 'text-emerald-700'
              }`}
            >
              {formatPaise(balancePaise)}
            </div>

            {limitPaise > 0 && (
              <div className="mt-2 mb-3">
                <div className="w-full bg-stone-200 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      utilization >= 90
                        ? 'bg-red-600'
                        : utilization >= 70
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${utilization}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-stone-500 mt-1">
                  <span>{utilization}% credit limit used</span>
                  <span>₹{((limitPaise - balancePaise) / 100).toFixed(0)} remaining</span>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-stone-200">
              <button
                onClick={() => handleOpenTx('CREDIT')}
                className="py-2 px-3 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1"
              >
                <ArrowUpRight className="w-4 h-4" /> + Udhaar Dena
              </button>
              <button
                onClick={() => handleOpenTx('PAYMENT')}
                className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1"
              >
                <ArrowDownLeft className="w-4 h-4" /> + Jama Lena
              </button>
            </div>

            {balancePaise > 0 && (
              <Link
                to={`/reminders?customerId=${customer.id}`}
                className="mt-2 w-full py-2 px-3 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
              >
                <MessageSquare className="w-4 h-4 text-emerald-700" />
                Generate WhatsApp Reminder
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Customer Ledger History Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-stone-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-stone-900 text-base">Ledger Statement & Transactions</h3>
            <p className="text-xs text-stone-500">
              Complete chronological journal of all debits, payments, and adjustments
            </p>
          </div>
          <span className="text-xs font-bold text-stone-500">
            Total Entries: {transactions.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 text-stone-500 font-bold uppercase tracking-wider border-b border-stone-100">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Details / Description</th>
                <th className="py-3 px-4">Ref / Bill No</th>
                <th className="py-3 px-4 text-right">Debit (Udhaar)</th>
                <th className="py-3 px-4 text-right">Credit (Jama)</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-700">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-stone-400">
                    No transactions recorded for this customer yet.
                  </td>
                </tr>
              ) : (
                transactions.map((tx: any) => {
                  const isCredit = tx.type === 'CREDIT';
                  const isPayment = tx.type === 'PAYMENT';
                  const isAdjustment = tx.type === 'ADJUSTMENT';
                  const isReversal = tx.type === 'REVERSAL';
                  const isReversed = tx.status === 'REVERSED';

                  return (
                    <tr
                      key={tx.id}
                      className={`hover:bg-stone-50/70 transition-colors ${
                        isReversed ? 'opacity-60 bg-stone-50/40 line-through' : ''
                      }`}
                    >
                      <td className="py-3 px-4 whitespace-nowrap text-stone-500">
                        {formatDate(tx.date)}
                        {tx.dueDate && (
                          <div className="text-[10px] text-amber-600 flex items-center gap-0.5 mt-0.5">
                            <Clock className="w-2.5 h-2.5" /> Due: {formatDate(tx.dueDate)}
                          </div>
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
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-semibold text-stone-900">{tx.description}</div>
                        {tx.adjustmentReason && (
                          <div className="text-[11px] text-amber-700 italic">
                            Reason: {tx.adjustmentReason}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-stone-500 font-mono text-[11px] whitespace-nowrap">
                        {tx.referenceNumber || '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-red-600 whitespace-nowrap">
                        {isCredit || (isAdjustment && tx.amountPaise > 0)
                          ? `+${formatPaise(tx.amountPaise)}`
                          : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-emerald-600 whitespace-nowrap">
                        {isPayment || isReversal
                          ? `-${formatPaise(tx.amountPaise)}`
                          : '—'}
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
                        {!isReversed && !isReversal ? (
                          <button
                            onClick={() => {
                              setReversalTarget(tx);
                              setReversalReason('');
                            }}
                            className="p-1 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Reverse / Undo this entry"
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

      {/* Transaction Entry Modal */}
      {isTxModalOpen && (
        <TransactionModal
          isOpen={isTxModalOpen}
          initialType={txModalType}
          defaultCustomerId={customer.id}
          defaultCustomerName={customer.name}
          onClose={() => setIsTxModalOpen(false)}
        />
      )}

      {/* Edit Customer Profile Modal */}
      {isEditModalOpen && (
        <CustomerModal
          isOpen={isEditModalOpen}
          customerToEdit={customer}
          onClose={() => setIsEditModalOpen(false)}
        />
      )}

      {/* Reversal Confirmation Modal */}
      {reversalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-red-600 font-bold">
                <RotateCcw className="w-5 h-5" />
                <h3>Reverse Transaction Entry</h3>
              </div>
              <button
                onClick={() => setReversalTarget(null)}
                className="text-stone-400 hover:text-stone-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed mb-4">
              Reversing will create an opposite accounting entry to neutralize{' '}
              <strong className="text-stone-900">
                {formatPaise(reversalTarget.amountPaise)}
              </strong>{' '}
              ({reversalTarget.description}) while maintaining complete audit history.
            </p>

            <form onSubmit={handleReverseSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Reason for Reversal <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Accidental double entry / Customer returned goods"
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
