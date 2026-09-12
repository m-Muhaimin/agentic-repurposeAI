export default function UrlFetchBar() {
  return (
    <div className="space-y-space-md">
      <div className="relative flex items-center w-full">
        <span className="material-symbols-outlined text-[18px] text-outline absolute left-3.5 pointer-events-none">
          link
        </span>
        <input
          className="w-full h-11 pl-10 pr-36 rounded bg-surface-container-low text-on-surface placeholder:text-outline font-body-medium text-body-medium focus:outline-none focus:bg-surface-container-lowest shadow-xs transition-colors"
          id="url-input"
          placeholder="Paste URL from YouTube, Loom, Spotify podcast, or article..."
          type="url"
        />
        <button
          className="absolute right-1.5 h-8 px-4 rounded bg-primary text-on-primary font-caption-bold text-caption-bold hover:bg-primary-container transition-colors shadow-xs active:scale-[0.98] flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          id="fetch-btn"
          type="button"
          disabled
          title="Coming soon"
        >
          <span>Fetch &amp; Analyze</span>
          <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
        </button>
      </div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-space-xs px-1 text-secondary font-body-sm text-body-sm">
        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
          <input
            checked
            className="w-4 h-4 rounded bg-surface-container text-primary accent-primary cursor-pointer"
            type="checkbox"
          />
          <span>Auto-detect multi-speaker dialogue (Transcribe with Whisper-v3 Large)</span>
        </label>
        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
          <input
            checked
            className="w-4 h-4 rounded bg-surface-container text-primary accent-primary cursor-pointer"
            type="checkbox"
          />
          <span>Extract architectural diagrams</span>
        </label>
      </div>
    </div>
  );
}