import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import dotenv from "dotenv";
import crypto from "crypto";
import axios from "axios";

dotenv.config();

// Default sandbox configuration
const SANDBOX_CONFIG = {
  merchantCode: "EPAYTEST",
  secretKey: "8gBm/:&EnhH.1/q",
  paymentUrl: "https://rc-epay.esewa.com.np/api/epay/main/v2/form",
  verifyUrl: "https://rc-epay.esewa.com.np/api/epay/transaction/status/",
  environment: "sandbox"
};

// Production configuration template
const PRODUCTION_CONFIG = {
  paymentUrl: "https://epay.esewa.com.np/api/epay/main/v2/form",
  verifyUrl: "https://epay.esewa.com.np/api/epay/transaction/status/",
  environment: "production"
};

// Store user credentials (in production, use proper database/session management)
const userCredentials = new Map();

// Helper: Get configuration for a user/session
function getConfig(sessionId = null, customConfig = null) {
  if (customConfig?.merchantCode && customConfig?.secretKey) {
    // User provided custom credentials
    return {
      merchantCode: customConfig.merchantCode,
      secretKey: customConfig.secretKey,
      paymentUrl: customConfig.environment === "production" 
        ? PRODUCTION_CONFIG.paymentUrl 
        : SANDBOX_CONFIG.paymentUrl,
      verifyUrl: customConfig.environment === "production"
        ? PRODUCTION_CONFIG.verifyUrl
        : SANDBOX_CONFIG.verifyUrl,
      environment: customConfig.environment || "production"
    };
  }
  
  // Check if user has stored credentials
  if (sessionId && userCredentials.has(sessionId)) {
    return userCredentials.get(sessionId);
  }
  
  // Default to sandbox
  return SANDBOX_CONFIG;
}

// Generate proper HMAC-SHA256 signature
function generateSignature(totalAmount, transactionUuid, productCode, secretKey) {
  const message = `total_amount=${totalAmount},transaction_uuid=${transactionUuid},product_code=${productCode}`;
  const hash = crypto
    .createHmac("sha256", secretKey)
    .update(message)
    .digest("base64");
  return hash;
}

// Create MCP Server
const server = new Server(
  {
    name: "esewa-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List Tools Handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "configure_credentials",
        description: "Configure eSewa merchant credentials. If not called, sandbox credentials will be used by default.",
        inputSchema: {
          type: "object",
          properties: {
            merchantCode: {
              type: "string",
              description: "Your eSewa merchant code (e.g., 'EPAYTEST' for sandbox or your actual merchant code)",
            },
            secretKey: {
              type: "string",
              description: "Your eSewa secret key",
            },
            environment: {
              type: "string",
              enum: ["sandbox", "production"],
              description: "Environment to use: 'sandbox' for testing or 'production' for live payments",
              default: "sandbox"
            },
            sessionId: {
              type: "string",
              description: "Optional session ID to store credentials for multiple users",
            },
          },
          required: ["merchantCode", "secretKey"],
        },
      },
      {
        name: "initiate_payment",
        description: "Initiate a new eSewa payment session. Uses configured credentials or sandbox if not set.",
        inputSchema: {
          type: "object",
          properties: {
            amount: {
              type: "number",
              description: "Payment amount in NPR",
            },
            transactionId: {
              type: "string",
              description: "Unique transaction ID",
            },
            successUrl: {
              type: "string",
              description: "URL to redirect after successful payment",
            },
            failureUrl: {
              type: "string",
              description: "URL to redirect after failed payment",
            },
            merchantCode: {
              type: "string",
              description: "Optional: Merchant code for this transaction (overrides configured credentials)",
            },
            secretKey: {
              type: "string",
              description: "Optional: Secret key for this transaction (overrides configured credentials)",
            },
            environment: {
              type: "string",
              enum: ["sandbox", "production"],
              description: "Optional: Environment for this transaction",
            },
            sessionId: {
              type: "string",
              description: "Optional: Session ID to use stored credentials",
            },
          },
          required: ["amount", "transactionId", "successUrl", "failureUrl"],
        },
      },
      {
        name: "verify_payment",
        description: "Verify an eSewa payment transaction. Uses configured credentials or sandbox if not set.",
        inputSchema: {
          type: "object",
          properties: {
            transactionId: {
              type: "string",
              description: "Transaction UUID to verify",
            },
            amount: {
              type: "number",
              description: "Transaction amount",
            },
            merchantCode: {
              type: "string",
              description: "Optional: Merchant code (overrides configured credentials)",
            },
            secretKey: {
              type: "string",
              description: "Optional: Secret key (overrides configured credentials)",
            },
            environment: {
              type: "string",
              enum: ["sandbox", "production"],
              description: "Optional: Environment",
            },
            sessionId: {
              type: "string",
              description: "Optional: Session ID to use stored credentials",
            },
          },
          required: ["transactionId", "amount"],
        },
      },
      {
        name: "get_current_config",
        description: "Get the currently configured credentials or confirm using sandbox mode",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Optional: Session ID to check stored credentials",
            },
          },
        },
      },
      {
        name: "get_test_credentials",
        description: "Get eSewa sandbox test credentials for testing",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_setup_instructions",
        description: "Get instructions on how to obtain eSewa merchant credentials",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

// Call Tool Handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "configure_credentials": {
        const { merchantCode, secretKey, environment = "sandbox", sessionId } = args;

        const config = {
          merchantCode,
          secretKey,
          paymentUrl: environment === "production" 
            ? PRODUCTION_CONFIG.paymentUrl 
            : SANDBOX_CONFIG.paymentUrl,
          verifyUrl: environment === "production"
            ? PRODUCTION_CONFIG.verifyUrl
            : SANDBOX_CONFIG.verifyUrl,
          environment
        };

        // Store credentials if sessionId provided
        if (sessionId) {
          userCredentials.set(sessionId, config);
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: "Credentials configured successfully",
                  environment: environment,
                  merchantCode: merchantCode,
                  sessionId: sessionId || "none (using for current operations only)",
                  note: sessionId 
                    ? "Credentials stored for this session. Use the same sessionId in other tool calls."
                    : "No sessionId provided. Pass these credentials with each payment operation or configure with a sessionId.",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_current_config": {
        const { sessionId } = args;
        const config = getConfig(sessionId);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  environment: config.environment,
                  merchantCode: config.merchantCode,
                  usingStoredCredentials: sessionId && userCredentials.has(sessionId),
                  message: config.environment === "sandbox" 
                    ? "Currently using SANDBOX mode. Call 'configure_credentials' to use production credentials."
                    : "Using PRODUCTION credentials",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "initiate_payment": {
        const { 
          amount, 
          transactionId, 
          successUrl, 
          failureUrl,
          merchantCode: customMerchantCode,
          secretKey: customSecretKey,
          environment: customEnvironment,
          sessionId
        } = args;

        // Get configuration
        const customConfig = customMerchantCode && customSecretKey 
          ? { merchantCode: customMerchantCode, secretKey: customSecretKey, environment: customEnvironment }
          : null;
        
        const config = getConfig(sessionId, customConfig);

        // Generate signature
        const signature = generateSignature(
          amount,
          transactionId,
          config.merchantCode,
          config.secretKey
        );

        // Prepare payment data
        const paymentData = {
          amount: amount.toString(),
          tax_amount: "0",
          total_amount: amount.toString(),
          transaction_uuid: transactionId,
          product_code: config.merchantCode,
          product_service_charge: "0",
          product_delivery_charge: "0",
          success_url: successUrl,
          failure_url: failureUrl,
          signed_field_names: "total_amount,transaction_uuid,product_code",
          signature: signature,
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  environment: config.environment,
                  paymentUrl: config.paymentUrl,
                  paymentData: paymentData,
                  transactionId: transactionId,
                  message: `Payment session created using ${config.environment} environment. POST this data to paymentUrl to initiate payment.`,
                  htmlFormExample: `
<!-- Auto-submit payment form -->
<form id="esewaForm" action="${config.paymentUrl}" method="POST">
  <input type="hidden" name="amount" value="${paymentData.amount}">
  <input type="hidden" name="tax_amount" value="${paymentData.tax_amount}">
  <input type="hidden" name="total_amount" value="${paymentData.total_amount}">
  <input type="hidden" name="transaction_uuid" value="${paymentData.transaction_uuid}">
  <input type="hidden" name="product_code" value="${paymentData.product_code}">
  <input type="hidden" name="product_service_charge" value="${paymentData.product_service_charge}">
  <input type="hidden" name="product_delivery_charge" value="${paymentData.product_delivery_charge}">
  <input type="hidden" name="success_url" value="${paymentData.success_url}">
  <input type="hidden" name="failure_url" value="${paymentData.failure_url}">
  <input type="hidden" name="signed_field_names" value="${paymentData.signed_field_names}">
  <input type="hidden" name="signature" value="${paymentData.signature}">
</form>
<script>document.getElementById('esewaForm').submit();</script>
                  `.trim(),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "verify_payment": {
        const { 
          transactionId, 
          amount,
          merchantCode: customMerchantCode,
          secretKey: customSecretKey,
          environment: customEnvironment,
          sessionId
        } = args;

        // Get configuration
        const customConfig = customMerchantCode && customSecretKey 
          ? { merchantCode: customMerchantCode, secretKey: customSecretKey, environment: customEnvironment }
          : null;
        
        const config = getConfig(sessionId, customConfig);

        try {
          const verifyUrl = `${config.verifyUrl}?product_code=${config.merchantCode}&total_amount=${amount}&transaction_uuid=${transactionId}`;

          const response = await axios.get(verifyUrl);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    environment: config.environment,
                    verified: response.data.status === "COMPLETE",
                    status: response.data.status,
                    transactionUuid: response.data.transaction_uuid,
                    refId: response.data.ref_id,
                    totalAmount: response.data.total_amount,
                    data: response.data,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  environment: config.environment,
                  error: `Verification failed: ${error.message}`,
                  note: "Make sure the transaction exists and credentials are correct",
                }),
              },
            ],
          };
        }
      }

      case "get_test_credentials": {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  sandboxCredentials: {
                    merchantCode: SANDBOX_CONFIG.merchantCode,
                    secretKey: SANDBOX_CONFIG.secretKey,
                    environment: "sandbox",
                  },
                  testUsers: [
                    { 
                      id: "9806800001", 
                      password: "Nepal@123", 
                      mpin: "1122", 
                      token: "123456",
                      note: "Use for testing payments" 
                    },
                    { 
                      id: "9806800002", 
                      password: "Nepal@123", 
                      mpin: "1122", 
                      token: "123456",
                      note: "Use for testing payments" 
                    },
                  ],
                  instructions: [
                    "1. Use these credentials to configure sandbox mode: configure_credentials tool",
                    "2. Or skip configuration to automatically use sandbox",
                    "3. When creating payments, use any test user credentials to complete payment",
                    "4. All test payments will succeed in sandbox environment"
                  ],
                  importantNote: "These are SANDBOX credentials. Get production credentials from https://esewa.com.np for live payments.",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_setup_instructions": {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  title: "How to Get eSewa Production Credentials",
                  steps: [
                    {
                      step: 1,
                      title: "Register as eSewa Merchant",
                      actions: [
                        "Visit https://esewa.com.np",
                        "Click on 'Merchant' or 'For Business'",
                        "Fill out merchant registration form",
                        "Submit required business documents",
                      ],
                    },
                    {
                      step: 2,
                      title: "Wait for Approval",
                      actions: [
                        "eSewa will review your application",
                        "This typically takes 2-5 business days",
                        "You'll receive confirmation via email/phone",
                      ],
                    },
                    {
                      step: 3,
                      title: "Get Your Credentials",
                      actions: [
                        "Log in to eSewa Merchant Portal: https://merchant.esewa.com.np",
                        "Navigate to Settings > API Credentials",
                        "Copy your Merchant Code and Secret Key",
                        "Keep these credentials secure!",
                      ],
                    },
                    {
                      step: 4,
                      title: "Configure in Your Application",
                      actions: [
                        "Call the 'configure_credentials' tool with your credentials",
                        "Set environment to 'production'",
                        "Test with small amounts first",
                      ],
                    },
                  ],
                  testingFirst: {
                    title: "Start with Sandbox Testing",
                    description: "Before getting production credentials, test your integration:",
                    steps: [
                      "Use default sandbox credentials (no configuration needed)",
                      "Or call configure_credentials with EPAYTEST/8gBm/:&EnhH.1/q",
                      "Test complete payment flow",
                      "Once working, register for production credentials",
                    ],
                  },
                  support: {
                    email: "merchant@esewa.com.np",
                    phone: "+977-1-5970032",
                    website: "https://developer.esewa.com.np",
                  },
                },
                null,
                2
              ),
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: `Unknown tool: ${name}` }),
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ error: error.message }),
        },
      ],
      isError: true,
    };
  }
});

// Express App Setup
const app = express();
app.use(express.json());

// Health check endpoint
app.get("/", (req, res) => {
  res.json({
    status: "healthy",
    service: "eSewa MCP Server",
    version: "1.0.0",
    features: [
      "Dynamic credential configuration",
      "Sandbox and production support",
      "Session-based credential storage",
      "Automatic fallback to sandbox"
    ],
    timestamp: new Date().toISOString(),
  });
});

// MCP endpoint
app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
  });

  res.on("close", () => {
    transport.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("MCP Error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 eSewa MCP Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/`);
  console.log(`📍 MCP endpoint: http://localhost:${PORT}/mcp`);
  console.log(`\n💡 Features:`);
  console.log(`   - Automatic sandbox mode if no credentials configured`);
  console.log(`   - Dynamic credential configuration per session`);
  console.log(`   - Support for both sandbox and production environments`);
});
