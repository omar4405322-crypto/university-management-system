import assert from "node:assert/strict";
import { test, beforeEach, afterEach } from "node:test";
import http from "node:http";
import EventEmitter from "node:events";
import {
  initSocket,
  closeSocket,
  resetSocketForTest,
  getUserRoom,
  getRoleRoom,
  getSocketAdapterStatus,
  getIO,
} from "../src/utils/socket";

// Simulated in-memory Redis PubSub bus for dual-replica integration testing
class MockRedisPubSubBus extends EventEmitter {
  createClient() {
    const bus = this;
    const client: any = new EventEmitter();
    client.status = "ready";

    client.publish = async (channel: string, message: string) => {
      bus.emit(channel, message);
      bus.emit("pmessage", channel, message);
      return 1;
    };

    client.subscribe = async (channel: string, cb?: any) => {
      const listener = (msg: string) => {
        client.emit("message", channel, msg);
      };
      bus.on(channel, listener);
      if (cb) cb();
    };

    client.psubscribe = async (pattern: string, cb?: any) => {
      const listener = (channel: string, msg: string) => {
        client.emit("pmessage", pattern, channel, msg);
      };
      bus.on("pmessage", listener);
      if (cb) cb();
    };

    client.punsubscribe = async (pattern: string, cb?: any) => {
      if (cb) cb();
    };

    client.unsubscribe = async (channel: string, cb?: any) => {
      if (cb) cb();
    };

    client.quit = async () => {
      client.status = "end";
      client.removeAllListeners();
    };

    client.disconnect = () => {
      client.status = "end";
      client.removeAllListeners();
    };

    client.duplicate = () => bus.createClient();

    return client;
  }
}

let server: http.Server;

beforeEach(() => {
  server = http.createServer();
  resetSocketForTest();
});

afterEach(async () => {
  await closeSocket();
  if (server && server.listening) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("SCALE-001: Room naming remains strictly deterministic", () => {
  assert.equal(getUserRoom(42), "user_42");
  assert.equal(getUserRoom("1001"), "user_1001");
  assert.equal(getRoleRoom("STUDENT"), "role_STUDENT");
  assert.equal(getRoleRoom("DOCTOR"), "role_DOCTOR");
  assert.equal(getRoleRoom("SUPER_ADMIN"), "role_SUPER_ADMIN");
});

test("SCALE-001: Adapts to standalone mode when Redis is unconfigured in development/test", () => {
  delete process.env.REDIS_URL;
  initSocket(server);

  const status = getSocketAdapterStatus();
  assert.equal(status.mode, "standalone");
  assert.equal(status.configured, false);
});

test("SCALE-001: Configures custom Pub/Sub adapter when Redis clients are supplied", () => {
  const bus = new MockRedisPubSubBus();
  const pubClient = bus.createClient();
  const subClient = bus.createClient();

  initSocket(server, { pubClient, subClient });

  const status = getSocketAdapterStatus();
  assert.equal(status.mode, "redis");
  assert.equal(status.configured, true);
  assert.equal(status.pubStatus, "ready");
  assert.equal(status.subStatus, "ready");
});

test("SCALE-001: Shutdown cleans up Socket.IO and disconnects Pub/Sub clients cleanly", async () => {
  const bus = new MockRedisPubSubBus();
  const pubClient = bus.createClient();
  const subClient = bus.createClient();

  initSocket(server, { pubClient, subClient });
  assert.equal(getSocketAdapterStatus().configured, true);

  await closeSocket();

  assert.equal(pubClient.status, "end");
  assert.equal(subClient.status, "end");
  assert.throws(() => getIO(), /Socket.io not initialized!/);
});

test("SCALE-001: Dual-replica event forwarding simulation", async () => {
  const eventBus = new MockRedisPubSubBus();
  const serverA = http.createServer();

  const pubClientA = eventBus.createClient();
  const subClientA = eventBus.createClient();

  initSocket(serverA, { pubClient: pubClientA, subClient: subClientA });
  assert.equal(getSocketAdapterStatus().mode, "redis");
  assert.equal(getSocketAdapterStatus().configured, true);

  // When Replica B publishes an event to the bus, pubClient receives and forwards it
  let receivedMessage: any = null;
  subClientA.on("message", (channel: string, msg: string) => {
    receivedMessage = { channel, msg };
  });
  subClientA.on("pmessage", (_pattern: string, channel: string, msg: string) => {
    receivedMessage = { channel, msg };
  });

  await pubClientA.publish("socket.io#/#user_42#", JSON.stringify({ event: "NOTIFICATION", data: "ok" }));

  assert.ok(receivedMessage);
  assert.equal(receivedMessage.channel, "socket.io#/#user_42#");

  await closeSocket();
  serverA.close();
});
