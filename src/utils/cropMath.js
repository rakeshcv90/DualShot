/**
 * Crop-region math for turning a recorded video/photo into the
 * opposite-orientation "dual shot" output (portrait source -> landscape
 * 16:9 crop, landscape source -> portrait 9:16 crop). Extracted from
 * HomeScreen.js's processVideo/processPhoto so it can be unit tested
 * without mocking MediaToolkit, nitro-image, or CameraRoll.
 */

/**
 * Crop region as fractions of the source video's own dimensions (0-1),
 * matching MediaToolkit.cropVideo's {x, y, width, height} contract.
 */
export const computeVideoCropRegion = (width, height) => {
  const currentRatio = width / height;
  const targetRatio = currentRatio > 1 ? 9 / 16 : 16 / 9;

  if (currentRatio > targetRatio) {
    const cropW = targetRatio / currentRatio;
    return { x: (1 - cropW) / 2, y: 0, width: cropW, height: 1.0 };
  }
  const cropH = currentRatio / targetRatio;
  return { x: 0, y: (1 - cropH) / 2, width: 1.0, height: cropH };
};

/**
 * Crop region in absolute pixels, matching how processPhoto feeds
 * image.cropAsync(x, y, x + width, y + height).
 */
export const computePhotoCropRegion = (width, height) => {
  const currentRatio = width / height;
  const targetRatio = currentRatio > 1 ? 9 / 16 : 16 / 9;

  if (currentRatio > targetRatio) {
    const cropW = height * targetRatio;
    return { x: (width - cropW) / 2, y: 0, width: cropW, height };
  }
  const cropH = width / targetRatio;
  return { x: 0, y: (height - cropH) / 2, width, height: cropH };
};
