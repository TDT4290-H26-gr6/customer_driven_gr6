import { BrowserRouter } from "react-router-dom";
import { AppProviders } from "@/app/providers/AppProviders";
import { AppRoutes } from "@/routes";
import { ErrorBoundary } from "@/shared/components/ErrorBoundary";

/**
 * Router + provider composition only, no data fetching, no business logic.
 * The outer ErrorBoundary is the last resort (e.g. a provider or the login
 * page failing); pages have their own inside AppShell, which keeps the nav.
 */
export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppProviders>
          <AppRoutes />
        </AppProviders>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
