import { render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { useAuth } from "@/app/providers/AuthProvider";
import { AppRoutes } from "./routes";

vi.mock("@/app/providers/AuthProvider", () => ({ useAuth: vi.fn() }));
// Pages have their own tests; here each is a stand-in naming itself, so the
// tests check which page a URL leads to (and the guards in between).
vi.mock("@/app/layout/AppShell", () => ({ AppShell: () => <Outlet /> }));
const { page } = vi.hoisted(() => ({
  page: (name: string) =>
    function StandInPage() {
      return <p>{name}</p>;
    },
}));
vi.mock("@/features/auth", () => ({
  LoginPage: page("login"),
  OrcidCallbackPage: page("orcid-callback"),
}));
vi.mock("@/features/assessment", () => ({
  AssessmentRunnerPage: page("assessment"),
  ReassessPage: page("reassess"),
}));
vi.mock("@/features/dashboard", () => ({
  DashboardPage: page("dashboard"),
  SectionDetailsPage: page("section details"),
}));
vi.mock("@/features/settings", () => ({ SettingsPage: page("settings") }));
vi.mock("@/features/profile", () => ({ ProfilePage: page("profile") }));
vi.mock("@/features/history", () => ({ HistoryPage: page("history") }));
vi.mock("@/features/competencies", () => ({ CompetenciesPage: page("competencies") }));
vi.mock("@/features/faq", () => ({ FaqPage: page("faq") }));
vi.mock("@/features/learningJourney", () => ({ LearningJourneysPage: page("journeys") }));
vi.mock("@/features/admin", () => ({ AdminPage: page("admin") }));
vi.mock("@/features/feedback", () => ({ FeedbackAdminPage: page("feedback admin") }));
vi.mock("@/features/curriculum", () => ({
  CurriculumPage: page("curriculum editor"),
  QuestionEditorPage: page("question editor"),
  JourneyEditorPage: page("journey editor"),
}));

const signedIn = {
  status: "signedIn",
  learner: { hasCompletedProfile: true, isAdmin: false },
};

function visit(path: string, auth: object = signedIn) {
  vi.mocked(useAuth).mockReturnValue(auth as never);
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe("AppRoutes", () => {
  it.each([
    ["/dashboard", "dashboard"],
    ["/dashboard/details", "section details"],
    ["/settings", "settings"],
    ["/profile", "profile"],
    ["/history", "history"],
    ["/journeys", "journeys"],
    ["/competencies", "competencies"],
    ["/faq", "faq"],
    ["/assessment", "assessment"],
    ["/assessment/reassess", "reassess"],
  ])("%s shows the %s page to a signed-in learner", (path, name) => {
    visit(path);
    expect(screen.getByText(name)).toBeInTheDocument();
  });

  it("/login is open to everyone", () => {
    visit("/login", { status: "signedOut", learner: null });
    expect(screen.getByText("login")).toBeInTheDocument();
  });

  it("sends a signed-out visitor from any page to the login page", () => {
    visit("/history", { status: "signedOut", learner: null });
    expect(screen.getByText("login")).toBeInTheDocument();
  });

  it("/ goes to the dashboard when signed in, and to login when not", () => {
    visit("/");
    expect(screen.getByText("dashboard")).toBeInTheDocument();
  });

  it("/ waits while the session is being checked", () => {
    visit("/", { status: "loading", learner: null });
    expect(screen.queryByText("dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("login")).not.toBeInTheDocument();
  });

  it("/ sends a signed-out visitor to login", () => {
    visit("/", { status: "signedOut", learner: null });
    expect(screen.getByText("login")).toBeInTheDocument();
  });

  it("unknown paths go home", () => {
    visit("/no-such-page");
    expect(screen.getByText("dashboard")).toBeInTheDocument();
  });

  it("the assessment needs a complete profile first", () => {
    visit("/assessment", { status: "signedIn", learner: { hasCompletedProfile: false } });
    expect(screen.getByText("profile")).toBeInTheDocument();
  });

  it.each([
    ["/admin", "admin"],
    ["/admin/feedback", "feedback admin"],
    ["/admin/curriculum", "curriculum editor"],
    ["/admin/curriculum/questions/new", "question editor"],
    ["/admin/curriculum/questions/q-1", "question editor"],
    ["/admin/curriculum/journeys/new", "journey editor"],
    ["/admin/curriculum/journeys/lj-1", "journey editor"],
  ])("%s is for admins only", (path, name) => {
    visit(path, { status: "signedIn", learner: { hasCompletedProfile: true, isAdmin: true } });
    expect(screen.getByText(name)).toBeInTheDocument();
  });

  it("sends a non-admin away from admin pages", () => {
    visit("/admin");
    expect(screen.queryByText("admin")).not.toBeInTheDocument();
    expect(screen.getByText("dashboard")).toBeInTheDocument();
  });
});
