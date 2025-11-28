import axios from "axios";
import crypto from "crypto";

// eSewa Configuration
const ESEWA_CONFIG = {
  merchantCode: process.env.ESEWA_MERCHANT_CODE || "EPAYTEST",
  secretKey: process.env.ESEWA_SECRET_KEY || "8gBm/:&EnhH.1/q",
  paymentUrl: "https://rc-epay.esewa.com.np/api/epay/main/v2/form",
  verifyUrl: "https://rc-epay.esewa.com.np/api/epay/transaction/status/",
};

/**
 * Generate HMAC-SHA256 signature for eSewa payment
 */
function generateSignature(totalAmount, transactionUuid, productCode) {
  const message = `total_amount=${totalAmount},transaction_uuid=${transactionUuid},product_code=${productCode}`;
  const hash = crypto
    .createHmac("sha256", ESEWA_CONFIG.secretKey)
    .update(message)
    .digest("base64");
  return hash;
}

/**
 * Create Payment Session
 */
export async function createPaymentSessionService(input) {
  try {
    const {
      amount,
      transactionId,
      productName,
      merchantCode = ESEWA_CONFIG.merchantCode,
      returnUrl,
      cancelUrl,
    } = input;

    // Generate signature
    const signature = generateSignature(amount, transactionId, merchantCode);

    // Prepare payload
    const paymentData = {
      amount: amount.toString(),
      tax_amount: "0",
      total_amount: amount.toString(),
      transaction_uuid: transactionId,
      product_code: merchantCode,
      product_service_charge: "0",
      product_delivery_charge: "0",
      success_url: returnUrl,
      failure_url: cancelUrl,
      signed_field_names: "total_amount,transaction_uuid,product_code",
      signature: signature,
    };

    return {
      success: true,
      paymentUrl: ESEWA_CONFIG.paymentUrl,
      paymentData: paymentData,
      message: "Payment session created successfully. POST this data to paymentUrl.",
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
    };
  }
}

/**
 * Verify Transaction
 */
export async function verifyTransactionService(input) {
  try {
    const { transactionId, amount } = input;

    const url = `${ESEWA_CONFIG.verifyUrl}?product_code=${ESEWA_CONFIG.merchantCode}&total_amount=${amount}&transaction_uuid=${transactionId}`;

    const response = await axios.get(url);

    return {
      success: true,
      verified: response.data.status === "COMPLETE",
      status: response.data.status,
      response: response.data,
    };
  } catch (err) {
    return {
      success: false,
      status: "FAILED",
      error: err.message,
    };
  }
}

/**
 * Refund Payment (Note: This may require additional authentication)
 */
export async function refundPaymentService(input) {
  try {
    const { transactionId, amount } = input;

    // eSewa refund endpoint (verify with eSewa documentation)
    const refundUrl = "https://rc-epay.esewa.com.np/api/epay/refund";

    const payload = {
      product_code: ESEWA_CONFIG.merchantCode,
      transaction_uuid: transactionId,
      refund_amount: amount,
      // You may need additional auth token here
    };

    const response = await axios.post(refundUrl, payload);

    return {
      success: true,
      status: response.data.status,
      message: response.data.message || "Refund processed",
    };
  } catch (err) {
    return {
      success: false,
      status: "FAILED",
      error: err.message,
    };
  }
}

/**
 * Get Payment Status
 */
export async function getPaymentStatusService(input) {
  try {
    const { transactionId, amount } = input;

    const url = `${ESEWA_CONFIG.verifyUrl}?product_code=${ESEWA_CONFIG.merchantCode}&total_amount=${amount}&transaction_uuid=${transactionId}`;

    const response = await axios.get(url);

    return {
      success: true,
      status: response.data.status,
      details: response.data,
    };
  } catch (err) {
    return {
      success: false,
      status: "FAILED",
      error: err.message,
    };
  }
}
