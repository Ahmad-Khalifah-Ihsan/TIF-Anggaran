const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://124.156.204.209';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    window.location.href = '/login';
    throw new Error('Sesi habis');
  }
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || 'Request failed');
  }
  return response.json();
}

export const authApi = {
  async login(username: string, password: string) {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    return handleResponse<any>(response);
  },

  async register(data: { username: string; password: string; nama_lengkap?: string; telegram_id?: string }) {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<any>(response);
  },

  async deleteAccount() {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/account`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse<any>(response);
  },

  async changePassword(oldPassword: string, newPassword: string) {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/change-password`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
    });
    return handleResponse<any>(response);
  },
};

export const userManagementApi = {
  async getUsers() {
    const response = await fetch(`${API_BASE_URL}/api/v1/admin/users`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<any>(response);
  },

  async createUser(data: { username: string; password: string; nama_lengkap?: string; telegram_id?: string }) {
    const response = await fetch(`${API_BASE_URL}/api/v1/admin/users`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<any>(response);
  },

  async updateUserStatus(userId: string, status: 'pending' | 'active' | 'rejected') {
    const response = await fetch(`${API_BASE_URL}/api/v1/admin/users/${userId}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status }),
    });
    return handleResponse<any>(response);
  },

  async updateUserRole(userId: string, role: 'admin' | 'user') {
    const response = await fetch(`${API_BASE_URL}/api/v1/admin/users/${userId}/role`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ role }),
    });
    return handleResponse<any>(response);
  },

  async deleteUser(userId: string) {
    const response = await fetch(`${API_BASE_URL}/api/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse<any>(response);
  },
};

export const budgetManagementApi = {
  async getCategories() {
    const response = await fetch(`${API_BASE_URL}/api/v1/budget/categories`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<any>(response);
  },

  async getCategory(categoryId: string) {
    const response = await fetch(`${API_BASE_URL}/api/v1/budget/categories/${categoryId}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<any>(response);
  },

  async createCategory(data: { nama: string; kode: string; deskripsi?: string; saldo_awal?: number }) {
    const response = await fetch(`${API_BASE_URL}/api/v1/budget/categories`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<any>(response);
  },

  async updateCategory(categoryId: string, data: { nama?: string; kode?: string; deskripsi?: string; saldo_awal?: number; is_active?: boolean }) {
    const response = await fetch(`${API_BASE_URL}/api/v1/budget/categories/${categoryId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<any>(response);
  },

  async deleteCategory(categoryId: string) {
    const response = await fetch(`${API_BASE_URL}/api/v1/budget/categories/${categoryId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse<any>(response);
  },

  async forceDeleteCategory(categoryId: string) {
    const response = await fetch(`${API_BASE_URL}/api/v1/budget/categories/${categoryId}/force-delete`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse<any>(response);
  },

  async getSummary() {
    const response = await fetch(`${API_BASE_URL}/api/v1/budget/summary`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<any>(response);
  },

  async getTotal() {
    const response = await fetch(`${API_BASE_URL}/api/v1/budget/total`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<any>(response);
  },

  async getRecords(params?: { category_id?: string; tipe?: string; start_date?: string; end_date?: string }) {
    let url = `${API_BASE_URL}/api/v1/budget/records`;
    const searchParams = new URLSearchParams();
    if (params?.category_id) searchParams.append('category_id', params.category_id);
    if (params?.tipe) searchParams.append('tipe', params.tipe);
    if (params?.start_date) searchParams.append('start_date', params.start_date);
    if (params?.end_date) searchParams.append('end_date', params.end_date);
    if (searchParams.toString()) url += '?' + searchParams.toString();
    
    const response = await fetch(url, {
      headers: getAuthHeaders(),
    });
    return handleResponse<any>(response);
  },

  async getRecord(id: string) {
    const response = await fetch(`${API_BASE_URL}/api/v1/budget/records/${id}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<any>(response);
  },

  async createRecord(formData: FormData) {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}/api/v1/budget/records`, {
      method: 'POST',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    return handleResponse<any>(response);
  },

  async deleteRecord(id: string) {
    const response = await fetch(`${API_BASE_URL}/api/v1/budget/records/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse<any>(response);
  },

  // Monthly Summary API
  async getMonthlySummaries(tahun?: number) {
    let url = `${API_BASE_URL}/api/v1/budget/monthly-summary`;
    if (tahun) url += `?tahun=${tahun}`;
    const response = await fetch(url, {
      headers: getAuthHeaders(),
    });
    return handleResponse<any>(response);
  },

  async getMonthlySummary(id: string) {
    const response = await fetch(`${API_BASE_URL}/api/v1/budget/monthly-summary/${id}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<any>(response);
  },

  async createMonthlySummary(data: { kode: string; category_id?: string; tahun: number; bulan: number; total_masuk: number; total_keluar: number; keterangan?: string }) {
    const response = await fetch(`${API_BASE_URL}/api/v1/budget/monthly-summary`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<any>(response);
  },

  async updateMonthlySummary(id: string, data: { kode?: string; category_id?: string; tahun?: number; bulan?: number; total_masuk?: number; total_keluar?: number; keterangan?: string }) {
    const response = await fetch(`${API_BASE_URL}/api/v1/budget/monthly-summary/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<any>(response);
  },

  async deleteMonthlySummary(id: string) {
    const response = await fetch(`${API_BASE_URL}/api/v1/budget/monthly-summary/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse<any>(response);
  },

  async getMonthlyAggregate() {
    const response = await fetch(`${API_BASE_URL}/api/v1/budget/monthly-aggregate`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<any>(response);
  },

  async getMonthlySummaryHistory(tahun: number) {
    const response = await fetch(`${API_BASE_URL}/api/v1/budget/monthly-summary-history/${tahun}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<any>(response);
  },

  async getMonthlyTransactions(bulan: number, tahun: number) {
    const response = await fetch(`${API_BASE_URL}/api/v1/budget/monthly-transactions/${bulan}/${tahun}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<any>(response);
  },
};
