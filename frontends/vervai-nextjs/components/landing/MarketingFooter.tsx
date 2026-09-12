import Link from "next/link";

type FooterColumn = { title: string; links: { label: string; href: string }[] };

const COLUMNS: FooterColumn[] = [
  {
    title: "Product Pillars",
    links: [
      { label: "Neural Routing", href: "/features" },
      { label: "Autonomous Agents", href: "/workflows" },
      { label: "Content Matrix", href: "/solutions" },
      { label: "Compliance Engine", href: "/enterprise" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "Codex Docs", href: "/enterprise" },
      { label: "API References", href: "/features" },
      { label: "SDKs & Webhooks", href: "/features" },
      { label: "Telemetry Benchmarks", href: "/pricing" },
    ],
  },
  {
    title: "Governance",
    links: [
      { label: "Security & SOC2", href: "/enterprise" },
      { label: "Privacy Standards", href: "/enterprise" },
      { label: "Service Level Terms", href: "/pricing" },
      { label: "Model Ethics", href: "/enterprise" },
    ],
  },
];

export default function MarketingFooter() {
  return (
    <footer className="w-full bg-surface-container-low pt-16 pb-12 mt-auto">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 pb-12">
          <div className="col-span-2 flex flex-col justify-between pr-4">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Link href="/" className="flex items-center gap-3">
                  <svg
                    className="w-7 h-7 text-surface-bright"
                    fill="none"
                    viewBox="0 0 40 40"
                    aria-hidden
                  >
                    <path
                      d="M10 11L20 29L30 11"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="4.5"
                    />
                    <circle cx={20} cy={20} fill="#007454" r={3.5} />
                  </svg>
                  <span className="font-headline-md text-headline-md text-on-surface">VervAI</span>
                </Link>
                <span className="font-label-caps text-label-caps tracking-wider text-outline">
                  Autonomous Grid
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant max-w-sm">
                Autonomous workflow orchestration and editorial intelligence architecture for
                high-velocity enterprise teams.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <span className="w-2 h-2 rounded-full bg-tertiary"></span>
              <span className="font-caption-bold text-caption-bold text-tertiary">
                Systems Operational
              </span>
              <span className="font-body-sm text-body-sm text-outline mx-2">•</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                v3.4.1 Engine
              </span>
            </div>
          </div>
          {COLUMNS.map((column) => (
            <div key={column.title}>
              <h4 className="font-headline-sm text-headline-sm text-on-surface mb-4">
                {column.title}
              </h4>
              <ul className="space-y-2.5 font-body-sm text-body-sm text-on-surface-variant">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="hover:text-on-surface transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 font-body-sm text-body-sm text-on-surface-variant">
          <p>© 2025 VervAI Systems Inc. Editorial and autonomous architecture reserved.</p>
          <div className="flex items-center gap-6 font-caption-bold text-caption-bold">
            <Link href="/enterprise" className="hover:text-on-surface transition-colors">
              Trust Center
            </Link>
            <Link href="/enterprise" className="hover:text-on-surface transition-colors">
              System Status
            </Link>
            <Link href="/enterprise" className="hover:text-on-surface transition-colors">
              Security Disclosure
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}