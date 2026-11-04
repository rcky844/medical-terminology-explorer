# Medical Terminology Browser

A small site that fetches the Medical Terminology list from
`https://medterms.hku.hk/storage/mtlist.json` at runtime, Base64-decodes it in the
browser, and lets you search/filter the 215 terms. Audio and images are loaded
directly from the HKU site; no copy of the terminology data is stored locally.

## Run

```bash
npm start
# or: node server.js
```

Then open http://localhost:3000

The Node server proxies `/api/mtlist` because the source does not send CORS headers;
the proxy returns the raw Base64 payload, which the client decodes with
`atob`/`TextDecoder` before `JSON.parse`.