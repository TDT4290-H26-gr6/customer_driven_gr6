import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { FeedbackWidget } from "@/features/feedback";
import { ErrorBoundary } from "@/shared/components/ErrorBoundary";
import { useLocalStorage } from "@/shared/hooks/useLocalStorage";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { MOBILE_QUERY } from "@/shared/lib/breakpoints";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { RoleGateModal } from "./RoleGateModal";
import styles from "./AppShell.module.css";

/**
 * Authenticated layout: header + nav + routed page. The nav is a collapsible
 * left sidebar on desktop and a bottom tab bar on mobile. A floating
 * "Feedback" button sits on top of every page while the app is in testing.
 *
 * The desktop rail has two independent, deliberately different controls:
 * the header's icon button hides the whole rail (`hidden`); the rail's own
 * bottom-right text just hides its item labels, icon-only (`collapsed`).
 */
export function AppShell() {
  const { learner } = useAuth();
  const needsRole = Boolean(learner && !learner.role);
  const [collapsed, setCollapsed] = useLocalStorage("aios.sidebarCollapsed", false);
  const [hidden, setHidden] = useLocalStorage("aios.sidebarHidden", false);
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const appRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  const toggleCollapsed = () => setCollapsed((c) => !c);
  const toggleHidden = () => setHidden((h) => !h);

  // `inert` (not just visually covered) while the role gate is up: blocks
  // clicks AND removes everything underneath from the tab order, so there's
  // no keyboard escape route into the rest of the app either.
  useEffect(() => {
    if (appRef.current) appRef.current.inert = needsRole;
  }, [needsRole]);

  return (
    <div className={styles.shell}>
      <div ref={appRef} className={styles.inertWrapper}>
        <a href="#main-content" className={styles.skipLink}>
          Skip to main content
        </a>
        <Header
          sidebarHidden={isMobile ? undefined : hidden}
          onToggleSidebar={isMobile ? undefined : toggleHidden}
        />
        <div className={styles.body}>
          {/* Rendered on one side or the other (not both, not CSS-reordered)
              so the DOM/tab order always matches what's on screen: the bottom
              bar sits after <main>, the side rail before it. Hiding the rail
              entirely (vs. just collapsing its labels) is desktop-only too —
              on mobile there's no other nav, so it always shows. */}
          {!isMobile && !hidden && (
            <Sidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
          )}
          {/* tabIndex={-1}: not a normal Tab stop, but focusable when the skip
              link above jumps here so keyboard focus actually moves (not just
              the visible scroll position). */}
          <main id="main-content" tabIndex={-1} className={styles.main}>
            {/* A page that crashes while rendering shows a fallback here while
                the header and nav keep working; navigating away resets it. */}
            {needsRole ? null : (
              <ErrorBoundary resetKey={pathname}>
                <Outlet />
              </ErrorBoundary>
            )}
          </main>
          {isMobile && (
            <Sidebar layout="bottom" collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
          )}
        </div>
        {/* Inside the inert wrapper: unreachable while the role gate is up. */}
        <FeedbackWidget />
      </div>

      {needsRole && <RoleGateModal />}
    </div>
  );
}
