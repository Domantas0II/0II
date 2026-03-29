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
import DashboardHome from '@/pages/DashboardHome';
import TeamPerformance from '@/pages/TeamPerformance';
import ProjectAnalytics from '@/pages/ProjectAnalytics';
import ImportHub from '@/pages/ImportHub';
import ImportUpload from '@/pages/ImportUpload';
import ImportMapping from '@/pages/ImportMapping';
import ImportPreview from '@/pages/ImportPreview';
import ImportHistory from '@/pages/ImportHistory';
import MyTasks from '@/pages/MyTasks';
import TasksBoard from '@/pages/TasksBoard';
import SLADashboard from '@/pages/SLADashboard';
import PriorityQueue from '@/pages/PriorityQueue';
import ManagerInsights from '@/pages/ManagerInsights';
import CustomerPortal from '@/pages/CustomerPortal';
import PartnerPortal from '@/pages/PartnerPortal';
import SystemSettings from '@/pages/SystemSettings';
import CommissionsList from '@/pages/CommissionsList';
import CommissionDetail from '@/pages/CommissionDetail';
import CommissionRulesList from '@/pages/CommissionRulesList';
import CommissionRuleForm from '@/pages/CommissionRuleForm';
import PayoutsList from '@/pages/PayoutsList';
import PayoutDetail from '@/pages/PayoutDetail';
import ReportsList from '@/pages/ReportsList';
import ReportBuilder from '@/pages/ReportBuilder';
import ReportDetail from '@/pages/ReportDetail';
import ScheduledReports from '@/pages/ScheduledReports';
import IntegrationsList from '@/pages/IntegrationsList';
import IntegrationDetail from '@/pages/IntegrationDetail';
import WebhookEndpoints from '@/pages/WebhookEndpoints';
import ApiKeys from '@/pages/ApiKeys';
import WebhookLogs from '@/pages/WebhookLogs';
import SystemHealthDashboard from '@/pages/SystemHealthDashboard';
import IncidentsList from '@/pages/IncidentsList';
import IncidentDetail from '@/pages/IncidentDetail';
import DataIntegrityPage from '@/pages/DataIntegrityPage';
import SystemTestsPage from '@/pages/SystemTestsPage';
import SystemAuditDashboard from '@/pages/SystemAuditDashboard';
import ReleaseChecklistPage from '@/pages/ReleaseChecklistPage';
import SecurityAuditPage from '@/pages/SecurityAuditPage';
import PerformanceAuditPage from '@/pages/PerformanceAuditPage';

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
        <Route path="/" element={<DashboardHome />} />
        <Route path="/dashboard" element={<DashboardHome />} />
        <Route path="/users" element={<UsersList />} />
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
        <Route path="/team-performance" element={<TeamPerformance />} />
        <Route path="/project-analytics/:id" element={<ProjectAnalytics />} />
        <Route path="/import" element={<ImportHub />} />
        <Route path="/import/upload" element={<ImportUpload />} />
        <Route path="/import/mapping" element={<ImportMapping />} />
        <Route path="/import/preview" element={<ImportPreview />} />
        <Route path="/import/history" element={<ImportHistory />} />
        <Route path="/tasks" element={<MyTasks />} />
        <Route path="/tasks-board" element={<TasksBoard />} />
        <Route path="/sla-dashboard" element={<SLADashboard />} />
        <Route path="/priority-queue" element={<PriorityQueue />} />
        <Route path="/manager-insights" element={<ManagerInsights />} />
        <Route path="/system-settings" element={<SystemSettings />} />
        <Route path="/commissions" element={<CommissionsList />} />
        <Route path="/commissions/:id" element={<CommissionDetail />} />
        <Route path="/commission-rules" element={<CommissionRulesList />} />
        <Route path="/commission-rules/new" element={<CommissionRuleForm />} />
        <Route path="/commission-rules/:id" element={<CommissionRuleForm />} />
        <Route path="/commission-rules/:id/edit" element={<CommissionRuleForm />} />
        <Route path="/payouts" element={<PayoutsList />} />
        <Route path="/payouts/:id" element={<PayoutDetail />} />
        <Route path="/reports" element={<ReportsList />} />
        <Route path="/reports/new" element={<ReportBuilder />} />
        <Route path="/reports/:id" element={<ReportDetail />} />
        <Route path="/scheduled-reports" element={<ScheduledReports />} />
        <Route path="/integrations" element={<IntegrationsList />} />
        <Route path="/integrations/:id" element={<IntegrationDetail />} />
        <Route path="/webhook-endpoints" element={<WebhookEndpoints />} />
        <Route path="/api-keys" element={<ApiKeys />} />
        <Route path="/webhook-logs" element={<WebhookLogs />} />
        <Route path="/system-health" element={<SystemHealthDashboard />} />
        <Route path="/incidents" element={<IncidentsList />} />
        <Route path="/incidents/:id" element={<IncidentDetail />} />
        <Route path="/data-integrity" element={<DataIntegrityPage />} />
        <Route path="/system-tests" element={<SystemTestsPage />} />
        <Route path="/system-audit" element={<SystemAuditDashboard />} />
        <Route path="/release-checklist" element={<ReleaseChecklistPage />} />
        <Route path="/security-audit" element={<SecurityAuditPage />} />
        <Route path="/performance-audit" element={<PerformanceAuditPage />} />
      </Route>
      {/* External Portal Routes (no layout) */}
      <Route path="/customer-portal" element={<CustomerPortal />} />
      <Route path="/partner-portal" element={<PartnerPortal />} />
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