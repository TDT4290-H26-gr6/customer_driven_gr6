import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { Spinner } from "@/shared/components/Spinner";

/** No session -> redirect to /login. */
export function RequireAuth() {
  const { status } = useAuth();

  if (status === "loading") return <Spinner />;
  if (status === "signedOut") return <Navigate to="/login" replace />;
  return <Outlet />;
}
