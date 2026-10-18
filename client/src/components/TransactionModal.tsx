import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, ArrowUpRight, ArrowDownLeft, AlertCircle, Calendar, Hash, FileText, Check } from 'lucide-react';
import { getCustomers, createTransaction } from '../lib/api';
import toast from 'react-hot-toast';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: 'CREDIT' | 'PAYMENT' | 'ADJUSTMENT';
  defaultCustomerId?: string;
  defaultCustomerName?: string;
}

export default function TransactionModal({
  isOpen,
  onClose,
  initialType = 'CREDIT',
  defaultCustomerId,
  defaultCustomerName,
}: TransactionModalProps) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<'CREDIT' | 'PAYMENT' | 'ADJUSTMENT'>(initialType);
  const [customerId, setCustomerId] = useState<string>(defaultCustomerId || '');
  const [amountRupees, setAmountRupees] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState<string>('');
  const [adjustmentReason, setAdjustmentReason] = useState<string>('');

  useEffect(() => {
    setType(initialType);
  }, [initialType]);

  useEffect(() => {
    if (defaultCustomerId) {
      setCustomerId(defaultCustomerId);
    }
  }, [defaultCustomerId]);

  const { data: customersRes } = useQuery({
    queryKey: ['customers', { limit: '100' }],
    queryFn: () => getCustomers({ limit: '100' }),
  });

  const customers = customersRes?.data?.items || [];

  const createTxMutation = useMutation({
    mutationFn: (txData: any) => createTransaction(txData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      if (customerId) {
        queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
        queryClient.invalidateQueries({ queryKey: ['customerTransactions', customerId] });
      }
      toast.success(
        type === 'CREDIT'
          ? 'Udhaar (Credit) recorded successfully!'
          : type === 'PAYMENT'
          ? 'Jama (Payment) recorded successfully!'
          : 'Adjustment saved successfully!'
      );
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to record entry');
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerId) {
      toast.error('Please select a customer');
      return;
    }

    const numRupees = parseFloat(amountRupees);
    if (isNaN(numRupees) || numRupees <= 0) {
      toast.error('Please enter a valid positive amount');
      return;
    }

    if (!description.trim()) {
      toast.error('Please enter items or a note description');
      return;
    }

    if (type === 'ADJUSTMENT' && !adjustmentReason.trim()) {
      toast.error('Please specify an adjustment reason');
      return;
    }

    const amountPaise = Math.round(numRupees * 100);

    createTxMutation.mutate({
      customerId,
      type,
      amountPaise,
      date,
      description: description.trim(),
      referenceNumber: referenceNumber.trim() || undefined,
      dueDate: dueDate || undefined,
      adjustmentReason: type === 'ADJUSTMENT' ? adjustmentReason.trim() : undefined,
      source: 'MANUAL',
    });
  };

  const selectedCustomer = customers.find((c: any) => c.id === customerId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/70">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-white ${
                type === 'CREDIT'
                  ? 'bg-red-600'
                  : type === 'PAYMENT'
                  ? 'bg-emerald-600'
                  : 'bg-amber-600'
              }`}
            >
              {type === 'CREDIT' ? (
                <ArrowUpRight className="w-5 h-5" />
              ) : type === 'PAYMENT' ? (
                <ArrowDownLeft className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-base">
                {type === 'CREDIT'
                  ? 'Record Udhaar (Given on Credit)'
                  : type === 'PAYMENT'
                  ? 'Record Jama (Payment Received)'
                  : 'Record Ledger Adjustment'}
              </h3>
              <p className="text-xs text-stone-500">Fast entry directly into customer ledger</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-200/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Type selector tabs */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-stone-100 rounded-xl">
            <button
              type="button"
              onClick={() => setType('CREDIT')}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                type === 'CREDIT'
                  ? 'bg-white text-red-700 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Udhaar (Credit)
            </button>
            <button
              type="button"
              onClick={() => setType('PAYMENT')}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                type === 'PAYMENT'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Jama (Payment)
            </button>
            <button
              type="button"
              onClick={() => setType('ADJUSTMENT')}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                type === 'ADJUSTMENT'
                  ? 'bg-white text-amber-700 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Adjustment
            </button>
          </div>

          {/* Customer Selection */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Select Customer <span className="text-red-500">*</span>
            </label>
            {defaultCustomerId && defaultCustomerName ? (
              <div className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm font-semibold text-stone-800">
                {defaultCustomerName}
              </div>
            ) : (
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full px-3 py-2.5 bg-stone-50 border border-stone-300 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                required
              >
                <option value="">-- Choose a Customer --</option>
                {customers.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ''} - Bal: ₹{(c.balancePaise / 100).toFixed(0)}
                  </option>
                ))}
              </select>
            )}

            {selectedCustomer && (
              <p className="mt-1 text-xs text-stone-500">
                Current Outstanding:{' '}
                <span className="font-semibold text-stone-800">
                  ₹{(selectedCustomer.balancePaise / 100).toFixed(2)}
                </span>
                {selectedCustomer.creditLimitPaise && (
                  <span className="ml-2">
                    | Limit: ₹{(selectedCustomer.creditLimitPaise / 100).toFixed(0)}
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Amount (₹) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-stone-400">
                ₹
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={amountRupees}
                onChange={(e) => setAmountRupees(e.target.value)}
                className="w-full pl-8 pr-4 py-2.5 bg-stone-50 border border-stone-300 rounded-lg text-lg font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                required
                autoFocus
              />
            </div>
          </div>

          {/* Date & Due Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Transaction Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  required
                />
              </div>
            </div>

            {type === 'CREDIT' && (
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Payment Due Date (Optional)
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>
            )}
          </div>

          {/* Description / Items */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Description / Items / Notes <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={2}
              placeholder={
                type === 'CREDIT'
                  ? 'e.g. 5kg Basmati Rice, 2L Mustard Oil, Tea'
                  : type === 'PAYMENT'
                  ? 'e.g. Cash payment received / Google Pay UPI transfer'
                  : 'Correction notes'
              }
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              required
            />
          </div>

          {/* Reference / Invoice / UPI txn ID */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Ref Number / UPI UTR / Bill No. (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. UPI-92837482 or Bill #104"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
            />
          </div>

          {type === 'ADJUSTMENT' && (
            <div>
              <label className="block text-xs font-bold text-amber-800 mb-1">
                Adjustment Reason <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Customer disputed calculation / Round-off waiver"
                value={adjustmentReason}
                onChange={(e) => setAdjustmentReason(e.target.value)}
                className="w-full px-3 py-2 bg-amber-50 border border-amber-300 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                required
              />
            </div>
          )}

          {/* Submit buttons */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-stone-300 rounded-lg text-sm font-semibold text-stone-700 hover:bg-stone-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createTxMutation.isPending}
              className={`px-5 py-2 rounded-lg text-sm font-bold text-white shadow-xs transition-all flex items-center gap-1.5 ${
                type === 'CREDIT'
                  ? 'bg-red-600 hover:bg-red-700 active:scale-98'
                  : type === 'PAYMENT'
                  ? 'bg-emerald-600 hover:bg-emerald-700 active:scale-98'
                  : 'bg-amber-600 hover:bg-amber-700 active:scale-98'
              }`}
            >
              {createTxMutation.isPending ? (
                'Saving...'
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Save Entry
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
