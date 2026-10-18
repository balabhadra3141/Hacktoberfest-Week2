import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileText,
  ArrowUpRight,
  ArrowDownLeft,
  Trash2,
  Edit2,
  Check,
  Send,
  HelpCircle,
  Zap,
} from 'lucide-react';
import {
  importText,
  importImage,
  confirmImport,
  getCustomers,
  formatPaise,
} from '../lib/api';
import toast from 'react-hot-toast';

export default function AIImport() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [inputText, setInputText] = useState('');
  const [candidates, setCandidates] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [warnings, setWarnings] = useState<string[]>([]);
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
  const [engine, setEngine] = useState<'LLM' | 'RULES' | null>(null);
  const [modelUsed, setModelUsed] = useState<string | null>(null);

  // Fetch customers for the matching dropdown
  const { data: customersRes } = useQuery({
    queryKey: ['customers', { limit: '100' }],
    queryFn: () => getCustomers({ limit: '100' }),
  });
  const existingCustomers = customersRes?.data?.items || [];

  const parseMutation = useMutation({
    mutationFn: (text: string) => importText(text),
    onSuccess: (res: any) => {
      const parsedCandidates = res?.data?.candidates || [];
      const parsedWarnings = res?.data?.warnings || [];
      setCandidates(parsedCandidates);
      setWarnings(parsedWarnings);
      setCurrentBatchId(res?.data?.batchId || res?.data?.batch?.id || null);
      setEngine(res?.data?.engine || null);
      setModelUsed(res?.data?.modelUsed || null);

      // Select all by default
      const ids = new Set<string>(parsedCandidates.map((c: any) => c.id));
      setSelectedIds(ids);

      if (parsedCandidates.length === 0) {
        toast.error('No entries could be parsed. Add a name and an amount, e.g. "Ramesh 450 udhaar".');
        return;
      }

      toast.success(
        `Parsed ${parsedCandidates.length} ledger transaction${
          parsedCandidates.length === 1 ? '' : 's'
        } ${res?.data?.engine === 'RULES' ? 'with the offline rule engine' : 'with local AI'} — review before posting.`
      );
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to parse text with AI');
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (candidateIds: string[]) => confirmImport(candidateIds),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });

      toast.success(
        `Successfully posted ${res?.data?.importedCount ?? selectedIds.size} transactions to ledger!`,
        { duration: 4000 }
      );
      setCandidates([]);
      setSelectedIds(new Set());
      setInputText('');
      setEngine(null);
      setModelUsed(null);
      navigate('/transactions');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to confirm transactions');
    },
  });

  const handleParse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) {
      toast.error('Please enter or paste ledger notes to parse');
      return;
    }
    parseMutation.mutate(inputText.trim());
  };

  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === candidates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(candidates.map((c) => c.id)));
    }
  };

  const handleUpdateCandidate = (id: string, updates: Partial<any>) => {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  };

  const handleConfirmSelected = () => {
    if (selectedIds.size === 0) {
      toast.error('Please select at least one transaction to confirm');
      return;
    }
    confirmMutation.mutate(Array.from(selectedIds));
  };

  const samplePresets = [
    {
      title: 'Hinglish Grocery Udhaar',
      text: 'Ramesh ji 450 udhaar diya 2 packet aata aur refined tel',
    },
    {
      title: 'UPI Payment / Jama',
      text: 'Sunil paid 1200 via gpay / phonepe jama',
    },
    {
      title: 'Bulk Daily Kirana Register',
      text: `Raju 350 udhaar ration
Sunil paid 500 cash jama
Pooja Gupta 1800 udhaar 10kg basmati rice
Vikram ne 250 diye via phonepe
Anita 400 udhaar refined oil`,
    },
    {
      title: 'Tea & Snacks Khata',
      text: 'Mahesh chai biscuit 85 udhaar kal dega bola',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-2 border-b border-stone-200/80">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <h2 className="text-2xl font-black text-stone-900 tracking-tight">
            AI Smart Khatabook Digitizer
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-stone-500 font-medium mt-1">
          Convert messy WhatsApp messages, voice notes & paper bills into structured ledger entries with 2-phase review
        </p>
      </div>

      {/* Input Section */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs">
        <form onSubmit={handleParse} className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-emerald-600" />
              Paste or Type Messy Khatabook Entries
            </label>
            <span className="text-[11px] text-stone-400">
              Hindi, Hinglish & English supported
            </span>
          </div>

          <textarea
            rows={5}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type or paste entries like:&#10;Ramesh ji 450 udhaar diya 2 packet aata&#10;Sunil paid 1200 via gpay&#10;Pooja 800 udhaar chawal and oil"
            className="w-full p-3.5 bg-stone-50 border border-stone-300 rounded-xl text-sm font-mono text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white resize-y leading-relaxed"
          />

          {/* Quick Presets */}
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 block mb-2">
              Try Sample Prompts:
            </span>
            <div className="flex flex-wrap gap-2">
              {samplePresets.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setInputText(preset.text)}
                  className="px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium transition-colors flex items-center gap-1 border border-stone-200/80"
                >
                  <Zap className="w-3 h-3 text-amber-600" />
                  {preset.title}
                </button>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2 flex items-center justify-between">
            <div className="text-xs text-stone-500 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Entries are parsed for review first — nothing is posted until you confirm.
            </div>

            <button
              type="submit"
              disabled={parseMutation.isPending || !inputText.trim()}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all flex items-center gap-2"
            >
              {parseMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Parsing with AI...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  Parse & Extract Entries
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Extraction engine indicator */}
      {engine && (
        <div
          className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold ${
            engine === 'LLM'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-sky-50 border-sky-200 text-sky-800'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          {engine === 'LLM'
            ? `Extracted with local AI (${modelUsed || 'Ollama'}) — 100% on-device`
            : 'Extracted with the offline rule engine — verify each row against the original note'}
        </div>
      )}

      {/* Warnings / Fallback notification */}
      {warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-xs space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            AI Parsing Notes & Suggestions:
          </div>
          {warnings.map((w, idx) => (
            <p key={idx} className="pl-5">
              • {w}
            </p>
          ))}
        </div>
      )}

      {/* Review & Confirmation Step */}
      {candidates.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden animate-in fade-in duration-200">
          <div className="p-5 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-50/70">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center">
                  2
                </span>
                <h3 className="font-bold text-stone-900 text-base">
                  Review & Confirm Extracted Entries ({selectedIds.size}/{candidates.length} Selected)
                </h3>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                Verify customer matching, amounts, and credit vs payment direction before posting to ledger
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-semibold text-stone-700 hover:bg-stone-100"
              >
                {selectedIds.size === candidates.length ? 'Deselect All' : 'Select All'}
              </button>
              <button
                type="button"
                onClick={handleConfirmSelected}
                disabled={confirmMutation.isPending || selectedIds.size === 0}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
              >
                {confirmMutation.isPending ? (
                  'Posting...'
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Confirm & Post to Ledger ({selectedIds.size})
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Candidates Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 text-stone-500 font-bold uppercase tracking-wider border-b border-stone-100">
                <tr>
                  <th className="py-3 px-4 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === candidates.length && candidates.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </th>
                  <th className="py-3 px-4">Customer Name</th>
                  <th className="py-3 px-4">Direction</th>
                  <th className="py-3 px-4">Amount (₹)</th>
                  <th className="py-3 px-4">Description / Items</th>
                  <th className="py-3 px-4">Confidence</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-700">
                {candidates.map((c: any) => {
                  const isSelected = selectedIds.has(c.id);
                  const isCredit = c.type === 'CREDIT';

                  return (
                    <tr
                      key={c.id}
                      className={`transition-colors ${
                        isSelected ? 'bg-white' : 'bg-stone-50/50 opacity-60'
                      }`}
                    >
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(c.id)}
                          className="rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                        />
                      </td>

                      {/* Customer mapping */}
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <input
                            type="text"
                            value={c.suggestedCustomerName}
                            onChange={(e) =>
                              handleUpdateCandidate(c.id, {
                                suggestedCustomerName: e.target.value,
                              })
                            }
                            className="font-bold text-stone-900 px-2 py-1 bg-stone-50 border border-stone-200 rounded text-xs w-full max-w-[180px] focus:bg-white focus:ring-1 focus:ring-emerald-500"
                          />
                          {c.matchedCustomer && (
                            <span className="block text-[10px] text-emerald-700 font-semibold">
                              ✓ Matched existing Khata ({c.matchedCustomer.name})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Direction: Credit / Payment */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <select
                          value={c.type}
                          onChange={(e) =>
                            handleUpdateCandidate(c.id, {
                              type: e.target.value as 'CREDIT' | 'PAYMENT',
                            })
                          }
                          className={`px-2 py-1 rounded-md text-xs font-bold border ${
                            isCredit
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          <option value="CREDIT">Udhaar (Credit)</option>
                          <option value="PAYMENT">Jama (Payment)</option>
                        </select>
                      </td>

                      {/* Amount in Rupees */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="relative max-w-[110px]">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 font-bold text-stone-400">
                            ₹
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            value={(c.amountPaise / 100).toFixed(2)}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val)) {
                                handleUpdateCandidate(c.id, {
                                  amountPaise: Math.round(val * 100),
                                });
                              }
                            }}
                            className="w-full pl-5 pr-2 py-1 bg-stone-50 border border-stone-200 rounded text-xs font-black text-stone-900 focus:bg-white focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      </td>

                      {/* Description */}
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={c.description}
                          onChange={(e) =>
                            handleUpdateCandidate(c.id, { description: e.target.value })
                          }
                          className="w-full px-2 py-1 bg-stone-50 border border-stone-200 rounded text-xs text-stone-800 focus:bg-white focus:ring-1 focus:ring-emerald-500"
                        />
                      </td>

                      {/* Confidence Pill */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            c.confidence >= 0.8
                              ? 'bg-emerald-100 text-emerald-800'
                              : c.confidence >= 0.5
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {Math.round(c.confidence * 100)}% Match
                        </span>
                      </td>

                      {/* Remove */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setCandidates((prev) => prev.filter((item) => item.id !== c.id));
                            const next = new Set(selectedIds);
                            next.delete(c.id);
                            setSelectedIds(next);
                          }}
                          className="p-1 text-stone-400 hover:text-red-600 rounded transition-colors"
                          title="Discard entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
