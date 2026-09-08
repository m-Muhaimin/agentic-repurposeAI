export const BRAND = {
  name: "VervAI",
  shortName: "VervAI",
  tagline: "Turn your content into your next best content.",
  description:
    "VervAI understands your content, recommends what to create next, and helps you create, review, and publish it.",
} as const;

/** Product display name — same as BRAND.name for now. */
export function productName(): string {
  return BRAND.name;
}
