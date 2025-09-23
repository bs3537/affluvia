import fs from "fs/promises";
import os from "os";
import path from "path";
import { execFile } from "node:child_process";
import fsSync from "fs";

function execFileAsync(cmd: string, args: string[], cwd?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { cwd }, (error) => {
      if (error) return reject(error);
      resolve();
    });
  });
}

async function fileExists(p: string): Promise<boolean> {
  try { await fs.access(p); return true; } catch { return false; }
}

function resolveBinarySync(cmd: string): string | null {
  const pathEnv = process.env.PATH || "";
  const sep = process.platform === 'win32' ? ';' : ':';
  const PATHS = ["/opt/homebrew/bin", "/usr/local/bin", ...pathEnv.split(sep).filter(Boolean)];
  for (const dir of PATHS) {
    const full = path.join(dir, cmd);
    try {
      fsSync.accessSync(full, fsSync.constants.X_OK);
      return full;
    } catch {}
  }
  return null;
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
      // Convert only first 3 pages to control latency
      for (let i = 1; i <= 3; i++) {
        await poppler.convert(pdfPath, { format: "png", out_dir: tmpDir, out_prefix: "page", page: i, dpi: 300 });
      }
      const files = await fs.readdir(tmpDir);
      images = files.filter((f) => f.startsWith("page-") && f.endsWith(".png")).sort().map((f) => path.join(tmpDir, f));
    } catch (e: any) {
      const msg = (e?.message || e) as string;
      console.warn("[OCR] pdf-poppler failed, trying system pdftoppm:", msg);
      try {
        // System fallback: pdftoppm -png -r 300 input.pdf page
        const bin = resolveBinarySync("pdftoppm") || "pdftoppm";
        // Limit to first 3 pages
        await execFileAsync(bin, ["-png", "-r", "300", "-f", "1", "-l", "3", pdfPath, "page"], tmpDir);
        const files = await fs.readdir(tmpDir);
        images = files.filter((f) => f.startsWith("page-") && f.endsWith(".png")).sort().map((f) => path.join(tmpDir, f));
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
      // OCR only first 3 page images as additional guard
      for (const img of images.slice(0, 3)) {
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
