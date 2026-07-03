const { spawn } = require("node:child_process");
const path = require("node:path");

function getPythonCommand() {
  const configuredCommand = process.env.PYTHON_PATH || process.env.PYTHON_BIN;

  if (configuredCommand) {
    const lowerCommand = configuredCommand.toLowerCase();
    if (
      process.platform === "win32" &&
      (lowerCommand === "python" || lowerCommand === "python3")
    ) {
      return "C:/Users/BIT/AppData/Local/Programs/Python/Python313/python.exe";
    }

    return configuredCommand;
  }

  if (process.env.RENDER === "true" || process.env.NODE_ENV === "production") {
    return "python3";
  }

  return process.platform === "win32"
    ? "C:/Users/BIT/AppData/Local/Programs/Python/Python313/python.exe"
    : "python3";
}

function runPythonParser(input) {
  const scriptPath = path.join(__dirname, "..", "python", "parse_network.py");
  const pythonCommand = getPythonCommand();
  const payload =
    typeof input === "string"
      ? { config: input }
      : Array.isArray(input)
        ? { configs: input }
        : input || {};

  return new Promise((resolve, reject) => {
    const child = spawn(pythonCommand, [scriptPath], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(
        new Error(
          `Failed to start Python parser using ${pythonCommand}: ${error.message}`,
        ),
      );
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(stderr.trim() || `Python parser exited with code ${code}`),
        );
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(new Error(`Could not parse Python output: ${error.message}`));
      }
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

module.exports = {
  runNetworkParser: runPythonParser,
  runPythonParser,
};
