import assert from "node:assert/strict";
import { createServer } from "node:net";
import { after, before, describe, test } from "node:test";

import {
  isPortAvailable,
  normalizeResolvedActivity,
  parseAdbDevices,
  parseArguments,
  selectDevice,
} from "./start-android-dev.mjs";

describe("start-android-dev", () => {
  test("CLI 옵션을 파싱한다", () => {
    assert.deepEqual(
      parseArguments([
        "--device",
        "emulator-5554",
        "--package",
        "com.example.app",
      ]),
      {
        device: "emulator-5554",
        help: false,
        packageName: "com.example.app",
      }
    );
  });

  test("ADB 결과에서 실행 가능한 기기를 선택한다", () => {
    const devices = parseAdbDevices(
      [
        "List of devices attached",
        "emulator-5554\tdevice",
        "R3CN30\tunauthorized",
        "",
      ].join("\n")
    );

    assert.equal(selectDevice(devices, null), "emulator-5554");
  });

  test("기기가 여러 대면 명시적 선택을 요구한다", () => {
    assert.throws(
      () =>
        selectDevice(
          [
            { serial: "emulator-5554", state: "device" },
            { serial: "emulator-5556", state: "device" },
          ],
          null
        ),
      /--device <serial>/u
    );
  });

  test("패키지 Activity를 정규화한다", () => {
    assert.equal(
      normalizeResolvedActivity(
        "com.s15p11b104app",
        "com.s15p11b104app/.MainActivity\n"
      ),
      "com.s15p11b104app/.MainActivity"
    );
  });

  describe("포트 점유 검사", () => {
    const server = createServer();
    let port;

    before(async () => {
      server.listen(0, "127.0.0.1");
      await new Promise((resolve) => {
        server.once("listening", resolve);
      });
      const address = server.address();
      port = address.port;
    });

    after(async () => {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    });

    test("이미 사용 중인 포트를 거부한다", async () => {
      assert.equal(await isPortAvailable(port), false);
    });

    test("서버가 종료된 포트는 사용할 수 있다", async () => {
      const temporaryServer = createServer();
      temporaryServer.listen(0, "127.0.0.1");
      await new Promise((resolve) => {
        temporaryServer.once("listening", resolve);
      });
      const address = temporaryServer.address();
      const availablePort = address.port;
      await new Promise((resolve, reject) => {
        temporaryServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });

      assert.equal(await isPortAvailable(availablePort), true);
    });
  });
});
