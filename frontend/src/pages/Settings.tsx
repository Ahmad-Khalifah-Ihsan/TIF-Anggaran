import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ChevronRight, Users } from 'lucide-react';

export default function Settings() {
  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <ShieldCheck className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pengaturan</h1>
          <p className="text-sm text-muted-foreground">Kelola informasi akun dan konfigurasi aplikasi.</p>
        </div>
      </div>

      <div className="space-y-4">
        <Link 
          to="/settings/account"
          className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/60 p-4 hover:bg-slate-800/50 transition-colors cursor-pointer"
        >
          <div>
            <p className="text-sm font-semibold text-white">Informasi Akun</p>
            <p className="text-xs text-slate-400">Nama pengguna, email, dan hak akses admin.</p>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </Link>

        <Link 
          to="/settings/users"
          className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/60 p-4 hover:bg-slate-800/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-semibold text-white">Kelola Akun</p>
              <p className="text-xs text-slate-400">Buat, verifikasi, dan hapus akun pengguna.</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </Link>
      </div>
    </div>
  );
}
