import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Users,
  UserPlus,
  Search,
  Phone,
  MapPin,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  MessageSquare,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { getCustomers, formatPaise, formatDate } from '../lib/api';
import CustomerModal from '../components/CustomerModal';
import TransactionModal from '../components/TransactionModal';

export default function Customers() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'BALANCE' | 'OVERDUE'>('ALL');
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<any | null>(null);

  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txModalType, setTxModalType] = useState<'CREDIT' | 'PAYMENT'>('CREDIT');
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);

  const { data: customersRes, isLoading, error } = useQuery({
    queryKey: ['customers', { query: searchTerm, limit: '100' }],
    queryFn: () => getCustomers({ query: searchTerm, limit: '100' }),
  });

  const customers = customersRes?.data?.items || [];

  // Filter customers locally based on tab
  const filteredCustomers = customers.filter((c: any) => {
    const bal = c.balancePaise || c.outstandingBalancePaise || 0;
    if (filterType === 'BALANCE') {
      return bal > 0;
    }
    if (filterType === 'OVERDUE') {
      return c.isOverdue || (c.overdueAmountPaise || 0) > 0;
    }
    return true;
  });

  const handleOpenTx = (type: 'CREDIT' | 'PAYMENT', customer: any) => {
    setTxModalType(type);
    setSelectedCustomer(customer);
    setIsTxModalOpen(true);
  };

  const handleCreateCustomer = () => {
    setCustomerToEdit(null);
    setIsCustomerModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-stone-200/80">
        <div>
          <h2 className="text-2xl font-black text-stone-900 tracking-tight">
            Customer Khata Directory
          </h2>
          <p className="text-xs sm:text-sm text-stone-500 font-medium">
            Manage customer accounts, credit balances, limits & repayment history
          </p>
        </div>

        <button
          onClick={handleCreateCustomer}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs sm:text-sm font-bold rounded-lg shadow-xs transition-all shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          + New Customer (Khata Kholein)
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-stone-200 shadow-xs">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search by customer name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
          />
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl">
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              filterType === 'ALL'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            All ({customers.length})
          </button>
          <button
            onClick={() => setFilterType('BALANCE')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              filterType === 'BALANCE'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Owe Money
          </button>
          <button
            onClick={() => setFilterType('OVERDUE')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              filterType === 'OVERDUE'
                ? 'bg-white text-red-700 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Overdue Only
          </button>
        </div>
      </div>

      {/* Customer Directory Grid / Cards */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-stone-500">Loading customer accounts...</p>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center max-w-md mx-auto space-y-3">
          <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center mx-auto text-stone-400">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-stone-900 text-base">No Customers Found</h3>
          <p className="text-xs text-stone-500">
            {searchTerm
              ? `No customer matching "${searchTerm}". Try another query.`
              : 'Add your first customer to start maintaining digital udhaar ledger.'}
          </p>
          <button
            onClick={handleCreateCustomer}
            className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg shadow-xs"
          >
            + Create New Customer
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.map((cust: any) => {
            const balancePaise = cust.balancePaise ?? cust.outstandingBalancePaise ?? 0;
            const hasDebt = balancePaise > 0;
            const limitPaise = cust.creditLimitPaise || 0;
            const utilization = limitPaise > 0 ? Math.min(100, Math.round((balancePaise / limitPaise) * 100)) : 0;
            const isOverdue = cust.isOverdue || (cust.overdueAmountPaise || 0) > 0;

            return (
              <div
                key={cust.id}
                className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  {/* Card Header: Customer Info & Status */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <Link
                        to={`/customers/${cust.id}`}
                        className="font-black text-stone-900 text-base hover:text-emerald-700 transition-colors line-clamp-1"
                      >
                        {cust.name}
                      </Link>
                      <div className="flex items-center gap-2 text-stone-500 text-xs mt-0.5">
                        {cust.phone ? (
                          <span className="flex items-center gap-1 font-mono">
                            <Phone className="w-3 h-3 text-stone-400" />
                            {cust.phone}
                          </span>
                        ) : (
                          <span className="text-[11px] text-stone-400 italic">No phone</span>
                        )}
                      </div>
                    </div>

                    {/* Status Badge */}
                    {isOverdue ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 flex items-center gap-1 shrink-0">
                        <AlertTriangle className="w-3 h-3" /> Overdue
                      </span>
                    ) : hasDebt ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                        Active Due
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                        Cleared
                      </span>
                    )}
                  </div>

                  {/* Balance Display */}
                  <div className="bg-stone-50 rounded-xl p-3 mb-3 border border-stone-100">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-stone-500 font-semibold">Net Outstanding</span>
                      {cust.lastTransactionDate && (
                        <span className="text-[10px] text-stone-400 flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          Last: {formatDate(cust.lastTransactionDate)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline justify-between">
                      <div
                        className={`text-xl font-black ${
                          hasDebt ? 'text-red-600' : 'text-emerald-700'
                        }`}
                      >
                        {formatPaise(balancePaise)}
                      </div>
                      {limitPaise > 0 && (
                        <span className="text-xs text-stone-500 font-medium">
                          Limit: ₹{(limitPaise / 100).toLocaleString()}
                        </span>
                      )}
                    </div>

                    {/* Credit Limit Progress bar */}
                    {limitPaise > 0 && (
                      <div className="mt-2">
                        <div className="w-full bg-stone-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              utilization >= 90
                                ? 'bg-red-600'
                                : utilization >= 70
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${utilization}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-stone-400 mt-1">
                          <span>{utilization}% Limit Used</span>
                          {utilization >= 90 && (
                            <span className="text-red-600 font-bold">Near Limit!</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {cust.address && (
                    <p className="text-xs text-stone-500 flex items-center gap-1 mb-3 line-clamp-1">
                      <MapPin className="w-3 h-3 text-stone-400 shrink-0" />
                      {cust.address}
                    </p>
                  )}
                </div>

                {/* Card Action Buttons */}
                <div className="pt-3 border-t border-stone-100 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleOpenTx('CREDIT', cust)}
                      className="py-1.5 px-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 border border-red-200"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" /> Udhaar
                    </button>
                    <button
                      onClick={() => handleOpenTx('PAYMENT', cust)}
                      className="py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 border border-emerald-200"
                    >
                      <ArrowDownLeft className="w-3.5 h-3.5" /> Jama
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    {hasDebt ? (
                      <Link
                        to={`/reminders?customerId=${cust.id}`}
                        className="text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1"
                      >
                        <MessageSquare className="w-3.5 h-3.5" /> WhatsApp Reminder
                      </Link>
                    ) : (
                      <span className="text-stone-400 text-[11px]">No dues pending</span>
                    )}

                    <Link
                      to={`/customers/${cust.id}`}
                      className="text-stone-500 hover:text-stone-900 font-semibold flex items-center gap-0.5"
                    >
                      Khata Book <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {isCustomerModalOpen && (
        <CustomerModal
          isOpen={isCustomerModalOpen}
          customerToEdit={customerToEdit}
          onClose={() => setIsCustomerModalOpen(false)}
        />
      )}

      {isTxModalOpen && (
        <TransactionModal
          isOpen={isTxModalOpen}
          initialType={txModalType}
          defaultCustomerId={selectedCustomer?.id}
          defaultCustomerName={selectedCustomer?.name}
          onClose={() => setIsTxModalOpen(false)}
        />
      )}
    </div>
  );
}
