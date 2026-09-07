import { GoogleGenerativeAI } from "@google/generative-ai";
import { retryOnOverload } from "./retry";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const MODEL = "gemini-3.6-flash";

const YOUTUBE_URL_PATTERN =
  /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)[\w-]+/i;

export function isValidYoutubeUrl(url: string): boolean {
  return YOUTUBE_URL_PATTERN.test(url.trim());
}

/**
 * Gemini can watch a public YouTube video directly when given its URL as a
 * file part — no download, no separate transcription API, no storage cost.
 * Note: the video must be public (or unlisted); private videos will fail.
 * There's also a ~1 hour practical duration ceiling on this capability today.
 */
export async function transcribeYoutubeUrl(youtubeUrl: string): Promise<string> {
  const model = genAI.getGenerativeModel({ model: MODEL });

  const result = await retryOnOverload(() =>
    model.generateContent([
      {
        fileData: {
          fileUri: youtubeUrl,
          mimeType: "video/*"
        }
      },
      {
        text:
          "Produce a clean, accurate, speaker-labeled transcript of this video's spoken content. " +
          "Do not summarize — write out what is actually said, as close to verbatim as you can. " +
          "Omit filler sounds (um, uh) but keep the actual words and meaning intact."
      }
    ])
  );

  return result.response.text();
}
