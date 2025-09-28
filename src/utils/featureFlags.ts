export interface FeatureFlags {
  tieredFactChecking: boolean;
  advancedCaching: boolean;
  blobReporting: boolean;
}

export const getFeatureFlags = (): FeatureFlags => {
  const flags = localStorage.getItem('feature_flags');

  if (flags) {
    try {
      return { ...defaultFlags, ...JSON.parse(flags) };
    } catch {
      return defaultFlags;
    }
  }

  return defaultFlags;
};

const defaultFlags: FeatureFlags = {
  tieredFactChecking: false, // Start disabled
  advancedCaching: true,     // Safe to enable
  blobReporting: true        // Already implemented
};

export const setFeatureFlag = (flag: keyof FeatureFlags, value: boolean): void => {
  const currentFlags = getFeatureFlags();
  const newFlags = { ...currentFlags, [flag]: value };
  localStorage.setItem('feature_flags', JSON.stringify(newFlags));
};