import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/app/layout/AppShell";
import { RequireAuth } from "@/app/guards/RequireAuth";
import { useAuth } from "@/app/providers/AuthProvider";
import { LoginPage } from "@/features/auth";
import { AssessmentRunnerPage } from "@/features/assessment";
import { ResultsPage, SectionDetailsPage } from "@/features/results";
import { SettingsPage } from "@/features/settings";
import { HistoryPage } from "@/features/history";
import { SourcesPage } from "@/features/sources";
import { AdminPage } from "@/features/admin";
import { Spinner } from "@/shared/components/Spinner";

/**
 * "/" always redirects to whatever step the learner is actually on. There's
 * no dedicated onboarding route: AppShell itself blocks with a modal
 * (RoleGateModal) whenever a signed-in learner has no role yet, on
 * whichever page they land on.
 */
function HomeRedirect() {
  const { status } = useAuth();

  if (status === "loading") return <Spinner />;
  if (status === "signedOut") return <Navigate to="/login" replace />;
  return <Navigate to="/results" replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/results/details" element={<SectionDetailsPage />} />
          <Route path="/sources" element={<SourcesPage />} />
          <Route path="/admin" element={<AdminPage />} />
          {/* Not in the sidebar — only reachable via the dashboard's
              "Assess yourself" button. */}
          <Route path="/assessment" element={<AssessmentRunnerPage />} />
        </Route>
      </Route>

      <Route path="/" element={<HomeRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
