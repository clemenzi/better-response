import { describe, expect, it } from "vitest";

import BetterResponse from "../src";

describe("BetterResponse", () => {
  it("serializes plain objects as JSON", async () => {
    const response = new BetterResponse({ ok: true });

    expect(response.headers.get("Content-Type")).toBe("application/json");
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("serializes arrays as JSON", async () => {
    const response = new BetterResponse(["a", "b"]);

    expect(response.headers.get("Content-Type")).toBe("application/json");
    await expect(response.json()).resolves.toEqual(["a", "b"]);
  });

  it("keeps string bodies as text", async () => {
    const response = new BetterResponse("hello");

    expect(response.headers.get("Content-Type")).toContain("text/plain");
    await expect(response.text()).resolves.toBe("hello");
  });

  it("does not JSON-stringify Blob bodies", async () => {
    const response = new BetterResponse(new Blob(["hello"]));

    expect(response.headers.get("Content-Type")).toBeNull();
    await expect(response.text()).resolves.toBe("hello");
  });

  it("does not JSON-stringify FormData bodies", async () => {
    const formData = new FormData();
    formData.set("email", "hello@example.com");

    const response = new BetterResponse(formData);
    const parsed = await response.formData();

    expect(parsed.get("email")).toBe("hello@example.com");
  });

  it("does not JSON-stringify ReadableStream bodies", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("stream"));
        controller.close();
      },
    });

    const response = new BetterResponse(stream);

    await expect(response.text()).resolves.toBe("stream");
  });

  it("preserves user-provided content type", async () => {
    const response = new BetterResponse(
      { error: "Invalid input" },
      {
        headers: {
          "Content-Type": "application/problem+json",
        },
      }
    );

    expect(response.headers.get("Content-Type")).toBe(
      "application/problem+json"
    );
    await expect(response.text()).resolves.toBe('{"error":"Invalid input"}');
  });

  it("preserves user-provided headers when security is enabled", () => {
    const response = new BetterResponse("ok", {
      security: true,
      headers: {
        "X-Frame-Options": "SAMEORIGIN",
        "X-App": "demo",
      },
    });

    expect(response.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(response.headers.get("X-App")).toBe("demo");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
  });

  it("creates a correct Cache-Control header from a number", () => {
    const response = new BetterResponse("cached", { cache: 60 });
    const immediatelyStaleResponse = new BetterResponse("stale", { cache: 0 });

    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");
    expect(immediatelyStaleResponse.headers.get("Cache-Control")).toBe(
      "public, max-age=0"
    );
  });

  it("creates a correct Cache-Control header from an object", () => {
    const response = new BetterResponse("cached", {
      cache: {
        public: true,
        maxAge: 60,
        staleWhileRevalidate: 300,
      },
    });

    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=60, stale-while-revalidate=300"
    );
  });

  it("adds security headers only when requested", () => {
    const response = new BetterResponse("secure", { security: true });

    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("does not add security headers when disabled", () => {
    const response = new BetterResponse("plain", { security: false });

    expect(response.headers.get("X-Content-Type-Options")).toBeNull();
    expect(response.headers.get("Referrer-Policy")).toBeNull();
    expect(response.headers.get("X-Frame-Options")).toBeNull();
  });

  it("supports json, text, and html helpers", async () => {
    const jsonResponse = BetterResponse.json({ ok: true });
    const textResponse = BetterResponse.text("hello");
    const htmlResponse = BetterResponse.html("<h1>Hello</h1>");

    await expect(jsonResponse.json()).resolves.toEqual({ ok: true });
    expect(textResponse.headers.get("Content-Type")).toBe(
      "text/plain; charset=utf-8"
    );
    expect(htmlResponse.headers.get("Content-Type")).toBe(
      "text/html; charset=utf-8"
    );
  });

  it("supports redirect and empty helpers", () => {
    const redirectResponse = BetterResponse.redirect("/login");
    const emptyResponse = BetterResponse.empty(204);

    expect(redirectResponse.status).toBe(302);
    expect(redirectResponse.headers.get("Location")).toBe("/login");
    expect(emptyResponse.status).toBe(204);
  });

  it("supports error responses", async () => {
    const response = BetterResponse.error("Not found", 404);
    const emptyMessageResponse = BetterResponse.error("");

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Not found" });
    await expect(emptyMessageResponse.json()).resolves.toEqual({ error: "" });
  });

  it("supports RFC 7807 problem responses", async () => {
    const response = BetterResponse.problem({
      status: 400,
      title: "Validation error",
      detail: "Email is invalid",
    });

    expect(response.status).toBe(400);
    expect(response.headers.get("Content-Type")).toBe(
      "application/problem+json"
    );
    await expect(response.json()).resolves.toEqual({
      status: 400,
      title: "Validation error",
      detail: "Email is invalid",
    });
  });

  it("can reuse an existing Response body without serializing it", async () => {
    const source = new Response("hello", {
      status: 201,
      headers: {
        "Content-Type": "text/plain",
      },
    });

    const response = new BetterResponse(source);

    expect(response.status).toBe(201);
    expect(response.headers.get("Content-Type")).toBe("text/plain");
    await expect(response.text()).resolves.toBe("hello");
  });
});
