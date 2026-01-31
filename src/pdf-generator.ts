import puppeteer from "puppeteer";
import path from "path";
import fs from "fs";

const OUTPUT_DIR = path.resolve(process.cwd(), "output");

function getUniqueFilePath(dir: string, fileName: string): string {
  const ext = path.extname(fileName);
  const base = path.basename(fileName, ext);
  let filePath = path.join(dir, fileName);
  let counter = 1;

  while (fs.existsSync(filePath)) {
    filePath = path.join(dir, `${base}_${counter}${ext}`);
    counter++;
  }

  return filePath;
}

export async function generatePDF(
  html: string,
  fileName: string
): Promise<string> {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const filePath = getUniqueFilePath(OUTPUT_DIR, fileName);
  const browser = await puppeteer.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.pdf({
      path: filePath,
      preferCSSPageSize: true,
      printBackground: true,
    });
  } finally {
    await browser.close();
  }

  return filePath;
}
