import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { base44 } from '@/api/base44Client';
import AdminLayout from '@/components/layout/AdminLayout';
import UsersList from '@/pages/UsersList';
import UserDetail from '@/pages/UserDetail';
import InviteUser from '@/pages/InviteUser';
import BrandingSettings from '@/pages/BrandingSettings';
import ProjectsList from '@/pages/ProjectsList';
import ProjectWizard from '@/pages/ProjectWizard';
import ProjectDetail from '@/pages/ProjectDetail';
import UnitsList from '@/pages/UnitsList';
import UnitDetail from '@/pages/UnitDetail';
import ComponentsPool from '@/pages/ComponentsPool';
import InquiryPool from '@/pages/InquiryPool';
import ClientDetail from '@/pages/ClientDetail';
import Pipeline from '@/pages/Pipeline';
import ReservationsList from '@/pages/ReservationsList';
import CreateReservation from '@/pages/CreateReservation';
import ReservationDetail from '@/pages/ReservationDetail';
import AgreementsList from '@/pages/AgreementsList';
import PaymentsList from '@/pages/PaymentsList';
import DealsList from '@/pages/DealsList';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'account_disabled') {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-background p-6">
          <div className="text-center max-w-sm">
            <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <svg className="h-8 w-8 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <h1 className="text-xl font-bold mb-2">Paskyra išjungta</h1>
            <p className="text-muted-foreground text-sm mb-6">Jūsų paskyra yra išjungta. Kreipkitės į administratorių.</p>
            <button onClick={() => base44.auth.logout()} className="text-sm text-muted-foreground underline">Atsijungti</button>
          </div>
        </div>
      );
    } else if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route path="/" element={<UsersList />} />
        <Route path="/users/:id" element={<UserDetail />} />
        <Route path="/invite" element={<InviteUser />} />
        <Route path="/branding" element={<BrandingSettings />} />
        <Route path="/projects" element={<ProjectsList />} />
        <Route path="/projects/new" element={<ProjectWizard />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/units" element={<UnitsList />} />
        <Route path="/units/:id" element={<UnitDetail />} />
        <Route path="/components" element={<ComponentsPool />} />
        <Route path="/inquiry" element={<InquiryPool />} />
        <Route path="/pipeline" element={<Pipeline />} />
        <Route path="/clients/:id" element={<ClientDetail />} />
        <Route path="/reservations" element={<ReservationsList />} />
        <Route path="/reservation-create" element={<CreateReservation />} />
        <Route path="/reservation/:id" element={<ReservationDetail />} />
        <Route path="/agreements" element={<AgreementsList />} />
        <Route path="/payments" element={<PaymentsList />} />
        <Route path="/deals" element={<DealsList />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App