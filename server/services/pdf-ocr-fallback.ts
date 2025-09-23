import fs from "fs/promises";
import os from "os";
import path from "path";

export async function ocrPdfToText(buffer: Buffer): Promise<string> {
  try {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "affluvia-ocr-"));
    const pdfPath = path.join(tmpDir, "input.pdf");
    await fs.writeFile(pdfPath, buffer);

    // Dynamically import pdf-poppler and tesseract.js; if unavailable or system deps missing, bail gracefully
    let images: string[] = [];
    try {
      const poppler: any = await import("pdf-poppler");
      // Convert to PNG pages at 300 DPI
      const outputPrefix = path.join(tmpDir, "page");
      await poppler.convert(pdfPath, {
        format: "png",
        out_dir: tmpDir,
        out_prefix: "page",
        page: null,
        dpi: 300,
      });
      // Collect generated images (page-1.png, etc.)
      const files = await fs.readdir(tmpDir);
      images = files.filter((f) => f.startsWith("page-") && f.endsWith(".png")).map((f) => path.join(tmpDir, f));
    } catch (e) {
      console.warn("[OCR] pdf-poppler not available or poppler-utils missing:", (e as any)?.message || e);
      return "";
    }

    if (!images.length) return "";

    let out = "";
    try {
      const { createWorker }: any = await import("tesseract.js");
      const worker = await createWorker("eng", 1);
      await worker.setParameters({
        tessedit_char_whitelist: "0123456789$,-.%()abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ ",
        preserve_interword_spaces: "1",
        tessedit_pageseg_mode: "6",
        user_defined_dpi: "300",
      });
      for (const img of images) {
        const { data: { text } } = await worker.recognize(img);
        out += (text || "") + "\n";
      }
      await worker.terminate();
    } catch (e) {
      console.warn("[OCR] tesseract.js failed:", (e as any)?.message || e);
      return "";
    }
    return out.trim();
  } catch (err) {
    console.warn("[OCR] Fallback failed:", (err as any)?.message || err);
    return "";
  }
}

