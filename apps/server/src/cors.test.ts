import assert from "node:assert/strict";
import type { IncomingMessage, ServerResponse } from "node:http";
import test from "node:test";
import { applyCors, parseCorsOrigins } from "./cors.js";

function fakeResponse(): { res: ServerResponse; headers: Record<string, string>; state: { status: number; ended: boolean } } {
  const headers: Record<string, string> = {};
  const state = { status: 200, ended: false };
  const res = {
    setHeader: (name: string, value: string) => {
      headers[name.toLowerCase()] = value;
    },
    end: () => {
      state.ended = true;
    },
    set statusCode(value: number) {
      state.status = value;
    },
  } as unknown as ServerResponse;
  return { res, headers, state };
}

function fakeRequest(method: string, headers: Record<string, string>): IncomingMessage {
  return { method, headers } as unknown as IncomingMessage;
}

test("CORS is off when WORKPLANE_CORS_ORIGINS is unset or empty", () => {
  assert.equal(parseCorsOrigins(undefined), null);
  assert.equal(parseCorsOrigins("  , "), null);
  const { res, headers } = fakeResponse();
  assert.equal(applyCors(fakeRequest("GET", { origin: "http://a.test" }), res, null), false);
  assert.deepEqual(headers, {});
});

test("an allowed origin gets headers and preflight is answered with 204", () => {
  const config = parseCorsOrigins("http://a.test, http://b.test");
  const get = fakeResponse();
  assert.equal(applyCors(fakeRequest("GET", { origin: "http://a.test" }), get.res, config), false);
  assert.equal(get.headers["access-control-allow-origin"], "http://a.test");

  const preflight = fakeResponse();
  const handled = applyCors(
    fakeRequest("OPTIONS", { origin: "http://b.test", "access-control-request-method": "POST" }),
    preflight.res,
    config,
  );
  assert.equal(handled, true);
  assert.equal(preflight.state.status, 204);
  assert.match(preflight.headers["access-control-allow-headers"], /authorization/);
});

test("an unknown origin gets no headers and a rejected preflight", () => {
  const config = parseCorsOrigins("http://a.test");
  const get = fakeResponse();
  applyCors(fakeRequest("GET", { origin: "http://evil.test" }), get.res, config);
  assert.equal(get.headers["access-control-allow-origin"], undefined);

  const preflight = fakeResponse();
  applyCors(fakeRequest("OPTIONS", { origin: "http://evil.test", "access-control-request-method": "GET" }), preflight.res, config);
  assert.equal(preflight.state.status, 403);
});

test("wildcard allows any origin", () => {
  const config = parseCorsOrigins("*");
  const get = fakeResponse();
  applyCors(fakeRequest("GET", { origin: "http://anything.test" }), get.res, config);
  assert.equal(get.headers["access-control-allow-origin"], "*");
});
