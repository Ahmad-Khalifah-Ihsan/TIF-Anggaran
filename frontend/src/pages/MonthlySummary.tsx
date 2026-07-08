import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { budgetManagementApi } from '../services/api';
import {
  ChevronDown,
  CheckCircle,
  LogOut,
  X,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Eye
} from 'lucide-react';

let rawUrl = import.meta.env.VITE_API_URL || 'http://localhost:9000';
rawUrl = rawUrl.replace(/\/+$/, '');
const API_BASE_URL = rawUrl;

interface BudgetCategory {
  id: string;
  nama: string;
  kode: string;
  deskripsi: string | null;
  saldo_awal: number;
  is_active: boolean;
}

interface Transaction {
  id: string;
  category_id: string;
  tipe: string;
  jumlah: number;
  keterangan: string | null;
  created_at: string;
  category_kode?: string;
  category_nama?: string;
  evidence_url?: string | null;
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
  { value: 12, label: 'Desember' },
];

export default function MonthlySummary() {
  const { logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tahun, setTahun] = useState(new Date().getFullYear());
  const [showModal, setShowModal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [actualRecords, setActualRecords] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [successMsg, setSuccessMsg] = useState('');
  const [viewingEvidence, setViewingEvidence] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [tahun]);

  // ESC to close modal
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowModal(false);
        setViewingEvidence(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showModal, viewingEvidence]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [recordsRes, categoriesRes] = await Promise.all([
        budgetManagementApi.getRecords(),
        budgetManagementApi.getCategories()
      ]);

      if (recordsRes.status === 'success') {
        setActualRecords(recordsRes.data);
      }

      if (categoriesRes.status === 'success') {
        setCategories(categoriesRes.data);
      }
    } catch (err: any) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getTotalSaldoAwal = () => {
    return categories
      .filter(c => c.is_active !== false)
      .reduce((sum, cat) => sum + (cat.saldo_awal || 0), 0);
  };

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
  };

  const getMonthActual = (bulan: number) => {
    let totalMasuk = 0;
    let totalKeluar = 0;
    let transactionCount = 0;

    actualRecords.forEach(r => {
      const datePart = r.created_at.split(/[T ]/)[0];
      const [rYear, rMonth] = datePart.split('-').map(Number);
      if (rYear === tahun && rMonth === bulan) {
        if (r.tipe === 'masuk') {
          totalMasuk += r.jumlah;
        } else if (r.tipe === 'keluar') {
          totalKeluar += r.jumlah;
        }
        transactionCount++;
      }
    });

    return {
      total_masuk: totalMasuk,
      total_keluar: totalKeluar,
      count: transactionCount
    };
  };

  const getMonthTransactions = (bulan: number) => {
    const transactions = actualRecords.filter(r => {
      const datePart = r.created_at.split(/[T ]/)[0];
      const [rYear, rMonth] = datePart.split('-').map(Number);
      return rYear === tahun && rMonth === bulan;
    });

    // Sort by created_at descending (newest first)
    return transactions.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  };

  const openModal = (bulan: number) => {
    setSelectedMonth(bulan);
    setShowModal(true);
  };

  const formatDateTime = (isoString: string) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const monthTransactions = selectedMonth ? getMonthTransactions(selectedMonth) : [];
  const pemasukanTransactions = monthTransactions.filter(t => t.tipe === 'masuk');
  const pengeluaranTransactions = monthTransactions.filter(t => t.tipe === 'keluar');
  const totalPemasukan = pemasukanTransactions.reduce((sum, t) => sum + t.jumlah, 0);
  const totalPengeluaran = pengeluaranTransactions.reduce((sum, t) => sum + t.jumlah, 0);
  const totalSaldo = getTotalSaldoAwal();
  const sisaSaldo = totalSaldo + totalPemasukan - totalPengeluaran;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            📋 Ringkasan Bulanan
          </h1>
          <p className="text-muted-foreground">Klik bulan untuk melihat ringkasan transaksi</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={logout} className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors">
            <LogOut size={18} />
            Keluar
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="mb-4 bg-green-500/20 text-green-400 text-sm p-3 rounded-lg flex items-center gap-2">
          <CheckCircle size={16} />{successMsg}
        </div>
      )}

      {/* Tahun Selector */}
      <div className="flex items-center gap-4 mb-6">
        <label className="text-sm font-medium">Tahun:</label>
        <div className="relative">
          <select
            className="bg-card border border-border rounded-lg px-4 py-2 appearance-none pr-10 font-medium"
            value={tahun}
            onChange={(e) => setTahun(parseInt(e.target.value))}
          >
            {Array.from({ length: 80 }, (_, i) => new Date().getFullYear() - 40 + i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Month List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {BULAN_OPTIONS.map(bulan => {
          const actual = getMonthActual(bulan.value);
          const hasActual = actual.count > 0;

          return (
            <div
              key={bulan.value}
              onClick={() => openModal(bulan.value)}
              className="bg-card border border-border rounded-xl p-4 cursor-pointer hover:border-primary hover:bg-primary/5 transition-all group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{bulan.label}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {hasActual ? `${actual.count} transaksi` : 'Belum ada transaksi'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {hasActual && (
                    <div className="flex gap-3 text-right mr-2">
                      <div>
                        <p className="text-[10px] text-muted-foreground">Masuk</p>
                        <p className="font-semibold text-green-400 text-sm">{formatCurrency(actual.total_masuk)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Keluar</p>
                        <p className="font-semibold text-red-400 text-sm">{formatCurrency(actual.total_keluar)}</p>
                      </div>
                    </div>
                  )}
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <ChevronRight size={18} className="text-primary" />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Ringkasan Transaksi */}
      {showModal && selectedMonth && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <h2 className="text-xl font-bold">
                  {BULAN_OPTIONS.find(b => b.value === selectedMonth)?.label} {tahun}
                </h2>
                <p className="text-sm text-muted-foreground">Ringkasan transaksi</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full hover:bg-secondary flex items-center justify-center transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content - 2 Columns */}
            <div className="p-6 overflow-y-auto max-h-[70vh] flex-1">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* Left Column: Pemasukan */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-green-400 border-b border-border pb-2 flex items-center gap-2">
                    <TrendingUp size={16} /> Pemasukan
                  </h3>
                  {pemasukanTransactions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Tidak ada transaksi pemasukan</p>
                  ) : (
                    <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
                      {pemasukanTransactions.map((tx) => (
                        <div key={tx.id} className="bg-background rounded-lg p-3 border border-border/40">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-muted-foreground font-mono">
                              {formatDateTime(tx.created_at)}
                            </span>
                            <span className="text-sm font-bold text-green-400">
                              + {formatCurrency(tx.jumlah)}
                            </span>
                          </div>
                          <p className="text-sm text-foreground truncate">
                            {tx.keterangan || '-'}
                          </p>
                          {tx.category_nama && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {tx.category_nama}
                            </p>
                          )}
                          {tx.evidence_url && (
                            <button
                              onClick={() => setViewingEvidence(tx.evidence_url!.startsWith('http') ? tx.evidence_url : `${API_BASE_URL}${tx.evidence_url}`)}
                              className="flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                            >
                              <Eye size={12} />Lihat Bukti
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right Column: Pengeluaran */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-red-400 border-b border-border pb-2 flex items-center gap-2">
                    <TrendingDown size={16} /> Pengeluaran
                  </h3>
                  {pengeluaranTransactions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Tidak ada transaksi pengeluaran</p>
                  ) : (
                    <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
                      {pengeluaranTransactions.map((tx) => (
                        <div key={tx.id} className="bg-background rounded-lg p-3 border border-border/40">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-muted-foreground font-mono">
                              {formatDateTime(tx.created_at)}
                            </span>
                            <span className="text-sm font-bold text-red-400">
                              - {formatCurrency(tx.jumlah)}
                            </span>
                          </div>
                          <p className="text-sm text-foreground truncate">
                            {tx.keterangan || '-'}
                          </p>
                          {tx.category_nama && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {tx.category_nama}
                            </p>
                          )}
                          {tx.evidence_url && (
                            <button
                              onClick={() => setViewingEvidence(tx.evidence_url!.startsWith('http') ? tx.evidence_url : `${API_BASE_URL}${tx.evidence_url}`)}
                              className="flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                            >
                              <Eye size={12} />Lihat Bukti
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-4 border-t border-border bg-secondary/30">
              <div className="flex gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Total Saldo</p>
                  <p className="text-lg font-bold text-primary">{formatCurrency(totalSaldo)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Pemasukan</p>
                  <p className="text-lg font-bold text-green-400">{formatCurrency(totalPemasukan)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Pengeluaran</p>
                  <p className="text-lg font-bold text-red-400">{formatCurrency(totalPengeluaran)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Sisa Saldo</p>
                  <p className="text-lg font-bold text-white">
                    {formatCurrency(sisaSaldo)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Evidence Lightbox Modal */}
      {viewingEvidence && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4" 
          onClick={() => setViewingEvidence(null)}
        >
          <button 
            className="absolute top-4 right-4 p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
            onClick={() => setViewingEvidence(null)}
          >
            <X size={24} className="text-white" />
          </button>
          <img 
            src={viewingEvidence} 
            alt="Bukti Transaksi" 
            className="max-w-full max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
