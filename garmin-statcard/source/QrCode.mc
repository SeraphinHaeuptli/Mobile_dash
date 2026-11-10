import Toybox.Lang;

// Minimal QR Code encoder: byte mode, error correction level L, versions 1-6
// (up to 134 bytes), fixed mask pattern 0. Enough for a profile URL or a
// short stats summary, and small enough to run on a watch.
//
// Kept to a plain subset of Monkey C (no "/" division, no type annotations)
// so tools/test-qr.mjs can run this exact file under Node and decode the output.
module QrCode {

    // Indexed by version (index 0 unused).
    const TOTAL_CODEWORDS = [0, 26, 44, 70, 100, 134, 172];
    const EC_PER_BLOCK = [0, 7, 10, 15, 20, 26, 18];
    const NUM_BLOCKS = [0, 1, 1, 1, 1, 1, 2];
    const DATA_PER_BLOCK = [0, 19, 34, 55, 80, 108, 68];
    const MAX_BYTES = 134;

    // Encodes a byte array. Returns rows of Booleans (true = dark module),
    // or null if the input is longer than MAX_BYTES.
    function encode(bytes) {
        var version = 0;
        for (var v = 1; v <= 6; v++) {
            // 4-bit mode + 8-bit length take 1.5 bytes, so 2 bytes of overhead.
            if (bytes.size() <= DATA_PER_BLOCK[v] * NUM_BLOCKS[v] - 2) {
                version = v;
                break;
            }
        }
        if (version == 0) {
            return null;
        }
        initTables();
        var codewords = addErrorCorrection(dataCodewords(bytes, version), version);
        return buildMatrix(codewords, version);
    }

    function dataCodewords(bytes, version) {
        var count = DATA_PER_BLOCK[version] * NUM_BLOCKS[version];
        var out = new [count];
        for (var i = 0; i < count; i++) {
            out[i] = 0;
        }
        var pos = putBits(out, 0, 4, 4); // mode indicator: byte mode (0100)
        pos = putBits(out, pos, bytes.size(), 8);
        for (var i = 0; i < bytes.size(); i++) {
            pos = putBits(out, pos, bytes[i], 8);
        }
        // Terminator (up to 4 zero bits), then round up to a whole byte.
        pos = pos + 4;
        pos = ((pos + 7) >> 3) << 3;
        var pad = 0xEC;
        for (var i = pos >> 3; i < count; i++) {
            out[i] = pad;
            pad = (pad == 0xEC) ? 0x11 : 0xEC;
        }
        return out;
    }

    function putBits(out, pos, value, len) {
        for (var i = len - 1; i >= 0; i--) {
            if (((value >> i) & 1) != 0) {
                out[pos >> 3] = out[pos >> 3] | (0x80 >> (pos & 7));
            }
            pos++;
        }
        return pos;
    }

    // Splits data into blocks, appends Reed-Solomon codewords, interleaves.
    function addErrorCorrection(data, version) {
        var blocks = NUM_BLOCKS[version];
        var blockLen = DATA_PER_BLOCK[version];
        var ecLen = EC_PER_BLOCK[version];
        var divisor = rsDivisor(ecLen);
        var ecc = new [blocks];
        for (var b = 0; b < blocks; b++) {
            ecc[b] = rsRemainder(data, b * blockLen, blockLen, divisor);
        }
        var total = TOTAL_CODEWORDS[version];
        var out = new [total];
        var k = 0;
        for (var i = 0; i < blockLen; i++) {
            for (var b = 0; b < blocks; b++) {
                out[k] = data[b * blockLen + i];
                k++;
            }
        }
        for (var i = 0; i < ecLen; i++) {
            for (var b = 0; b < blocks; b++) {
                out[k] = ecc[b][i];
                k++;
            }
        }
        return out;
    }

    // GF(2^8) arithmetic (modulo x^8 + x^4 + x^3 + x^2 + 1) via log/exp tables,
    // which keeps the Reed-Solomon step cheap on a watch.
    var gfExp = null;
    var gfLog = null;

    function initTables() {
        if (gfExp != null) {
            return;
        }
        gfExp = new [512];
        gfLog = new [256];
        var x = 1;
        for (var i = 0; i < 255; i++) {
            gfExp[i] = x;
            gfLog[x] = i;
            x = x << 1;
            if (x >= 256) {
                x = x ^ 0x11D;
            }
        }
        for (var i = 255; i < 512; i++) {
            gfExp[i] = gfExp[i - 255];
        }
    }

    function gfMul(x, y) {
        if (x == 0 || y == 0) {
            return 0;
        }
        return gfExp[gfLog[x] + gfLog[y]];
    }

    function rsDivisor(degree) {
        var result = new [degree];
        for (var i = 0; i < degree; i++) {
            result[i] = 0;
        }
        result[degree - 1] = 1;
        var root = 1;
        for (var i = 0; i < degree; i++) {
            for (var j = 0; j < degree; j++) {
                result[j] = gfMul(result[j], root);
                if (j + 1 < degree) {
                    result[j] = result[j] ^ result[j + 1];
                }
            }
            root = gfMul(root, 0x02);
        }
        return result;
    }

    function rsRemainder(data, start, len, divisor) {
        var degree = divisor.size();
        var result = new [degree];
        for (var i = 0; i < degree; i++) {
            result[i] = 0;
        }
        for (var k = start; k < start + len; k++) {
            var factor = data[k] ^ result[0];
            for (var i = 0; i < degree - 1; i++) {
                result[i] = result[i + 1];
            }
            result[degree - 1] = 0;
            for (var i = 0; i < degree; i++) {
                result[i] = result[i] ^ gfMul(divisor[i], factor);
            }
        }
        return result;
    }

    function buildMatrix(codewords, version) {
        var size = 17 + 4 * version;
        var m = new [size];
        var fn = new [size]; // true where a function pattern lives
        for (var y = 0; y < size; y++) {
            m[y] = new [size];
            fn[y] = new [size];
            for (var x = 0; x < size; x++) {
                m[y][x] = false;
                fn[y][x] = false;
            }
        }

        // Timing patterns (finders drawn afterwards overwrite the ends).
        for (var i = 0; i < size; i++) {
            setFunction(m, fn, 6, i, (i & 1) == 0);
            setFunction(m, fn, i, 6, (i & 1) == 0);
        }
        drawFinder(m, fn, size, 3, 3);
        drawFinder(m, fn, size, size - 4, 3);
        drawFinder(m, fn, size, 3, size - 4);
        if (version >= 2) {
            // Versions 2-6 have a single alignment pattern.
            var c = size - 7;
            for (var dy = -2; dy <= 2; dy++) {
                for (var dx = -2; dx <= 2; dx++) {
                    setFunction(m, fn, c + dx, c + dy, maxAbs(dx, dy) != 1);
                }
            }
        }
        drawFormat(m, fn, size, 0); // reserve the format areas

        // Place data bits in the zigzag order, applying mask 0 ((x + y) % 2 == 0).
        var bit = 0;
        var totalBits = codewords.size() * 8;
        var right = size - 1;
        while (right >= 1) {
            if (right == 6) {
                right = 5; // skip the vertical timing column
            }
            var upward = ((right + 1) & 2) == 0;
            for (var vert = 0; vert < size; vert++) {
                var y = upward ? (size - 1 - vert) : vert;
                for (var j = 0; j < 2; j++) {
                    var x = right - j;
                    if (!fn[y][x]) {
                        var dark = false;
                        if (bit < totalBits) {
                            dark = ((codewords[bit >> 3] >> (7 - (bit & 7))) & 1) != 0;
                            bit++;
                        }
                        if (((x + y) & 1) == 0) {
                            dark = !dark;
                        }
                        m[y][x] = dark;
                    }
                }
            }
            right = right - 2;
        }

        // Format info: error correction level L (01) and mask 0, BCH-protected.
        var data = 8;
        var rem = data;
        for (var i = 0; i < 10; i++) {
            rem = (rem << 1) ^ ((rem >> 9) * 0x537);
        }
        drawFormat(m, fn, size, ((data << 10) | rem) ^ 0x5412);
        return m;
    }

    function drawFormat(m, fn, size, bits) {
        for (var i = 0; i <= 5; i++) {
            setFunction(m, fn, 8, i, formatBit(bits, i));
        }
        setFunction(m, fn, 8, 7, formatBit(bits, 6));
        setFunction(m, fn, 8, 8, formatBit(bits, 7));
        setFunction(m, fn, 7, 8, formatBit(bits, 8));
        for (var i = 9; i < 15; i++) {
            setFunction(m, fn, 14 - i, 8, formatBit(bits, i));
        }
        for (var i = 0; i < 8; i++) {
            setFunction(m, fn, size - 1 - i, 8, formatBit(bits, i));
        }
        for (var i = 8; i < 15; i++) {
            setFunction(m, fn, 8, size - 15 + i, formatBit(bits, i));
        }
        setFunction(m, fn, 8, size - 8, true); // the always-dark module
    }

    function formatBit(bits, i) {
        return ((bits >> i) & 1) != 0;
    }

    // Finder pattern centred on (cx, cy), including its light separator.
    function drawFinder(m, fn, size, cx, cy) {
        for (var dy = -4; dy <= 4; dy++) {
            for (var dx = -4; dx <= 4; dx++) {
                var x = cx + dx;
                var y = cy + dy;
                if (x >= 0 && x < size && y >= 0 && y < size) {
                    var d = maxAbs(dx, dy);
                    setFunction(m, fn, x, y, d != 2 && d != 4);
                }
            }
        }
    }

    function setFunction(m, fn, x, y, dark) {
        m[y][x] = dark;
        fn[y][x] = true;
    }

    function maxAbs(a, b) {
        if (a < 0) {
            a = -a;
        }
        if (b < 0) {
            b = -b;
        }
        return (a > b) ? a : b;
    }
}
