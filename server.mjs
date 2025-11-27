import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import dotenv from "dotenv";
import {
  createPaymentSessionService,
  verifyTransactionService,
  refundPaymentService,
  getPaymentStatusService
} from "./services/esewa.js";

dotenv.config();

// Create MCP server instance with tools (high-level API)
const mcpServer = new McpServer({
  name: "esewa-mcp-server",
  version: "1.0.0"
});

// Register tools
mcpServer.registerTool("initiate_payment", {
  title: "Initiate Payment",
  description: "Initiate a new eSewa payment",
  inputSchema: { amount: Number, productId: String, successUrl: String, failureUrl: String },
}, async ({ amount, productId, successUrl, failureUrl }) => {
  try {
    const result = await createPaymentSessionService({
      amount,
      transactionId: productId,
      productName: productId,
      returnUrl: successUrl,
      cancelUrl: failureUrl
    });
    // Ensure only plain JSON-serializable object, no Zod schemas
    const plainResult = JSON.parse(JSON.stringify(result));
    const responseText = JSON.stringify(plainResult);
    return {
      content: [{ type: 'text', text: responseText }]
    };
  } catch (err) {
    const errorText = err.message || String(err);
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: errorText }) }],
      isError: true
    };
  }
});

mcpServer.registerTool("verify_payment", {
  title: "Verify Payment",
  description: "Verify an eSewa payment transaction",
  inputSchema: { transactionId: String, refId: String, amount: Number }
}, async ({ transactionId, refId, amount }) => {
  try {
    const result = await verifyTransactionService({ transactionId, amount });
    const plainResult = JSON.parse(JSON.stringify(result));
    const responseText = JSON.stringify(plainResult);
    return {
      content: [{ type: 'text', text: responseText }]
    };
  } catch (err) {
    const errorText = err.message || String(err);
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: errorText }) }],
      isError: true
    };
  }
});

mcpServer.registerTool("get_test_credentials", {
  title: "Get Test Credentials",
  description: "Get eSewa test credentials and merchant info",
  inputSchema: {},
}, async () => {
  try {
    const creds = {
      users: ["9800000000", "9800000001"],
      password: "asdf@123",
      mpin: "1234",
      merchantId: process.env.ESEWA_MERCHANT_CODE || "EPAYTEST",
      token: process.env.ESEWA_TOKEN || "123456",
      secretKey: process.env.ESEWA_SECRET_KEY || "8gBm/:&EnhH.1/q"
    };
    const plainCreds = JSON.parse(JSON.stringify(creds));
    return {
      content: [{ type: 'text', text: JSON.stringify(plainCreds) }]
    };
  } catch (err) {
    const errorText = err.message || String(err);
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: errorText }) }],
      isError: true
    };
  }
});

mcpServer.registerTool("health_check", {
  title: "Health Check",
  description: "Check server health and uptime",
  inputSchema: {},
}, async () => {
  try {
    const uptime = process.uptime();
    const health = { status: "healthy", uptime };
    const plainHealth = JSON.parse(JSON.stringify(health));
    return {
      content: [{ type: 'text', text: JSON.stringify(plainHealth) }]
    };
  } catch (err) {
    const errorText = err.message || String(err);
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: errorText }) }],
      isError: true
    };
  }
});

// HTTP server required by MCP
const app = express();
app.use(express.json());

// MCP handler — required for Smithery
app.post("/mcp", async (req, res) => {
  // Create a new Streamable HTTP transport for each request
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });

  res.on('close', () => {
    transport.close();
  });

  try {
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('MCP Error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      try { res.end(); } catch (e) {}
    }
  }
});

// Health check
app.get("/", (req, res) => {
  res.send("✅ eSewa MCP Server is running");
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 eSewa MCP Server running on port ${PORT}`);
});
