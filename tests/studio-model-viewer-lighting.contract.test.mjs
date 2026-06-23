import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const viewerSource = readFileSync(
  "src/components/studio/StudioModelViewer.tsx",
  "utf8",
);
const studioPageSource = readFileSync("src/pages/StudioPage.tsx", "utf8");
const dashboardSource = readFileSync("src/pages/DashboardPage.tsx", "utf8");

function readSourceTree(dir) {
  return readdirSync(dir)
    .flatMap((entry) => {
      const path = join(dir, entry);
      const stat = statSync(path);

      if (stat.isDirectory()) {
        return readSourceTree(path);
      }

      return /\.(?:ts|tsx|js|jsx)$/.test(entry)
        ? readFileSync(path, "utf8")
        : [];
    })
    .join("\n");
}

test("StudioModelViewer keeps balanced multi-point lighting", () => {
  assert.match(viewerSource, /function StudioLighting\(\)/);
  assert.match(viewerSource, /const AMBIENT_LIGHT_INTENSITY = 0\.62;/);
  assert.match(viewerSource, /const HEMISPHERE_LIGHT_INTENSITY = 0\.88;/);
  assert.match(viewerSource, /const KEY_LIGHT_INTENSITY = 1\.38;/);
  assert.match(viewerSource, /const FILL_LIGHT_INTENSITY = 0\.68;/);
  assert.match(viewerSource, /const BACK_RIM_LIGHT_INTENSITY = 1\.08;/);
  assert.match(
    viewerSource,
    /const BACK_RIM_LIGHT_POSITION: \[number, number, number\] = \[-3\.4, 4\.1, -5\.2\];/,
  );
  assert.match(
    viewerSource,
    /<directionalLight[\s\S]*intensity={BACK_RIM_LIGHT_INTENSITY}[\s\S]*position={BACK_RIM_LIGHT_POSITION}/,
  );
  assert.match(
    viewerSource,
    /<pointLight[\s\S]*intensity={REAR_SOFT_LIGHT_INTENSITY}[\s\S]*position={REAR_SOFT_LIGHT_POSITION}/,
  );

  const directionalLightCount =
    viewerSource.match(/<directionalLight/g)?.length ?? 0;
  assert.ok(
    directionalLightCount >= 3,
    "Studio viewer should keep key, fill, and back rim directional lights",
  );
});

test("StudioModelViewer uses the current Three.js color pipeline", () => {
  assert.match(viewerSource, /ACESFilmicToneMapping/);
  assert.match(viewerSource, /SRGBColorSpace/);
  assert.match(viewerSource, /gl\.outputColorSpace = SRGBColorSpace;/);
  assert.match(viewerSource, /gl\.toneMapping = ACESFilmicToneMapping;/);
  assert.match(viewerSource, /gl\.toneMappingExposure = 1\.05;/);
});

test("StudioModelViewer does not ship visible light helpers", () => {
  assert.doesNotMatch(
    viewerSource,
    /CameraHelper|DirectionalLightHelper|HemisphereLightHelper|PointLightHelper/,
  );
});

test("Studio keeps modelViewerUrl viewer-only and modelUrl gated for export", () => {
  assert.match(
    studioPageSource,
    /<StudioModelViewer\s+modelUrl={figure\.modelViewerUrl}\s+onShow2d={onShow2d}/,
  );
  assert.match(
    studioPageSource,
    /const exportModelUrl = selectedFigure\.modelUrl \?\? null;/,
  );
  assert.match(studioPageSource, /href={exportModelUrl}/);
  assert.doesNotMatch(
    `${studioPageSource}\n${dashboardSource}`,
    /modelViewerUrl[\s\S]{0,160}(?:href|download|window\.open|provider|source|input)/,
  );
});

test("Frontend keeps Meshy calls and normal generation payload protected", () => {
  const frontendSource = readSourceTree("src");

  assert.doesNotMatch(
    frontendSource,
    /MESHY_API_KEY|api\.meshy\.ai|openapi\/v1|openapi\/v2/,
  );
  assert.match(
    dashboardSource,
    /figuresApi\.generateFigure\(\{\s*prompt: composedPrompt,\s*\}\);/,
  );
});
