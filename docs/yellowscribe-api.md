# Yellowscribe API

Source: https://github.com/ThePants999/Yellowscribe  
Base URL: `https://yellowscribe.link`

No authentication required.

---

## POST /getArmyCode

The endpoint we use. Accepts a Yellowscribe-format JSON body and returns a short shareable code.

### Request

```
POST https://yellowscribe.link/getArmyCode?uiHeight=700&uiWidth=1200&decorativeNames=false&modules=MatchedPlay
Content-Type: application/json

{ "edition": "10e", "order": [...], "units": { ... } }
```

**Body:** the Yellowscribe JSON object (`edition`, `order`, `units`) — exactly the format `generateYellowscribe()` produces.

**Query parameters** (all optional, defaults shown):

| Parameter | Default | Notes |
|---|---|---|
| `uiHeight` | `700` | TTS UI panel height in pixels |
| `uiWidth` | `1200` | TTS UI panel width in pixels |
| `decorativeNames` | `false` | Use decorative unit names in TTS |
| `modules` | `MatchedPlay` | Comma-separated. Add `,Crusade` for Crusade rules |

### Response

```json
{ "code": "a1b2c3d4" }
```

`code` is an 8-character hex string. The army can be retrieved at:

```
https://yellowscribe.link/get_army_by_id?id=a1b2c3d4
```

**Codes expire after 10 minutes of inactivity.**

### Status codes

| Code | Meaning |
|---|---|
| 200 | Success |
| 500 | Server error processing the army |

---

## Other endpoints (for reference, not used by this app)

**`POST /getFormattedArmy`** — accepts a raw `.rosz` or `.regiztry` BattleScribe roster file, returns parsed Yellowscribe JSON. Not relevant since we build the JSON ourselves.

**`POST /makeArmyAndReturnCode`** — one-shot: upload a BattleScribe file and get a code back directly.

**`GET /get_army_by_id?id=<code>`** — retrieves the stored roster JSON by code. Returns 404 if expired.

---

## Integration plan

Replace the "Export Yellowscribe" download with a button that:

1. Calls `generateYellowscribe(rawData, format, armyState)` to build the payload.
2. POSTs it to `https://yellowscribe.link/getArmyCode`.
3. On success, shows the returned `code` to the user (copy-to-clipboard or direct link).
4. On network error or 500, falls back to downloading the JSON file.
