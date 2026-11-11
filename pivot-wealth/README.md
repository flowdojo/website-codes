# Pivot Wealth VSL pages

One form script serves both pages (it detects which one it is on):

| Page | Path |
|---|---|
| High-income (hinry) | `/high-income/vsl` |
| Business owner | `/business/vsl` |

## Files (served from `https://website-codes.vercel.app/pivot-wealth/`)

| File | What it is |
|---|---|
| `vsl.js` / `vsl.min.js` | the form script (readable / minified, identical behaviour). Edit `vsl.js`, regenerate the min file |
| `popup.js` / `popup.min.js` | modal vs inline placement of the form (A/B variant via the `vsl:form-inline` event) |
| `vsl-styles.css` | the CSS the form needs (selected option, autofill, date chips, modal) |

## Add to each page (Webflow, before `</body>`)

```html
<link rel="stylesheet" href="https://website-codes.vercel.app/pivot-wealth/vsl-styles.css">
<script src="https://website-codes.vercel.app/pivot-wealth/vsl.min.js"></script>
<script src="https://website-codes.vercel.app/pivot-wealth/popup.min.js"></script>
```

Use `vsl.js` / `popup.js` instead of the `.min` files when debugging.

## Config

Everything lives in the `CONFIG` object at the top of `vsl.js`: worker URLs (booking + OTP), qualification thresholds,
HubSpot field keys, hero videos per page (`PAGES.<page>.HERO_VIDEO_URL`) and the shared success video (`SUCCESS_VIDEO_URL`).

Files are cached by browsers for 5 minutes (`vercel.json`), so an update can take up to 5 minutes to show.

## A/B variant (inline form instead of the modal)

```js
window.dispatchEvent(new Event('vsl:form-inline'))   // or set window.__vslFormInline = true before popup.js runs
```
