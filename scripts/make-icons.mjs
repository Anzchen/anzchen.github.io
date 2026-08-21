/**
 * Derives every favicon / touch-icon / share-card asset from the seal.
 *
 * Source `icon.png` is the seal painted onto an OPAQUE WHITE field (only its
 * rounded corners carry alpha), which is why the browser tab shows a white
 * square. This un-composites that white back out to recover a genuinely
 * transparent seal, then re-emits the sizes each surface actually wants.
 *
 * Run: node scripts/make-icons.mjs
 * Output is committed to public/ — this is not part of the Vite build.
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "src/assets/images/icon.png");
const OUT = join(root, "public");

/** Site beige. Opaque fields use this, never white — white reads as a sticker. */
const BEIGE = { r: 0xe2, g: 0xd7, b: 0xbb, alpha: 1 };

/**
 * Un-composite a known white background.
 *
 * Each source pixel is the seal at coverage `a` over white:
 *     c = a·V + (1 - a)·255
 * The green channel carries the most signal (vermillion #C23B3B is ~59 green
 * against 255 white, a 196-wide spread) so it recovers `a` most precisely:
 *     a = (255 - g) / (255 - 59)
 * Then the true pigment is recovered by dividing the coverage back out, which
 * preserves the stamp's real ink variation instead of flattening it to a flat
 * vermillion fill.
 */
async function transparentMaster() {
  const { data, info } = await sharp(SRC)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const px = Buffer.from(data);
  const SEAL_G = 59; // green channel of #C23B3B

  for (let i = 0; i < px.length; i += 4) {
    const [r, g, b, srcAlpha] = [px[i], px[i + 1], px[i + 2], px[i + 3]];

    let a = (255 - g) / (255 - SEAL_G);
    a = Math.min(1, Math.max(0, a));

    // Respect the rounded-corner alpha already in the source.
    const alpha = a * (srcAlpha / 255);

    if (alpha < 0.004) {
      px[i] = px[i + 1] = px[i + 2] = px[i + 3] = 0;
      continue;
    }

    // Divide the white back out: V = (c - (1 - a)·255) / a
    const unmix = (c) =>
      Math.round(Math.min(255, Math.max(0, (c - (1 - a) * 255) / a)));

    px[i] = unmix(r);
    px[i + 1] = unmix(g);
    px[i + 2] = unmix(b);
    px[i + 3] = Math.round(alpha * 255);
  }

  return sharp(px, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

/** Transparent seal, trimmed to its own bounds so small sizes stay crisp. */
async function trimmed(master) {
  return sharp(master).trim({ threshold: 1 }).png().toBuffer();
}

/**
 * Opaque surfaces get the beige field, never white or transparent.
 * iOS composites transparent touch icons against black, and social platforms
 * flatten transparent share images unpredictably (LinkedIn white, others black).
 */
async function onBeige(seal, size, sealFraction) {
  const inner = Math.round(size * sealFraction);
  // `inside` scales to fit without letterboxing. `contain` would pad to an
  // exact square, and sharp's default pad colour is OPAQUE BLACK.
  const scaled = await sharp(seal).resize(inner, inner, { fit: "inside" }).toBuffer();

  return sharp({
    create: { width: size, height: size, channels: 4, background: BEIGE },
  })
    .composite([{ input: scaled, gravity: "centre" }])
    .png()
    .toBuffer();
}

async function shareCard(seal) {
  const W = 1200;
  const H = 630;
  const sealPx = 280;

  // `inside`, not `contain` — see onBeige. The seal is not perfectly square,
  // so contain would letterbox it in opaque black.
  const { data: scaled, info: sealInfo } = await sharp(seal)
    .resize(sealPx, sealPx, { fit: "inside" })
    .toBuffer({ resolveWithObject: true });

  // Georgia is the declared Fraunces fallback in tailwind.config.js, so the
  // card stays on-voice even though Fraunces itself isn't available to librsvg.
  const text = Buffer.from(`
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <text x="560" y="291" font-family="Georgia, serif" font-size="82"
            fill="#2C2825">Anthony Chen</text>
      <text x="563" y="345" font-family="Georgia, serif" font-size="30"
            font-style="italic" fill="#564E41">Software Engineer &amp; App Developer</text>
      <rect x="563" y="386" width="86" height="3" fill="#C23B3B"/>
    </svg>`);

  return sharp({
    create: { width: W, height: H, channels: 4, background: BEIGE },
  })
    .composite([
      { input: scaled, left: 200, top: Math.round((H - sealInfo.height) / 2) },
      { input: text, left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
}

async function main() {
  await mkdir(OUT, { recursive: true });

  const master = await transparentMaster();
  const seal = await trimmed(master);

  // Transparent — the browser tab shows the seal alone, no field.
  for (const size of [16, 32]) {
    await sharp(seal)
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toFile(join(OUT, `favicon-${size}.png`));
  }

  // Opaque beige. 0.72 leaves the margin iOS expects once it rounds the corners.
  await sharp(await onBeige(seal, 180, 0.72))
    .png({ compressionLevel: 9 })
    .toFile(join(OUT, "apple-touch-icon-180.png"));

  await sharp(await shareCard(seal))
    .png({ compressionLevel: 9 })
    .toFile(join(OUT, "og-image-1200x630.png"));

  console.log("[make-icons] wrote favicon-16/32, apple-touch-icon-180, og-image-1200x630");
}

main().catch((error) => {
  console.error("[make-icons] failed:", { src: SRC, error });
  process.exit(1);
});
