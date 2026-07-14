import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface SidebarProps {
  onClose?: () => void;
}

const Sidebar : React.FC<SidebarProps> = ({ onClose }) => {
    const location = useLocation();
    const {user, logout} = useAuth();

    const menuItems = [
        {path: "/", label: 'Dashboard Sisa Saldo', icon: '◆'},
        {path: "/categories", label: 'Saldo bulanan', icon: '☰'},
        {path: "/monthly-summary", label: 'Ringkasan Bulanan', icon: '📊'},
        { label: "Pengaturan", path: "/settings", icon: "⚙️" },
    ];

    return (
    <aside className="w-64 bg-slate-800 min-h-screen flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-700 flex justify-between items-center">
        <img 
          src="/Logo Solid-Infranexia-dengan Telkom Indonesia V2.png" 
          alt="InfraNexia Logo" 
          className="w-full max-w-[165px] h-auto object-contain" 
          style={{ filter: 'drop-shadow(0 0 10px rgba(255, 255, 255, 0.75))' }}
        />
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1"
        >
          ✕
        </button>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  location.pathname === item.path
                    ? 'bg-primary text-white'
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* User Account - Bottom Left */}
      <div className="p-4 border-t border-slate-700">
        <Link
          to="/settings/account"
          className="flex items-center gap-3 mb-3 p-2 -m-2 rounded-lg hover:bg-slate-700/50 transition-colors"
        >
          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-bold">
            {user?.username?.charAt(0).toUpperCase() || 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {user?.nama_lengkap || user?.username || 'Admin'}
            </p>
            <p className="text-xs text-slate-400 truncate cursor-pointer hover:text-primary transition-colors">
              {user?.username || 'admin'} - Lihat Akun
            </p>
          </div>
        </Link>
        <button
          onClick={logout}
          className="w-full px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors text-left"
        >
          🚪 Logout
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
