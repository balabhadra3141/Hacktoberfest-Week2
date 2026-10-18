import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, UserPlus, Check, UserCheck } from 'lucide-react';
import { createCustomer, updateCustomer } from '../lib/api';
import toast from 'react-hot-toast';

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerToEdit?: any | null;
}

export default function CustomerModal({
  isOpen,
  onClose,
  customerToEdit,
}: CustomerModalProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [creditLimitRupees, setCreditLimitRupees] = useState('');

  useEffect(() => {
    if (customerToEdit) {
      setName(customerToEdit.name || '');
      setPhone(customerToEdit.phone || '');
      setAddress(customerToEdit.address || '');
      setNotes(customerToEdit.notes || '');
      setCreditLimitRupees(
        customerToEdit.creditLimitPaise
          ? (customerToEdit.creditLimitPaise / 100).toString()
          : ''
      );
    } else {
      setName('');
      setPhone('');
      setAddress('');
      setNotes('');
      setCreditLimitRupees('5000');
    }
  }, [customerToEdit, isOpen]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => {
      if (customerToEdit) {
        return updateCustomer(customerToEdit.id, data);
      }
      return createCustomer(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      if (customerToEdit) {
        queryClient.invalidateQueries({ queryKey: ['customer', customerToEdit.id] });
      }
      toast.success(
        customerToEdit
          ? 'Customer updated successfully!'
          : 'New customer account created!'
      );
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to save customer');
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Customer name is required');
      return;
    }

    const limitPaise = creditLimitRupees
      ? Math.round(parseFloat(creditLimitRupees) * 100)
      : null;

    saveMutation.mutate({
      name: name.trim(),
      phone: phone.trim() || null,
      address: address.trim() || null,
      notes: notes.trim() || null,
      creditLimitPaise: limitPaise,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-stone-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
              {customerToEdit ? <UserCheck className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-base">
                {customerToEdit ? 'Edit Customer Khata' : 'Add New Customer (Khata Kholiye)'}
              </h3>
              <p className="text-xs text-stone-500">Track balance, credit limits & phone numbers</p>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Customer Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Ramesh Kumar / Sharma Ji"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Phone / WhatsApp Number
            </label>
            <input
              type="tel"
              placeholder="e.g. 9876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
            />
            <p className="text-[11px] text-stone-500 mt-0.5">Used for sending WhatsApp payment reminders</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Credit Limit (₹)
            </label>
            <input
              type="number"
              placeholder="e.g. 5000"
              value={creditLimitRupees}
              onChange={(e) => setCreditLimitRupees(e.target.value)}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
            />
            <p className="text-[11px] text-stone-500 mt-0.5">Alerts when customer balance exceeds this limit</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Locality / Address
            </label>
            <input
              type="text"
              placeholder="e.g. Ward 4, Near Shiva Mandir"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Notes
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Regular customer, pays on 1st of every month"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
            />
          </div>

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
              disabled={saveMutation.isPending}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-lg text-sm font-bold shadow-xs transition-all flex items-center gap-1.5"
            >
              {saveMutation.isPending ? (
                'Saving...'
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  {customerToEdit ? 'Save Changes' : 'Create Customer'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
