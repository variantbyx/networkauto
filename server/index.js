require("dotenv").config();

const express = require("express");
const cors = require("cors");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const auth = require("./middleware/auth");
const authRoutes = require("./routes/auth");
const configRoutes = require("./routes/config");
const { runPythonParser } = require("./pythonBridge");

const app = express();
const server = http.createServer(app);
function getConfiguredOrigins() {
  const originValues = [process.env.FRONTEND_URL, process.env.CORS_ORIGIN]
    .filter(Boolean)
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  if (originValues.length > 0) {
    return originValues;
  }

  return ["http://localhost:5173", "http://127.0.0.1:5173"];
}

const allowedOrigins = getConfiguredOrigins();
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "DELETE"],
    credentials: true,
  },
});

const port = Number(process.env.PORT || 3000);
const sampleConfigDir = path.join(__dirname, "..", "sample-configs");
const distDir = path.join(__dirname, "..", "dist");
const hasDist = fs.existsSync(distDir);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));

async function connectMongo() {
  if (!process.env.MONGODB_URI) {
    console.warn("MongoDB URI not set; using local fallback stores.");
    return;
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 3000,
    });
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.warn(`MongoDB connection unavailable: ${error.message}`);
  }
}

connectMongo();

function readSampleConfigs() {
  return fs
    .readdirSync(sampleConfigDir)
    .filter((fileName) => fileName.endsWith(".txt"))
    .map((fileName) => ({
      name: path.basename(fileName, ".txt"),
      text: fs.readFileSync(path.join(sampleConfigDir, fileName), "utf8"),
    }));
}

function createRuntimeStatus(devices) {
  const windowSeed = Math.floor(Date.now() / 15000);

  return devices.map((device, index) => {
    const deviceName = String(device.name || device.deviceName || "device");
    const hash = Array.from(deviceName).reduce(
      (sum, character) => sum + character.charCodeAt(0),
      0,
    );
    const value = (hash + index + windowSeed) % 10;
    const status = value < 6 ? "online" : value < 8 ? "degraded" : "offline";

    return {
      ...device,
      status,
      latency:
        status === "online"
          ? 8 + (hash % 12)
          : status === "degraded"
            ? 45 + (hash % 25)
            : null,
      packetLoss:
        status === "offline" ? 100 : status === "degraded" ? 7 + (hash % 8) : 0,
      lastSeen: new Date().toISOString(),
    };
  });
}

function addRuntimeMetrics(payload) {
  const devices = createRuntimeStatus(payload.devices || []);
  const healthyCount = devices.filter(
    (device) => device.status === "online",
  ).length;

  return {
    ...payload,
    devices,
    metrics: {
      ...payload.metrics,
      healthyCount,
      uptimePercent:
        devices.length === 0
          ? 0
          : Math.round((healthyCount / devices.length) * 100),
    },
    generatedAt: new Date().toISOString(),
  };
}

async function buildDashboardPayload(configs) {
  const parsed = await runPythonParser({ configs });
  return addRuntimeMetrics(parsed);
}

app.use("/api/auth", authRoutes);
app.use("/api/config", configRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "network-automation-dashboard" });
});

app.get("/api/dashboard", auth, async (req, res) => {
  try {
    const payload = await buildDashboardPayload(readSampleConfigs());
    res.json({ success: true, data: payload, user: req.user });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Dashboard fetch failed",
      error: error.message,
    });
  }
});

app.post("/api/analyze", auth, async (req, res) => {
  try {
    const configText =
      typeof req.body?.configText === "string" ? req.body.configText : "";
    const name =
      typeof req.body?.name === "string" && req.body.name.trim()
        ? req.body.name.trim()
        : "custom-device";

    if (!configText.trim()) {
      res.status(400).json({ success: false, error: "configText is required" });
      return;
    }

    const payload = await runPythonParser({ name, config: configText });
    res.json({ success: true, data: payload, user: req.user });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Analysis failed",
      error: error.message,
    });
  }
});

io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  const statusInterval = setInterval(() => {
    const status =
      Math.random() > 0.25
        ? "online"
        : Math.random() > 0.5
          ? "degraded"
          : "offline";

    socket.emit("device_status_update", {
      deviceId: "LAB-EDGE",
      status,
      timestamp: new Date().toISOString(),
    });

    socket.emit("metric_update", {
      deviceId: "LAB-EDGE",
      latency: Math.floor(Math.random() * 100) + 10,
      packetLoss: Number((Math.random() * 2).toFixed(2)),
      timestamp: new Date().toISOString(),
    });
  }, 5000);

  socket.on("analyze_config", async (data = {}) => {
    try {
      const configText = String(data.config || data.configText || "").trim();

      if (!configText) {
        socket.emit("alert", {
          type: "error",
          message: "Configuration text is required",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const result = await runPythonParser({
        name: data.deviceName || "custom",
        config: configText,
      });
      socket.emit("analysis_result", result);

      const issueCount =
        (result.validation?.duplicateIps?.length || 0) +
        (result.validation?.gatewayIssues?.length || 0) +
        (result.validation?.vlanIssues?.length || 0) +
        (result.validation?.bgpIssues?.length || 0) +
        (result.validation?.aclIssues?.length || 0) +
        (result.validation?.routingIssues?.length || 0);

      socket.emit("alert", {
        type: issueCount > 0 ? "error" : "success",
        message:
          issueCount > 0
            ? `Configuration validation found ${issueCount} issue${issueCount === 1 ? "" : "s"}`
            : "Configuration validated successfully",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      socket.emit("alert", {
        type: "error",
        message: `Analysis failed: ${error.message}`,
        timestamp: new Date().toISOString(),
      });
    }
  });

  socket.on("disconnect", () => {
    clearInterval(statusInterval);
    console.log("Client disconnected:", socket.id);
  });
});

if (hasDist) {
  app.use(express.static(distDir));

  app.get("*", (_req, res, next) => {
    if (fs.existsSync(path.join(distDir, "index.html"))) {
      res.sendFile(path.join(distDir, "index.html"));
      return;
    }

    next();
  });
}

server.listen(port, () => {
  console.log(
    `Network Automation Dashboard API running on http://localhost:${port}`,
  );
});
