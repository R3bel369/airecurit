import { readFileSync, writeFileSync } from 'fs';

const filePath = 'C:/Users/user/.gemini/antigravity-ide/scratch/recruitpro-ats/src/App.jsx';

let content = readFileSync(filePath, 'utf8');
if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);

// Windows-1252 to Unicode mapping for chars 0x80-0x9F (the problematic range)
// Standard latin1 maps 0x80-0x9F to U+0080-U+009F (control chars)
// But Windows-1252 maps them to printable chars:
const cp1252Map = {
  0x80: 0x20AC, // €
  0x82: 0x201A, // ‚
  0x83: 0x0192, // ƒ
  0x84: 0x201E, // „
  0x85: 0x2026, // …
  0x86: 0x2020, // †
  0x87: 0x2021, // ‡
  0x88: 0x02C6, // ˆ
  0x89: 0x2030, // ‰
  0x8A: 0x0160, // Š
  0x8B: 0x2039, // ‹
  0x8C: 0x0152, // Œ
  0x8E: 0x017D, // Ž
  0x91: 0x2018, // '
  0x92: 0x2019, // '
  0x93: 0x201C, // "
  0x94: 0x201D, // "
  0x95: 0x2022, // •
  0x96: 0x2013, // –
  0x97: 0x2014, // —
  0x98: 0x02DC, // ˜
  0x99: 0x2122, // ™
  0x9A: 0x0161, // š
  0x9B: 0x203A, // ›
  0x9C: 0x0153, // œ
  0x9E: 0x017E, // ž
  0x9F: 0x0178, // Ÿ (U+0178)
};

// Reverse map: Unicode codepoint -> byte value in CP1252
const unicodeToCp1252 = {};
for (const [byte, unicode] of Object.entries(cp1252Map)) {
  unicodeToCp1252[unicode] = parseInt(byte);
}
// Also add direct mappings for U+00A0 to U+00FF (same in latin1 and cp1252)
for (let i = 0xA0; i <= 0xFF; i++) {
  unicodeToCp1252[i] = i;
}

// Function: given the Unicode string (which came from CP1252-interpreted bytes re-encoded as UTF-8),
// recover the original bytes, then decode those bytes as proper UTF-8
function recoverFromCp1252(str) {
  // Convert each char back to its CP1252 byte value
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    const cp = str.charCodeAt(i);
    if (cp < 0x80) {
      // ASCII - byte value = codepoint
      bytes.push(cp);
    } else if (unicodeToCp1252[cp] !== undefined) {
      // CP1252 special char
      bytes.push(unicodeToCp1252[cp]);
    } else if (cp >= 0x80 && cp <= 0xFF) {
      // Direct latin1 range
      bytes.push(cp);
    } else {
      // Already a proper Unicode char (> U+00FF), keep as-is
      // This shouldn't happen if recovery is needed
      return null;
    }
  }
  return Buffer.from(bytes);
}

// Process the string: find sequences of non-ASCII chars that form CP1252-encoded UTF-8 sequences
let result = '';
let count = 0;
let i = 0;

while (i < content.length) {
  const cp = content.charCodeAt(i);
  
  // Check if this could be the start of a CP1252-encoded multi-byte UTF-8 sequence
  // In CP1252, the byte 0xF0 = U+00F0 (ð) - start of a 4-byte UTF-8 sequence
  // The byte 0xE0-0xEF starts a 3-byte UTF-8 sequence
  // The byte 0xC2-0xDF starts a 2-byte UTF-8 sequence
  
  // Try 4-byte emoji (byte F0-F4 in original = U+00F0-U+00F4 or CP1252 remapping)
  if ((cp === 0x00F0 || (cp >= 0x00F1 && cp <= 0x00F4)) && i + 3 < content.length) {
    // Possible 4-byte emoji sequence
    // Convert this char and next 3 back to their CP1252 byte values
    const chars4 = content.substring(i, i+4);
    const bytes4 = recoverFromCp1252(chars4);
    if (bytes4 && bytes4[0] >= 0xF0 && bytes4[0] <= 0xF4) {
      // Check that bytes 1-3 are continuation bytes (0x80-0xBF)
      if (bytes4[1] >= 0x80 && bytes4[1] <= 0xBF &&
          bytes4[2] >= 0x80 && bytes4[2] <= 0xBF &&
          bytes4[3] >= 0x80 && bytes4[3] <= 0xBF) {
        const decoded = bytes4.toString('utf8');
        if (!decoded.includes('\uFFFD')) {
          result += decoded;
          count++;
          i += 4;
          continue;
        }
      }
    }
  }
  
  // Try 3-byte sequence (byte E0-EF = U+00E0-U+00EF)
  if (cp >= 0x00E0 && cp <= 0x00EF && i + 2 < content.length) {
    const chars3 = content.substring(i, i+3);
    const bytes3 = recoverFromCp1252(chars3);
    if (bytes3 && bytes3[0] >= 0xE0 && bytes3[0] <= 0xEF) {
      if (bytes3[1] >= 0x80 && bytes3[1] <= 0xBF &&
          bytes3[2] >= 0x80 && bytes3[2] <= 0xBF) {
        const decoded = bytes3.toString('utf8');
        if (!decoded.includes('\uFFFD')) {
          result += decoded;
          count++;
          i += 3;
          continue;
        }
      }
    }
  }
  
  // Try 2-byte sequence (byte C2-DF = U+00C2-U+00DF, but also check CP1252 special chars)
  if (cp >= 0x00C2 && cp <= 0x00DF && i + 1 < content.length) {
    const chars2 = content.substring(i, i+2);
    const bytes2 = recoverFromCp1252(chars2);
    if (bytes2 && bytes2[0] >= 0xC2 && bytes2[0] <= 0xDF) {
      if (bytes2[1] >= 0x80 && bytes2[1] <= 0xBF) {
        const codepoint = ((bytes2[0] & 0x1F) << 6) | (bytes2[1] & 0x3F);
        if (codepoint >= 0x0080) {
          const decoded = bytes2.toString('utf8');
          if (!decoded.includes('\uFFFD')) {
            result += decoded;
            count++;
            i += 2;
            continue;
          }
        }
      }
    }
  }
  
  // Not a recoverable sequence - keep as-is
  result += content[i];
  i++;
}

console.log(`Recovered ${count} sequences`);

// Verify
const idx = result.indexOf('Sign In to Candidate');
if (idx >= 0) {
  console.log('Login area:', JSON.stringify(result.substring(Math.max(0,idx-40), idx+60)));
}

const bidx = result.indexOf('Missing must-have');
if (bidx >= 0) {
  const area = result.substring(Math.max(0,bidx-5), bidx+5);
  console.log('Bullet area codes:', [...area].map(c => 'U+' + c.charCodeAt(0).toString(16).padStart(4,'0')).join(' '));
}

writeFileSync(filePath, result, 'utf8');
console.log('Done. Written', Buffer.byteLength(result, 'utf8'), 'bytes');
