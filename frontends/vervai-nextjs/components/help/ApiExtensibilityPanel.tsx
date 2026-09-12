export default function ApiExtensibilityPanel() {
  return (
    <div className="md:col-span-8 rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between overflow-hidden">
      <div>
        <div className="px-space-lg py-4 bg-surface-container-low flex items-center justify-between">
          <div className="flex items-center gap-space-sm">
            <div className="w-8 h-8 rounded-lg bg-surface-container-high text-on-surface flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">terminal</span>
            </div>
            <div>
              <h2 className="font-headline-md text-headline-md text-on-surface">
                API, Webhooks & Extensibility
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Enterprise integration reference and TypeScript SDK patterns
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-primary-fixed text-on-primary-fixed font-caption-bold text-caption-bold">
              Node 20+
            </span>
            <span className="px-2 py-0.5 rounded bg-secondary-fixed text-on-secondary-fixed font-caption-bold text-caption-bold">
              Python 3.11
            </span>
          </div>
        </div>
        <div className="p-space-lg grid grid-cols-1 md:grid-cols-2 gap-space-lg">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-caption-bold text-caption-bold text-on-surface-variant uppercase">
                TypeScript Client
              </span>
              <span className="font-caption-bold text-caption-bold text-on-surface-variant">
                @vervai/sdk
              </span>
            </div>
            <div className="p-space-sm rounded-lg bg-inverse-surface text-inverse-on-surface font-mono text-body-sm flex flex-col gap-1 overflow-x-auto shadow-sm">
              <span className="text-tertiary-fixed-dim">
                import {'{'} VervClient {'}'}{' from \'@vervai/sdk\';'}
              </span>
              <span className="text-inverse-on-surface">const verv = new VervClient({'{'}</span>
              <span className="pl-4 text-on-primary-container">
                apiKey: proces...KEY,
              </span>
              <span className="pl-4 text-on-primary-container">
                webhookSecret: process.env.SIGNING_KEY
              </span>
              <span className="text-inverse-on-surface">{'}'});</span>
              <span className="text-outline-variant">{'// Trigger autonomous synthesis run'}</span>
              <span className="text-inverse-on-surface">const pipeline = await verv.agent.run({'{'}</span>
              <span className="pl-4 text-primary-fixed-dim">sourceId: {'"src_9921_audio"'},</span>
              <span className="pl-4 text-primary-fixed-dim">voiceProfile: {'"elena_vance_direct"'},</span>
              <span className="pl-4 text-primary-fixed-dim">
                autoDispatch: false
              </span>
              <span className="text-inverse-on-surface">{'}'});</span>
            </div>
          </div>
          <div className="flex flex-col gap-space-sm justify-between">
            <div className="space-y-2">
              <h3 className="font-headline-sm text-headline-sm text-on-surface">Direct Data Relays</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Every pipeline state fires signed HMAC-SHA256 events to your ingest webhooks,
                enabling custom database insertion or Slack notification relays.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 rounded bg-surface-container-low text-on-surface font-body-sm">
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-tertiary">database</span>
                  <span>Supabase pgvector Schema</span>
                </span>
                <span className="font-caption-bold text-caption-bold text-primary cursor-pointer hover:underline">
                  View SQL
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-surface-container-low text-on-surface font-body-sm">
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-primary">share</span>
                  <span>LinkedIn & Buffer OAuth 2.0</span>
                </span>
                <span className="font-caption-bold text-caption-bold text-primary cursor-pointer hover:underline">
                  Setup Auth
                </span>
              </div>
            </div>
            <button
              className="w-full py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-body-medium text-body-medium transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              type="button"
              disabled
              title="Coming soon"
            >
              <span className="material-symbols-outlined text-[16px]">menu_book</span>
              <span>Explore Interactive Swagger API Specs</span>
            </button>
          </div>
        </div>
      </div>
      <div className="px-space-lg py-3 bg-surface-container-low flex items-center justify-between">
        <span className="text-on-surface-variant font-caption-bold text-caption-bold">
          Current SDK Version: v2.4.0
        </span>
        <span className="text-primary font-caption-bold text-caption-bold cursor-pointer hover:underline">
          Generate New API Token
        </span>
      </div>
    </div>
  );
}
