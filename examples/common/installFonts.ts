import { type Stage } from '@lightningjs/renderer';

export async function installFonts(stage: Stage) {
  // Load Canvas fonts using the new unified API
  stage.loadFont('canvas', {
    fontFamily: 'NotoSans',
    fontUrl: './fonts/NotoSans-Regular.ttf',
    metrics: {
      ascender: 1069,
      descender: -293,
      lineGap: 0,
      unitsPerEm: 1000,
    },
  });

  stage.loadFont('canvas', {
    fontFamily: 'Ubuntu',
    fontUrl: './fonts/Ubuntu-Regular.ttf',
    metrics: {
      ascender: 776,
      descender: -185,
      lineGap: 56,
      unitsPerEm: 1000,
    },
  });

  stage.loadFont('canvas', {
    fontFamily: 'Ubuntu-No-Metrics',
    fontUrl: './fonts/Ubuntu-Regular.ttf',
  });

  const ubuntuModifiedMetrics = {
    ascender: 850,
    descender: -250,
    lineGap: 60,
    unitsPerEm: 1000,
  };

  stage.loadFont('canvas', {
    fontFamily: 'Ubuntu-Modified-Metrics',
    fontUrl: './fonts/Ubuntu-Regular.ttf',
    metrics: ubuntuModifiedMetrics,
  });

  // Load SDF fonts for WebGL renderer using the new unified API
  if (stage.renderer.mode === 'webgl') {
    stage.loadFont('sdf', {
      fontFamily: 'NotoSans',
      atlasUrl: './fonts/NotoSans-Regular.ssdf.png',
      atlasDataUrl: './fonts/NotoSans-Regular.ssdf.json',
      metrics: {
        ascender: 1000,
        descender: -200,
        lineGap: 0,
        unitsPerEm: 1000,
      },
    });

    stage.loadFont('sdf', {
      fontFamily: 'Ubuntu',
      atlasUrl: './fonts/Ubuntu-Regular.msdf.png',
      atlasDataUrl: './fonts/Ubuntu-Regular.msdf.json',
      // Instead of supplying `metrics` this font will rely on the ones
      // encoded in the json file under `lightningMetrics`.
    });

    stage.loadFont('sdf', {
      fontFamily: 'Ubuntu-Modified-Metrics',
      atlasUrl: './fonts/Ubuntu-Regular.msdf.png',
      atlasDataUrl: './fonts/Ubuntu-Regular.msdf.json',
      metrics: ubuntuModifiedMetrics,
    });

    stage.loadFont('sdf', {
      fontFamily: 'Ubuntu-ssdf',
      atlasUrl: './fonts/Ubuntu-Regular.ssdf.png',
      atlasDataUrl: './fonts/Ubuntu-Regular.ssdf.json',
      metrics: {
        ascender: 776,
        descender: -185,
        lineGap: 56,
        unitsPerEm: 1000,
      },
    });
  }
}
