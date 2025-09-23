export async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const mod: any = await import("pdf-parse");
    const pdfParse = (mod && (mod.default || mod)) as Function;
    // Some builds prefer an object with data; others accept Buffer directly
    const res = await pdfParse(buffer?.byteLength ? buffer : { data: buffer });
    const text = (res?.text || "").toString().trim();
    return text;
  } catch (e) {
    console.warn("[PDF] Failed to parse via pdf-parse:", (e as any)?.message || e);
    try {
      // Second attempt: pass as object
      const mod: any = await import("pdf-parse");
      const pdfParse = (mod && (mod.default || mod)) as Function;
      const res = await pdfParse({ data: buffer });
      const text = (res?.text || "").toString().trim();
      return text;
    } catch (e2) {
      console.warn("[PDF] Second attempt failed:", (e2 as any)?.message || e2);
      return "";
    }
  }
}
