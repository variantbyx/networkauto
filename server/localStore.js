const { randomUUID } = require("node:crypto");
const bcrypt = require("bcryptjs");

const users = [];
const histories = [];

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  const { password, ...safeUser } = user;
  return safeUser;
}

async function createLocalUser({ username, email, password, role = "user" }) {
  const normalizedEmail = normalizeEmail(email);
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = {
    _id: randomUUID(),
    username: String(username || "").trim(),
    email: normalizedEmail,
    password: hashedPassword,
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  users.push(user);
  return user;
}

function findLocalUserByEmailOrUsername({ email, username }) {
  const normalizedEmail = normalizeEmail(email);
  return users.find(
    (user) => user.email === normalizedEmail || user.username === username,
  );
}

function findLocalUserById(userId) {
  return users.find((user) => user._id === String(userId));
}

async function verifyLocalPassword(user, password) {
  return bcrypt.compare(password, user.password);
}

function saveLocalHistory(entry) {
  const history = {
    _id: randomUUID(),
    ...entry,
    timestamp: entry.timestamp || new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  histories.unshift(history);
  return history;
}

function listLocalHistory(userId, limit, offset) {
  const filtered = histories.filter((entry) => entry.userId === String(userId));
  return filtered.slice(offset, offset + limit);
}

function getLocalHistoryById(historyId, userId) {
  return histories.find(
    (entry) =>
      entry._id === String(historyId) && entry.userId === String(userId),
  );
}

function deleteLocalHistoryById(historyId, userId) {
  const index = histories.findIndex(
    (entry) =>
      entry._id === String(historyId) && entry.userId === String(userId),
  );

  if (index === -1) {
    return null;
  }

  const [removed] = histories.splice(index, 1);
  return removed;
}

function countLocalHistory(userId) {
  return histories.filter((entry) => entry.userId === String(userId)).length;
}

module.exports = {
  createLocalUser,
  countLocalHistory,
  deleteLocalHistoryById,
  findLocalUserByEmailOrUsername,
  findLocalUserById,
  getLocalHistoryById,
  listLocalHistory,
  sanitizeUser,
  saveLocalHistory,
  verifyLocalPassword,
};
