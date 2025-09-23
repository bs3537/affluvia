import fs from "fs/promises";
import os from "os";
import path from "path";
import { execFile } from "node:child_process";

function execFileAsync(cmd: string, args: string[], cwd?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { cwd }, (error) => {
      if (error) return reject(error);
      resolve();
    });
  });
}

export async function ocrPdfToText(buffer: Buffer): Promise<string> {
  try {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "affluvia-ocr-"));
    const pdfPath = path.join(tmpDir, "input.pdf");
    await fs.writeFile(pdfPath, buffer);

    // Dynamically import pdf-poppler and tesseract.js; if unavailable or system deps missing, bail gracefully
    let images: string[] = [];
    try {
      const poppler: any = await import("pdf-poppler");
      const outputPrefix = path.join(tmpDir, "page");
      await poppler.convert(pdfPath, { format: "png", out_dir: tmpDir, out_prefix: "page", page: null, dpi: 300 });
      const files = await fs.readdir(tmpDir);
      images = files.filter((f) => f.startsWith("page-") && f.endsWith(".png")).map((f) => path.join(tmpDir, f));
    } catch (e: any) {
      const msg = (e?.message || e) as string;
      console.warn("[OCR] pdf-poppler failed, trying system pdftoppm:", msg);
      try {
        // System fallback: pdftoppm -png -r 300 input.pdf page
        await execFileAsync("pdftoppm", ["-png", "-r", "300", pdfPath, "page"], tmpDir);
        const files = await fs.readdir(tmpDir);
        images = files.filter((f) => f.startsWith("page-") && f.endsWith(".png")).map((f) => path.join(tmpDir, f));
      } catch (e2) {
        console.warn("[OCR] System pdftoppm unavailable:", (e2 as any)?.message || e2);
        return "";
      }
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
