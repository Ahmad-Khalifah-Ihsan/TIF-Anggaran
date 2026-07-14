import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { budgetManagementApi } from '../services/api';
import { jsPDF } from 'jspdf';
import { 
  Wallet, 
  Plus, 
  Eye, 
  X, 
  TrendingUp, 
  TrendingDown, 
  Upload, 
  CheckCircle, 
  Settings, 
  Save, 
  History as HistoryIcon, 
  Filter, 
  Trash2, 
  Download, 
  Square, 
  CheckSquare, 
  LogOut, 
  Calendar,
  Clock
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

interface BudgetSummary {
  category_id: string;
  category_nama: string;
  category_kode: string;
  saldo_awal: number;
  total_masuk: number;
  total_keluar: number;
  saldo: number;
}

interface Transaction {
  id: string;
  category_id: string;
  tipe: 'masuk' | 'keluar';
  jumlah: number;
  keterangan: string | null;
  evidence_url: string | null;
  evidence_filename: string | null;
  created_at: string;
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

const compressImageFrontend = (file: File, maxWidth = 1200, maxHeight = 1200, quality = 0.7): Promise<File> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      resolve(file); // Return as is if it's not an image (like a PDF)
      return;
    }
    
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Calculate new dimensions keeping aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
};

export default function BudgetManagement() {
  const { user, logout } = useAuth();
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [summary, setSummary] = useState<BudgetSummary[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<BudgetCategory | null>(null);
  const [viewingEvidence, setViewingEvidence] = useState<string | null>(null);
  const [evidenceBlobUrl, setEvidenceBlobUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'transaksi' | 'riwayat'>('transaksi');
  
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterBulan, setFilterBulan] = useState<number>(new Date().getMonth() + 1);
  const [filterTahun, setFilterTahun] = useState(new Date().getFullYear());
  
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  
  const [formData, setFormData] = useState({
    tipe: 'keluar' as 'masuk' | 'keluar',
    tanggal: '',
    jam: '',
    jumlah: '',
    keterangan: '',
    evidence: null as File | null
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchData();
  }, [filterBulan, filterTahun]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [categoriesRes, summaryRes, recordsRes] = await Promise.all([
        budgetManagementApi.getCategories(),
        budgetManagementApi.getSummary(filterBulan, filterTahun),
        budgetManagementApi.getRecords()
      ]);
      
      if (categoriesRes.status === 'success') setCategories(categoriesRes.data);
      if (summaryRes.status === 'success') setSummary(summaryRes.data);
      if (recordsRes.status === 'success') setTransactions(recordsRes.data);
    } catch (err: any) {
      console.error('Error fetching budget data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getCategorySummary = (categoryId: string) => {
    return summary.find(s => s.category_id === categoryId) || {
      category_id: categoryId,
      category_nama: '',
      category_kode: '',
      saldo_awal: 0,
      total_masuk: 0,
      total_keluar: 0,
      saldo: 0
    };
  };

  const getCategoryTransactions = (categoryId: string) => {
    let filtered = transactions.filter(t => t.category_id === categoryId);
    if (filterStartDate) {
      filtered = filtered.filter(t => new Date(t.created_at) >= new Date(filterStartDate));
    }
    if (filterEndDate) {
      filtered = filtered.filter(t => new Date(t.created_at) <= new Date(filterEndDate + 'T23:59:59'));
    }
    if (filterBulan !== null) {
      filtered = filtered.filter(t => {
        const date = new Date(t.created_at);
        return date.getMonth() + 1 === filterBulan && date.getFullYear() === filterTahun;
      });
    }
    return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  };

  const getCategoryPeriodTotals = (categoryId: string) => {
    const txns = getCategoryTransactions(categoryId);
    const totalMasuk = txns.filter(t => t.tipe === 'masuk').reduce((sum, t) => sum + t.jumlah, 0);
    const totalKeluar = txns.filter(t => t.tipe === 'keluar').reduce((sum, t) => sum + t.jumlah, 0);
    return { total_masuk: totalMasuk, total_keluar: totalKeluar };
  };

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
  };

  const formatNumberInput = (value: string) => {
    const number = value.replace(/\D/g, '');
    return number.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const formatTanggalInput = (value: string) => {
    // Auto-format: DD/MM/YYYY
    const numbers = value.replace(/\D/g, '');
    
    let dd = numbers.slice(0, 2);
    let mm = numbers.slice(2, 4);
    let yyyy = numbers.slice(4, 8);
    
    if (dd && parseInt(dd) > 31) {
      dd = '31';
    }
    if (mm && parseInt(mm) > 12) {
      mm = '12';
    }
    
    if (numbers.length <= 2) {
      return dd;
    }
    if (numbers.length <= 4) {
      return `${dd}/${mm}`;
    }
    return `${dd}/${mm}/${yyyy}`;
  };

  const formatJamInput = (value: string) => {
    // Auto-format: HH:MM
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    return `${numbers.slice(0, 2)}:${numbers.slice(2, 4)}`;
  };

  const parseFormattedNumber = (value: string) => {
    return parseInt(value.replace(/\./g, '')) || 0;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const handleOpenDetail = (category: BudgetCategory) => {
    setSelectedCategory(category);
    setActiveTab('transaksi');
    // Set default tanggal to today
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const hours = String(today.getHours()).padStart(2, '0');
    const minutes = String(today.getMinutes()).padStart(2, '0');
    setFormData({ 
      tipe: 'keluar', 
      tanggal: `${yyyy}-${mm}-${dd}`, 
      jam: `${hours}:${minutes}`, 
      jumlah: '', 
      keterangan: '', 
      evidence: null 
    });
    setFilterStartDate('');
    setFilterEndDate('');
    setSelectedTransactions(new Set());
    setSelectAll(false);
    setError('');
    setSuccess('');
    setShowModal(true);
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    const jumlah = parseFormattedNumber(formData.jumlah);
    if (!formData.jumlah || jumlah <= 0) {
      setError('Jumlah harus diisi dan lebih dari 0');
      return;
    }
    if (formData.tipe === 'keluar' && !formData.evidence) {
      setError('Bukti transaksi (evidence) wajib diupload untuk pengeluaran');
      return;
    }

    // Validate date correctness
    if (formData.tanggal) {
      const dateParts = formData.tanggal.split('-');
      if (dateParts.length === 3) {
        const y = parseInt(dateParts[0]);
        const m = parseInt(dateParts[1]);
        const d = parseInt(dateParts[2]);
        
        if (isNaN(d) || isNaN(m) || isNaN(y) || m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) {
          setError('Tanggal tidak valid');
          return;
        }
      } else {
        setError('Format tanggal tidak valid');
        return;
      }
    }

    // Validate time correctness
    if (formData.jam) {
      const jamParts = formData.jam.split(':');
      if (jamParts.length === 2) {
        const hh = parseInt(jamParts[0]);
        const mm = parseInt(jamParts[1]);
        if (isNaN(hh) || isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
          setError('Format jam tidak valid (00:00 - 23:59)');
          return;
        }
      } else {
        setError('Format jam harus HH:MM');
        return;
      }
    }

    try {
      setSubmitting(true);
      const formPayload = new FormData();
      formPayload.append('category_id', selectedCategory!.id);
      formPayload.append('tipe', formData.tipe);
      formPayload.append('jumlah', jumlah.toString());
      formPayload.append('keterangan', formData.keterangan || '');
      if (formData.tanggal) {
        const parts = formData.tanggal.split('-');
        if (parts.length === 3) {
          formPayload.append('tanggal', `${parts[2]}/${parts[1]}/${parts[0]}`); // Convert to DD/MM/YYYY for backend
        }
      }
      if (formData.jam) {
        formPayload.append('jam', formData.jam);
      }
      if (formData.evidence) {
        // Compress image in frontend before upload
        const compressedEvidence = await compressImageFrontend(formData.evidence);
        formPayload.append('evidence', compressedEvidence);
      }
      await budgetManagementApi.createRecord(formPayload);
      setSuccess('Transaksi berhasil disimpan!');
      // Reset with today's date
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const yyyy = today.getFullYear();
      const hours = String(today.getHours()).padStart(2, '0');
      const minutes = String(today.getMinutes()).padStart(2, '0');
      setFormData({ 
        tipe: 'keluar', 
        tanggal: `${yyyy}-${mm}-${dd}`, 
        jam: `${hours}:${minutes}`, 
        jumlah: '', 
        keterangan: '', 
        evidence: null 
      });
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan');
    } finally {
      setSubmitting(false);
    }
  };



  const handleDeleteTransaction = async (transactionId: string) => {
    if (!confirm('Yakin hapus transaksi ini?')) return;
    try {
      setSubmitting(true);
      await budgetManagementApi.deleteRecord(transactionId);
      setSuccess('Transaksi berhasil dihapus!');
      fetchData();
      setSelectedTransactions(prev => {
        const newSet = new Set(prev);
        newSet.delete(transactionId);
        return newSet;
      });
    } catch (err: any) {
      setError(err.message || 'Gagal hapus transaksi');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedTransactions.size === 0) return;
    if (!confirm(`Yakin hapus ${selectedTransactions.size} transaksi?`)) return;
    try {
      setSubmitting(true);
      for (const id of selectedTransactions) {
        await budgetManagementApi.deleteRecord(id);
      }
      setSuccess(`${selectedTransactions.size} transaksi berhasil dihapus!`);
      setSelectedTransactions(new Set());
      setSelectAll(false);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Gagal hapus transaksi');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleTransactionSelection = (transactionId: string) => {
    setSelectedTransactions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(transactionId)) newSet.delete(transactionId);
      else newSet.add(transactionId);
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedTransactions(new Set());
    } else {
      const allIds = getCategoryTransactions(selectedCategory?.id || '').map(t => t.id);
      setSelectedTransactions(new Set(allIds));
    }
    setSelectAll(!selectAll);
  };

  const handleViewEvidence = async (url: string) => {
    if (!url.startsWith('http') || url.includes('ngrok-free.dev') || url.includes('124.156.204.209')) {
      try {
        const response = await fetch(url, {
          headers: {
            'ngrok-skip-browser-warning': 'true'
          }
        });
        if (response.ok) {
          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);
          setEvidenceBlobUrl(blobUrl);
          setViewingEvidence(blobUrl);
          return;
        }
      } catch (e) {
        console.error("Failed to fetch evidence blob:", e);
      }
    }
    setViewingEvidence(url);
  };

  const handleCloseEvidence = () => {
    if (evidenceBlobUrl) {
      URL.revokeObjectURL(evidenceBlobUrl);
      setEvidenceBlobUrl(null);
    }
    setViewingEvidence(null);
  };

  const loadImageToBase64 = async (src: string): Promise<string | null> => {
    try {
      const response = await fetch(src, {
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      });
      if (!response.ok) return null;
      const blob = await response.blob();
      
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error("Failed to load image to base64:", e);
      return null;
    }
  };

  const generateTransactionBlock = async (doc: jsPDF, transaction: Transaction, category: BudgetCategory, startY: number) => {
    const catSummary = getCategorySummary(category.id);
    const allTxns = getCategoryTransactions(category.id).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    let saldoAwal = catSummary.saldo_awal || 0;
    for (const t of allTxns) {
      if (t.id === transaction.id) break;
      if (t.tipe === 'masuk') saldoAwal -= t.jumlah;
      else saldoAwal += t.jumlah;
    }
    const saldoSisa = transaction.tipe === 'masuk' ? saldoAwal + transaction.jumlah : saldoAwal - transaction.jumlah;
    const warna = transaction.tipe === 'masuk' ? [34, 197, 94] : [220, 38, 38];
    let y = startY;

    doc.setFillColor(15, 23, 42);
    doc.rect(15, y, 180, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`${category.kode}`, 20, y + 5.5);
    doc.setFontSize(9);
    doc.text(formatDate(transaction.created_at), 190, y + 5.5, { align: 'right' });
    y += 11;

    doc.setFillColor(248, 250, 252);
    doc.rect(15, y, 180, 55, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(15, y, 180, 55, 'S');

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Kategori', 20, y + 7);
    doc.setFont('helvetica', 'normal');
    doc.text(category.nama, 60, y + 7);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Tipe', 20, y + 14);
    doc.setTextColor(warna[0], warna[1], warna[2]);
    doc.text(transaction.tipe === 'masuk' ? 'PEMASUKAN' : 'PENGELUARAN', 60, y + 14);
    
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('Saldo Awal', 105, y + 7);
    doc.setFont('helvetica', 'normal');
    doc.text(formatCurrency(saldoAwal), 145, y + 7);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Jumlah', 105, y + 14);
    doc.setTextColor(warna[0], warna[1], warna[2]);
    doc.text(`${transaction.tipe === 'masuk' ? '+' : '-'} ${formatCurrency(transaction.jumlah)}`, 145, y + 14);
    
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('Keterangan', 20, y + 28);
    doc.setFont('helvetica', 'normal');
    doc.text(transaction.keterangan || '-', 60, y + 28);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Saldo Sisa', 20, y + 42);
    doc.setTextColor(34, 197, 94);
    doc.text(formatCurrency(saldoSisa), 60, y + 42);
    
    y += 58;

    if (transaction.evidence_url) {
      const imgSrc = transaction.evidence_url.startsWith('http') ? transaction.evidence_url : `${API_BASE_URL}${transaction.evidence_url}`;
      const imgBase64 = await loadImageToBase64(imgSrc);
      if (imgBase64) {
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('BUKTI TRANSAKSI:', 20, y + 3);
        y += 6;
        try {
          const props = doc.getImageProperties(imgBase64);
          const maxW = 170;
          const maxH = 70;
          let iw = props.width;
          let ih = props.height;
          if (iw > maxW) { ih = (ih / iw) * maxW; iw = maxW; }
          if (ih > maxH) { iw = (iw / ih) * maxH; ih = maxH; }
          const xOff = (210 - iw) / 2;
          doc.addImage(imgBase64, 'JPEG', xOff, y, iw, ih);
          y += ih + 3;
        } catch {
          doc.setTextColor(150, 150, 150);
          doc.text('[Gagal memuat gambar]', 105, y + 5, { align: 'center' });
          y += 10;
        }
      }
    }
    
    y += 5;
    doc.setDrawColor(200, 200, 200);
    doc.line(20, y, 190, y);
    y += 8;
    
    return y;
  };

  const handleDownloadEvidence = async (transaction: Transaction, category: BudgetCategory) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('INFRANEXIA BUDGETING', 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text('Bukti Transaksi Anggaran', 105, 27, { align: 'center' });
    doc.setLineWidth(0.5);
    doc.line(20, 32, 190, 32);
    
    const y = await generateTransactionBlock(doc, transaction, category, 38);
    
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Dicetak: ${new Date().toLocaleString('id-ID')}`, 105, 285, { align: 'center' });
    
    const filename = `Bukti_${category.kode}_${new Date(transaction.created_at).toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
  };

  const handleDownloadSelected = async () => {
    if (selectedTransactions.size === 0) return;
    const selectedTxns = transactions.filter(t => selectedTransactions.has(t.id));
    if (selectedTxns.length === 0 || !selectedCategory) {
      alert('Tidak ada transaksi untuk didownload');
      return;
    }

    const sortedTxns = [...selectedTxns].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('INFRANEXIA BUDGETING', 105, 15, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`Bukti Transaksi - ${selectedCategory.kode}`, 105, 22, { align: 'center' });
    doc.setFontSize(9);
    doc.text(new Date().toLocaleDateString('id-ID'), 105, 28, { align: 'center' });
    doc.setLineWidth(0.3);
    doc.line(20, 32, 190, 32);
    
    let y = 38;
    const pageH = 280;

    for (const txn of sortedTxns) {
      if (y > pageH - 120) {
        doc.addPage();
        y = 20;
      }
      y = await generateTransactionBlock(doc, txn, selectedCategory, y);
    }

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`INFRANEXIA BUDGETING - ${sortedTxns.length} transaksi`, 105, 285, { align: 'center' });

    const filename = `Bukti_${selectedCategory.kode}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
  };

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
            <Wallet className="text-primary" size={28} />
            Dashboard Sisa Saldo
          </h1>
          <p className="text-muted-foreground">{categories.length} Mata Anggaran - Pencatatan anggaran</p>
        </div>
        <button onClick={logout} className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors">
          <LogOut size={18} />
          Keluar
        </button>
      </div>




      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {categories.filter(c => c.is_active !== false).map((category) => {
          const catSummary = getCategorySummary(category.id);
          const sisa = (catSummary.saldo_awal || 0) + catSummary.total_masuk - catSummary.total_keluar;
          
          return (
            <div key={category.id} className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 hover:shadow-lg transition-all" onClick={() => handleOpenDetail(category)}>
              <div className="p-4 border-b border-border bg-gradient-to-r from-primary/10 to-transparent">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono bg-primary/20 text-primary px-2 py-0.5 rounded">{category.kode}</span>
                </div>
                <h3 className="font-semibold text-sm line-clamp-2 cursor-pointer" title={category.nama}>{category.nama}</h3>
              </div>
              <div className="p-4 space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Saldo Awal</span>
                  <span className="font-medium">{formatCurrency(catSummary.saldo_awal || 0)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-green-400 flex items-center gap-1"><TrendingUp size={12} /> Masuk</span>
                  <span className="font-medium text-green-400">+{formatCurrency(catSummary.total_masuk)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-red-400 flex items-center gap-1"><TrendingDown size={12} /> Keluar</span>
                  <span className="font-medium text-red-400">-{formatCurrency(catSummary.total_keluar)}</span>
                </div>
                <div className="border-t border-border"></div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-sm">Sisa</span>
                  <span className={`font-bold text-lg ${sisa >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(sisa)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showModal && selectedCategory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-card rounded-xl w-full max-w-4xl border border-border max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <h3 className="font-semibold text-lg">{selectedCategory.nama}</h3>
                <p className="text-xs text-muted-foreground">{selectedCategory.kode}</p>
              </div>
              <button onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            
            {(() => {
              const catSummary = getCategorySummary(selectedCategory.id);
              const sisa = (catSummary.saldo_awal || 0) + catSummary.total_masuk - catSummary.total_keluar;
              return (
                <div className="grid grid-cols-4 gap-2 p-4 bg-secondary/30 border-b border-border">
                  <div className="text-center"><p className="text-xs text-muted-foreground">Saldo Awal</p><p className="font-semibold text-sm">{formatCurrency(catSummary.saldo_awal || 0)}</p></div>
                  <div className="text-center"><p className="text-xs text-green-400">Total Masuk</p><p className="font-semibold text-sm text-green-400">+{formatCurrency(catSummary.total_masuk)}</p></div>
                  <div className="text-center"><p className="text-xs text-red-400">Total Keluar</p><p className="font-semibold text-sm text-red-400">-{formatCurrency(catSummary.total_keluar)}</p></div>
                  <div className="text-center"><p className={`text-xs ${sisa >= 0 ? 'text-green-400' : 'text-red-400'}`}>Sisa</p><p className={`font-bold text-lg ${sisa >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(sisa)}</p></div>
                </div>
              );
            })()}
            
            <div className="flex border-b border-border">
              <button onClick={() => setActiveTab('transaksi')} className={`flex-1 py-3 flex items-center justify-center gap-2 font-medium transition-colors ${activeTab === 'transaksi' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                <Plus size={18} />Tambah Transaksi
              </button>
              <button onClick={() => setActiveTab('riwayat')} className={`flex-1 py-3 flex items-center justify-center gap-2 font-medium transition-colors ${activeTab === 'riwayat' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                <HistoryIcon size={18} />Riwayat Transaksi
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              {activeTab === 'transaksi' && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && <div className="bg-red-500/20 text-red-400 text-sm p-3 rounded-lg flex items-center gap-2"><X size={16} />{error}</div>}
                  {success && <div className="bg-green-500/20 text-green-400 text-sm p-3 rounded-lg flex items-center gap-2"><CheckCircle size={16} />{success}</div>}

                  <div>
                    <label className="block text-sm font-medium mb-2">Tipe Transaksi</label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setFormData({...formData, tipe: 'masuk'})} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-colors ${formData.tipe === 'masuk' ? 'bg-green-500/20 text-green-400 border-2 border-green-500' : 'bg-background border border-border hover:border-green-500/50'}`}>
                        <TrendingUp size={18} />Pemasukan
                      </button>
                      <button type="button" onClick={() => setFormData({...formData, tipe: 'keluar'})} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-colors ${formData.tipe === 'keluar' ? 'bg-red-500/20 text-red-400 border-2 border-red-500' : 'bg-background border border-border hover:border-red-500/50'}`}>
                        <TrendingDown size={18} />Pengeluaran
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        <Calendar size={14} className="inline mr-1" />
                        Tanggal Transaksi
                      </label>
                      <input
                        type="date"
                        className="w-full bg-background border border-border rounded-lg px-4 py-3 font-mono text-foreground cursor-pointer"
                        style={{ colorScheme: 'dark' }}
                        value={formData.tanggal}
                        onChange={(e) => setFormData({...formData, tanggal: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        <Clock size={14} className="inline mr-1" />
                        Jam Transaksi (Opsional)
                      </label>
                      <input
                        type="time"
                        className="w-full bg-background border border-border rounded-lg px-4 py-3 font-mono text-foreground cursor-pointer"
                        style={{ colorScheme: 'dark' }}
                        value={formData.jam}
                        onChange={(e) => setFormData({...formData, jam: e.target.value})}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Nominal (Rp)</label>
                    <input
                      type="text"
                      className="w-full bg-background border border-border rounded-lg px-4 py-3 text-lg font-mono"
                      placeholder="0"
                      value={formData.jumlah}
                      onChange={(e) => setFormData({...formData, jumlah: formatNumberInput(e.target.value)})}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Keterangan</label>
                    <textarea className="w-full bg-background border border-border rounded-lg px-4 py-3" rows={3} placeholder="Opsional" value={formData.keterangan} onChange={(e) => setFormData({...formData, keterangan: e.target.value})} />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      {formData.tipe === 'keluar' ? (
                        <><span className="text-red-400">*</span> Upload Bukti (Wajib)</>
                      ) : (
                        <>Upload Bukti (Opsional)</>
                      )}
                    </label>
                    <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                      <input type="file" accept="image/*" className="hidden" id="evidence-upload" onChange={(e) => setFormData({...formData, evidence: e.target.files?.[0] || null})} />
                      <label htmlFor="evidence-upload" className="cursor-pointer">
                        {formData.evidence ? (
                          <div className="flex items-center justify-center gap-2 text-green-400"><CheckCircle size={24} /><span className="font-medium">{formData.evidence.name}</span></div>
                        ) : (
                          <><Upload size={32} className="mx-auto text-muted-foreground mb-2" /><p className="text-muted-foreground">Klik untuk upload evidence</p><p className="text-xs text-muted-foreground mt-1">JPG, PNG</p></>
                        )}
                      </label>
                    </div>
                  </div>

                  <button type="submit" disabled={submitting} className="w-full py-3 rounded-lg font-medium bg-primary text-white disabled:opacity-50 flex items-center justify-center gap-2">
                    {submitting ? <><div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>Menyimpan...</> : <><Save size={18} />Simpan Transaksi</>}
                  </button>
                </form>
              )}

              {activeTab === 'riwayat' && (
                <div className="space-y-4">
                  <div className="bg-secondary/30 rounded-lg p-4 border border-border">
                    <div className="flex items-center gap-2 mb-3"><Filter size={16} className="text-primary" /><span className="font-medium text-sm">Filter Tanggal</span></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-black mb-1">Dari Tanggal</label>
                        <input type="date" className="w-full bg-white text-gray-800 border-2 border-primary/40 rounded-lg px-3 py-2 text-sm" style={{ colorScheme: 'light' }} value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs text-black mb-1">Sampai Tanggal</label>
                        <input type="date" className="w-full bg-white text-gray-800 border-2 border-primary/40 rounded-lg px-3 py-2 text-sm" style={{ colorScheme: 'light' }} value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} />
                      </div>
                    </div>
                    {(filterStartDate || filterEndDate) && <button onClick={() => { setFilterStartDate(''); setFilterEndDate(''); }} className="mt-2 text-xs text-primary hover:underline">Reset Filter</button>}
                  </div>

                  {selectedTransactions.size > 0 && (
                    <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 flex items-center justify-between">
                      <span className="text-sm text-primary font-medium">{selectedTransactions.size} dipilih</span>
                      <div className="flex gap-2">
                        <button onClick={handleDownloadSelected} className="flex items-center gap-1 px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-sm hover:bg-green-500/30"><Download size={14} />Download</button>
                        <button onClick={handleDeleteSelected} className="flex items-center gap-1 px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/30"><Trash2 size={14} />Hapus</button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <button onClick={toggleSelectAll} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                      {selectAll ? <CheckSquare size={16} className="text-primary" /> : <Square size={16} />}Pilih Semua
                    </button>
                  </div>

                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {getCategoryTransactions(selectedCategory.id).length === 0 ? (
                      <div className="text-center py-8"><HistoryIcon size={40} className="mx-auto text-muted-foreground mb-2" /><p className="text-muted-foreground">Belum ada transaksi</p></div>
                    ) : (
                      getCategoryTransactions(selectedCategory.id).map((t) => (
                        <div key={t.id} className={`flex items-start gap-3 p-3 bg-secondary/20 rounded-lg border transition-colors ${selectedTransactions.has(t.id) ? 'border-primary bg-primary/5' : 'border-border'}`}>
                          <button onClick={() => toggleTransactionSelection(t.id)} className="mt-1 flex-shrink-0">{selectedTransactions.has(t.id) ? <CheckSquare size={18} className="text-primary" /> : <Square size={18} className="text-muted-foreground" />}</button>
                          <div className={`p-2 rounded-lg flex-shrink-0 ${t.tipe === 'masuk' ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                            {t.tipe === 'masuk' ? <TrendingUp size={18} className="text-green-400" /> : <TrendingDown size={18} className="text-red-400" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                              <p className={`font-bold ${t.tipe === 'masuk' ? 'text-green-400' : 'text-red-400'}`}>{t.tipe === 'masuk' ? '+' : '-'} {formatCurrency(t.jumlah)}</p>
                              <span className="text-xs text-muted-foreground">{formatDate(t.created_at)}</span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{t.keterangan || '-'}</p>
                            <div className="flex items-center gap-2 mt-2">
                              {t.evidence_url && (
                                <>
                                  <button onClick={() => handleViewEvidence(t.evidence_url!.startsWith('http') ? t.evidence_url : `${API_BASE_URL}${t.evidence_url}`)} className="flex items-center gap-1 text-xs text-primary hover:underline"><Eye size={12} />Lihat Bukti</button>
                                  <button onClick={() => selectedCategory && handleDownloadEvidence(t, selectedCategory)} className="flex items-center gap-1 text-xs text-green-400 hover:underline"><Download size={12} />Download</button>
                                </>
                              )}
                              <button onClick={() => handleDeleteTransaction(t.id)} className="flex items-center gap-1 text-xs text-red-400 hover:underline"><Trash2 size={12} />Hapus</button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}



      {viewingEvidence && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4" onClick={handleCloseEvidence}>
          <button className="absolute top-4 right-4 p-2 bg-white/20 rounded-full hover:bg-white/30" onClick={handleCloseEvidence}><X size={24} className="text-white" /></button>
          <img src={viewingEvidence} alt="Evidence" className="max-w-full max-h-[90vh] object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
