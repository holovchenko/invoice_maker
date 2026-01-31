import express from "express";
import path from "path";
import { addBusinessDays } from "./business-days";
import { amountToWordsEN, amountToWordsUA } from "./number-to-words";
import {
  formatAmount,
  formatDate,
  generateInvoiceNumber,
  generateFileName,
} from "./format";
import { renderInvoiceHTML } from "./template";
import { generatePDF } from "./pdf-generator";

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(import.meta.dirname, "public")));

app.post("/api/generate", async (req, res) => {
  try {
    const { date, hours, rate } = req.body;
    const invoiceDate = new Date(date);
    const totalAmount = hours * rate;
    const paymentDueDate = addBusinessDays(invoiceDate, 20);

    const data = {
      invoiceNumber: generateInvoiceNumber(invoiceDate),
      invoiceDate: formatDate(invoiceDate),
      hours,
      rate,
      totalAmount: formatAmount(totalAmount),
      totalWordsEN: amountToWordsEN(totalAmount),
      totalWordsUA: amountToWordsUA(totalAmount),
      paymentDueDate: formatDate(paymentDueDate),
    };

    const html = renderInvoiceHTML(data);
    const fileName = generateFileName(invoiceDate);
    const filePath = await generatePDF(html, fileName);

    res.download(filePath, fileName);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

app.listen(PORT, () => {
  console.log(`Invoice maker running at http://localhost:${PORT}`);
});
