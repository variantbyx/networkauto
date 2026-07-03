const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const {
  createLocalUser,
  findLocalUserByEmailOrUsername,
  sanitizeUser,
  verifyLocalPassword,
} = require("../localStore");

const router = express.Router();

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function signToken(user) {
  return jwt.sign(
    { userId: String(user._id), email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || "7d" },
  );
}

router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body || {};

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Username, email, and password are required",
      });
    }

    const normalizedEmail = normalizeEmail(email);
    let user = null;

    if (mongoose.connection.readyState === 1) {
      const existingUser = await User.findOne({
        $or: [{ email: normalizedEmail }, { username }],
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "User already exists with this email or username",
        });
      }

      user = await User.create({ username, email: normalizedEmail, password });
    } else {
      const existingUser = findLocalUserByEmailOrUsername({
        email: normalizedEmail,
        username,
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "User already exists with this email or username",
        });
      }

      user = await createLocalUser({
        username,
        email: normalizedEmail,
        password,
      });
    }

    const token = signToken(user);

    res.status(201).json({
      success: true,
      message: "User created successfully",
      token,
      user: sanitizeUser(user.toObject ? user.toObject() : user),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Registration failed",
      error: error.message,
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const normalizedEmail = normalizeEmail(email);
    let user = null;
    let isMatch = false;

    if (mongoose.connection.readyState === 1) {
      user = await User.findOne({ email: normalizedEmail });

      if (user) {
        isMatch = await user.comparePassword(password);
      }
    } else {
      user = findLocalUserByEmailOrUsername({ email: normalizedEmail });
      if (user) {
        isMatch = await verifyLocalPassword(user, password);
      }
    }

    if (!user || !isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const token = signToken(user);

    res.json({
      success: true,
      token,
      user: sanitizeUser(user.toObject ? user.toObject() : user),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Login failed",
      error: error.message,
    });
  }
});

module.exports = router;
