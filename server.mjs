import { Server } from "@modelcontextprotocol/sdk/server";
import express from "express";
import dotenv from "dotenv";
import {
  createPaymentSessionService,
  verifyTransactionService,
  refundPaymentService,
  getPaymentStatusService
} from "./services/esewa.js";

dotenv.config();

// Create MCP server instance with tools
const mcpServer = new Server({
  name: "esewa-mcp-server",
  version: "1.0.0",
  tools: [
    { name: "createPaymentSession", handler: createPaymentSessionService },
    { name: "verifyTransaction", handler: verifyTransactionService },
    { name: "refundPayment", handler: refundPaymentService },
    { name: "getPaymentStatus", handler: getPaymentStatusService }
  ]
});

// HTTP server required by MCP
const app = express();
app.use(express.json());

// MCP handler — required for Smithery
app.post("/mcp", async (req, res) => {
  try {
    const response = await mcpServer.handle(req.body);
    res.json(response);
  } catch (err) {
    console.error("MCP Error:", err);
    res.status(500).json({ error: err.message });
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
