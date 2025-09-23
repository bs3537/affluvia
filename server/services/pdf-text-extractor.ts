import pdfParse from "pdf-parse";

export async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer);
    const text = (data.text || "").trim();
    return text;
  } catch (e) {
    console.warn("[PDF] Failed to parse PDF via pdf-parse:", (e as any)?.message || e);
    return "";
  }
}

