"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Checkbox from "@/components/ui/Checkbox";
import TextInput from "@/components/ui/TextInput";
import { createClient } from "@/lib/supabase/client";

type Platform =
  | "linkedin"
  | "x"
  | "newsletter"
  | "youtube_shorts"
  | "tiktok"
  | "instagram";

// Single source of truth: QuickSchedule channel id -> v4_distribution_jobs.platform.
const CHANNEL_PLATFORM: Record<string, Platform> = {
  linkedin: "linkedin",
  twitter: "x",
  substack: "newsletter",
  shorts: "youtube_shorts",
};

const CHANNELS = [
  { id: "linkedin", label: "LinkedIn Creator", checked: true },
  { id: "twitter", label: "Twitter / X Relay", checked: true },
  { id: "substack", label: "Substack Broadcast", checked: false },
  { id: "shorts", label: "Shorts / TikTok", checked: false },
];

const DEFAULT_DATE = new Date().toISOString().slice(0, 10);
const DEFAULT_TIME = "09:00";

export default function QuickScheduleModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [channels, setChannels] = useState(CHANNELS);
  const [copy, setCopy] = useState("");
  const [date, setDate] = useState(DEFAULT_DATE);
  const [time, setTime] = useState(DEFAULT_TIME);
  const [saving, setSaving] = useState(false);
  const [queued, setQueued] = useState(false);
  const [error, setError] = useState("");

  const toggleChannel = (id: string) =>
    setChannels((cs) => cs.map((c) => (c.id === id ? { ...c, checked: !c.checked } : c)));

  const handleQueue = async () => {
    if (saving) return;
    setSaving(true);
    setError("");

    const client = createClient();
    const uid = (await client.auth.getUser()).data.user?.id;
    if (!uid) {
      setSaving(false);
      setError("Sign-in required.");
      return;
    }

    const selected = channels.filter((c) => c.checked);
    if (selected.length === 0) {
      setSaving(false);
      setError("Select at least one channel.");
      return;
    }

    const parsed = new Date(`${date}T${time}:00`);
    if (Number.isNaN(parsed.getTime())) {
      setSaving(false);
      setError("Enter a valid publish date and time.");
      return;
    }
    const scheduledAt = parsed.toISOString();

    let firstError: string | null = null;
    for (const channel of selected) {
      const { error: insertError } = await client
        .from("v4_distribution_jobs")
        .insert({
          user_id: uid,
          platform: CHANNEL_PLATFORM[channel.id],
          status: "scheduled",
          scheduled_at: scheduledAt,
          output_id: null,
          run_id: null,
        });
      if (insertError && !firstError) firstError = insertError.message;
    }
    if (firstError) {
      setSaving(false);
      setError(firstError);
      return;
    }

    // All rows were written — reset the form, hold an honest success state, then close.
    setChannels(CHANNELS);
    setCopy("");
    setDate(DEFAULT_DATE);
    setTime(DEFAULT_TIME);
    setSaving(false);
    setQueued(true);
    router.refresh();
    setTimeout(() => {
      setQueued(false);
      setOpen(false);
    }, 1200);
  };

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Icon name="add_circle" size={16} />
        <span>New Direct Schedule</span>
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New Direct Schedule"
        footer={
          queued ? (
            <span className="font-body-medium text-body-medium text-tertiary flex items-center gap-2">
              <Icon name="check_circle" size={18} /> Queued to distribution
            </span>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleQueue} loading={saving}>
                Push to Queue
              </Button>
            </>
          )
        }
      >
        {error && (
          <p className="font-body-sm text-body-sm text-error mb-space-md">{error}</p>
        )}
        <p className="font-body-sm text-body-sm text-secondary mb-space-md">
          Bypass review agent and immediately inject deliverable to distribution pipes.
        </p>
        <p className="font-body-sm text-body-sm text-secondary mb-space-md">
          Queued jobs appear on your publish timeline.
        </p>
        <div className="space-y-space-md">
          <div className="space-y-1.5">
            <label className="font-caption-bold text-caption-bold text-on-surface">
              Target Distribution Pipes
            </label>
            <div className="grid grid-cols-2 gap-2">
              {channels.map((channel) => (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => toggleChannel(channel.id)}
                  className={`flex items-center gap-2 p-2.5 rounded-lg cursor-pointer transition-colors ${
                    channel.checked
                      ? "bg-primary-fixed/20 hover:bg-primary-fixed/30"
                      : "bg-surface-container-low hover:bg-surface-container"
                  }`}
                >
                  <Checkbox checked={channel.checked} onChange={() => toggleChannel(channel.id)} />
                  <span className="font-body-sm text-body-sm text-on-surface font-medium">
                    {channel.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="font-caption-bold text-caption-bold text-on-surface">
              Content Copy / Anchor
            </label>
            <textarea
              className="w-full p-3 rounded-lg bg-surface-container-low border-0 text-on-surface font-body-sm text-body-sm focus:ring-2 focus:ring-primary resize-none"
              placeholder="Compose or paste finalized distribution copy..."
              rows={3}
              value={copy}
              onChange={(e) => setCopy(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-space-sm">
            <div className="space-y-1">
              <label className="font-caption-bold text-caption-bold text-on-surface">
                Publish Date
              </label>
              <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="font-caption-bold text-caption-bold text-on-surface">
                Time Slot (EDT)
              </label>
              <TextInput type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}