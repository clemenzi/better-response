# Better Response

A tiny helper for creating better Fetch API `Response` objects.

`better-response` keeps the native `Response` API, but removes a bit of boilerplate for common JSON, text, HTML, cache, and error responses.

## Installation

```bash
npm install better-response
```

## Usage

```ts
import BetterResponse from "better-response";

return new BetterResponse({ ok: true });
```

That produces a normal `Response` with:

- a JSON string body
- `Content-Type: application/json`

## Static helpers

### JSON

```ts
return BetterResponse.json({ ok: true });
```

### Text

```ts
return BetterResponse.text("Hello");
```

### HTML

```ts
return BetterResponse.html("<h1>Hello</h1>");
```

### Error

```ts
return BetterResponse.error("Not found", 404);
```

Response body:

```json
{
  "error": "Not found"
}
```

### Redirect

```ts
return BetterResponse.redirect("/login");
```

### Empty

```ts
return BetterResponse.empty(204);
```

## Constructor behavior

`BetterResponse` only auto-serializes plain objects and arrays.

```ts
new BetterResponse({ ok: true });
new BetterResponse(["a", "b"]);
```

It leaves other Fetch body types alone:

```ts
new BetterResponse("hello");
new BetterResponse(new Blob(["hello"]));
new BetterResponse(new FormData());
new BetterResponse(new URLSearchParams({ q: "test" }));
```

If you provide your own `Content-Type`, it is preserved:

```ts
new BetterResponse(
  { error: "Invalid input" },
  {
    headers: {
      "Content-Type": "application/problem+json"
    }
  }
);
```

## Cache control

Use `cache: false`, a number, or an object.

```ts
new BetterResponse({ ok: true }, { cache: false });

new BetterResponse({ ok: true }, { cache: 60 });
// Cache-Control: public, max-age=60

new BetterResponse({ ok: true }, {
  cache: {
    public: true,
    maxAge: 60,
    staleWhileRevalidate: 300
  }
});
// Cache-Control: public, max-age=60, stale-while-revalidate=300
```

## Security headers

Security headers are opt-in:

```ts
BetterResponse.json(
  { ok: true },
  {
    cache: {
      public: true,
      maxAge: 60,
      staleWhileRevalidate: 300
    },
    security: true
  }
);
```

When enabled, `better-response` adds safe defaults unless you already set them:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`
- `X-Frame-Options: DENY`

## Problem responses

For RFC 7807 style responses:

```ts
return BetterResponse.problem({
  status: 400,
  title: "Validation error",
  detail: "Email is invalid"
});
```

This sets:

- `Content-Type: application/problem+json`

## Native compatibility

The class extends the standard `Response`, so normal `ResponseInit` options still work:

```ts
return new BetterResponse("Created", {
  status: 201,
  headers: {
    "X-App": "demo"
  }
});
```

## License

MIT
