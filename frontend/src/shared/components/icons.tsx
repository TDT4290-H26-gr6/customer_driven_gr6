import type { SVGProps } from "react";

// Small inline icon set. No icon library dependency — see "keep it boring"
// in context/frontend-structure.md.

type IconProps = SVGProps<SVGSVGElement>;

const defaults: IconProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export function HomeIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v9a1 1 0 0 0 1 1H10v-6h4v6h3.5a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

export function ClipboardIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
      <path d="M9 11h6M9 15h6" />
    </svg>
  );
}

/** Right-pointing chevron by default; rotate via CSS to indicate direction. */
export function ChevronIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function BookIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z" />
    </svg>
  );
}

export function MonitorIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function LogoutIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M15 17l5-5-5-5" />
      <path d="M20 12H9" />
      <path d="M13 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7" />
    </svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M12 3l8 3v6c0 4.5-3.2 8.3-8 9-4.8-.7-8-4.5-8-9V6l8-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

/** Speech bubble — the "Feedback" button. */
export function MessageIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M20 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" />
      <path d="M8 8h8M8 12h5" />
    </svg>
  );
}
