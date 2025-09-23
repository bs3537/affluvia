export async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const mod: any = await import("pdf-parse");
    const pdfParse = (mod && (mod.default || mod)) as Function;
    // Some builds prefer an object with data; others accept Buffer directly
    if (!buffer || !(buffer instanceof Buffer) || buffer.byteLength === 0) return "";
    let res = await pdfParse(buffer);
    const text = (res?.text || "").toString().trim();
    return text;
  } catch (e) {
    // Downgrade to debug-level logging to avoid noisy console in production
    console.info("[PDF] Fast path failed; trying object form:", (e as any)?.message || e);
    try {
      // Second attempt: pass as object
      const mod: any = await import("pdf-parse");
      const pdfParse = (mod && (mod.default || mod)) as Function;
      const res = await pdfParse({ data: buffer });
      const text = (res?.text || "").toString().trim();
      return text;
    } catch (e2) {
      console.info("[PDF] Second attempt failed; will try OCR fallback:", (e2 as any)?.message || e2);
      return "";
    }
  }
}
