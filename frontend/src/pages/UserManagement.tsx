import { useState, useEffect } from 'react';
import { UserPlus, Users, Trash2, CheckCircle, XCircle, Clock, RefreshCw, X, Shield, ShieldOff } from 'lucide-react';
import { userManagementApi } from '../services/api';

interface User {
  id: string;
  username: string;
  nama_lengkap: string | null;
  telegram_id: string | null;
  status: 'pending' | 'active' | 'rejected';
  role: 'admin' | 'user';
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newNamaLengkap, setNewNamaLengkap] = useState('');
  const [newTelegramId, setNewTelegramId] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await userManagementApi.getUsers();
      setUsers(response.data || []);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Gagal mengambil data user');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');

    try {
      await userManagementApi.createUser({
        username: newUsername,
        password: newPassword,
        nama_lengkap: newNamaLengkap || undefined,
        telegram_id: newTelegramId || undefined,
      });
      setSuccess('Akun berhasil dibuat');
      setShowCreateModal(false);
      setNewUsername('');
      setNewPassword('');
      setNewNamaLengkap('');
      setNewTelegramId('');
      fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Gagal membuat akun');
    } finally {
      setCreating(false);
    }
  };

  const handleApproveUser = async (userId: string) => {
    try {
      await userManagementApi.updateUserStatus(userId, 'active');
      setSuccess('User berhasil diaktifkan');
      fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Gagal mengaktifkan user');
    }
  };

  const handleRejectUser = async (userId: string) => {
    try {
      await userManagementApi.updateUserStatus(userId, 'rejected');
      setSuccess('User berhasil ditolak');
      fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Gagal menolak user');
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!confirm(`Yakin ingin menghapus user "${username}"?`)) return;
    
    try {
      await userManagementApi.deleteUser(userId);
      setSuccess('User berhasil dihapus');
      fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Gagal menghapus user');
    }
  };

  const handleToggleRole = async (userId: string, username: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    const action = newRole === 'admin' ? 'menaikan' : 'menurunkan';
    
    if (!confirm(`Yakin ingin ${action} "${username}" menjadi ${newRole}?`)) return;
    
    try {
      await userManagementApi.updateUserRole(userId, newRole as 'admin' | 'user');
      setSuccess(`User "${username}" berhasil di${action} menjadi ${newRole}`);
      fetchUsers();
    } catch (err: any) {
      setError(err.message || `Gagal mengubah role user`);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
            <CheckCircle size={12} />
            Aktif
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-medium">
            <Clock size={12} />
            Pending
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-medium">
            <XCircle size={12} />
            Ditolak
          </span>
        );
      default:
        return null;
    }
  };

  const pendingCount = users.filter(u => u.status === 'pending').length;

  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/20 rounded-lg">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Kelola Akun</h1>
            <p className="text-sm text-muted-foreground">Kelola semua akun pengguna sistem</p>
          </div>
        </div>
        
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <UserPlus size={18} />
          Buat Akun
        </button>
      </div>

      {error && (
        <div className="bg-red-500/20 text-red-400 text-sm p-3 rounded-lg border border-red-500/30 mb-4 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="hover:text-red-300">
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-500/20 text-green-400 text-sm p-3 rounded-lg border border-green-500/30 mb-4 flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="hover:text-green-300">
            <X size={16} />
          </button>
        </div>
      )}

      {pendingCount > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 text-yellow-400">
            <Clock size={18} />
            <span className="font-medium">Ada {pendingCount} user yang menunggu verifikasi</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Username</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Nama Lengkap</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Status</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Role</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Tanggal Dibuat</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">
                    Belum ada user
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center text-primary font-medium">
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-white font-medium">{user.username}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {user.nama_lengkap || '-'}
                    </td>
                    <td className="py-3 px-4">
                      {getStatusBadge(user.status)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        user.role === 'admin' 
                          ? 'bg-purple-500/20 text-purple-400' 
                          : 'bg-slate-500/20 text-slate-400'
                      }`}>
                        {user.role === 'admin' ? (
                          <><Shield size={12} />Admin</>
                        ) : (
                          <><ShieldOff size={12} />User</>
                        )}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-sm">
                      {new Date(user.created_at).toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        {user.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApproveUser(user.id)}
                              className="p-2 text-green-400 hover:bg-green-500/20 rounded-lg transition-colors"
                              title="Approve"
                            >
                              <CheckCircle size={18} />
                            </button>
                            <button
                              onClick={() => handleRejectUser(user.id)}
                              className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                              title="Reject"
                            >
                              <XCircle size={18} />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleToggleRole(user.id, user.username, user.role)}
                          className={`p-2 rounded-lg transition-colors ${
                            user.role === 'admin' 
                              ? 'text-yellow-400 hover:bg-yellow-500/20' 
                              : 'text-purple-400 hover:bg-purple-500/20'
                          }`}
                          title={user.role === 'admin' ? 'Turunkan ke User' : 'Naikkan ke Admin'}
                        >
                          {user.role === 'admin' ? <ShieldOff size={18} /> : <Shield size={18} />}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id, user.username)}
                          className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                          title="Hapus"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Buat Akun Baru</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              {error && (
                <div className="bg-red-500/20 text-red-400 text-sm p-3 rounded-lg">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Username <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  placeholder="Username"
                  required
                  minLength={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  placeholder="Password (min. 6 karakter)"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  value={newNamaLengkap}
                  onChange={(e) => setNewNamaLengkap(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  placeholder="Nama lengkap (opsional)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Telegram ID
                </label>
                <input
                  type="text"
                  value={newTelegramId}
                  onChange={(e) => setNewTelegramId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  placeholder="ID Telegram (opsional)"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 rounded-lg font-medium border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-3 rounded-lg font-medium bg-primary text-white hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                >
                  {creating ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>
                      Membuat...
                    </>
                  ) : (
                    <>
                      <UserPlus size={18} />
                      Buat Akun
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
