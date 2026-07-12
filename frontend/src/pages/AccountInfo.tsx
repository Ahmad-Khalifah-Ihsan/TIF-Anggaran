//Tes biar masuk Github
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Shield, Clock, Trash2, X, Key } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authApi, userManagementApi } from '../services/api';

export default function AccountInfo() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmResetText, setConfirmResetText] = useState('');
  const [resetError, setResetError] = useState('');

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleDeleteAccount = async () => {
    if (!confirm('Yakin ingin menghapus akun ini? Tindakan ini tidak dapat dibatalkan.')) return;
    
    setDeleting(true);
    try {
      await authApi.deleteAccount();
      logout();
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      navigate('/login');
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus akun');
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleResetDatabase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmResetText !== 'HAPUS DATABASE') {
      setResetError('Teks konfirmasi salah. Harap ketik "HAPUS DATABASE".');
      return;
    }
    
    setResetting(true);
    setResetError('');
    try {
      const res = await userManagementApi.resetDatabase();
      alert(res.message || 'Database berhasil direset.');
      setShowResetModal(false);
      setConfirmResetText('');
      navigate('/settings');
    } catch (err: any) {
      setResetError(err.message || 'Gagal mereset database');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link 
          to="/settings" 
          className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-slate-400" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Informasi Akun</h1>
          <p className="text-sm text-muted-foreground">Detail profil dan akses akun Anda.</p>
        </div>
      </div>

      {/* Profile Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
        {/* Avatar and Username */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center text-white text-3xl font-bold">
            {user?.username?.charAt(0).toUpperCase() || 'A'}
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">
              {user?.nama_lengkap || user?.username || 'Administrator'}
            </h2>
            <p className="text-sm text-slate-400">@{user?.username || 'admin'}</p>
          </div>
        </div>

        {/* Info Grid */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-900/50">
            <div className="p-2 bg-primary/20 rounded-lg">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-slate-400">Username</p>
              <p className="text-sm font-medium text-white">{user?.username || 'admin'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-900/50">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-slate-400">Role</p>
              <p className="text-sm font-medium text-white">Administrator</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-900/50">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-slate-400">Status Password</p>
              <p className="text-sm font-medium text-white">
                {user?.must_change_password ? (
                  <span className="text-yellow-400">Perlu diubah</span>
                ) : (
                  <span className="text-green-400">Aman</span>
                )}
              </p>
            </div>
          </div>

          {/* Ubah Password */}
          <div className="pt-6 border-t border-slate-800">
            <p className="text-xs text-slate-400 mb-3">Keamanan Akun</p>
            <button
              onClick={() => navigate('/change-password')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-500/20 transition-colors w-full sm:w-auto"
            >
              <Key size={18} />
              Ubah Password
            </button>
          </div>

          {/* Danger Zone */}
          <div className="mt-6 pt-6 border-t border-slate-800">
            <p className="text-xs text-slate-400 mb-3">Zona Berbahaya</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setShowDeleteModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-colors w-full sm:w-auto"
              >
                <Trash2 size={18} />
                Hapus Akun
              </button>

              {user?.role === 'admin' && (
                <button
                  onClick={() => setShowResetModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600/10 text-red-400 border border-red-600/30 rounded-lg hover:bg-red-600/20 transition-colors w-full sm:w-auto font-medium"
                >
                  <Trash2 size={18} />
                  Hapus Seluruh Database
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">Hapus Akun</h2>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
              <p className="text-red-400 text-sm">
                <strong>Peringatan:</strong> Menghapus akun akan menghilangkan semua data yang terkait. Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-3 rounded-lg font-medium border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="flex-1 py-3 rounded-lg font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                {deleting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>
                    Menghapus...
                  </>
                ) : (
                  <>
                    <Trash2 size={18} />
                    Hapus Akun
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Database Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">Hapus Seluruh Database</h2>
              <button
                onClick={() => {
                  setShowResetModal(false);
                  setConfirmResetText('');
                  setResetError('');
                }}
                className="text-slate-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
              <p className="text-red-400 text-sm leading-relaxed">
                <strong>PERINGATAN SANGAT KRITIS:</strong> Tindakan ini akan menghapus permanen seluruh riwayat transaksi, ringkasan bulanan, file bukti transaksi di storage, dan menyetel ulang saldo awal semua kategori menjadi Rp 0.
              </p>
              <p className="text-red-400 text-sm mt-2 font-bold animate-pulse">
                Tindakan ini TIDAK DAPAT DIBATALKAN atau DIKEMBALIKAN.
              </p>
            </div>

            <form onSubmit={handleResetDatabase} className="space-y-4">
              {resetError && (
                <div className="bg-red-500/20 text-red-400 text-sm p-3 rounded-lg flex items-center gap-2">
                  <X size={16} className="flex-shrink-0" />
                  <span>{resetError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs text-slate-400 mb-2">
                  Ketik <strong className="text-white">HAPUS DATABASE</strong> untuk mengonfirmasi:
                </label>
                <input
                  type="text"
                  required
                  placeholder="HAPUS DATABASE"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500 font-mono text-center tracking-wider"
                  value={confirmResetText}
                  onChange={(e) => setConfirmResetText(e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetModal(false);
                    setConfirmResetText('');
                    setResetError('');
                  }}
                  className="flex-1 py-3 rounded-lg font-medium border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors text-sm"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={resetting || confirmResetText !== 'HAPUS DATABASE'}
                  className="flex-1 py-3 rounded-lg font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-30 disabled:hover:bg-red-600 flex items-center justify-center gap-2 transition-colors text-sm"
                >
                  {resetting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>
                      Mereset...
                    </>
                  ) : (
                    <>
                      <Trash2 size={18} />
                      Ya, Hapus Semua
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
