/**
 * Per-route request/response schemas published in the x402 402 challenge.
 *
 * Generated from `openapi.json` so the discovery metadata and the runtime
 * challenge cannot drift apart: `accepts[].outputSchema.input` describes how to
 * call the route, `accepts[].outputSchema.output` describes what the paid 200
 * returns. Keys match the paywall route map in `server.ts` exactly.
 *
 * Update `openapi.json` first, then re-derive this file.
 */

/** x402 Bazaar-style schema pair carried by every accept entry. */
export type RouteSchema = {
  /** How to invoke the route: method, query params and/or JSON body fields. */
  input: Record<string, unknown>;
  /** JSON Schema of the paid 200 response body. */
  output: Record<string, unknown>;
};

export const ROUTE_SCHEMAS: Record<string, RouteSchema> = {
  "POST /gifts": {
    "input": {
      "type": "http",
      "method": "POST",
      "queryParams": {
        "amount": {
          "type": "string",
          "example": "0.25",
          "description": "Gift budget in USD, clamped to $0.01–$5.00 (default $0.10). Send it in the query string: the 402 challenge is built before the request body is read, so this is what lets the quote be amount + $0.01 fee."
        }
      },
      "bodyType": "json",
      "bodyFields": {
        "amount": {
          "type": "string",
          "description": "Gift budget in USD. Only honoured when no ?amount= query parameter was sent on the paid request.",
          "example": "0.25"
        },
        "sponsor": {
          "type": "string"
        },
        "recipient": {
          "type": "string"
        },
        "message": {
          "type": "string",
          "maxLength": 500
        },
        "taskHint": {
          "type": "string",
          "maxLength": 500
        }
      }
    },
    "output": {
      "type": "object",
      "properties": {
        "voucherId": {
          "type": "string"
        },
        "document": {
          "const": "x402-gift-agent/voucher"
        },
        "claimCode": {
          "type": "string",
          "description": "Secret redemption code — returned only to the buyer"
        },
        "taskBudget": {
          "type": "string"
        },
        "feePaid": {
          "type": "string"
        },
        "totalPaid": {
          "type": "string"
        },
        "sponsor": {
          "type": "object",
          "description": "Dual-rail wallet identity",
          "properties": {
            "rail": {
              "type": "string",
              "enum": [
                "evm",
                "solana"
              ]
            },
            "address": {
              "type": "string",
              "description": "Lowercased 0x address, or base58 Solana pubkey"
            }
          }
        },
        "boundTo": {
          "type": "object",
          "description": "Dual-rail wallet identity",
          "properties": {
            "rail": {
              "type": "string",
              "enum": [
                "evm",
                "solana"
              ]
            },
            "address": {
              "type": "string",
              "description": "Lowercased 0x address, or base58 Solana pubkey"
            }
          }
        },
        "message": {
          "type": "string"
        },
        "taskHint": {
          "type": "string"
        },
        "issuedAt": {
          "type": "string",
          "format": "date-time"
        },
        "expiresAt": {
          "type": "string",
          "format": "date-time"
        },
        "status": {
          "type": "string",
          "enum": [
            "unclaimed",
            "claimed",
            "expired"
          ]
        },
        "signature": {
          "type": "string"
        },
        "algorithm": {
          "const": "HMAC-SHA256"
        }
      }
    }
  },
};
