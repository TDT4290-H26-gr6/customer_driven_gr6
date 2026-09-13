import { NavLink } from "react-router-dom";
import { BookIcon, ChevronIcon, HomeIcon } from "@/shared/components/icons";
import styles from "./Sidebar.module.css";

// Assessment is deliberately not a nav item — it's only reachable via the
// dashboard's "Assess yourself" button, not as a page someone browses to.
const NAV_ITEMS = [
  { to: "/results", label: "Dashboard", Icon: HomeIcon },
  { to: "/courses", label: "Courses", Icon: BookIcon },
];

type Props = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

/** Collapsible left nav. Icons replace icon+label when collapsed. */
export function Sidebar({ collapsed, onToggleCollapsed }: Props) {
  const sidebarClass = collapsed ? `${styles.sidebar} ${styles.collapsed}` : styles.sidebar;

  return (
    <aside className={sidebarClass}>
      <nav className={styles.nav}>
        {NAV_ITEMS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => (isActive ? `${styles.item} ${styles.active}` : styles.item)}
            title={collapsed ? label : undefined}
          >
            <Icon className={styles.icon} />
            {!collapsed && <span className={styles.label}>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Always anchored to the sidebar's right edge, no label — icon only. */}
      <button
        type="button"
        className={styles.toggle}
        onClick={onToggleCollapsed}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!collapsed}
      >
        <ChevronIcon className={collapsed ? styles.chevronCollapsed : styles.chevronExpanded} />
      </button>
    </aside>
  );
}
