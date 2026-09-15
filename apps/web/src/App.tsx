import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ProtectedRoute } from './components/ProtectedRoute';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { AccountPage } from './pages/AccountPage';

// Mapa (leaflet) e relatórios (recharts) são as duas dependências mais pesadas
// e ficam em rotas secundárias — carregá-las sob demanda tira esse peso do
// primeiro carregamento.
const MapPage = lazy(() => import('./pages/MapPage').then((m) => ({ default: m.MapPage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((m) => ({ default: m.ReportsPage })));

function RouteFallback() {
  return <p className="p-6 text-sm text-neutral-500">Carregando…</p>;
}

export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route element={<ProtectedRoute />}>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/map" element={<MapPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/account" element={<AccountPage />} />
                </Route>
              </Routes>
            </Suspense>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
