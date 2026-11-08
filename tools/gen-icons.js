var fs, zlib;
if (typeof require === "function") {
  try { fs = require("fs"); zlib = require("zlib"); } catch (e) {}
}

// ---- PNG minimal RGBA (génération par le workflow — aucun binaire dans le dépôt) ----
var CRC_TABLE = [];
for (var n = 0; n < 256; n++) {
  var c = n;
  for (var k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf) {
  var c = 0xffffffff;
  for (var i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  var len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  var t = Buffer.from(type, "ascii");
  var body = Buffer.concat([t, data]);
  var crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function writePNG(path, W, draw) {
  var raw = Buffer.alloc((W * 4 + 1) * W);
  var o = 0;
  for (var y = 0; y < W; y++) {
    raw[o++] = 0; // filtre "none"
    for (var x = 0; x < W; x++) {
      var px = draw(x, y); // [r,g,b,a]
      raw[o++] = px[0]; raw[o++] = px[1]; raw[o++] = px[2]; raw[o++] = px[3];
    }
  }
  var ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(W, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  var png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
  fs.writeFileSync(path, png);
  console.log(path, png.length, "octets");
}

// ---- icône flamme + chevrons (identique à icon.svg) ----
function hex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
var BG = hex("#0d1020"), ORANGE = hex("#ff7a18"), YELLOW = hex("#ffd23f"), GREEN = hex("#2fd08c");

function inRRect(x, y, rx, ry, rw, rh, r) {
  if (x < rx || y < ry || x >= rx + rw || y >= ry + rh) return false;
  var x0 = rx + r, y0 = ry + r, x1 = rx + rw - r, y1 = ry + rh - r;
  if (x >= x0 && x < x1) return true;
  if (y >= y0 && y < y1) return true;
  var cx = x < x0 ? x0 : x1;
  var cy = y < y0 ? y0 : y1;
  var dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}
function inEllipse(x, y, cx, cy, rx, ry) {
  var dx = (x - cx) / rx, dy = (y - cy) / ry;
  return dx * dx + dy * dy <= 1;
}
// flamme : union d'ellipses décalées vers le haut (langue de feu)
function inFlame(x, y, s) {
  return inEllipse(x, y, 256, 250 + s, 74 + s, 85 + s)
    || inEllipse(x, y, 232, 195 + s, 46 + s, 60 + s)
    || inEllipse(x, y, 280, 210 + s, 44 + s, 55 + s);
}

function drawPix(x, y) {
  // chevrons (grade / progression)
  if (inRRect(x, y, 176, 398, 160, 26, 13)) return [GREEN[0], GREEN[1], GREEN[2], 190];
  if (inRRect(x, y, 140, 360, 232, 26, 13)) return GREEN;
  // flamme intérieure jaune
  if (inFlame(x, y, -26) && y > 180) return YELLOW;
  // flamme orange
  if (inFlame(x, y, 0)) return ORANGE;
  // fond arrondi
  if (inRRect(x, y, 0, 0, 512, 512, 104)) return BG;
  return [0, 0, 0, 0];
}
function drawScaled(W) {
  var s = W / 512;
  return function (x, y) {
    var c = drawPix(Math.round(x / s), Math.round(y / s));
    return [c[0], c[1], c[2], 255];
  };
}

function main() {
  if (!fs || !zlib) {
    console.log("Génération PNG : nécessite Node.js (exécutée par le workflow GitHub Actions).");
    return;
  }
  writePNG("icon-512.png", 512, drawScaled(512));
  writePNG("icon-192.png", 192, drawScaled(192));
}
main();

if (typeof module !== "undefined" && module.exports) {
  module.exports = { drawPix: drawPix, crc32: crc32, inRRect: inRRect, inEllipse: inEllipse };
}
