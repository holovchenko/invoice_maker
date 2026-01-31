import puppeteer from "puppeteer";
import path from "path";
import fs from "fs";

const OUTPUT_DIR = path.resolve(process.cwd(), "output");

export async function generatePDF(
  html: string,
  fileName: string
): Promise<string> {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const filePath = path.join(OUTPUT_DIR, fileName);
  const browser = await puppeteer.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.pdf({
      path: filePath,
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
    });
  } finally {
    await browser.close();
  }

  return filePath;
}
