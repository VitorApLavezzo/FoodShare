import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ProtectedRoute, RequireOrganization } from './components/ProtectedRoute';
import { useLiveUpdates } from './lib/live-updates';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { AccountPage } from './pages/AccountPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { DonationDetailPage } from './pages/DonationDetailPage';
import { NotFoundPage } from './pages/NotFoundPage';

// Mapa (leaflet) e relatórios (recharts) são as duas dependências mais pesadas
// e ficam em rotas secundárias — carregá-las sob demanda tira esse peso do
// primeiro carregamento.
const MapPage = lazy(() => import('./pages/MapPage').then((m) => ({ default: m.MapPage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const AdminUsersPage = lazy(() =>
  import('./pages/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })),
);

function RouteFallback() {
  return <p className="p-6 text-sm text-ink-muted">Carregando…</p>;
}

/** Assina os avisos de mudança uma única vez, para toda a aplicação. */
function LiveUpdates() {
  useLiveUpdates();
  return null;
}

export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <LiveUpdates />
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
                <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
                <Route path="/verificar-email" element={<VerifyEmailPage />} />
                <Route element={<ProtectedRoute />}>
                  {/* O painel fica sempre aberto: é onde mora o formulário de cadastro. */}
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route element={<RequireOrganization />}>
                    <Route path="/doacoes/:id" element={<DonationDetailPage />} />
                    <Route path="/map" element={<MapPage />} />
                    <Route path="/account" element={<AccountPage />} />
                  </Route>
                </Route>
                <Route element={<ProtectedRoute roles={['ADMIN']} />}>
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/admin/usuarios" element={<AdminUsersPage />} />
                </Route>
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
