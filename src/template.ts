export interface InvoiceData {
  readonly invoiceNumber: string;
  readonly invoiceDate: string;
  readonly hours: number;
  readonly rate: number;
  readonly totalAmount: string;
  readonly totalWordsEN: string;
  readonly totalWordsUA: string;
  readonly paymentDueDate: string;
}

function escapeHTML(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderInvoiceHTML(data: InvoiceData): string {
  const d = {
    invoiceNumber: escapeHTML(data.invoiceNumber),
    invoiceDate: escapeHTML(data.invoiceDate),
    hours: data.hours,
    rate: data.rate,
    totalAmount: escapeHTML(data.totalAmount),
    totalWordsEN: escapeHTML(data.totalWordsEN),
    totalWordsUA: escapeHTML(data.totalWordsUA),
    paymentDueDate: escapeHTML(data.paymentDueDate),
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Invoice ${d.invoiceNumber}</title>
<style>
  @page {
    size: A4;
    margin: 15mm 20mm;
  }

  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10px;
    line-height: 1.3;
    color: #000;
  }

  h1 {
    text-align: center;
    font-size: 13px;
    font-weight: bold;
    margin-bottom: 8px;
    font-style: italic;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  .info-table td {
    border: 1px solid #000;
    padding: 4px 6px;
    vertical-align: top;
    width: 50%;
  }

  .info-table .label {
    font-weight: bold;
  }

  .items-table {
    margin-top: 12px;
  }

  .items-table th,
  .items-table td {
    border: 1px solid #000;
    padding: 4px 6px;
    vertical-align: top;
    text-align: left;
  }

  .items-table th {
    font-weight: bold;
    text-align: left;
  }

  .items-table .col-no { width: 5%; }
  .items-table .col-desc { width: 35%; }
  .items-table .col-qty { width: 14%; }
  .items-table .col-price { width: 16%; }
  .items-table .col-amount { width: 18%; }

  .total-row {
    margin-top: 0;
    width: 100%;
  }

  .total-row td {
    border: 1px solid #000;
    padding: 4px 6px;
    vertical-align: top;
  }

  .legal-text {
    margin-top: 10px;
    font-size: 10px;
    line-height: 1.35;
  }

  .legal-text p {
    margin-bottom: 8px;
  }

  .signature {
    margin-top: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .text-right {
    text-align: right;
  }

  .bank-table {
    width: auto;
    border-collapse: collapse;
    margin-top: 2px;
  }

  .bank-table td {
    border: none;
    padding: 0 8px 0 0;
    vertical-align: top;
  }
</style>
</head>
<body>

<h1>Invoice (offer) / Інвойс (оферта) № ${d.invoiceNumber}</h1>

<table class="info-table">
  <tr>
    <td><span class="label">Date and Place:</span> ${d.invoiceDate}, Kyiv</td>
    <td><span class="label">Дата та місце:</span> ${d.invoiceDate}, м. Київ</td>
  </tr>
  <tr>
    <td>
      <span class="label">Supplier</span> Individual Entrepreneur Doe John<br>
      address: Ukraine, Example str., 1, 01001, Kyiv<br>
      registration code 1234567890
    </td>
    <td>
      <span class="label">Виконавець:</span> ФО-П Доу Джон Батькович, що<br>
      проживає за адресою 01001, Київ, Прикладна, 1<br>
      ІПН - 1234567890
    </td>
  </tr>
  <tr>
    <td>
      <span class="label">Customer:</span> Customer:<br>
      EXAMPLE COMPANY SRL, City, District 1<br>
      Example street no 1, 1st floor<br>
      Tax identification number: RO00000000<br>
      RC: J00/0000/2024<br>
      Bank account no: RO00XXXX0000000000000000<br>
      EXAMPLE BANK
    </td>
    <td>
      <span class="label">Замовник:</span><br>
      EXAMPLE COMPANY SRL, City, District 1<br>
      Example street no 1, 1st floor<br>
      Tax identification number: RO00000000<br>
      RC: J00/0000/2024<br>
      Bank account no: RO00XXXX0000000000000000<br>
      EXAMPLE BANK
    </td>
  </tr>
  <tr>
    <td><span class="label">Subject matter:</span> Information technology services provided under contract</td>
    <td><span class="label">Предмет:</span> Послуги з інформаційних технологій, що надаються за контрактом.</td>
  </tr>
  <tr>
    <td><span class="label">Currency:</span> EUR</td>
    <td><span class="label">Валюта:</span> EUR</td>
  </tr>
  <tr>
    <td><span class="label">Price (amount) of the goods/services :</span> ${d.totalAmount}</td>
    <td><span class="label">Ціна (загальна вартість) товарів/послуг:</span> ${d.totalAmount}</td>
  </tr>
  <tr>
    <td>
      <span class="label">Terms of payments and acceptation:</span><br>
      Postpayment of 100% upon the service delivery. The services being rendered at the location of the Customer.
    </td>
    <td>
      <span class="label">Умови оплати та передачі:</span><br>
      100% післяплата за фактом виконання послуг. Послуги надаються за місцем реєстрації Замовника.
    </td>
  </tr>
  <tr>
    <td>
      <span class="label">Customer Bank information:</span><br>
      Beneficiary: EXAMPLE COMPANY<br>
      Account #:<br>
      RO00XXXX0000000000000000<br>
      Beneficiary&#39;s bank: Example Bank
    </td>
    <td>
      <span class="label">Supplier Bank information:</span>
      <table class="bank-table">
        <tr><td>Beneficiary:</td><td>PE Doe John</td></tr>
        <tr><td>SEPA:</td><td>GB00XXXX00000000000000</td></tr>
        <tr><td>BIC:</td><td>XXXXGB00</td></tr>
        <tr><td>Receiver:</td><td>DOE JOHN</td></tr>
      </table>
    </td>
  </tr>
</table>

<table class="items-table">
  <thead>
    <tr>
      <th class="col-no">&#8470;</th>
      <th class="col-desc">Description/<br>Опис</th>
      <th class="col-qty">Quantity/<br>Кількість</th>
      <th class="col-price">Price,EUR<br>Ціна, Євро</th>
      <th class="col-amount">Amount, EUR /<br>Загальна вартість,<br>Євро</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1</td>
      <td>Information technology services provided under contract / Послуги з інформаційних технологій, що надаються за контрактом</td>
      <td>${d.hours}</td>
      <td>${d.rate}</td>
      <td>${d.totalAmount}</td>
    </tr>
    <tr>
      <td></td>
      <td></td>
      <td></td>
      <td class="text-right"><strong>Total/Усього:</strong></td>
      <td>${d.totalAmount}</td>
    </tr>
  </tbody>
</table>

<table class="total-row" style="margin-top: 0;">
  <tr>
    <td style="border: 1px solid #000; width: 60%;">
      Total to pay/ &nbsp;${d.totalWordsEN}.<br>
      Усього до сплати: &nbsp;${d.totalWordsUA}.
    </td>
    <td style="border: 1px solid #000; text-align: right; width: 40%; vertical-align: middle;">
      ${d.totalAmount}
    </td>
  </tr>
</table>

<div class="legal-text">
  <p>All charges of correspondent banks are at the Customer&#39;s expenses. / Усі комісії банків-кореспондентів сплачує Замовник.</p>

  <p>This Invoice is an offer to enter into the agreement. Payment according hereto shall be deemed as an acceptation of the offer to enter into the agreement on the terms and conditions set out herein. Payment according hereto may be made not later than ${d.paymentDueDate}./ Цей Інвойс є пропозицією укласти договір. Оплата за цим Інвойсом є прийняттям пропозиції укласти договір на умовах, викладених в цьому Інвойсі. Оплата за цим інвойсом може бути здійснена не пізніше ${d.paymentDueDate}.</p>

  <p>Please note, that payment according hereto at the same time is the evidence of the work performance and the service delivery in full scope, acceptation thereof and the confirmation of final mutual installments between Parties. / Оплата згідно цього Інвойсу одночасно є свідченням виконання робіт та надання послуг в повному обсязі, їх прийняття, а також підтвердженням кінцевих розрахунків між Сторонами.</p>

  <p>Payment according hereto shall be also the confirmation that Parties have no claims to each other and have no intention to submit any claims. The agreement shall not include penalty and fine clauses. / Оплата згідно цього Інвойсу є підтвердженням того, що Сторони не мають взаємних претензій та не мають наміру направляти рекламації. Договір не передбачає штрафних санкцій.</p>

  <p>The Parties shall not be liable for non-performance or improper performance of the obligations under the agreement during the term of insuperable force circumstances. / Сторони звільняються від відповідальності за невиконання чи неналежне виконання зобов&#39;язань за договором на час дії форс-мажорних обставин.</p>

  <p>Any disputes arising out of the agreement between the Parties shall be settled by the competent court at the location of a defendant. / Всі спори, що виникнуть між Сторонами по договору будуть розглядатись компетентним судом за місцезнаходженням відповідача.</p>
</div>

<div class="signature">
  <span>Supplier/Виконавець: ________________</span>
  <span>(Doe John / Доу Д.Б.)</span>
</div>

</body>
</html>`;
}
