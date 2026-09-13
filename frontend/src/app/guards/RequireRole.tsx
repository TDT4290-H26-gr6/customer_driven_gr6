import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";

/** No persona chosen yet -> redirect to /onboarding. */
export function RequireRole() {
  const { learner } = useAuth();

  if (learner && !learner.role) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}
