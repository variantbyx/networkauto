const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");
const { findLocalUserById, sanitizeUser } = require("../localStore");

async function auth(req, res, next) {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      throw new Error("No token provided");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    let user = null;

    if (mongoose.connection.readyState === 1) {
      user = await User.findById(decoded.userId);
    } else {
      user = findLocalUserById(decoded.userId);
    }

    if (!user) {
      throw new Error("User not found");
    }

    req.user = sanitizeUser(user.toObject ? user.toObject() : user);
    req.userId = String(decoded.userId);
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: "Please authenticate",
      error: error.message,
    });
  }
}

module.exports = auth;
