export type NavItem = {
  label: string;
  icon: string;
  href: string;
  activeKey: string;
};

export type NavSection = {
  section: string;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    section: "Platform",
    items: [
      { label: "Command Center", icon: "home", href: "/dashboard", activeKey: "dashboard" },
      { label: "Source Intake", icon: "add_circle", href: "/source-intake", activeKey: "create" },
      { label: "Content Assets", icon: "folder_open", href: "/library", activeKey: "library" },
      { label: "Distribution", icon: "send", href: "/publish", activeKey: "publish" },
    ],
  },
  {
    section: "Workspace",
    items: [
      { label: "Brand Voice", icon: "auto_awesome", href: "/brand-voice", activeKey: "branding" },
      { label: "Connections", icon: "hub", href: "/connections", activeKey: "connections" },
      { label: "Usage & Telemetry", icon: "bar_chart", href: "/usage", activeKey: "usage" },
    ],
  },
];

export const BOTTOM_NAV: NavItem[] = [
  { label: "Preferences", icon: "settings", href: "/preferences", activeKey: "settings" },
  { label: "Documentation", icon: "help_center", href: "/help", activeKey: "help" },
];

/** Returns the activeKey ("dashboard", "create", ...) for the current pathname. */
export function activeKeyForPath(pathname: string): string | null {
  const item = [...NAV_SECTIONS.flatMap((s) => s.items), ...BOTTOM_NAV].find((i) =>
    pathname.startsWith(i.href)
  );
  return item?.activeKey ?? null;
}