export interface CacheOptions {
  public?: boolean;
  private?: boolean;
  noStore?: boolean;
  noCache?: boolean;
  immutable?: boolean;
  mustRevalidate?: boolean;
  maxAge?: number;
  sMaxAge?: number;
  staleWhileRevalidate?: number;
  staleIfError?: number;
}

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export type JsonObject = { [key: string]: JsonValue | undefined };
export type JsonArray = JsonValue[];
export type JsonBody = JsonObject | JsonArray;
export type BetterResponseBody = BodyInit | JsonBody | Response | null;

export interface BetterResponseInit extends ResponseInit {
  cache?: false | number | CacheOptions;
  security?: boolean;
}

export interface ProblemDetails extends JsonObject {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
}

const JSON_CONTENT_TYPE = "application/json";
const PROBLEM_CONTENT_TYPE = "application/problem+json";

const SECURITY_HEADERS = {
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
} as const;

function isPlainObject(
  value: BetterResponseBody | undefined
): value is JsonObject {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function isJsonBody(value: BetterResponseBody | undefined): value is JsonBody {
  return Array.isArray(value) || isPlainObject(value);
}

function isResponse(value: BetterResponseBody | undefined): value is Response {
  return value instanceof Response;
}

function normalizeMaxAge(value: number): number {
  return Math.max(0, Math.floor(value));
}

function buildCacheControl(cache: BetterResponseInit["cache"]): string | null {
  if (typeof cache === "number") {
    return `public, max-age=${normalizeMaxAge(cache)}`;
  }

  if (!cache) return null;

  const flags: ReadonlyArray<readonly [boolean | undefined, string]> = [
    [cache.public, "public"],
    [cache.private, "private"],
    [cache.noStore, "no-store"],
    [cache.noCache, "no-cache"],
    [cache.immutable, "immutable"],
    [cache.mustRevalidate, "must-revalidate"],
  ];
  const durations: ReadonlyArray<readonly [number | undefined, string]> = [
    [cache.maxAge, "max-age"],
    [cache.sMaxAge, "s-maxage"],
    [cache.staleWhileRevalidate, "stale-while-revalidate"],
    [cache.staleIfError, "stale-if-error"],
  ];
  const directives = [
    ...flags.filter(([enabled]) => enabled).map(([, directive]) => directive),
    ...durations.flatMap(([value, directive]) =>
      typeof value === "number" ? `${directive}=${normalizeMaxAge(value)}` : []
    ),
  ];

  return directives.join(", ") || null;
}

function applyAutomaticHeader(
  headers: Headers,
  name: string,
  value: string
): void {
  if (!headers.has(name)) {
    headers.set(name, value);
  }
}

function prepareBody(
  body: BetterResponseBody | undefined,
  headers: Headers
): BodyInit | null {
  if (isResponse(body)) {
    const contentType = body.headers.get("Content-Type");
    if (contentType) applyAutomaticHeader(headers, "Content-Type", contentType);

    return body.body;
  }

  if (isJsonBody(body)) {
    applyAutomaticHeader(headers, "Content-Type", JSON_CONTENT_TYPE);
    return JSON.stringify(body);
  }

  return body ?? null;
}

function buildResponseInit(
  body: BetterResponseBody | undefined,
  init?: BetterResponseInit
): { body: BodyInit | null; init: ResponseInit } {
  const { cache, security, ...responseInit } = init ?? {};
  const headers = new Headers(responseInit.headers);
  responseInit.headers = headers;

  if (isResponse(body)) {
    responseInit.status ??= body.status;
    responseInit.statusText ??= body.statusText;
  }

  const preparedBody = prepareBody(body, headers);
  const cacheControl = buildCacheControl(cache);

  if (cacheControl) {
    applyAutomaticHeader(headers, "Cache-Control", cacheControl);
  }

  if (security) {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      applyAutomaticHeader(headers, name, value);
    }
  }

  return { body: preparedBody, init: responseInit };
}

export class BetterResponse extends Response {
  constructor(body?: BetterResponseBody, init?: BetterResponseInit) {
    const { body: preparedBody, init: responseInit } = buildResponseInit(
      body,
      init
    );
    super(preparedBody, responseInit);
  }

  get error(): boolean {
    return this.status >= 400;
  }

  static json(data: JsonBody, init?: BetterResponseInit): BetterResponse {
    return new BetterResponse(data, init);
  }

  static text(text: string, init?: BetterResponseInit): BetterResponse {
    const headers = new Headers(init?.headers);
    applyAutomaticHeader(headers, "Content-Type", "text/plain; charset=utf-8");
    return new BetterResponse(text, { ...init, headers });
  }

  static html(html: string, init?: BetterResponseInit): BetterResponse {
    const headers = new Headers(init?.headers);
    applyAutomaticHeader(headers, "Content-Type", "text/html; charset=utf-8");
    return new BetterResponse(html, { ...init, headers });
  }

  static redirect(url: string | URL, status = 302): BetterResponse {
    return new BetterResponse(null, {
      status,
      headers: {
        Location: String(url),
      },
    });
  }

  static empty(status = 204): BetterResponse {
    return new BetterResponse(null, { status });
  }

  static error(): Response;
  static error(
    message: string,
    status?: number,
    init?: BetterResponseInit
  ): BetterResponse;
  static error(
    ...args: [] | [message: string, status?: number, init?: BetterResponseInit]
  ): Response {
    if (!args.length) return Response.error();

    const [message, status = 500, init] = args;

    return new BetterResponse({ error: message }, { ...init, status });
  }

  static problem(
    problem: ProblemDetails,
    init?: BetterResponseInit
  ): BetterResponse {
    const headers = new Headers(init?.headers);
    applyAutomaticHeader(headers, "Content-Type", PROBLEM_CONTENT_TYPE);

    return new BetterResponse(problem, {
      ...init,
      status: init?.status ?? problem.status,
      headers,
    });
  }
}

export default BetterResponse;
