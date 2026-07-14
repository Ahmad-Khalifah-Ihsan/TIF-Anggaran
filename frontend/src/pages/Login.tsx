import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';
import { LogIn, Eye, EyeOff, Shield, UserPlus, CheckCircle } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  
  // Login states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Register states
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regNamaLengkap, setRegNamaLengkap] = useState('');
  const [regTelegramId, setRegTelegramId] = useState('');
  const [regSuccess, setRegSuccess] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(username, password);
    
    if (!result.success) {
      setError(result.message);
    }
    
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authApi.register({
        username: regUsername,
        password: regPassword,
        nama_lengkap: regNamaLengkap || undefined,
        telegram_id: regTelegramId || undefined,
      });
      setRegSuccess(true);
      // Reset form
      setRegUsername('');
      setRegPassword('');
      setRegNamaLengkap('');
      setRegTelegramId('');
    } catch (err: any) {
      setError(err.message || 'Gagal mendaftar');
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8 flex flex-col items-center">
          <img 
            src="/Logo Solid-Infranexia-dengan Telkom Indonesia V2.png" 
            alt="InfraNexia Logo" 
            className="w-full max-w-[350px] h-auto object-contain mb-4" 
            style={{ filter: 'drop-shadow(0 0 10px rgba(255, 255, 255, 0.75))' }}
          />
          <p className="text-slate-400 mt-1">Sistem Biaya Dinas</p>
        </div>

        {/* Login Card */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-xl">
          {/* Tab Switcher */}
          <div className="flex gap-2 mb-6 bg-slate-800/50 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => { setActiveTab('login'); setError(''); setRegSuccess(false); }}
              className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'login' 
                  ? 'bg-primary text-white' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LogIn className="w-4 h-4" />
              Masuk
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('register'); setError(''); setRegSuccess(false); }}
              className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'register' 
                  ? 'bg-primary text-white' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              Daftar
            </button>
          </div>

          {regSuccess ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 mb-4">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Pendaftaran Berhasil!</h3>
              <p className="text-slate-400 text-sm mb-6">
                Akun Anda sedang menunggu verifikasi oleh admin.<br />
                Silakan hubungi admin untuk mengaktifkan akun Anda.
              </p>
              <button
                onClick={() => { setActiveTab('login'); setRegSuccess(false); }}
                className="text-primary hover:text-primary/80 text-sm font-medium"
              >
                Kembali ke halaman login
              </button>
            </div>
          ) : activeTab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                  placeholder="Masukkan username"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-4 py-3 pr-12 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                    placeholder="Masukkan password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg font-medium bg-primary text-white hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>
                    Masuk...
                  </>
                ) : (
                  <>
                    <LogIn size={18} />
                    Masuk
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Username <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                  placeholder="Buat username"
                  required
                  minLength={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-4 py-3 pr-12 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                    placeholder="Buat password (min. 6 karakter)"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  value={regNamaLengkap}
                  onChange={(e) => setRegNamaLengkap(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                  placeholder="Nama lengkap (opsional)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Telegram ID
                </label>
                <input
                  type="text"
                  value={regTelegramId}
                  onChange={(e) => setRegTelegramId(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                  placeholder="ID Telegram (opsional)"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg font-medium bg-primary text-white hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>
                    Mendaftar...
                  </>
                ) : (
                  <>
                    <UserPlus size={18} />
                    Daftar
                  </>
                )}
              </button>
              
              <p className="text-xs text-slate-500 text-center">
                Akun akan memerlukan verifikasi dari admin sebelum dapat digunakan.
              </p>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          ©2024 INFRANEXIA BUDGETING. Hak cipta dilindungi.
        </p>
      </div>
    </div>
  );
}
