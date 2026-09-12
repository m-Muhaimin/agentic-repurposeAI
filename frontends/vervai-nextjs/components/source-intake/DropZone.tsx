const FORMAT_CHIPS = [
  { icon: "videocam", label: "MP4 / MOV (Video)" },
  { icon: "mic", label: "MP3 / WAV (Audio)" },
  { icon: "description", label: "PDF / DOCX (Reports)" },
  { icon: "link", label: "YouTube / Loom / URL" },
];

export default function DropZone() {
  return (
    <div
      className="flex flex-col items-center text-center justify-center p-space-xl rounded-lg bg-surface-container-low/60 hover:bg-surface-container-low transition-all duration-200 cursor-pointer group mb-space-lg"
      id="drop-zone"
    >
      <div className="w-16 h-16 rounded-xl bg-surface-container-lowest flex items-center justify-center mb-space-md shadow-sm group-hover:scale-105 transition-transform duration-200">
        <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
          <path
            d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"
            strokeLinecap="round"
            strokeLinejoin="round"
          ></path>
        </svg>
      </div>
      <h2 className="font-headline-md text-headline-md text-on-surface mb-1">
        Drag and drop raw media or paste a link
      </h2>
      <p className="font-body-sm text-body-sm text-secondary mb-space-lg max-w-md">
        Autonomous multi-modal parser will index speaker tracks, visual transcripts, and structural
        insights without preliminary tagging.
      </p>
      <div className="flex flex-wrap justify-center gap-2 mb-space-lg">
        {FORMAT_CHIPS.map((chip) => (
          <span
            key={chip.label}
            className="font-label-caps text-label-caps px-2.5 py-1 rounded bg-surface-container text-on-surface-variant flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[14px]">{chip.icon}</span>
            {chip.label}
          </span>
        ))}
      </div>
      <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-caption-bold text-caption-bold cursor-pointer transition-colors shadow-xs active:scale-[0.98]">
        <span className="material-symbols-outlined text-[18px]">upload_file</span>
        <span>Select File from Computer</span>
        <input accept="audio/*,video/*,.pdf,.doc,.docx" className="hidden" id="file-input" type="file" />
      </label>
      <span className="font-body-sm text-[11px] text-outline mt-2">
        Supports payloads up to 2.0 GB
      </span>
    </div>
  );
}