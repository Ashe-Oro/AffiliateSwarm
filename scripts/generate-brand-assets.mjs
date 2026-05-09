import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const root = process.cwd();
const publicDir = path.join(root, "public");
const brandDir = path.join(publicDir, "brand");
const imageDir = path.join(root, "images");

const colors = {
  bg: "#05080a",
  panel: "#0b1113",
  surface: "#10191b",
  text: "#effff8",
  muted: "#a4bdb6",
  tertiary: "#607a75",
  cyan: "#35f2d0",
  lime: "#b6f44a",
  coral: "#ff6b6b",
};

function markSvg(size = 1024) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="${colors.bg}"/>
  <rect x="5" y="5" width="54" height="54" rx="13" fill="${colors.surface}" stroke="rgba(53,242,208,0.3)"/>
  <path d="M18 18h13l15 8 7 14-13 9H23L11 38l7-20Z" fill="none" stroke="${colors.cyan}" stroke-width="2.1" stroke-linejoin="round"/>
  <path d="M18 18 32 32 46 26M11 38l21-6 21 8M23 49l9-17 8 17" fill="none" stroke="${colors.lime}" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" opacity="0.9"/>
  <path d="M32 18v14l8 17" fill="none" stroke="${colors.muted}" stroke-linecap="round" stroke-width="1.3" opacity="0.75"/>
  <circle cx="32" cy="32" r="5.5" fill="${colors.bg}"/>
  <circle cx="32" cy="32" r="3.2" fill="${colors.cyan}"/>
  <circle cx="18" cy="18" r="3.4" fill="${colors.lime}" stroke="${colors.bg}" stroke-width="1.7"/>
  <circle cx="46" cy="26" r="3.4" fill="${colors.cyan}" stroke="${colors.bg}" stroke-width="1.7"/>
  <circle cx="53" cy="40" r="3.4" fill="${colors.lime}" stroke="${colors.bg}" stroke-width="1.7"/>
  <circle cx="40" cy="49" r="3.4" fill="${colors.coral}" stroke="${colors.bg}" stroke-width="1.7"/>
  <circle cx="23" cy="49" r="3.4" fill="${colors.cyan}" stroke="${colors.bg}" stroke-width="1.7"/>
  <circle cx="11" cy="38" r="3.4" fill="${colors.lime}" stroke="${colors.bg}" stroke-width="1.7"/>
  <circle cx="32" cy="18" r="3.4" fill="${colors.text}" stroke="${colors.bg}" stroke-width="1.7"/>
</svg>`;
}

const nodes = [
  [164, 192, colors.cyan, 7],
  [288, 292, colors.lime, 5],
  [418, 168, colors.cyan, 6],
  [566, 312, colors.coral, 5],
  [692, 186, colors.lime, 7],
  [834, 272, colors.cyan, 5],
  [1016, 144, colors.cyan, 6],
  [1148, 314, colors.lime, 8],
  [1326, 210, colors.cyan, 5],
  [1438, 354, colors.coral, 6],
  [302, 512, colors.cyan, 8],
  [502, 594, colors.lime, 5],
  [706, 486, colors.cyan, 9],
  [924, 612, colors.coral, 5],
  [1128, 530, colors.cyan, 7],
  [1324, 650, colors.lime, 5],
];

const links = [
  [0, 1],
  [1, 2],
  [2, 4],
  [4, 7],
  [5, 7],
  [6, 7],
  [7, 8],
  [8, 9],
  [1, 10],
  [10, 11],
  [11, 12],
  [12, 14],
  [14, 15],
  [3, 12],
  [2, 12],
  [5, 13],
  [13, 14],
  [3, 7],
  [4, 12],
];

function networkLines(opacity = 0.36) {
  return links
    .map(([a, b]) => {
      const [x1, y1] = nodes[a];
      const [x2, y2] = nodes[b];
      return `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${colors.cyan}" stroke-width="2" opacity="${opacity}" stroke-linecap="round"/>`;
    })
    .join("\n");
}

function networkNodes() {
  return nodes
    .map(
      ([cx, cy, fill, radius]) =>
        `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${fill}" stroke="${colors.bg}" stroke-width="4"/>`
    )
    .join("\n");
}

function fieldSvg(width = 1600, height = 900, withText = false) {
  const title = withText
    ? `<text x="96" y="256" fill="${colors.text}" font-family="Geist, Inter, Arial, sans-serif" font-size="82" font-weight="760">AffiliateSwarm.ai</text>
  <text x="100" y="326" fill="${colors.muted}" font-family="Geist, Inter, Arial, sans-serif" font-size="34" font-weight="460">Agent-native affiliate network</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 1600 900">
  <defs>
    <pattern id="grid" width="56" height="56" patternUnits="userSpaceOnUse">
      <path d="M56 0H0V56" fill="none" stroke="${colors.cyan}" stroke-opacity="0.13" stroke-width="1"/>
    </pattern>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="7" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <linearGradient id="line" x1="0" x2="1">
      <stop offset="0" stop-color="${colors.cyan}" stop-opacity="0.08"/>
      <stop offset="0.5" stop-color="${colors.lime}" stop-opacity="0.48"/>
      <stop offset="1" stop-color="${colors.cyan}" stop-opacity="0.08"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="900" fill="${colors.bg}"/>
  <rect width="1600" height="900" fill="url(#grid)" opacity="0.45"/>
  <path d="M0 690C254 584 387 618 584 526C837 408 1032 416 1600 254" fill="none" stroke="url(#line)" stroke-width="2"/>
  <path d="M0 300C250 400 428 294 644 344C863 394 1035 548 1600 458" fill="none" stroke="${colors.cyan}" stroke-opacity="0.16" stroke-width="2"/>
  <g filter="url(#glow)">
    ${networkLines(withText ? 0.28 : 0.42)}
    ${networkNodes()}
  </g>
  <g transform="translate(1160 116) scale(4.2)" opacity="${withText ? "0.92" : "0.7"}">
    ${markSvg(64)
      .replace(/<svg[^>]*>/, "")
      .replace("</svg>", "")}
  </g>
  ${title}
</svg>`;
}

async function render(browser, svg, outputPath, width, height, type = "png") {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    `<html><body style="margin:0;background:${colors.bg};">${svg}</body></html>`
  );
  await page.screenshot({
    path: outputPath,
    type,
    quality: type === "jpeg" ? 92 : undefined,
    fullPage: false,
  });
  await page.close();
}

await mkdir(brandDir, { recursive: true });
await mkdir(imageDir, { recursive: true });

await writeFile(path.join(publicDir, "favicon.svg"), markSvg(64));
await writeFile(path.join(brandDir, "affiliateswarm-mark.svg"), markSvg(1024));
await writeFile(path.join(brandDir, "swarm-field.svg"), fieldSvg());

const browser = await chromium.launch();

await render(
  browser,
  fieldSvg(),
  path.join(brandDir, "swarm-field.png"),
  1600,
  900
);
await render(
  browser,
  fieldSvg(1200, 630, true),
  path.join(publicDir, "og-image.jpg"),
  1200,
  630,
  "jpeg"
);
await render(
  browser,
  fieldSvg(1500, 500, true),
  path.join(imageDir, "affiliateswarm-x-banner.jpg"),
  1500,
  500,
  "jpeg"
);
await render(
  browser,
  markSvg(),
  path.join(publicDir, "affiliateswarm-logo.jpg"),
  1024,
  1024,
  "jpeg"
);
await render(
  browser,
  markSvg(),
  path.join(imageDir, "affiliateswarm-logo-1.jpg"),
  1024,
  1024,
  "jpeg"
);
await render(
  browser,
  markSvg(16),
  path.join(publicDir, "favicon-16x16.png"),
  16,
  16
);
await render(
  browser,
  markSvg(32),
  path.join(publicDir, "favicon-32x32.png"),
  32,
  32
);
await render(
  browser,
  markSvg(180),
  path.join(publicDir, "apple-touch-icon.png"),
  180,
  180
);
await render(
  browser,
  markSvg(192),
  path.join(publicDir, "icon-192.png"),
  192,
  192
);
await render(
  browser,
  markSvg(512),
  path.join(publicDir, "icon-512.png"),
  512,
  512
);

await browser.close();
