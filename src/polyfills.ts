import { Buffer } from "buffer";

// Solana web3.js and related libraries need Buffer and global in the browser
globalThis.Buffer = Buffer;
