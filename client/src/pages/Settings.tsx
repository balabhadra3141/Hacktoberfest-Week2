import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Settings as SettingsIcon,
  Store,
  Bot,
  Database,
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Shield,
  Save,
  Check,
  Zap,
  Cpu,
  Play,
} from 'lucide-react';
import {
  getBusinessProfile,
  updateBusinessProfile,
  getAIStatus,
  getAIModels,
  setAIModel,
  createBackup,
  restoreBackup,
  loadSeedData,
  downloadBlob,
} from '../lib/api';
import toast from 'react-hot-toast';

export default function Settings() {
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [currencySymbol, setCurrencySymbol] = useState('₹');
  const [defaultDueDays, setDefaultDueDays] = useState('15');
  const [defaultCreditLimitRupees, setDefaultCreditLimitRupees] = useState('5000');

  const { data: businessRes, isLoading: businessLoading } = useQuery({
    queryKey: ['businessProfile'],
    queryFn: getBusinessProfile,
  });

  const { data: aiStatusRes, refetch: refetchAIStatus, isLoading: aiLoading } = useQuery({
    queryKey: ['aiStatus'],
    queryFn: getAIStatus,
  });

  const { data: aiModelsRes, isLoading: modelsLoading } = useQuery({
    queryKey: ['aiModels'],
    queryFn: getAIModels,
  });

  const [customModel, setCustomModel] = useState('');

  useEffect(() => {
    if (businessRes?.data) {
      const b = businessRes.data;
      setName(b.name || '');
      setPhone(b.phone || '');
      setAddress(b.address || '');
      setCurrencySymbol(b.currencySymbol || '₹');
      setDefaultDueDays(b.defaultDueDays?.toString() || '15');
      setDefaultCreditLimitRupees(
        b.defaultCreditLimitPaise
          ? (b.defaultCreditLimitPaise / 100).toString()
          : '5000'
      );
    }
  }, [businessRes]);

  const updateProfileMutation = useMutation({
    mutationFn: (data: any) => updateBusinessProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businessProfile'] });
      toast.success('Store profile updated successfully!');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update store profile');
    },
  });

  const setModelMutation = useMutation({
    mutationFn: (model: string) => setAIModel(model),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['aiStatus'] });
      queryClient.invalidateQueries({ queryKey: ['aiModels'] });
      if (res?.data?.warning) {
        toast(res.data.warning, { icon: '⚠️', duration: 6000 });
      } else {
        toast.success(`Local AI now using ${res?.data?.model}`);
      }
    },
    onError: (err: any) => toast.error(err.message || 'Failed to switch model'),
  });

  const loadSeedMutation = useMutation({
    mutationFn: loadSeedData,
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success('Demo sample Kirana store dataset loaded successfully!');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to load seed data');
    },
  });

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Store name is required');
      return;
    }

    const limitPaise = defaultCreditLimitRupees
      ? Math.round(parseFloat(defaultCreditLimitRupees) * 100)
      : null;

    updateProfileMutation.mutate({
      name: name.trim(),
      phone: phone.trim() || null,
      address: address.trim() || null,
      currencySymbol: currencySymbol.trim() || '₹',
      defaultDueDays: parseInt(defaultDueDays, 10) || 15,
      defaultCreditLimitPaise: limitPaise,
    });
  };

  const handleDownloadBackup = async () => {
    try {
      toast.loading('Generating backup archive...', { id: 'backup' });
      const blob = await createBackup();
      downloadBlob(blob, `udhaaros-backup-${new Date().toISOString().slice(0, 10)}.json`);
      toast.success('Database backup downloaded safely!', { id: 'backup' });
    } catch (err: any) {
      toast.error('Failed to create backup: ' + err.message, { id: 'backup' });
    }
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      toast.loading('Validating and restoring backup...', { id: 'restore' });
      const text = await file.text();
      const json = JSON.parse(text);
      await restoreBackup(json);
      queryClient.invalidateQueries();
      toast.success('Database successfully restored from backup!', { id: 'restore' });
    } catch (err: any) {
      toast.error('Restore failed: ' + (err.message || 'Invalid JSON file'), { id: 'restore' });
    } finally {
      e.target.value = '';
    }
  };

  const aiStatus = aiStatusRes?.data;
  const aiModels = aiModelsRes?.data;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="pb-2 border-b border-stone-200/80">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-stone-900 text-white flex items-center justify-center shadow-xs">
            <SettingsIcon className="w-4 h-4" />
          </div>
          <h2 className="text-2xl font-black text-stone-900 tracking-tight">
            Store Profile & Configuration
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-stone-500 font-medium mt-1">
          Merchant business information, local AI engine diagnostics & database backups
        </p>
      </div>

      {/* AI Runtime Diagnostics Card */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-stone-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-base">Open-Source AI Engine Status</h3>
              <p className="text-xs text-stone-500">Local inference runtime health & fallback engine</p>
            </div>
          </div>

          <button
            onClick={() => {
              refetchAIStatus();
              queryClient.invalidateQueries({ queryKey: ['aiModels'] });
            }}
            disabled={aiLoading}
            className="p-2 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors"
            title="Refresh AI health status"
          >
            <RefreshCw className={`w-4 h-4 ${aiLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 bg-stone-50 rounded-xl border border-stone-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-stone-700">Active AI Model</span>
              {aiStatus?.available ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Connected
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800">
                  Offline Rule Engine
                </span>
              )}
            </div>
            <div className="space-y-1 text-stone-600">
              <p>
                <strong>Provider:</strong> {aiStatus?.provider || 'Ollama (Local)'}
              </p>
              <p>
                <strong>Model:</strong> {aiStatus?.model || 'llama3'}{' '}
                <span className="text-[10px] text-stone-400">
                  ({aiStatus?.modelSource === 'settings' ? 'set in app' : 'from .env'})
                </span>
              </p>
              <p>
                <strong>Base URL:</strong> {aiStatus?.baseUrl || 'http://localhost:11434'}
              </p>
              {!aiStatus?.available && aiStatus?.error && (
                <p className="text-[11px] text-amber-700 flex items-start gap-1 pt-0.5">
                  <AlertCircle className="w-3.5 h-3.5 mt-px shrink-0" />
                  <span>{aiStatus.error}</span>
                </p>
              )}
            </div>
          </div>

          <div className="p-4 bg-stone-50 rounded-xl border border-stone-200/80 space-y-2">
            <span className="font-bold text-stone-700 block">Offline Resilience & Privacy</span>
            <p className="text-stone-600 leading-relaxed">
              UdhaarOS implements a dual-path engine: high-precision local LLM when Ollama is available, with an
              instant deterministic rule-based parser (regex + Hinglish heuristics) when it is not. Nothing is ever
              posted to the ledger without your review.
            </p>
            <div className="flex items-center gap-1.5 text-emerald-700 font-semibold pt-1">
              <Shield className="w-3.5 h-3.5" /> 100% Local — Zero customer debt data leaves your device.
            </div>
          </div>
        </div>

        {/* AI Model Setup */}
        <div className="mt-4 p-4 bg-white rounded-xl border border-stone-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-stone-700 text-xs flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-emerald-600" />
              AI Model Setup
            </span>
            {modelsLoading ? (
              <span className="text-[10px] font-semibold text-stone-500">Checking Ollama…</span>
            ) : aiModels?.reachable ? (
              <span className="text-[10px] font-semibold text-emerald-700">
                {aiModels.models?.length || 0} model{aiModels.models?.length === 1 ? '' : 's'} detected
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-amber-700">
                {aiModels?.error || 'Ollama not reachable'}
              </span>
            )}
          </div>

          {!modelsLoading && !aiModels?.models?.length ? (
            <p className="text-[11px] text-stone-500 leading-relaxed">
              No local models detected. Start Ollama with{' '}
              <code className="px-1 py-0.5 bg-stone-100 rounded font-mono text-[10px]">ollama serve</code>, then pull
              one (for example{' '}
              <code className="px-1 py-0.5 bg-stone-100 rounded font-mono text-[10px]">ollama pull llama3</code>).
              Import keeps working meanwhile via the offline rule engine.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(aiModels?.models || []).map((m: any) => {
                const isActive = Boolean(m.active);
                return (
                  <button
                    key={m.name}
                    type="button"
                    onClick={() => setModelMutation.mutate(m.name)}
                    disabled={setModelMutation.isPending || isActive}
                    title={isActive ? 'Currently in use' : `Use ${m.name} for local extraction`}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors flex items-center gap-1.5 disabled:cursor-default ${
                      isActive
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                        : 'bg-white border-stone-300 text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    {isActive ? <Check className="w-3 h-3" /> : <Play className="w-3 h-3 text-stone-400" />}
                    {m.name}
                    {m.parameterSize && <span className="opacity-70 font-medium">{m.parameterSize}</span>}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={customModel}
              onChange={(e) => setCustomModel(e.target.value)}
              placeholder="Or type a tag, e.g. llama3:8b"
              className="flex-1 px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs font-mono text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
            />
            <button
              type="button"
              onClick={() => customModel.trim() && setModelMutation.mutate(customModel.trim())}
              disabled={setModelMutation.isPending || !customModel.trim()}
              className="px-4 py-2 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
            >
              {setModelMutation.isPending ? 'Switching…' : 'Use Model'}
            </button>
          </div>
        </div>
      </div>

      {/* Business Profile Settings Form */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs">
        <div className="flex items-center gap-2.5 pb-4 border-b border-stone-100 mb-4">
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-stone-900 text-base">Store & Merchant Profile</h3>
            <p className="text-xs text-stone-500">Appears on WhatsApp reminders, statements and reports</p>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Store / Business Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Gupta Kirana & General Store"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Merchant Phone Number
              </label>
              <input
                type="tel"
                placeholder="e.g. 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Store Address / Locality
            </label>
            <input
              type="text"
              placeholder="e.g. Main Market, Near Clock Tower"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Currency Symbol
              </label>
              <input
                type="text"
                value={currencySymbol}
                onChange={(e) => setCurrencySymbol(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Default Due Period (Days)
              </label>
              <input
                type="number"
                min="1"
                max="365"
                value={defaultDueDays}
                onChange={(e) => setDefaultDueDays(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Default Credit Limit (₹)
              </label>
              <input
                type="number"
                min="0"
                value={defaultCreditLimitRupees}
                onChange={(e) => setDefaultCreditLimitRupees(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
            </div>
          </div>

          <div className="pt-3 flex justify-end">
            <button
              type="submit"
              disabled={updateProfileMutation.isPending}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 disabled:opacity-50 text-white rounded-lg text-xs sm:text-sm font-bold shadow-xs transition-all flex items-center gap-1.5"
            >
              {updateProfileMutation.isPending ? (
                'Saving...'
              ) : (
                <>
                  <Save className="w-4 h-4" /> Save Store Profile
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Database Management & Demo Tools */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs">
        <div className="flex items-center gap-2.5 pb-4 border-b border-stone-100 mb-4">
          <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-stone-900 text-base">Data Backup & Demo Sandbox</h3>
            <p className="text-xs text-stone-500">
              Download JSON backup archives or reset with realistic test data
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Backup */}
          <div className="p-4 bg-stone-50 rounded-xl border border-stone-200/80 flex flex-col justify-between space-y-3">
            <div>
              <span className="font-bold text-xs text-stone-900 block mb-1">Download Backup</span>
              <p className="text-[11px] text-stone-500">
                Full snapshot of customers, ledger transactions, and reminder history.
              </p>
            </div>
            <button
              onClick={handleDownloadBackup}
              className="w-full py-2 px-3 bg-white hover:bg-stone-100 border border-stone-300 text-stone-800 rounded-lg text-xs font-semibold shadow-2xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-stone-600" /> Export JSON
            </button>
          </div>

          {/* Restore */}
          <div className="p-4 bg-stone-50 rounded-xl border border-stone-200/80 flex flex-col justify-between space-y-3">
            <div>
              <span className="font-bold text-xs text-stone-900 block mb-1">Restore Backup</span>
              <p className="text-[11px] text-stone-500">
                Restore data from a previously exported UdhaarOS JSON archive.
              </p>
            </div>
            <label className="w-full py-2 px-3 bg-white hover:bg-stone-100 border border-stone-300 text-stone-800 rounded-lg text-xs font-semibold shadow-2xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-stone-600" /> Choose File
              <input
                type="file"
                accept=".json"
                onChange={handleRestoreFile}
                className="hidden"
              />
            </label>
          </div>

          {/* Reset / Seed Demo */}
          <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200/80 flex flex-col justify-between space-y-3">
            <div>
              <span className="font-bold text-xs text-amber-900 block mb-1">Demo Dataset</span>
              <p className="text-[11px] text-amber-800/80">
                Reset or load sample kirana shopkeeper data (8 customers, 25+ entries).
              </p>
            </div>
            <button
              onClick={() => {
                if (window.confirm('Reload sample demo data into database?')) {
                  loadSeedMutation.mutate();
                }
              }}
              disabled={loadSeedMutation.isPending}
              className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 active:scale-98 text-white rounded-lg text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <Zap className="w-3.5 h-3.5" />
              {loadSeedMutation.isPending ? 'Reloading...' : 'Reload Demo Data'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
