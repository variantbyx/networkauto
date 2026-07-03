const express = require("express");
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const ConfigHistory = require("../models/ConfigHistory");
const { runPythonParser } = require("../pythonBridge");
const {
  countLocalHistory,
  deleteLocalHistoryById,
  getLocalHistoryById,
  listLocalHistory,
  saveLocalHistory,
} = require("../localStore");

const router = express.Router();

function normalizeStatus(validation) {
  const hasIssues =
    validation?.hasErrors ||
    (validation?.duplicateIps?.length || 0) > 0 ||
    (validation?.gatewayIssues?.length || 0) > 0 ||
    (validation?.vlanIssues?.length || 0) > 0 ||
    (validation?.bgpIssues?.length || 0) > 0 ||
    (validation?.aclIssues?.length || 0) > 0 ||
    (validation?.routingIssues?.length || 0) > 0;

  if (!hasIssues) {
    return "valid";
  }

  return validation?.hasErrors ? "error" : "warning";
}

function pickDeviceInfo(parsedData) {
  return (
    parsedData?.device ||
    parsedData?.devices?.[0] || {
      name: "unknown",
      type: "router",
      role: "edge",
    }
  );
}

router.post("/analyze", auth, async (req, res) => {
  try {
    const { configText, deviceName, deviceType } = req.body || {};

    if (!configText) {
      return res.status(400).json({
        success: false,
        message: "Config text is required",
      });
    }

    const parsedData = await runPythonParser(configText);
    const validationResults = parsedData.validation || {};
    const deviceInfo = pickDeviceInfo(parsedData);

    const historyPayload = {
      userId: req.userId,
      deviceName:
        deviceName || deviceInfo.name || deviceInfo.deviceName || "unknown",
      deviceType:
        deviceType || deviceInfo.type || deviceInfo.deviceType || "router",
      configText,
      parsedData,
      validationResults,
      status: normalizeStatus(validationResults),
      timestamp: new Date(),
    };

    let historyEntry = null;

    if (mongoose.connection.readyState === 1) {
      historyEntry = await ConfigHistory.create(historyPayload);
    } else {
      historyEntry = saveLocalHistory(historyPayload);
    }

    res.json({
      success: true,
      data: parsedData,
      historyId: String(historyEntry._id),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Analysis failed",
      error: error.message,
    });
  }
});

router.get("/history", auth, async (req, res) => {
  try {
    const limit = Number(req.query.limit || 50);
    const offset = Number(req.query.offset || 0);

    let history = [];
    let total = 0;

    if (mongoose.connection.readyState === 1) {
      history = await ConfigHistory.find({ userId: req.userId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .skip(offset);
      total = await ConfigHistory.countDocuments({ userId: req.userId });
    } else {
      history = listLocalHistory(req.userId, limit, offset);
      total = countLocalHistory(req.userId);
    }

    res.json({
      success: true,
      data: history,
      pagination: { limit, offset, total },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch history",
      error: error.message,
    });
  }
});

router.get("/history/:id", auth, async (req, res) => {
  try {
    let config = null;

    if (mongoose.connection.readyState === 1) {
      config = await ConfigHistory.findOne({
        _id: req.params.id,
        userId: req.userId,
      });
    } else {
      config = getLocalHistoryById(req.params.id, req.userId);
    }

    if (!config) {
      return res.status(404).json({
        success: false,
        message: "Config not found",
      });
    }

    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch config",
      error: error.message,
    });
  }
});

router.delete("/history/:id", auth, async (req, res) => {
  try {
    let deleted = null;

    if (mongoose.connection.readyState === 1) {
      deleted = await ConfigHistory.findOneAndDelete({
        _id: req.params.id,
        userId: req.userId,
      });
    } else {
      deleted = deleteLocalHistoryById(req.params.id, req.userId);
    }

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Config not found",
      });
    }

    res.json({ success: true, message: "Config deleted successfully" });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete config",
      error: error.message,
    });
  }
});

module.exports = router;
