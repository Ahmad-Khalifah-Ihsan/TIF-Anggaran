import React, { useEffect, useState } from 'react';
import { budgetManagementApi } from '../services/api';
import { 
  List, 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  Save, 
  CheckCircle,
  AlertCircle,
  Settings,
  Filter,
  Calendar,
  Globe
} from 'lucide-react';

interface BudgetCategory {
  id: string;
  nama: string;
  kode: string;
  deskripsi: string | null;
  saldo_awal: number;
  is_active: boolean;
}

interface CategoryFormData {
  nama: string;
  kode: string;
  deskripsi: string;
  saldo_awal: string;
}

const BULAN_OPTIONS = [
  { value: 1, label: 'Januari' },
  { value: 2, label: 'Februari' },
  { value: 3, label: 'Maret' },
  { value: 4, label: 'April' },
  { value: 5, label: 'Mei' },
  { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' },
  { value: 8, label: 'Agustus' },
  { value: 9, label: 'September' },
  { value: 10, label: 'Oktober' },
  { value: 11, label: 'November' },
  { value: 12, label: 'Desember' }
];

export default function CategoryManagement() {
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<BudgetCategory | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>({
    nama: '',
    kode: '',
    deskripsi: '',
    saldo_awal: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [filterBulan, setFilterBulan] = useState<number>(new Date().getMonth() + 1);
  const [filterTahun, setFilterTahun] = useState<number>(new Date().getFullYear());
  const [deleteTarget, setDeleteTarget] = useState<BudgetCategory | null>(null);
  const [selectedMasterId, setSelectedMasterId] = useState<string>('new');

  useEffect(() => {
    fetchCategories();
  }, [filterBulan, filterTahun]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await budgetManagementApi.getCategories(filterBulan, filterTahun);
      if (response.status === 'success') {
        setCategories(response.data);
      }
    } catch (err: any) {
      console.error('Error fetching categories:', err);
      setError(err.message || 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ nama: '', kode: '', deskripsi: '', saldo_awal: '' });
    setEditingCategory(null);
    setError('');
    setSuccess('');
  };

  const handleOpenCreate = () => {
    resetForm();
    setSelectedMasterId('new');
    setShowModal(true);
  };

  const handleOpenEdit = (category: BudgetCategory) => {
    setEditingCategory(category);
    setSelectedMasterId(category.id);
    setFormData({
      nama: category.nama,
      kode: category.kode,
      deskripsi: category.deskripsi || '',
      saldo_awal: category.saldo_awal.toString()
    });
    setError('');
    setSuccess('');
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    resetForm();
    setSelectedMasterId('new');
  };

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
  };

  const formatNumberInput = (value: string) => {
    const number = value.replace(/\D/g, '');
    return number.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const parseFormattedNumber = (value: string) => {
    return parseInt(value.replace(/\./g, '')) || 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.nama.trim()) {
      setError('Nama akun anggaran wajib diisi');
      return;
    }
    if (!formData.kode.trim()) {
      setError('Cost Element wajib diisi');
      return;
    }

    const payload: any = {
      nama: formData.nama.trim(),
      kode: formData.kode.trim().toUpperCase(),
      deskripsi: formData.deskripsi.trim() || null,
    };

    const saldoAwal = parseFormattedNumber(formData.saldo_awal);
    const isEditing = !!editingCategory;
    const isExistingAllocation = !isEditing && selectedMasterId !== 'new';

    // Only send saldo_awal if creating a new master category, or if we explicitly modified the saldo
    if (!isEditing || saldoAwal !== editingCategory.saldo_awal) {
      payload.saldo_awal = saldoAwal;
    }

    try {
      setSubmitting(true);
      
      if (isEditing || isExistingAllocation) {
        // Update existing category or allocate budget to existing category
        const targetId = isEditing ? editingCategory.id : selectedMasterId;
        const result = await budgetManagementApi.updateCategory(targetId, payload, filterBulan, filterTahun);
        if (result.status === 'success') {
          setSuccess(isEditing ? 'Mata anggaran berhasil diupdate!' : 'Anggaran berhasil dialokasikan!');
          fetchCategories();
          setTimeout(handleCloseModal, 1500);
        } else {
          throw new Error(result.detail || 'Gagal update');
        }
      } else {
        // Create new category
        const result = await budgetManagementApi.createCategory(payload, filterBulan, filterTahun);
        if (result.status === 'success') {
          setSuccess('Mata anggaran berhasil dibuat!');
          fetchCategories();
          setTimeout(handleCloseModal, 1500);
        } else {
          throw new Error(result.detail || 'Gagal membuat');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAllocation = async () => {
    if (!deleteTarget) return;
    try {
      setSubmitting(true);
      const result = await budgetManagementApi.deleteAllocation(deleteTarget.id, filterBulan, filterTahun);
      if (result.status === 'success') {
        setSuccess(`Alokasi anggaran "${deleteTarget.nama}" untuk bulan ${BULAN_OPTIONS.find(b => b.value === filterBulan)?.label} ${filterTahun} berhasil dihapus!`);
        setDeleteTarget(null);
        fetchCategories();
      } else {
        throw new Error(result.detail || 'Gagal menghapus alokasi');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteGlobal = async () => {
    if (!deleteTarget) return;
    try {
      setSubmitting(true);
      const result = await budgetManagementApi.deleteCategory(deleteTarget.id);
      if (result.status === 'success') {
        setSuccess(`Mata anggaran "${deleteTarget.nama}" berhasil dinonaktifkan secara global!`);
        setDeleteTarget(null);
        fetchCategories();
      } else {
        throw new Error(result.detail || 'Gagal menonaktifkan kategori');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (category: BudgetCategory) => {
    if (category.is_active === false) {
      // Force delete inactive category from database permanently
      if (!confirm(`Yakin hapus permanen mata anggaran "${category.nama}"?`)) return;
      try {
        setSubmitting(true);
        const result = await budgetManagementApi.forceDeleteCategory(category.id);
        if (result.status === 'success') {
          setSuccess(result.message || 'Mata anggaran berhasil dihapus permanen!');
          fetchCategories();
        } else {
          throw new Error(result.detail || 'Gagal hapus');
        }
      } catch (err: any) {
        setError(err.message || 'Terjadi kesalahan');
      } finally {
        setSubmitting(false);
      }
    } else {
      // Open custom confirmation modal for active categories
      setDeleteTarget(category);
    }
  };

  const activeCategories = categories.filter(c => c.is_active !== false && (c.saldo_awal || 0) > 0);
  const inactiveCategories = categories.filter(c => c.is_active === false);
  const displayedCategories = showInactive ? inactiveCategories : activeCategories;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <List className="text-primary" size={28} />
            Saldo Bulanan
          </h1>
          <p className="text-muted-foreground">Kelola saldo awal mata anggaran per bulan</p>
        </div>
        <button 
          onClick={handleOpenCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus size={18} />
          Tambah Mata Anggaran
        </button>
      </div>

      {/* Month & Year Filter for Monthly Balance */}
      <div className="flex flex-wrap items-center gap-3 mb-6 bg-secondary/20 p-4 rounded-xl border border-border">
        <span className="text-sm font-medium flex items-center gap-2 text-foreground">
          <Filter size={16} className="text-primary" />
          Periode Anggaran:
        </span>
        <select
          value={filterBulan}
          onChange={(e) => {
            setFilterBulan(parseInt(e.target.value));
          }}
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm outline-none cursor-pointer hover:border-primary/50 transition-colors text-foreground"
        >
          {BULAN_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          value={filterTahun}
          onChange={(e) => {
            setFilterTahun(parseInt(e.target.value));
          }}
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm outline-none cursor-pointer hover:border-primary/50 transition-colors text-foreground"
        >
          {Array.from({ length: 80 }, (_, i) => new Date().getFullYear() - 40 + i).map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="bg-red-500/20 text-red-400 text-sm p-3 rounded-lg flex items-center gap-2 mb-4">
          <AlertCircle size={16} />
          {error}
          <button onClick={() => setError('')} className="ml-auto"><X size={16} /></button>
        </div>
      )}

      {success && (
        <div className="bg-green-500/20 text-green-400 text-sm p-3 rounded-lg flex items-center gap-2 mb-4">
          <CheckCircle size={16} />
          {success}
          <button onClick={() => setSuccess('')} className="ml-auto"><X size={16} /></button>
        </div>
      )}

      {/* Tab Filter */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setShowInactive(false)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            !showInactive 
              ? 'bg-primary text-white' 
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          Aktif ({activeCategories.length})
        </button>
        {inactiveCategories.length > 0 && (
          <button
            onClick={() => setShowInactive(true)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              showInactive 
                ? 'bg-red-500 text-white' 
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Dinonaktifkan ({inactiveCategories.length})
          </button>
        )}
      </div>

      {/* Categories Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-300">Cost Element</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-300">Nama Akun Anggaran</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-300">Deskripsi</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-slate-300">Saldo Awal</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-slate-300">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {displayedCategories.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    {showInactive ? 'Tidak ada mata anggaran yang dinonaktifkan' : 'Belum ada mata anggaran yang dialokasikan untuk periode ini'}
                  </td>
                </tr>
              ) : (
                displayedCategories.map((category) => (
                  <tr key={category.id} className={`hover:bg-slate-800/30 ${category.is_active === false ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm bg-primary/20 text-primary px-2 py-0.5 rounded">
                        {category.kode}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">{category.nama}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {category.deskripsi || '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatCurrency(category.saldo_awal || 0)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleOpenEdit(category)}
                          className="p-2 text-blue-400 hover:bg-blue-400/20 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(category)}
                          className={`p-2 rounded-lg transition-colors ${
                            category.is_active === false
                              ? 'text-red-400 hover:bg-red-400/20'
                              : 'text-orange-400 hover:bg-orange-400/20'
                          }`}
                          title={category.is_active === false ? 'Hapus Permanen' : 'Nonaktifkan'}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={handleCloseModal}>
          <div className="bg-card rounded-xl w-full max-w-md border border-border" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                {editingCategory ? (
                  <><Edit2 size={20} className="text-primary" /><h3 className="font-semibold">Edit Mata Anggaran</h3></>
                ) : (
                  <><Plus size={20} className="text-primary" /><h3 className="font-semibold">Tambah Mata Anggaran</h3></>
                )}
              </div>
              <button onClick={handleCloseModal}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {error && (
                <div className="bg-red-500/20 text-red-400 text-sm p-3 rounded-lg flex items-center gap-2">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              {success && (
                <div className="bg-green-500/20 text-green-400 text-sm p-3 rounded-lg flex items-center gap-2">
                  <CheckCircle size={16} />
                  {success}
                </div>
              )}

              {!editingCategory && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Tipe Kategori Anggaran
                  </label>
                  <select
                    className="w-full bg-background border border-border rounded-lg px-4 py-2.5 outline-none cursor-pointer text-foreground"
                    value={selectedMasterId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedMasterId(val);
                      if (val === 'new') {
                        setFormData({ nama: '', kode: '', deskripsi: '', saldo_awal: '' });
                      } else {
                        const cat = categories.find(c => c.id === val);
                        if (cat) {
                          setFormData({
                            nama: cat.nama,
                            kode: cat.kode,
                            deskripsi: cat.deskripsi || '',
                            saldo_awal: ''
                          });
                        }
                      }
                    }}
                  >
                    <option value="new">-- Buat Kategori Baru --</option>
                    {categories
                      .filter(c => c.is_active !== false && (!c.saldo_awal || c.saldo_awal === 0))
                      .map(c => (
                        <option key={c.id} value={c.id}>
                          {c.kode} - {c.nama} (Gunakan Kategori yang Sudah Ada)
                        </option>
                      ))
                    }
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">
                  Cost Element <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  className="w-full bg-background border border-border rounded-lg px-4 py-2.5 font-mono uppercase"
                  placeholder="Contoh: 51321001"
                  value={formData.kode}
                  onChange={(e) => setFormData({...formData, kode: e.target.value.toUpperCase()})}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Nama Akun Anggaran <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  className="w-full bg-background border border-border rounded-lg px-4 py-2.5"
                  placeholder="Contoh: Gaji Karyawan"
                  value={formData.nama}
                  onChange={(e) => setFormData({...formData, nama: e.target.value})}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Deskripsi
                </label>
                <textarea
                  className="w-full bg-background border border-border rounded-lg px-4 py-2.5"
                  rows={3}
                  placeholder="Deskripsi opsional untuk mata anggaran ini"
                  value={formData.deskripsi}
                  onChange={(e) => setFormData({...formData, deskripsi: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Saldo Awal
                </label>
                <input
                  type="text"
                  className="w-full bg-background border border-border rounded-lg px-4 py-2.5 font-mono"
                  placeholder="0"
                  value={formatNumberInput(formData.saldo_awal)}
                  onChange={(e) => setFormData({...formData, saldo_awal: formatNumberInput(e.target.value)})}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 py-2.5 rounded-lg font-medium bg-secondary border border-border hover:bg-slate-700 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-lg font-medium bg-primary text-white disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      {editingCategory ? 'Update' : 'Simpan'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border w-full max-w-md rounded-2xl p-6 shadow-2xl relative">
            <h3 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">
              <Trash2 className="text-red-400" size={24} />
              Hapus Mata Anggaran
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Pilih opsi penghapusan untuk mata anggaran <strong className="text-foreground">"{deleteTarget.nama}"</strong>:
            </p>
            
            <div className="space-y-4">
              <button
                type="button"
                onClick={handleDeleteAllocation}
                disabled={submitting}
                className="w-full text-left p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all group flex items-start gap-3"
              >
                <div className="p-2 rounded-lg bg-primary/10 text-primary mt-0.5 group-hover:bg-primary/20 transition-colors">
                  <Calendar size={18} />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground text-sm">Hapus Alokasi Bulan Ini Saja</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Hanya menghapus anggaran untuk periode <strong>{BULAN_OPTIONS.find(b => b.value === filterBulan)?.label} {filterTahun}</strong>. Saldo awal bulan ini akan kembali menjadi Rp 0.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={handleDeleteGlobal}
                disabled={submitting}
                className="w-full text-left p-4 rounded-xl border border-border hover:border-red-500/50 hover:bg-red-500/5 transition-all group flex items-start gap-3"
              >
                <div className="p-2 rounded-lg bg-red-500/10 text-red-400 mt-0.5 group-hover:bg-red-500/20 transition-colors">
                  <Globe size={18} />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground text-sm text-red-400">Nonaktifkan Secara Global</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Menonaktifkan kategori ini di semua periode bulan/tahun.
                  </p>
                </div>
              </button>
            </div>

            <div className="flex gap-3 pt-6 mt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={submitting}
                className="w-full py-2.5 rounded-lg font-medium bg-secondary border border-border hover:bg-slate-700 transition-colors text-center text-sm"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
