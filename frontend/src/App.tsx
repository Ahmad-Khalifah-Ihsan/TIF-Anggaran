// Backup branch deployment trigger
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useState } from 'react';
import Login from './pages/Login';
import BudgetManagement from './pages/BudgetManagement';
import CategoryManagement from './pages/CategoryManagement';
import Settings from './pages/Settings';
import AccountInfo from './pages/AccountInfo';
import UserManagement from './pages/UserManagement';
import MonthlySummary from './pages/MonthlySummary';
import ChangePassword from './pages/ChangePassword';
import Sidebar from './components/Sidebar';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    return localStorage.getItem('sidebar_open') !== 'false';
  });

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100">
      {sidebarOpen && <Sidebar onClose={() => setSidebarOpen(false)} />}
      <main className="flex-1 bg-slate-900 p-4 md:p-6 relative">
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="fixed top-4 left-4 z-50 p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg shadow-lg"
          >
            ☰
          </button>
        )}
        {children}
      </main>
    </div>
  );
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();
  
  return (
    <Routes>
      <Route 
        path="/login" 
        element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} 
      />
      <Route 
        path="/" 
        element={
          <ProtectedRoute>
            <ProtectedLayout>
              <BudgetManagement />
            </ProtectedLayout>
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/categories" 
        element={
          <ProtectedRoute>
            <ProtectedLayout>
              <CategoryManagement />
            </ProtectedLayout>
          </ProtectedRoute>
        } 
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <ProtectedLayout>
              <Settings />
            </ProtectedLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/account"
        element={
          <ProtectedRoute>
            <ProtectedLayout>
              <AccountInfo />
            </ProtectedLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/users"
        element={
          <ProtectedRoute>
            <ProtectedLayout>
              <UserManagement />
            </ProtectedLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/monthly-summary"
        element={
          <ProtectedRoute>
            <ProtectedLayout>
              <MonthlySummary />
            </ProtectedLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/change-password"
        element={
          <ProtectedRoute>
            <ProtectedLayout>
              <ChangePassword />
            </ProtectedLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
