import { NavLink } from "react-router-dom";
import { BookIcon, ChevronIcon, ClipboardIcon, HomeIcon } from "@/shared/components/icons";
import styles from "./Sidebar.module.css";

// Assessment is deliberately not a nav item — it's only reachable via the
// dashboard's "Assess yourself" button, not as a page someone browses to.
const NAV_ITEMS = [
  { to: "/results", label: "Dashboard", Icon: HomeIcon },
  { to: "/history", label: "History", Icon: ClipboardIcon },
  { to: "/courses", label: "Courses", Icon: BookIcon },
];

type Props = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /**
   * "side": the collapsible left rail (desktop). "bottom": a fixed tab bar
   * with icon + label stacked, no collapse control (mobile — see AppShell).
   */
  layout?: "side" | "bottom";
};

/** Main nav: a collapsible left rail on desktop, a bottom tab bar on mobile. */
export function Sidebar({ collapsed, onToggleCollapsed, layout = "side" }: Props) {
  const isBottom = layout === "bottom";
  // The bottom bar always shows labels — the persisted "collapsed" preference
  // is a desktop-only concept and must not leak into it.
  const showLabels = isBottom || !collapsed;
  const sidebarClass = isBottom
    ? `${styles.sidebar} ${styles.bottomBar}`
    : collapsed
      ? `${styles.sidebar} ${styles.collapsed}`
      : styles.sidebar;

  return (
    <aside className={sidebarClass}>
      <nav className={styles.nav} aria-label="Main">
        {NAV_ITEMS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              isActive ? `${styles.item} ${styles.active}` : styles.item
            }
            title={showLabels ? undefined : label}
          >
            <Icon className={styles.icon} />
            {showLabels && <span className={styles.label}>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Always anchored to the sidebar's right edge, no label — icon only. */}
      {!isBottom && (
        <button
          type="button"
          className={styles.toggle}
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
        >
          <ChevronIcon className={collapsed ? styles.chevronCollapsed : styles.chevronExpanded} />
        </button>
      )}
    </aside>
  );
}
