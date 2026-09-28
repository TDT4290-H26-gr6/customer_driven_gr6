import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";

/**
 * Not an admin -> back to the dashboard. UX only: the backend's
 * requireAdmin is the real boundary (every /admin request checks it).
 */
export function RequireAdmin() {
  const { learner } = useAuth();
  if (!learner?.isAdmin) return <Navigate to="/results" replace />;
  return <Outlet />;
}
