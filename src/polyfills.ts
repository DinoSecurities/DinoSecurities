import { Buffer } from "buffer";

// Solana web3.js and related libraries need Buffer in the browser
if (typeof globalThis.Buffer === "undefined") {
  globalThis.Buffer = Buffer;
}
