import { describe, it, expect } from "vitest";
import { renderInvoiceHTML, InvoiceData } from "./template.js";
import type { SupplierConfig, CustomerConfig } from "./config.js";

const SAMPLE_DATA: InvoiceData = {
  invoiceNumber: "2025-12",
  invoiceDate: "31.12.2025",
  hours: 178,
  rate: 29,
  totalAmount: "5 162",
  totalWordsEN: "five thousand one hundred sixty-two euros",
  totalWordsUA: "п'ять тисяч сто шістдесят два євро",
  paymentDueDate: "28.01.2026",
};

const SAMPLE_SUPPLIER: SupplierConfig = {
  nameEN: "Individual Entrepreneur Doe John",
  nameUA: "ФО-П Доу Джон Батькович",
  addressEN: "Ukraine, Example str., 1, 01001, Kyiv",
  addressUA: "01001, Київ, Прикладна, 1",
  registrationCode: "1234567890",
  signatureEN: "Doe John",
  signatureUA: "Доу Д.Б.",
  bank: {
    beneficiary: "PE Doe John",
    sepa: "GB00XXXX00000000000000",
    bic: "XXXXGB00",
    receiver: "DOE JOHN",
  },
  fileNamePattern: "{surname}_Invoice_{month}_{customerShort}_{year}.pdf",
  surname: "Doe",
  customerShort: "Client",
};

const SAMPLE_CUSTOMER: CustomerConfig = {
  nameEN: "EXAMPLE COMPANY SRL",
  locationEN: "City, District 1\nExample street no 1, 1st floor",
  taxId: "RO00000000",
  registrationCode: "J00/0000/2024",
  bankAccount: "RO00XXXX0000000000000000",
  bankName: "EXAMPLE BANK",
  bank: {
    beneficiary: "EXAMPLE COMPANY",
    account: "RO00XXXX0000000000000000",
    bankName: "Example Bank",
  },
};

describe("renderInvoiceHTML", () => {
  it("returns a complete HTML document", () => {
    const html = renderInvoiceHTML(SAMPLE_DATA, SAMPLE_SUPPLIER, SAMPLE_CUSTOMER);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
  });

  it("includes the invoice number in the header", () => {
    const html = renderInvoiceHTML(SAMPLE_DATA, SAMPLE_SUPPLIER, SAMPLE_CUSTOMER);
    expect(html).toContain("Invoice (offer) / Інвойс (оферта) № 2025-12");
  });

  it("includes date and place in both languages", () => {
    const html = renderInvoiceHTML(SAMPLE_DATA, SAMPLE_SUPPLIER, SAMPLE_CUSTOMER);
    expect(html).toContain("Date and Place:");
    expect(html).toContain("31.12.2025, Kyiv");
    expect(html).toContain("Дата та місце:");
    expect(html).toContain("31.12.2025, м. Київ");
  });

  it("includes supplier information from config", () => {
    const html = renderInvoiceHTML(SAMPLE_DATA, SAMPLE_SUPPLIER, SAMPLE_CUSTOMER);
    expect(html).toContain("Individual Entrepreneur Doe John");
    expect(html).toContain("registration code 1234567890");
    expect(html).toContain("ФО-П Доу Джон Батькович");
  });

  it("includes customer information from config", () => {
    const html = renderInvoiceHTML(SAMPLE_DATA, SAMPLE_SUPPLIER, SAMPLE_CUSTOMER);
    expect(html).toContain("EXAMPLE COMPANY SRL, City, District 1");
    expect(html).toContain("RO00000000");
    expect(html).toContain("J00/0000/2024");
    expect(html).toContain("RO00XXXX0000000000000000");
  });

  it("includes subject matter in both languages", () => {
    const html = renderInvoiceHTML(SAMPLE_DATA, SAMPLE_SUPPLIER, SAMPLE_CUSTOMER);
    expect(html).toContain("Information technology services provided under contract");
    expect(html).toContain("Послуги з інформаційних технологій, що надаються за контрактом");
  });

  it("includes currency", () => {
    const html = renderInvoiceHTML(SAMPLE_DATA, SAMPLE_SUPPLIER, SAMPLE_CUSTOMER);
    expect(html).toMatch(/Currency:.*EUR/s);
    expect(html).toMatch(/Валюта:.*EUR/s);
  });

  it("includes total amount in the price row", () => {
    const html = renderInvoiceHTML(SAMPLE_DATA, SAMPLE_SUPPLIER, SAMPLE_CUSTOMER);
    expect(html).toContain("Price (amount) of the goods/services :");
    expect(html).toMatch(/Price \(amount\) of the goods\/services :.*5 162/s);
    expect(html).toMatch(/Ціна \(загальна вартість\) товарів\/послуг:.*5 162/s);
  });

  it("includes payment terms in both languages", () => {
    const html = renderInvoiceHTML(SAMPLE_DATA, SAMPLE_SUPPLIER, SAMPLE_CUSTOMER);
    expect(html).toContain("Postpayment of 100% upon the service delivery");
    expect(html).toContain("100% післяплата за фактом виконання послуг");
  });

  it("includes bank information for both parties", () => {
    const html = renderInvoiceHTML(SAMPLE_DATA, SAMPLE_SUPPLIER, SAMPLE_CUSTOMER);
    expect(html).toContain("Customer Bank information:");
    expect(html).toContain("Supplier Bank information:");
    expect(html).toContain("Beneficiary: EXAMPLE COMPANY");
    expect(html).toContain("PE Doe John");
    expect(html).toContain("GB00XXXX00000000000000");
    expect(html).toContain("XXXXGB00");
  });

  it("includes the items table with hours and rate", () => {
    const html = renderInvoiceHTML(SAMPLE_DATA, SAMPLE_SUPPLIER, SAMPLE_CUSTOMER);
    expect(html).toContain("178");
    expect(html).toContain("29");
    expect(html).toContain("5 162");
  });

  it("includes total to pay in both languages", () => {
    const html = renderInvoiceHTML(SAMPLE_DATA, SAMPLE_SUPPLIER, SAMPLE_CUSTOMER);
    expect(html).toContain("Total to pay/");
    expect(html).toContain("five thousand one hundred sixty-two euros");
    expect(html).toContain("Усього до сплати:");
    expect(html).toContain("п&#39;ять тисяч сто шістдесят два євро");
  });

  it("includes the payment due date in legal text", () => {
    const html = renderInvoiceHTML(SAMPLE_DATA, SAMPLE_SUPPLIER, SAMPLE_CUSTOMER);
    expect(html).toContain("not later than 28.01.2026");
    expect(html).toContain("не пізніше 28.01.2026");
  });

  it("includes all legal paragraphs", () => {
    const html = renderInvoiceHTML(SAMPLE_DATA, SAMPLE_SUPPLIER, SAMPLE_CUSTOMER);
    expect(html).toContain("All charges of correspondent banks are at the Customer");
    expect(html).toContain("This Invoice is an offer to enter into the agreement");
    expect(html).toContain("Please note, that payment according hereto");
    expect(html).toContain("Payment according hereto shall be also the confirmation");
    expect(html).toContain("The Parties shall not be liable for non-performance");
    expect(html).toContain("Any disputes arising out of the agreement");
  });

  it("includes the signature line with config values", () => {
    const html = renderInvoiceHTML(SAMPLE_DATA, SAMPLE_SUPPLIER, SAMPLE_CUSTOMER);
    expect(html).toContain("Supplier/Виконавець:");
    expect(html).toContain("Doe John / Доу Д.Б.");
  });

  it("sets A4 page size in CSS", () => {
    const html = renderInvoiceHTML(SAMPLE_DATA, SAMPLE_SUPPLIER, SAMPLE_CUSTOMER);
    expect(html).toContain("A4");
  });

  it("uses sans-serif font", () => {
    const html = renderInvoiceHTML(SAMPLE_DATA, SAMPLE_SUPPLIER, SAMPLE_CUSTOMER);
    expect(html).toMatch(/arial|sans-serif/i);
  });

  it("does not mutate the input data", () => {
    const data: InvoiceData = { ...SAMPLE_DATA };
    const frozen = JSON.stringify(data);
    renderInvoiceHTML(data, SAMPLE_SUPPLIER, SAMPLE_CUSTOMER);
    expect(JSON.stringify(data)).toBe(frozen);
  });

  it("produces different output for different invoice numbers", () => {
    const html1 = renderInvoiceHTML(SAMPLE_DATA, SAMPLE_SUPPLIER, SAMPLE_CUSTOMER);
    const html2 = renderInvoiceHTML({ ...SAMPLE_DATA, invoiceNumber: "2026-01" }, SAMPLE_SUPPLIER, SAMPLE_CUSTOMER);
    expect(html1).not.toBe(html2);
    expect(html2).toContain("2026-01");
  });

  it("uses different supplier when config changes", () => {
    const altSupplier: SupplierConfig = {
      ...SAMPLE_SUPPLIER,
      nameEN: "Individual Entrepreneur Smith Jane",
      signatureEN: "Smith Jane",
    };
    const html = renderInvoiceHTML(SAMPLE_DATA, altSupplier, SAMPLE_CUSTOMER);
    expect(html).toContain("Individual Entrepreneur Smith Jane");
    expect(html).toContain("Smith Jane");
    expect(html).not.toContain("Individual Entrepreneur Doe John");
  });

  it("uses different customer when config changes", () => {
    const altCustomer: CustomerConfig = {
      ...SAMPLE_CUSTOMER,
      nameEN: "ACME CORP SRL",
      taxId: "RO99999999",
    };
    const html = renderInvoiceHTML(SAMPLE_DATA, SAMPLE_SUPPLIER, altCustomer);
    expect(html).toContain("ACME CORP SRL");
    expect(html).toContain("RO99999999");
    expect(html).not.toContain("EXAMPLE COMPANY SRL");
  });
});
