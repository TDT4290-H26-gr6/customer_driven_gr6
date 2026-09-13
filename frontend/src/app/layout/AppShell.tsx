import { Outlet } from "react-router-dom";
import { useLocalStorage } from "@/shared/hooks/useLocalStorage";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import styles from "./AppShell.module.css";

/** Authenticated layout: header + collapsible sidebar + routed page. */
export function AppShell() {
  const [collapsed, setCollapsed] = useLocalStorage("aios.sidebarCollapsed", false);

  return (
    <div className={styles.shell}>
      <Header />
      <div className={styles.body}>
        <Sidebar collapsed={collapsed} onToggleCollapsed={() => setCollapsed((c) => !c)} />
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
