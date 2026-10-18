import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquare,
  Sparkles,
  Send,
  Copy,
  Clock,
  CheckCircle2,
  Phone,
  AlertTriangle,
  History,
  Store,
  ExternalLink,
} from 'lucide-react';
import {
  getCustomers,
  generateReminder,
  saveReminder,
  getReminderHistory,
  getBusinessProfile,
  formatPaise,
  formatDate,
} from '../lib/api';
import toast from 'react-hot-toast';

export default function Reminders() {
  const [searchParams] = useSearchParams();
  const queryParamCustomerId = searchParams.get('customerId');

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    queryParamCustomerId || ''
  );
  const [reminderType, setReminderType] = useState<'WHATSAPP' | 'FORMAL'>('WHATSAPP');
  const [language, setLanguage] = useState<'en' | 'hi' | 'od'>('hi');
  const [generatedMessage, setGeneratedMessage] = useState<string>('');

  const { data: businessRes } = useQuery({
    queryKey: ['businessProfile'],
    queryFn: getBusinessProfile,
  });
  const business = businessRes?.data;

  const { data: customersRes, isLoading: customersLoading } = useQuery({
    queryKey: ['customers', { limit: '100' }],
    queryFn: () => getCustomers({ limit: '100' }),
  });

  const customers = customersRes?.data?.items || [];
  // Filter for customers with balance > 0
  const debtors = customers.filter(
    (c: any) => (c.balancePaise || c.outstandingBalancePaise || 0) > 0
  );

  useEffect(() => {
    if (queryParamCustomerId) {
      setSelectedCustomerId(queryParamCustomerId);
    } else if (debtors.length > 0 && !selectedCustomerId) {
      setSelectedCustomerId(debtors[0].id);
    }
  }, [queryParamCustomerId, debtors]);

  const selectedCustomer = customers.find((c: any) => c.id === selectedCustomerId);

  // History query
  const { data: historyRes, refetch: refetchHistory } = useQuery({
    queryKey: ['reminderHistory', selectedCustomerId],
    queryFn: () => getReminderHistory(selectedCustomerId),
    enabled: !!selectedCustomerId,
  });
  const history = historyRes?.data || [];

  // Generate reminder mutation
  const generateMutation = useMutation({
    mutationFn: () =>
      generateReminder({
        customerId: selectedCustomerId,
        type: reminderType,
        language,
      }),
    onSuccess: (res: any) => {
      setGeneratedMessage(res?.data?.message || '');
      toast.success('AI reminder generated successfully!');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to generate reminder');
    },
  });

  // Save history mutation
  const saveMutation = useMutation({
    mutationFn: (messageText: string) =>
      saveReminder({
        customerId: selectedCustomerId,
        type: reminderType,
        language,
        messageText,
        amountPaise: selectedCustomer?.balancePaise || 0,
      }),
    onSuccess: () => {
      refetchHistory();
    },
  });

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      toast.error('Please select a customer');
      return;
    }
    generateMutation.mutate();
  };

  const handleCopy = () => {
    if (!generatedMessage) return;
    navigator.clipboard.writeText(generatedMessage);
    toast.success('Message copied to clipboard!');
    saveMutation.mutate(generatedMessage);
  };

  const handleSendWhatsApp = () => {
    if (!generatedMessage) return;
    if (!selectedCustomer?.phone) {
      toast.error('Customer has no phone number recorded');
      return;
    }

    saveMutation.mutate(generatedMessage);

    // Clean phone number (remove dashes, spaces, +)
    let cleanPhone = selectedCustomer.phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone; // Add India country code if 10-digit
    }

    const encoded = encodeURIComponent(generatedMessage);
    const url = `https://wa.me/${cleanPhone}?text=${encoded}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-2 border-b border-stone-200/80">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-xs">
            <MessageSquare className="w-4 h-4" />
          </div>
          <h2 className="text-2xl font-black text-stone-900 tracking-tight">
            AI Payment Intelligence & Reminders
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-stone-500 font-medium mt-1">
          Generate polite, culturally tailored payment reminders with one-click WhatsApp dispatch & UPI links
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Generator Controls (1 Col) */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs space-y-5">
          <div>
            <h3 className="font-bold text-stone-900 text-base">Select Debtor Customer</h3>
            <p className="text-xs text-stone-500">Pick a customer with outstanding balance</p>
          </div>

          <form onSubmit={handleGenerate} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Customer <span className="text-red-500">*</span>
              </label>
              {customersLoading ? (
                <div className="text-xs text-stone-400">Loading customers...</div>
              ) : debtors.length === 0 ? (
                <div className="p-3 bg-stone-50 text-stone-500 text-xs rounded-lg">
                  No customers currently have unpaid dues.
                </div>
              ) : (
                <select
                  value={selectedCustomerId}
                  onChange={(e) => {
                    setSelectedCustomerId(e.target.value);
                    setGeneratedMessage('');
                  }}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  required
                >
                  <option value="">-- Choose Customer --</option>
                  {debtors.map((c: any) => {
                    const bal = c.balancePaise || c.outstandingBalancePaise || 0;
                    return (
                      <option key={c.id} value={c.id}>
                        {c.name} — Owed: ₹{(bal / 100).toFixed(0)}{' '}
                        {c.isOverdue ? '(Overdue)' : ''}
                      </option>
                    );
                  })}
                </select>
              )}
            </div>

            {selectedCustomer && (
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-100 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-stone-500">Outstanding:</span>
                  <span className="font-black text-red-600">
                    {formatPaise(selectedCustomer.balancePaise || selectedCustomer.outstandingBalancePaise || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Phone:</span>
                  <span className="font-mono text-stone-700 font-bold">
                    {selectedCustomer.phone || 'No phone recorded'}
                  </span>
                </div>
                {selectedCustomer.isOverdue && (
                  <div className="flex items-center gap-1 text-amber-700 font-semibold pt-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Overdue payment detected
                  </div>
                )}
              </div>
            )}

            {/* Reminder Tone */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Tone & Format
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setReminderType('WHATSAPP')}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border text-center transition-colors ${
                    reminderType === 'WHATSAPP'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold'
                      : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  💬 Friendly WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => setReminderType('FORMAL')}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border text-center transition-colors ${
                    reminderType === 'FORMAL'
                      ? 'bg-stone-900 border-stone-900 text-white font-bold'
                      : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  📄 Formal Notice
                </button>
              </div>
            </div>

            {/* Language */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Language
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { code: 'hi', label: 'Hinglish / Hindi' },
                  { code: 'en', label: 'English' },
                  { code: 'od', label: 'Odia / Regional' },
                ].map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => setLanguage(lang.code as any)}
                    className={`py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                      language === lang.code
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={generateMutation.isPending || !selectedCustomerId}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
            >
              {generateMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Composing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  Generate AI Reminder
                </>
              )}
            </button>
          </form>
        </div>

        {/* Message Preview and Dispatch (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-4">
                <div>
                  <h3 className="font-bold text-stone-900 text-base">Generated Message Preview</h3>
                  <p className="text-xs text-stone-500">
                    Ready to copy or send directly to customer's WhatsApp
                  </p>
                </div>
                <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                  {reminderType === 'WHATSAPP' ? 'WhatsApp Format' : 'Formal SMS/Email'}
                </span>
              </div>

              {generatedMessage ? (
                <div className="bg-[#f0fdf4] border border-emerald-200/80 rounded-2xl p-5 relative shadow-inner">
                  {/* WhatsApp chat bubble simulation */}
                  <div className="bg-white rounded-2xl p-4 shadow-xs border border-emerald-100 max-w-lg space-y-3">
                    <p className="text-sm text-stone-800 whitespace-pre-wrap leading-relaxed font-sans">
                      {generatedMessage}
                    </p>
                    <div className="flex items-center justify-between pt-2 border-t border-stone-100 text-[10px] text-stone-400">
                      <span>Store: {business?.name || 'UdhaarOS'}</span>
                      <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                        ✓✓ Delivered
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-16 text-center border-2 border-dashed border-stone-200 rounded-2xl bg-stone-50/50 space-y-2">
                  <div className="w-10 h-10 rounded-full bg-stone-100 text-stone-400 flex items-center justify-center mx-auto">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-stone-700 text-sm">No message generated yet</h4>
                  <p className="text-xs text-stone-400 max-w-sm mx-auto">
                    Select a customer from the left panel and click "Generate AI Reminder" to craft a contextual payment notice.
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            {generatedMessage && (
              <div className="pt-5 mt-5 border-t border-stone-100 flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Copy className="w-4 h-4" /> Copy Message
                </button>
                <button
                  type="button"
                  onClick={handleSendWhatsApp}
                  disabled={!selectedCustomer?.phone}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 disabled:opacity-50 text-white text-xs sm:text-sm font-bold rounded-lg shadow-xs transition-all flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Open WhatsApp Web / App
                </button>
              </div>
            )}
          </div>

          {/* Past Reminder History */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-stone-500" />
                <h3 className="font-bold text-stone-900 text-sm">
                  Reminder History for {selectedCustomer?.name || 'Selected Customer'}
                </h3>
              </div>
              <span className="text-xs text-stone-400 font-semibold">
                {history.length} logged
              </span>
            </div>

            <div className="space-y-3">
              {history.length === 0 ? (
                <p className="text-xs text-stone-400 text-center py-4">
                  No reminders previously dispatched to this customer.
                </p>
              ) : (
                history.map((h: any) => (
                  <div
                    key={h.id}
                    className="p-3 bg-stone-50 border border-stone-200/80 rounded-xl text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between text-[11px] text-stone-500">
                      <span className="font-bold text-stone-700">
                        {h.type} ({h.language})
                      </span>
                      <span>{formatDate(h.createdAt)}</span>
                    </div>
                    <p className="text-stone-700 line-clamp-2">{h.messageText}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
