import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";

/**
 * Profile not filled in -> the profile page, which asks for it. UX only: the
 * backend refuses to save answers without a complete profile
 * (POST /assessment/responses).
 */
export function RequireProfile() {
  const { learner } = useAuth();
  if (!learner?.hasCompletedProfile) return <Navigate to="/profile" replace />;
  return <Outlet />;
}
