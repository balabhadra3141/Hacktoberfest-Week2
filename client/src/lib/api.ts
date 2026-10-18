const API_BASE = 'http://localhost:3001/api';

async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Network error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  // Handle CSV/file downloads
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('text/csv')) {
    const blob = await response.blob();
    return blob as unknown as T;
  }

  return response.json();
}

// Dashboard
export const getDashboard = () => fetchAPI<any>('/dashboard');

// Customers
export const getCustomers = (params?: Record<string, string>) => {
  const query = params ? '?' + new URLSearchParams(params).toString() : '';
  return fetchAPI<any>(`/customers${query}`);
};

export const getCustomer = (id: string) => fetchAPI<any>(`/customers/${id}`);

export const createCustomer = (data: any) =>
  fetchAPI<any>('/customers', { method: 'POST', body: JSON.stringify(data) });

export const updateCustomer = (id: string, data: any) =>
  fetchAPI<any>(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const archiveCustomer = (id: string) =>
  fetchAPI<any>(`/customers/${id}/archive`, { method: 'PATCH' });

// Transactions
export const getTransactions = (params?: Record<string, string>) => {
  const query = params ? '?' + new URLSearchParams(params).toString() : '';
  return fetchAPI<any>(`/transactions${query}`);
};

export const getCustomerTransactions = (customerId: string, params?: Record<string, string>) => {
  const query = params ? '?' + new URLSearchParams(params).toString() : '';
  return fetchAPI<any>(`/transactions/customer/${customerId}${query}`);
};

export const createTransaction = (data: any) =>
  fetchAPI<any>('/transactions', { method: 'POST', body: JSON.stringify(data) });

export const reverseTransaction = (id: string, reason: string) =>
  fetchAPI<any>(`/transactions/${id}/reverse`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });

// Import
export const importText = (text: string, referenceDate?: string) =>
  fetchAPI<any>('/import/text', {
    method: 'POST',
    body: JSON.stringify({ text, referenceDate }),
  });

export const importImage = async (file: File) => {
  const formData = new FormData();
  formData.append('image', file);
  const response = await fetch(`${API_BASE}/import/image`, {
    method: 'POST',
    body: formData,
  });
  return response.json();
};

export const updateImportCandidate = (id: string, data: any) =>
  fetchAPI<any>(`/import/candidates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const confirmImport = (candidateIds: string[]) =>
  fetchAPI<any>('/import/confirm', {
    method: 'POST',
    body: JSON.stringify({ candidateIds }),
  });

export const getImportBatches = () => fetchAPI<any>('/import/batches');

export const getImportBatch = (id: string) => fetchAPI<any>(`/import/batches/${id}`);

// Reminders
export const generateReminder = (data: any) =>
  fetchAPI<any>('/reminders/generate', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const saveReminder = (data: any) =>
  fetchAPI<any>('/reminders/save', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const getReminderHistory = (customerId: string) =>
  fetchAPI<any>(`/reminders/history/${customerId}`);

// Reports
export const getOutstandingReport = () => fetchAPI<any>('/reports/outstanding');
export const getCollectionsReport = (params?: Record<string, string>) => {
  const query = params ? '?' + new URLSearchParams(params).toString() : '';
  return fetchAPI<any>(`/reports/collections${query}`);
};

export const exportTransactionsCsv = async (params?: Record<string, string>) => {
  const query = params ? '?' + new URLSearchParams(params).toString() : '';
  const response = await fetch(`${API_BASE}/reports/export/transactions${query}`);
  return response.blob();
};

export const exportCustomerStatement = async (customerId: string) => {
  const response = await fetch(`${API_BASE}/reports/export/customer-statement/${customerId}`);
  return response.blob();
};

// Settings
export const getBusinessProfile = () => fetchAPI<any>('/settings/business');
export const updateBusinessProfile = (data: any) =>
  fetchAPI<any>('/settings/business', { method: 'PUT', body: JSON.stringify(data) });

export const getAIStatus = () => fetchAPI<any>('/settings/ai-status');

export const getAIModels = () => fetchAPI<any>('/settings/ai-models');

export const setAIModel = (model: string) =>
  fetchAPI<any>('/settings/ai-model', {
    method: 'PUT',
    body: JSON.stringify({ model }),
  });

export const createBackup = async () => {
  const response = await fetch(`${API_BASE}/settings/backup`, { method: 'POST' });
  return response.blob();
};

export const restoreBackup = (data: any) =>
  fetchAPI<any>('/settings/restore', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const loadSeedData = () =>
  fetchAPI<any>('/settings/seed', { method: 'POST' });

// Health
export const healthCheck = () => fetchAPI<any>('/settings/health');

// Utility
export function formatPaise(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(rupees);
}

export function formatPaiseShort(paise: number): string {
  const rupees = paise / 100;
  if (rupees >= 10000000) return `₹${(rupees / 10000000).toFixed(1)}Cr`;
  if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(1)}L`;
  if (rupees >= 1000) return `₹${(rupees / 1000).toFixed(1)}K`;
  return formatPaise(paise);
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
