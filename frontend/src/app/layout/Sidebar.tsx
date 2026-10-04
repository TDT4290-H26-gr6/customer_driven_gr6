import { NavLink } from "react-router-dom";
import { BookIcon, ChevronIcon, ClipboardIcon, HomeIcon } from "@/shared/components/icons";
import styles from "./Sidebar.module.css";

// Assessment is deliberately not a nav item — it's only reachable via the
// dashboard's "Retake assessment" button, not as a page someone browses to.
const NAV_ITEMS = [
  { to: "/results", label: "Dashboard", Icon: HomeIcon },
  { to: "/history", label: "History", Icon: ClipboardIcon },
  { to: "/sources", label: "Sources", Icon: BookIcon },
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

      {/* Pinned to the sidebar's own bottom-right corner, whatever the nav's
          length — same collapse toggle as the header's icon button, as a
          chevron instead of an icon-swap: it points right (there's more to
          reveal in that direction — the labels sit to the right of the
          icons) while collapsed, and flips to point left (tuck it back
          away) once labels are showing, so the glyph itself says what a
          click does, in the same direction the rail actually resizes. The
          native `title` carries the same explanation on hover, since
          there's no text label left on the button to read. */}
      {!isBottom && (
        <button
          type="button"
          className={styles.labelToggle}
          onClick={onToggleCollapsed}
          title={collapsed ? "Show labels next to the icons" : "Hide labels, icons only"}
          aria-label={collapsed ? "Show labels" : "Hide labels"}
          aria-expanded={!collapsed}
        >
          {/* Right-pointing by default (per its own doc comment, meant to be
              rotated via CSS) — that's exactly "expand rightward", so it
              needs no rotation while collapsed; flipped 180deg to point
              left once expanded. */}
          <ChevronIcon style={{ transform: collapsed ? undefined : "rotate(180deg)" }} />
        </button>
      )}
    </aside>
  );
}
