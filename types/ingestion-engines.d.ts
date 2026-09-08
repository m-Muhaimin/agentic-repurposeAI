// Ambient types for the Node-only ingestion engines' dependencies. These two
// packages ship no bundled types; the declarations here cover exactly the
// surface the engines use. Kept in `types/` (included by tsconfig) so the
// server-only engines module can stay dependency-free of DefinitelyTyped.

declare module "pdf-parse" {
  interface PdfParseResult {
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: unknown;
    text: string;
    version: string;
  }
  function pdfParse(dataBuffer: Buffer): Promise<PdfParseResult>;
  export = pdfParse;
}

// The side-effect-free parser entry actually used by the engines (the package
// root runs a debug self-test under ESM transforms that reads missing test
// fixtures). Same export shape as "pdf-parse".
declare module "pdf-parse/lib/pdf-parse.js" {
  interface PdfParseResult {
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: unknown;
    text: string;
    version: string;
  }
  function pdfParse(dataBuffer: Buffer): Promise<PdfParseResult>;
  export = pdfParse;
}

declare module "mammoth" {
  interface MammothMessage {
    type: string;
    message: string;
  }
  interface MammothRawTextResult {
    value: string;
    messages: MammothMessage[];
  }
  function extractRawText(input: { buffer: Buffer }): Promise<MammothRawTextResult>;
  export { extractRawText };
}