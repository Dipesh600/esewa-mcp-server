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
mcpServer.registerTool("createPaymentSession", {
  title: "Create Payment Session",
  description: "Create a new eSewa payment session",
  inputSchema: { amount: Number, transactionId: String },
}, async ({ amount, transactionId }, extra) => {
  return await createPaymentSessionService({ amount, transactionId });
});

mcpServer.registerTool("verifyTransaction", {
  title: "Verify Transaction",
  description: "Verify a transaction",
  inputSchema: { transactionId: String, amount: Number }
}, async ({ transactionId, amount }) => {
  return await verifyTransactionService({ transactionId, amount });
});

mcpServer.registerTool("refundPayment", {
  title: "Refund Payment",
  description: "Refund a payment",
  inputSchema: { transactionId: String, amount: Number }
}, async ({ transactionId, amount }) => {
  return await refundPaymentService({ transactionId, amount });
});

mcpServer.registerTool("getPaymentStatus", {
  title: "Get Payment Status",
  description: "Get payment status",
  inputSchema: { transactionId: String }
}, async ({ transactionId }) => {
  return await getPaymentStatusService({ transactionId });
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
