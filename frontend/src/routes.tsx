import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/app/layout/AppShell";
import { RequireAuth } from "@/app/guards/RequireAuth";
import { RequireRole } from "@/app/guards/RequireRole";
import { useAuth } from "@/app/providers/AuthProvider";
import { LoginPage } from "@/features/auth";
import { OnboardingPage } from "@/features/onboarding";
import { AssessmentRunnerPage } from "@/features/assessment";
import { ResultsPage } from "@/features/results";
import { SettingsPage } from "@/features/settings";
import { CoursesPage } from "@/features/courses";
import { Spinner } from "@/shared/components/Spinner";

/** "/" always redirects to whatever step the learner is actually on. */
function HomeRedirect() {
  const { status, learner } = useAuth();

  if (status === "loading") return <Spinner />;
  if (status === "signedOut") return <Navigate to="/login" replace />;
  if (!learner?.role) return <Navigate to="/onboarding" replace />;
  return <Navigate to="/results" replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/settings" element={<SettingsPage />} />

          <Route element={<RequireRole />}>
            <Route path="/results" element={<ResultsPage />} />
            <Route path="/courses" element={<CoursesPage />} />
            <Route path="/assessment" element={<AssessmentRunnerPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<HomeRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
