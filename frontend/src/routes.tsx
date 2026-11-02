import { lazy, Suspense } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
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
import { Spinner } from "@/shared/components/Spinner";

// Admin mode's pages load only when an admin opens one, most learners never
// do, so they aren't in the bundle everyone downloads. Imported from their own
// files rather than the feature barrels: learner code imports those barrels
// too (AppShell's FeedbackWidget), which would keep the pages in the bundle.
const AdminPage = lazy(() =>
  import("@/features/admin/pages/AdminPage").then((m) => ({ default: m.AdminPage })),
);
const FeedbackAdminPage = lazy(() =>
  import("@/features/feedback/pages/FeedbackAdminPage").then((m) => ({
    default: m.FeedbackAdminPage,
  })),
);
const CurriculumPage = lazy(() =>
  import("@/features/curriculum/pages/CurriculumPage").then((m) => ({ default: m.CurriculumPage })),
);
const QuestionEditorPage = lazy(() =>
  import("@/features/curriculum/pages/QuestionEditorPage").then((m) => ({
    default: m.QuestionEditorPage,
  })),
);
const JourneyEditorPage = lazy(() =>
  import("@/features/curriculum/pages/JourneyEditorPage").then((m) => ({
    default: m.JourneyEditorPage,
  })),
);

/** A spinner while an admin page loads, the first time one is opened. */
function LoadingAdminPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <Outlet />
    </Suspense>
  );
}

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
            <Route element={<LoadingAdminPage />}>
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/admin/feedback" element={<FeedbackAdminPage />} />
              <Route path="/admin/curriculum" element={<CurriculumPage />} />
              <Route path="/admin/curriculum/questions/new" element={<QuestionEditorPage />} />
              <Route path="/admin/curriculum/questions/:id" element={<QuestionEditorPage />} />
              <Route path="/admin/curriculum/journeys/new" element={<JourneyEditorPage />} />
              <Route path="/admin/curriculum/journeys/:id" element={<JourneyEditorPage />} />
            </Route>
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
