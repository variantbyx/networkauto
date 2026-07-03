const mongoose = require("mongoose");

const ConfigHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    deviceName: {
      type: String,
      required: true,
    },
    deviceType: {
      type: String,
      enum: ["router", "switch", "firewall", "loadbalancer"],
      required: true,
    },
    configText: {
      type: String,
      required: true,
    },
    parsedData: {
      type: Object,
      default: null,
    },
    validationResults: {
      type: Object,
      default: null,
    },
    status: {
      type: String,
      enum: ["valid", "warning", "error"],
      default: "valid",
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

ConfigHistorySchema.index({ userId: 1, timestamp: -1 });
ConfigHistorySchema.index({ deviceName: 1 });

module.exports = mongoose.model("ConfigHistory", ConfigHistorySchema);
