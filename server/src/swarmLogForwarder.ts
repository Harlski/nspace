import fs from "node:fs";
import path from "node:path";
import util from "node:util";

type ConsoleMethod = (...args: unknown[]) => void;

function stringifyArgs(args: unknown[]): string {
  return args
    .map((arg) =>
      typeof arg === "string"
        ? arg
        : util.inspect(arg, { depth: 4, breakLength: 120, maxArrayLength: 50 })
    )
    .join(" ");
}

function safeAppend(logFilePath: string, line: string): void {
  try {
    fs.appendFileSync(logFilePath, line, "utf8");
  } catch {
    // Never break runtime logging due to mirror-file write failures.
  }
}

function installStreamMirror(logFilePath: string): void {
  let stdoutBuf = "";
  let stderrBuf = "";
  const ORIG_STDOUT_WRITE = process.stdout.write.bind(process.stdout);
  const ORIG_STDERR_WRITE = process.stderr.write.bind(process.stderr);

  process.stdout.write = ((chunk: unknown, ...args: unknown[]) => {
    const text = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
    const parts = (stdoutBuf + text).split(/\r?\n/);
    stdoutBuf = parts.pop() ?? "";
    for (const line of parts) {
      if (!/swarm/i.test(line)) continue;
      safeAppend(logFilePath, `[${new Date().toISOString()}] [STDOUT] ${line}\n`);
    }
    return (ORIG_STDOUT_WRITE as (...writeArgs: unknown[]) => boolean)(chunk, ...args);
  }) as typeof process.stdout.write;

  process.stderr.write = ((chunk: unknown, ...args: unknown[]) => {
    const text = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
    const parts = (stderrBuf + text).split(/\r?\n/);
    stderrBuf = parts.pop() ?? "";
    for (const line of parts) {
      if (!/swarm/i.test(line)) continue;
      safeAppend(logFilePath, `[${new Date().toISOString()}] [STDERR] ${line}\n`);
    }
    return (ORIG_STDERR_WRITE as (...writeArgs: unknown[]) => boolean)(chunk, ...args);
  }) as typeof process.stderr.write;
}

export function installSwarmErrorForwarder(logFilePath: string): void {
  const dir = path.dirname(logFilePath);
  fs.mkdirSync(dir, { recursive: true });

  const baseError = console.error.bind(console) as ConsoleMethod;
  const baseWarn = console.warn.bind(console) as ConsoleMethod;

  const forwardIfSwarm = (level: "ERROR" | "WARN", args: unknown[]): void => {
    const line = stringifyArgs(args);
    if (!/swarm/i.test(line)) return;
    const out = `[${new Date().toISOString()}] [${level}] ${line}\n`;
    safeAppend(logFilePath, out);
  };

  console.error = (...args: unknown[]) => {
    forwardIfSwarm("ERROR", args);
    baseError(...args);
  };
  console.warn = (...args: unknown[]) => {
    forwardIfSwarm("WARN", args);
    baseWarn(...args);
  };

  installStreamMirror(logFilePath);
  baseWarn(`[logs] swarm forwarder active -> ${logFilePath}`);
}

