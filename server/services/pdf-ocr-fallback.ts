// Backward-compatible wrapper that now delegates to the native OCR engine
export async function ocrPdfToText(buffer: Buffer): Promise<string> {
  try {
    const { ocrFirstTwentyPages } = await import("./ocr-engine");
    // Respect env-configured limits; default behavior handles 20 pages and time budget
    return await ocrFirstTwentyPages(buffer);
  } catch (err) {
    console.warn("[OCR] Fallback wrapper failed:", (err as any)?.message || err);
    return "";
  }
}
