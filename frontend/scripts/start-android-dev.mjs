#!/usr/bin/env node

import { spawn } from "node:child_process";
import { once } from "node:events";
import { access, realpath } from "node:fs/promises";
import { createConnection } from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const DEFAULT_PACKAGE_NAME = "com.s15p11b104app";
const METRO_PORT = 8081;
const METRO_START_TIMEOUT_MS = 30_000;

export function parseArguments(args) {
  const options = {
    device: null,
    help: false,
    packageName: DEFAULT_PACKAGE_NAME,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }

    if (argument === "--device" || argument === "--package") {
      const value = args[index + 1];

      if (!value || value.startsWith("--")) {
        throw new Error(`${argument} 뒤에 값을 입력해 주세요.`);
      }

      if (argument === "--device") {
        options.device = value;
      } else {
        options.packageName = value;
      }

      index += 1;
      continue;
    }

    throw new Error(`지원하지 않는 옵션입니다: ${argument}`);
  }

  return options;
}

export function parseAdbDevices(output) {
  return output
    .split(/\r?\n/u)
    .slice(1)
    .map((line) => line.trim().split(/\s+/u))
    .filter(([serial, state]) => serial && state)
    .map(([serial, state]) => ({ serial, state }));
}

export function selectDevice(devices, requestedSerial) {
  const availableDevices = devices.filter(({ state }) => state === "device");

  if (requestedSerial) {
    const requestedDevice = availableDevices.find(
      ({ serial }) => serial === requestedSerial
    );

    if (!requestedDevice) {
      throw new Error(
        `사용 가능한 Android 기기에서 ${requestedSerial}을(를) 찾지 못했습니다.`
      );
    }

    return requestedDevice.serial;
  }

  if (availableDevices.length === 0) {
    throw new Error(
      "연결된 Android 기기가 없습니다. 에뮬레이터를 먼저 실행해 주세요."
    );
  }

  if (availableDevices.length > 1) {
    const serials = availableDevices.map(({ serial }) => serial).join(", ");
    throw new Error(
      `Android 기기가 여러 대입니다(${serials}). --device <serial>을 지정해 주세요.`
    );
  }

  return availableDevices[0].serial;
}

export function normalizeResolvedActivity(packageName, output) {
  const activity = output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => line.includes("/"));

  if (!activity) {
    throw new Error(
      `${packageName}의 실행 Activity를 찾지 못했습니다. 먼저 npm run android로 앱을 설치해 주세요.`
    );
  }

  return activity.startsWith(".") ? `${packageName}/${activity}` : activity;
}

export async function isPortAvailable(port, host = "127.0.0.1") {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host, port });

    socket.setTimeout(1_000);
    socket.once("connect", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", (error) => {
      socket.destroy();

      if (error.code === "ECONNREFUSED") {
        resolve(true);
        return;
      }

      reject(error);
    });
    socket.once("timeout", () => {
      socket.destroy();
      reject(new Error(`${host}:${port} 포트 확인 시간이 초과되었습니다.`));
    });
  });
}

function printHelp() {
  process.stdout.write(
    [
      "현재 frontend 경로에서 Metro를 8081로 실행하고 Android 앱을 엽니다.",
      "",
      "사용법:",
      "  npm run android:dev",
      "  npm run android:dev -- --device emulator-5554",
      "  npm run android:dev -- --package com.example.app",
      "",
      "8081이 이미 사용 중이면 다른 Worktree의 번들을 잘못 읽지 않도록 실행을 중단합니다.",
      "",
    ].join("\n")
  );
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }

      reject(
        new Error(
          `${command} ${args.join(" ")} 실패(code ${code})${
            stderr.trim() ? `\n${stderr.trim()}` : ""
          }`
        )
      );
    });
  });
}

async function resolveAdbCommand() {
  const executableName = process.platform === "win32" ? "adb.exe" : "adb";
  const sdkRoots = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, "Android", "Sdk")
      : null,
  ].filter(Boolean);

  for (const sdkRoot of sdkRoots) {
    const candidate = path.join(sdkRoot, "platform-tools", executableName);

    try {
      await access(candidate);
      return candidate;
    } catch {
      // 다음 SDK 후보 또는 PATH의 adb를 확인한다.
    }
  }

  return "adb";
}

async function assertExpectedWorkingDirectory(frontendRoot) {
  const [expectedPath, actualPath] = await Promise.all([
    realpath(frontendRoot),
    realpath(process.cwd()),
  ]);
  const normalize = (value) =>
    process.platform === "win32" ? value.toLowerCase() : value;

  if (normalize(expectedPath) !== normalize(actualPath)) {
    throw new Error(
      [
        "잘못된 경로에서 실행했습니다.",
        `현재 경로: ${actualPath}`,
        `실행할 경로: ${expectedPath}`,
        "위 frontend 경로로 이동한 뒤 npm run android:dev를 실행해 주세요.",
      ].join("\n")
    );
  }
}

async function waitForMetro(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/status`);
      const status = await response.text();

      if (response.ok && status.includes("packager-status:running")) {
        return;
      }
    } catch {
      // Metro가 시작될 때까지 짧게 재시도한다.
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 250);
    });
  }

  throw new Error(`Metro가 ${timeoutMs / 1000}초 안에 시작되지 않았습니다.`);
}

async function main() {
  const options = parseArguments(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  const frontendRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    ".."
  );
  await assertExpectedWorkingDirectory(frontendRoot);

  if (!(await isPortAvailable(METRO_PORT))) {
    throw new Error(
      [
        `포트 ${METRO_PORT}을 이미 다른 프로세스가 사용하고 있습니다.`,
        "기존 Metro 터미널에서 Ctrl+C로 종료한 뒤 다시 실행해 주세요.",
        "점유 중인 Metro를 재사용하지 않으므로 다른 Worktree의 화면이 섞이지 않습니다.",
      ].join("\n")
    );
  }

  const metroCliPath = path.join(
    frontendRoot,
    "node_modules",
    "react-native",
    "cli.js"
  );

  try {
    await access(metroCliPath);
  } catch {
    throw new Error(
      "React Native CLI를 찾지 못했습니다. frontend에서 npm install을 먼저 실행해 주세요."
    );
  }

  const adb = await resolveAdbCommand();
  const devices = parseAdbDevices(await runCommand(adb, ["devices"]));
  const serial = selectDevice(devices, options.device);
  const resolvedActivity = normalizeResolvedActivity(
    options.packageName,
    await runCommand(adb, [
      "-s",
      serial,
      "shell",
      "cmd",
      "package",
      "resolve-activity",
      "--brief",
      options.packageName,
    ])
  );

  process.stdout.write(
    [
      `Frontend: ${frontendRoot}`,
      `Android: ${serial}`,
      `Metro: http://127.0.0.1:${METRO_PORT}`,
      "Metro를 시작합니다...",
      "",
    ].join("\n")
  );

  const metro = spawn(
    process.execPath,
    [metroCliPath, "start", "--port", String(METRO_PORT), "--reset-cache"],
    {
      cwd: frontendRoot,
      stdio: "inherit",
    }
  );
  const metroExit = once(metro, "exit");
  let isStopping = false;

  const stopMetro = () => {
    if (isStopping) {
      return;
    }

    isStopping = true;
    metro.kill("SIGTERM");
  };
  const handleSignal = () => {
    stopMetro();
  };

  process.once("SIGINT", handleSignal);
  process.once("SIGTERM", handleSignal);

  try {
    await Promise.race([
      waitForMetro(METRO_PORT, METRO_START_TIMEOUT_MS),
      metroExit.then(([code, signal]) => {
        throw new Error(
          `Metro가 준비 전에 종료되었습니다(code ${code}, signal ${
            signal ?? "none"
          }).`
        );
      }),
    ]);

    await runCommand(adb, [
      "-s",
      serial,
      "reverse",
      `tcp:${METRO_PORT}`,
      `tcp:${METRO_PORT}`,
    ]);
    await runCommand(adb, [
      "-s",
      serial,
      "shell",
      "am",
      "force-stop",
      options.packageName,
    ]);
    const launchOutput = await runCommand(adb, [
      "-s",
      serial,
      "shell",
      "am",
      "start",
      "-n",
      resolvedActivity,
    ]);

    process.stdout.write(
      [
        "",
        launchOutput,
        `앱을 열었습니다: ${resolvedActivity}`,
        "이 터미널을 유지하고 종료할 때 Ctrl+C를 누르세요.",
        "",
      ].join("\n")
    );

    const [code, signal] = await metroExit;

    if (!isStopping && code !== 0) {
      throw new Error(
        `Metro가 비정상 종료되었습니다(code ${code}, signal ${
          signal ?? "none"
        }).`
      );
    }
  } finally {
    process.removeListener("SIGINT", handleSignal);
    process.removeListener("SIGTERM", handleSignal);
    stopMetro();
  }
}

const isMainModule =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  main().catch((error) => {
    process.stderr.write(`\nAndroid 개발 실행 실패\n${error.message}\n`);
    process.exitCode = 1;
  });
}
