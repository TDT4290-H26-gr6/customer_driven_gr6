import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/app/layout/AppShell";
import { RequireAuth } from "@/app/guards/RequireAuth";
import { RequireAdmin } from "@/app/guards/RequireAdmin";
import { RequireProfile } from "@/app/guards/RequireProfile";
import { useAuth } from "@/app/providers/AuthProvider";
import { LoginPage } from "@/features/auth";
import { AssessmentRunnerPage, ReassessPage } from "@/features/assessment";
import { DashboardPage, SectionDetailsPage } from "@/features/dashboard";
import { SettingsPage } from "@/features/settings";
import { ProfilePage } from "@/features/profile";
import { HistoryPage } from "@/features/history";
import { CompetenciesPage } from "@/features/competencies";
import { FaqPage } from "@/features/faq";
import { LearningJourneysPage } from "@/features/learningJourney";
import { AdminPage } from "@/features/admin";
import { CurriculumPage, QuestionEditorPage } from "@/features/curriculum";
import { FeedbackAdminPage } from "@/features/feedback";
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
  return <Navigate to="/dashboard" replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/settings" element={<SettingsPage />} />
          {/* Not in the sidebar, RequireProfile sends learners here. */}
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/journeys" element={<LearningJourneysPage />} />
          <Route path="/competencies" element={<CompetenciesPage />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/dashboard/details" element={<SectionDetailsPage />} />
          <Route element={<RequireAdmin />}>
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/admin/feedback" element={<FeedbackAdminPage />} />
            <Route path="/admin/curriculum" element={<CurriculumPage />} />
            <Route path="/admin/curriculum/questions/new" element={<QuestionEditorPage />} />
            <Route path="/admin/curriculum/questions/:id" element={<QuestionEditorPage />} />
          </Route>
          {/* Not in the sidebar, only reachable via the dashboard's
              "Retake assessment" button. The profile must be filled in first. */}
          <Route element={<RequireProfile />}>
            <Route path="/assessment" element={<AssessmentRunnerPage />} />
            {/* The dashboard's "Retake assessment": asks about completed journeys first. */}
            <Route path="/assessment/reassess" element={<ReassessPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<HomeRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
