export default function DataSovereignty() {
  return (
    <section
      id="data-export"
      className="lg:col-span-12 bg-surface-container-lowest rounded-xl p-space-xl shadow-sm flex flex-col gap-space-lg scroll-mt-8"
    >
      <div className="flex items-center justify-between pb-space-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-surface-container text-on-surface">
            <span className="material-symbols-outlined text-[20px]">security</span>
          </div>
          <div>
            <h2 className="font-headline-lg text-headline-lg text-on-surface">
              Data Sovereignty & Retention
            </h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Manage retention defaults, storage, and workspace export options.
            </p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-space-xl pt-1">
        <div className="flex flex-col gap-space-md justify-between">
          <div className="space-y-space-md">
            <div className="flex flex-col gap-2">
              <label className="font-headline-sm text-headline-sm text-on-surface">
                Raw Media Retention Policy
              </label>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Choose how long raw audio and video source files are kept after processing. No
                policy has been configured yet.
              </p>
              <div className="relative mt-1">
                <select className="w-full appearance-none px-3.5 py-2.5 rounded-lg bg-surface-container-low text-on-surface-variant font-body-base text-body-sm shadow-inner focus:outline-none focus:ring-2 focus:ring-primary-container pr-10">
                  <option value="" selected disabled>
                    Not configured
                  </option>
                  <option value="30">Keep raw source media files for 30 days after synthesis</option>
                  <option value="90">Keep raw source media files for 90 days after synthesis</option>
                  <option value="180">Keep raw source media files for 180 days after synthesis</option>
                  <option value="forever">Keep raw source media files indefinitely</option>
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant text-[18px]">
                  history
                </span>
              </div>
            </div>
            <div className="p-space-md bg-surface-container-low rounded-xl">
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                No storage usage statistics are available for this workspace yet.
              </span>
            </div>
          </div>
          <div className="pt-2">
            <button
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-space-lg py-2.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-body-medium text-body-medium shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              type="button"
              disabled
              title="Coming soon"
            >
              <span className="material-symbols-outlined text-[20px] text-primary">download</span>
              <span>Export Workspace Content</span>
            </button>
          </div>
        </div>
        <div className="p-space-lg bg-error-container/20 rounded-xl flex flex-col justify-between gap-space-md">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-error">
              <span className="material-symbols-outlined text-[20px]">warning</span>
              <span className="font-headline-md text-headline-md font-bold">Danger Zone</span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface">
              Irreversible systemic actions for this workspace. Purging deletes all sources,
              generated outputs, pending drafts, and saved preferences.
            </p>
            <div className="p-3 bg-surface-container-lowest rounded-lg">
              <ul className="text-[12px] font-body-sm text-on-surface-variant space-y-1">
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-error"></span>
                  Deletes all ingested sources, outputs, and content ideas
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-error"></span>
                  Removes saved agent preferences and brand voice
                </li>
              </ul>
            </div>
          </div>
          <div className="pt-2">
            <button
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-space-lg py-2.5 rounded-lg bg-error text-on-error font-body-medium text-body-medium shadow-md hover:bg-on-error-container transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              type="button"
              disabled
              title="Coming soon"
            >
              <span className="material-symbols-outlined text-[18px]">delete_forever</span>
              <span>Delete Workspace</span>
              <span className="font-label-caps text-[10px] text-on-surface-variant uppercase ml-1">Coming soon</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}