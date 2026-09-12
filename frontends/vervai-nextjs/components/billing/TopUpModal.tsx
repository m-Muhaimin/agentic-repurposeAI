"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";

type Pack = { credits: string; price: string; per: string; highlighted?: boolean };

const PACKS: Pack[] = [
  { credits: "50", price: "$29", per: "$0.58 / credit" },
  { credits: "200", price: "$99", per: "$0.49 / credit", highlighted: true },
  { credits: "500", price: "$219", per: "$0.44 / credit" },
];

export default function TopUpModal() {
  const [open, setOpen] = useState(false);
  const [purchased, setPurchased] = useState(false);

  const handlePurchase = () => {
    setPurchased(true);
    setTimeout(() => {
      setPurchased(false);
      setOpen(false);
    }, 1200);
  };

  return (
    <>
      <Button variant="secondary" disabled title="Coming soon" onClick={() => setOpen(true)}>
        <Icon name="add_circle" size={18} className="text-primary" />
        <span>Add On-Demand Credits</span>
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add On-Demand Credits"
        footer={
          purchased ? (
            <span className="font-body-medium text-body-medium text-tertiary flex items-center gap-2">
              <Icon name="check_circle" size={18} /> Credits provisioned
            </span>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handlePurchase}>Purchase &amp; Provision</Button>
            </>
          )
        }
      >
        <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-md">
          Select a credit pack. Credits are immediately available for Whisper-v3, generative pipelines,
          and vector embeddings.
        </p>
        <div className="space-y-space-sm">
          {PACKS.map((pack) => (
            <div
              key={pack.credits}
              className={`flex items-center justify-between p-space-md rounded-xl border transition-colors cursor-pointer ${
                pack.highlighted
                  ? "border-primary bg-primary-fixed/10"
                  : "border-outline-variant/40 bg-surface-container-low hover:bg-surface-container"
              }`}
            >
              <div>
                <span className="font-headline-md text-headline-md text-on-surface">{pack.credits}</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant ml-1">credits</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant ml-2">({pack.per})</span>
              </div>
              <span className="font-headline-sm text-headline-sm text-on-surface">{pack.price}</span>
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}