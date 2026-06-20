"use strict";

const Afip = require("@afipsdk/afip.js");
const admin = require("firebase-admin");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

admin.initializeApp({
  databaseURL: "https://panaderia-venta-default-rtdb.firebaseio.com",
});

const ARCA_CERT = defineSecret("ARCA_CERT");
const ARCA_KEY = defineSecret("ARCA_KEY");
const ARCA_INVOICE_TOKEN = defineSecret("ARCA_INVOICE_TOKEN");

const CUIT = 27148478053;
const POINT_OF_SALE = 7;
const INVOICE_TYPE_B = 6;
const IVA_105_ID = 4;
const CONSUMIDOR_FINAL_DOC_TYPE = 99;
const CONSUMIDOR_FINAL_DOC_NUMBER = 0;
const CONSUMIDOR_FINAL_IVA_CONDITION = 5;
const SALES_KEY = "panaderia_josue_ventas_v1";

function setCors(response) {
  response.set("Access-Control-Allow-Origin", "*");
  response.set("Access-Control-Allow-Headers", "Content-Type, X-Panaderia-Token");
  response.set("Access-Control-Allow-Methods", "POST, OPTIONS");
}

function round2(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function formatArcaDate(date = new Date()) {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

function buildVoucherData({ voucherNumber, total }) {
  const amountTotal = round2(total);
  const amountNet = round2(amountTotal / 1.105);
  const amountIva = round2(amountTotal - amountNet);

  return {
    CantReg: 1,
    PtoVta: POINT_OF_SALE,
    CbteTipo: INVOICE_TYPE_B,
    Concepto: 1,
    DocTipo: CONSUMIDOR_FINAL_DOC_TYPE,
    DocNro: CONSUMIDOR_FINAL_DOC_NUMBER,
    CbteDesde: voucherNumber,
    CbteHasta: voucherNumber,
    CbteFch: formatArcaDate(),
    ImpTotal: amountTotal,
    ImpTotConc: 0,
    ImpNeto: amountNet,
    ImpOpEx: 0,
    ImpIVA: amountIva,
    ImpTrib: 0,
    MonId: "PES",
    MonCotiz: 1,
    CondicionIVAReceptorId: CONSUMIDOR_FINAL_IVA_CONDITION,
    Iva: [
      {
        Id: IVA_105_ID,
        BaseImp: amountNet,
        Importe: amountIva,
      },
    ],
  };
}

async function getSaleById(saleId) {
  const snapshot = await admin.database().ref(SALES_KEY).get();
  const value = snapshot.val();
  const sales = Array.isArray(value) ? value : [];
  const index = sales.findIndex((sale) => sale && sale.id === saleId);
  return { sales, sale: index >= 0 ? sales[index] : null, index };
}

async function saveSaleInvoice({ sales, index, invoice }) {
  const sale = sales[index];
  sales[index] = {
    ...sale,
    invoice,
    updatedAt: new Date().toISOString(),
  };
  await admin.database().ref(SALES_KEY).set(sales);
}

exports.facturarVenta = onRequest(
  {
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "256MiB",
    invoker: "public",
    secrets: [ARCA_CERT, ARCA_KEY, ARCA_INVOICE_TOKEN],
  },
  async (request, response) => {
    setCors(response);

    if (request.method === "OPTIONS") {
      response.status(204).send("");
      return;
    }

    if (request.method !== "POST") {
      response.status(405).json({ ok: false, error: "Metodo no permitido." });
      return;
    }

    const expectedToken = ARCA_INVOICE_TOKEN.value();
    const receivedToken = request.get("X-Panaderia-Token") || "";
    if (expectedToken && receivedToken !== expectedToken) {
      response.status(401).json({ ok: false, error: "Token invalido." });
      return;
    }

    const saleId = String(request.body?.saleId || "").trim();
    if (!saleId) {
      response.status(400).json({ ok: false, error: "Falta el ID de la venta." });
      return;
    }

    const { sales, sale, index } = await getSaleById(saleId);
    if (!sale) {
      response.status(404).json({ ok: false, error: "No se encontro la venta en la base." });
      return;
    }

    if (sale.invoice?.cae) {
      response.json({
        ok: true,
        saleId,
        alreadyInvoiced: true,
        pointOfSale: sale.invoice.pointOfSale,
        invoiceType: sale.invoice.invoiceType || "B",
        voucherNumber: sale.invoice.voucherNumber,
        cae: sale.invoice.cae,
        caeDueDate: sale.invoice.caeDueDate,
      });
      return;
    }

    const total = Number(sale.total || 0);
    if (!Number.isFinite(total) || total <= 0) {
      response.status(400).json({ ok: false, error: "Importe invalido." });
      return;
    }

    try {
      const afip = new Afip({
        CUIT,
        cert: ARCA_CERT.value(),
        key: ARCA_KEY.value(),
        production: true,
      });

      const lastVoucher = await afip.ElectronicBilling.getLastVoucher(
        POINT_OF_SALE,
        INVOICE_TYPE_B,
      );
      const voucherNumber = Number(lastVoucher || 0) + 1;
      const voucherData = buildVoucherData({ voucherNumber, total });
      const result = await afip.ElectronicBilling.createVoucher(voucherData);
      const invoice = {
        cae: result.CAE,
        caeDueDate: result.CAEFchVto,
        voucherNumber,
        pointOfSale: POINT_OF_SALE,
        invoiceType: "B",
        invoicedAt: new Date().toISOString(),
      };

      await saveSaleInvoice({ sales, index, invoice });

      response.json({
        ok: true,
        saleId,
        pointOfSale: POINT_OF_SALE,
        invoiceType: "B",
        voucherNumber,
        cae: result.CAE,
        caeDueDate: result.CAEFchVto,
        raw: result,
      });
    } catch (error) {
      console.error("ARCA invoice error", error);
      response.status(500).json({
        ok: false,
        error: error?.message || "No se pudo autorizar la factura en ARCA.",
      });
    }
  },
);
