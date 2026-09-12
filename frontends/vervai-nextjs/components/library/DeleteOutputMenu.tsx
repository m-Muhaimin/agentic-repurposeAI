"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";

type DeleteOutputMenuProps = {
  outputId: string;
  title: string;
};

export default function DeleteOutputMenu({ outputId, title }: DeleteOutputMenuProps) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/outputs/${outputId}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? "Delete failed");
        setDeleting(false);
        return;
      }
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      setDeleting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        aria-label={`Delete ${title}`}
        onClick={() => setOpen(true)}
        className="p-1 rounded text-secondary hover:text-error hover:bg-surface-container transition-colors"
      >
        <span className="material-symbols-outlined text-[18px]">more_vert</span>
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Delete “${title}”?`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              className="!bg-error !text-on-error hover:!bg-on-error-container"
              loading={deleting}
              disabled={deleting}
              onClick={handleDelete}
            >
              Delete Output
            </Button>
          </>
        }
      >
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          This removes the output. This cannot be undone.
        </p>
        {error ? (
          <p className="font-body-sm text-body-sm text-error mt-space-sm">{error}</p>
        ) : null}
      </Modal>
    </>
  );
}