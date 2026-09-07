import LegalDoc, { LegalHeading } from "@/components/legal-doc";

const CONTACT = "support@repurpose-ai.app";

export const metadata = {
  title: "Privacy Policy — Repurpose AI"
};

export default function PrivacyPage() {
  return (
    <LegalDoc title="Privacy Policy" updated="September 2026">
      <section>
        <LegalHeading>What we store</LegalHeading>
        <p>
          When you use the service we hold: your account (email address and password — the
          password is stored by the authentication provider, not by us), the audio/video files you
          upload, transcripts made from them, the written drafts we generate, and any prompt or
          brand-voice settings you save.
        </p>
        <p>
          If you connect a YouTube account, we additionally store a connection record: your channel
          id and name, and encrypted session tokens that let us read your own videos&apos; titles and
          captions on your behalf. The tokens are stored encrypted with a key held only by us, and
          you can revoke the connection at any time from the upload page (which also deletes the
          stored tokens).
        </p>
      </section>

      <section>
        <LegalHeading>Why we keep it</LegalHeading>
        <p>
          The content you give us is processed to produce your drafts and so you can open, edit,
          and regenerate them later. We don&apos;t sell your data, and we don&apos;t use your recordings or
          transcripts to train anyone&apos;s models beyond the normal operation of the providers below.
        </p>
      </section>

      <section>
        <LegalHeading>Who processes the data</LegalHeading>
        <p>
          Making a draft touches several third-party services, each with its own privacy policy:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Supabase — hosting your account, database, and uploaded files.</li>
          <li>Vercel — hosting the app itself.</li>
          <li>AssemblyAI — turning your audio/video into a text transcript.</li>
          <li>Google Gemini and/or OpenRouter — generating the drafts from the transcript.</li>
          <li>Google (YouTube) — only if you connect a YouTube account; we read your own
            videos&apos; titles and captions through the official YouTube API, in line with Google&apos;s
            API user-data policy.</li>
        </ul>
        <p>
          Each of these sees only what it needs: for example, AssemblyAI sees your audio, Google
          Gemini sees your transcript plus the prompt.
        </p>
      </section>

      <section>
        <LegalHeading>When content is deleted</LegalHeading>
        <p>
          Deleting a single recording from the dashboard removes its audio file, transcript, and
          drafts. Deleting your account removes your account details. Data is also removed from the
          providers above on the schedules they publish. Because drafts run through automated
          services, some copies can linger in backups or caches for a short time afterward.
        </p>
      </section>

      <section>
        <LegalHeading>Children</LegalHeading>
        <p>
          The service isn&apos;t directed at children, and we don&apos;t knowingly collect their personal
          information. If you believe a child&apos;s data has been uploaded, contact us and we&apos;ll
          remove it.
        </p>
      </section>

      <section>
        <LegalHeading>Questions & changes</LegalHeading>
        <p>
          Email us at{" "}
          <a className="font-medium text-primary-500 hover:underline" href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>{" "}
          with any privacy questions. If this policy changes materially, the &ldquo;last
          updated&rdquo; date above will change so returning visitors can spot the difference.
        </p>
      </section>
    </LegalDoc>
  );
}