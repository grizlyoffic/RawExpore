import { Router } from "express";
import { spawn } from "child_process";
import { logger } from "../lib/logger";

const router = Router();

interface ExecuteRequest {
  code: string;
  language: "python" | "node" | "bash" | "java";
  cwd?: string;
}

const LANGUAGE_COMMANDS: Record<string, { cmd: string; args: string[]; ext: string }> = {
  python: { cmd: "python3", args: ["-c"], ext: "py" },
  node: { cmd: "node", args: ["-e"], ext: "js" },
  bash: { cmd: "bash", args: ["-c"], ext: "sh" },
  java: { cmd: "bash", args: ["-c"], ext: "java" },
};

router.post("/execute", async (req, res) => {
  const { code, language, cwd } = req.body as ExecuteRequest;

  if (!code || !language) {
    res.status(400).json({ error: "code and language are required" });
    return;
  }

  const langConfig = LANGUAGE_COMMANDS[language];
  if (!langConfig) {
    res.status(400).json({ error: `Unsupported language: ${language}` });
    return;
  }

  const start = Date.now();

  try {
    const result = await new Promise<{ stdout: string; stderr: string; exitCode: number }>(
      (resolve, reject) => {
        let stdout = "";
        let stderr = "";

        const args =
          language === "java"
            ? ["-c", `echo '${code.replace(/'/g, "'\\''").replace(/\n/g, "\\n")}' | java --source 21 /dev/stdin 2>&1 || echo "Java compilation/run error"`]
            : [...langConfig.args, code];

        const proc = spawn(langConfig.cmd, args, {
          cwd: cwd ?? process.cwd(),
          env: { ...process.env },
          timeout: 15000,
        });

        proc.stdout.on("data", (data: Buffer) => {
          stdout += data.toString();
        });

        proc.stderr.on("data", (data: Buffer) => {
          stderr += data.toString();
        });

        proc.on("error", (err) => {
          reject(err);
        });

        proc.on("close", (code) => {
          resolve({ stdout, stderr, exitCode: code ?? 0 });
        });

        setTimeout(() => {
          proc.kill("SIGTERM");
          resolve({ stdout, stderr: stderr + "\nProcess timed out (15s limit)", exitCode: 124 });
        }, 15000);
      }
    );

    const executionTime = Date.now() - start;

    req.log.info({ language, exitCode: result.exitCode, executionTime }, "Code executed");

    res.json({
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      executionTime,
    });
  } catch (err) {
    logger.error({ err }, "Execution error");
    res.status(500).json({ error: "Execution failed" });
  }
});

export default router;
