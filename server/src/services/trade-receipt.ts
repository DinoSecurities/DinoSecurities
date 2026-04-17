/**
 * Trade-confirmation PDF generator.
 *
 * Builds a printable trade-confirmation document for every settled
 * atomic DvP on DinoSecurities. Format is loosely modeled on Rule
 * 10b-10 broker-dealer trade confirmations — but the cover page
 * explicitly disclaims that DinoSecurities is NOT a registered
 * broker-dealer and this document is NOT a regulatory filing.
 * Issuers running under the platform's Transfer Hook can use it as
 * their own record-keeping artifact for holders.
 *
 * Output: a Buffer containing a PDF/1.4 document, one page per
 * settlement, ~20-40 KB uncompressed.
 */
import PDFDocument from "pdfkit";
import QRCode from "qrcode";

export interface SettlementReceiptData {
  signature: string;
  settledAt: Date;
  buyer: string | null;
  seller: string | null;
  securityMint: string;
  securitySymbol?: string | null;
  securityName?: string | null;
  isin?: string | null;
  tokenAmount: number;
  usdcAmount: number; // micro-USDC (6 decimals) as stored
  paymentMintLabel?: string; // "USDC — EPjFWdd5…wyTDt1v"
  feeLamports?: number | null;
  finalityMs?: number | null;
  slot?: number | null;
  restriction?: string | null;
}

const INK = "#0a0a0f";
const MUTED = "#6b6b7a";
const RULE = "#e3e3e8";
const DINO = "#5b2fc9";

function truncate(s: string, head = 8, tail = 6) {
  if (!s || s.length <= head + tail + 3) return s ?? "";
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

function field(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  opts: { x: number; y: number; width: number },
) {
  doc
    .fontSize(7.5)
    .fillColor(MUTED)
    .font("Helvetica-Bold")
    .text(label.toUpperCase(), opts.x, opts.y, { width: opts.width, characterSpacing: 1.5 });
  doc
    .fontSize(10.5)
    .fillColor(INK)
    .font("Helvetica")
    .text(value, opts.x, opts.y + 12, { width: opts.width });
}

/** Build the receipt PDF as a Buffer. */
export async function buildReceipt(data: SettlementReceiptData): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "LETTER",
    margins: { top: 56, bottom: 56, left: 56, right: 56 },
    info: {
      Title: `Trade Confirmation — ${data.securitySymbol ?? data.securityMint.slice(0, 8)} × ${data.tokenAmount}`,
      Author: "DinoSecurities",
      Subject: `Settlement ${data.signature}`,
      Keywords: "DinoSecurities DvP Solana Settlement",
    },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));
  const done: Promise<void> = new Promise((resolve) => doc.on("end", () => resolve()));

  const pageW = doc.page.width - 56 - 56;
  const left = 56;

  // Header band
  doc.save();
  doc.rect(0, 0, doc.page.width, 48).fill(INK);
  doc
    .fillColor("#c4b5fd")
    .fontSize(9)
    .font("Helvetica-Bold")
    .text("DINOSECURITIES · TRADE CONFIRMATION", left, 18, {
      characterSpacing: 3,
    });
  doc
    .fillColor("#9997b0")
    .fontSize(8)
    .font("Helvetica")
    .text("Atomic DvP · Solana mainnet-beta", left + 320, 20, { align: "right", width: pageW - 320 });
  doc.restore();

  // Title
  doc.moveDown(3);
  doc.fontSize(9).fillColor(MUTED).font("Helvetica-Bold")
    .text("CONFIRMATION", left, 78, { characterSpacing: 2 });

  const title = `${data.securitySymbol ?? "—"} × ${data.tokenAmount.toLocaleString()}`;
  doc.fontSize(26).fillColor(INK).font("Helvetica-Bold").text(title, left, 94);

  if (data.securityName) {
    doc.fontSize(11).fillColor(MUTED).font("Helvetica").text(data.securityName, left, 128);
  }

  // Key-value grid
  const gridTop = 170;
  const colW = (pageW - 16) / 2;
  const rowH = 40;

  const unitPriceMicro = data.tokenAmount > 0 ? data.usdcAmount / data.tokenAmount : 0;
  const unitPriceDollars = unitPriceMicro / 1e6;

  const leftFields: Array<[string, string]> = [
    ["Confirmation #", truncate(data.signature, 10, 8).toUpperCase()],
    ["Trade date", data.settledAt.toISOString().slice(0, 10)],
    ["Settlement date", `${data.settledAt.toISOString().slice(0, 10)} (atomic)`],
    ["Mint", truncate(data.securityMint)],
    ["ISIN", data.isin || "—"],
  ];
  const rightFields: Array<[string, string]> = [
    ["Quantity", data.tokenAmount.toLocaleString()],
    ["Unit price", `$${unitPriceDollars.toFixed(4)}`],
    ["Consideration", `$${(data.usdcAmount / 1e6).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
    ["Payment", data.paymentMintLabel ?? "USDC"],
    ["Restriction", data.restriction ?? "—"],
  ];

  leftFields.forEach(([l, v], i) => field(doc, l, v, { x: left, y: gridTop + i * rowH, width: colW }));
  rightFields.forEach(([l, v], i) => field(doc, l, v, { x: left + colW + 16, y: gridTop + i * rowH, width: colW }));

  // Parties block
  const partiesTop = gridTop + 5 * rowH + 14;
  doc.moveTo(left, partiesTop).lineTo(left + pageW, partiesTop).strokeColor(RULE).lineWidth(0.5).stroke();
  doc.fontSize(8).fillColor(MUTED).font("Helvetica-Bold")
    .text("COUNTERPARTIES", left, partiesTop + 10, { characterSpacing: 1.5 });
  field(doc, "Buyer", data.buyer ? truncate(data.buyer) : "—", {
    x: left, y: partiesTop + 30, width: colW,
  });
  field(doc, "Seller", data.seller ? truncate(data.seller) : "—", {
    x: left + colW + 16, y: partiesTop + 30, width: colW,
  });

  // On-chain verification block + QR
  const verifyTop = partiesTop + 84;
  doc.moveTo(left, verifyTop).lineTo(left + pageW, verifyTop).strokeColor(RULE).lineWidth(0.5).stroke();
  doc.fontSize(8).fillColor(MUTED).font("Helvetica-Bold")
    .text("ON-CHAIN VERIFICATION", left, verifyTop + 10, { characterSpacing: 1.5 });

  const explorerUrl = `https://explorer.solana.com/tx/${data.signature}`;
  doc
    .fontSize(9)
    .fillColor(INK)
    .font("Helvetica")
    .text("This settlement was executed atomically in a single Solana transaction.", left, verifyTop + 30, { width: pageW - 120 });
  doc
    .fontSize(9)
    .fillColor(DINO)
    .font("Helvetica-Bold")
    .text(`Signature: ${truncate(data.signature, 20, 10)}`, left, verifyTop + 46);
  doc
    .fontSize(8)
    .fillColor(MUTED)
    .font("Helvetica")
    .text(explorerUrl, left, verifyTop + 62, { link: explorerUrl, underline: true });

  if (data.finalityMs != null) {
    doc
      .fontSize(8)
      .fillColor(MUTED)
      .font("Helvetica")
      .text(`Finality: ${data.finalityMs} ms · Slot: ${data.slot ?? "—"} · Fee: ${
        data.feeLamports != null ? `${(data.feeLamports / 1e9).toFixed(6)} SOL` : "—"
      }`, left, verifyTop + 80);
  }

  // QR → explorer link
  try {
    const qrDataUrl = await QRCode.toDataURL(explorerUrl, { margin: 0, width: 96, errorCorrectionLevel: "M" });
    const qrBuf = Buffer.from(qrDataUrl.split(",")[1] ?? "", "base64");
    doc.image(qrBuf, left + pageW - 96, verifyTop + 28, { width: 96, height: 96 });
  } catch {
    // QR generation is best-effort; receipt still valid without it.
  }

  // Regulatory footer
  const footerTop = doc.page.height - 140;
  doc.moveTo(left, footerTop).lineTo(left + pageW, footerTop).strokeColor(RULE).lineWidth(0.5).stroke();
  doc.fontSize(7.5).fillColor(MUTED).font("Helvetica-Bold")
    .text("IMPORTANT DISCLOSURES", left, footerTop + 10, { characterSpacing: 1.5 });
  doc
    .fontSize(8)
    .fillColor(MUTED)
    .font("Helvetica")
    .text(
      "This trade confirmation is issued by DinoSecurities as a record-keeping artifact for the " +
      "settlement described above. DinoSecurities is NOT a registered broker-dealer, transfer " +
      "agent, or alternative trading system. This document is NOT a broker-dealer trade " +
      "confirmation under SEC Rule 10b-10 and does not constitute investment advice. Issuers " +
      "operating under the DinoSecurities protocol are responsible for their own compliance " +
      "with securities laws in each jurisdiction where their tokens are distributed or held. " +
      "Verify the underlying transaction on the Solana blockchain at the link above.",
      left, footerTop + 26, { width: pageW, lineGap: 1 },
    );

  // Brand strip at bottom
  doc.fontSize(7).fillColor(MUTED).font("Helvetica-Bold")
    .text(`Generated ${new Date().toISOString()}  ·  dinosecurities.com  ·  ${truncate(data.signature, 6, 4).toUpperCase()}`,
      left, doc.page.height - 36, { width: pageW, characterSpacing: 1 });

  doc.end();
  await done;
  return Buffer.concat(chunks);
}
