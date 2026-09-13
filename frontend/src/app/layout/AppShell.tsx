import { useEffect, useRef } from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { useLocalStorage } from "@/shared/hooks/useLocalStorage";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { RoleGateModal } from "./RoleGateModal";
import styles from "./AppShell.module.css";

/** Authenticated layout: header + collapsible sidebar + routed page. */
export function AppShell() {
  const { learner } = useAuth();
  const needsRole = Boolean(learner && !learner.role);
  const [collapsed, setCollapsed] = useLocalStorage("aios.sidebarCollapsed", false);
  const appRef = useRef<HTMLDivElement>(null);

  // `inert` (not just visually covered) while the role gate is up: blocks
  // clicks AND removes everything underneath from the tab order, so there's
  // no keyboard escape route into the rest of the app either.
  useEffect(() => {
    if (appRef.current) appRef.current.inert = needsRole;
  }, [needsRole]);

  return (
    <div className={styles.shell}>
      <div ref={appRef} className={styles.inertWrapper}>
        <Header />
        <div className={styles.body}>
          <Sidebar collapsed={collapsed} onToggleCollapsed={() => setCollapsed((c) => !c)} />
          <main className={styles.main}>{needsRole ? null : <Outlet />}</main>
        </div>
      </div>

      {needsRole && <RoleGateModal />}
    </div>
  );
}
