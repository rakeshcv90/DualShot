import {SUBSCRIPTION_SKUS, ALL_SUBSCRIPTION_SKUS} from '../iapSkus';

describe('SUBSCRIPTION_SKUS', () => {
  it('has the expected top-level platform keys', () => {
    expect(Object.keys(SUBSCRIPTION_SKUS).sort()).toEqual(['android', 'ios']);
  });

  it('has ios monthly and yearly string SKUs', () => {
    expect(Object.keys(SUBSCRIPTION_SKUS.ios).sort()).toEqual([
      'monthly',
      'yearly',
    ]);
    expect(typeof SUBSCRIPTION_SKUS.ios.monthly).toBe('string');
    expect(typeof SUBSCRIPTION_SKUS.ios.yearly).toBe('string');
    expect(SUBSCRIPTION_SKUS.ios.monthly.length).toBeGreaterThan(0);
    expect(SUBSCRIPTION_SKUS.ios.yearly.length).toBeGreaterThan(0);
  });

  it('has android monthly and yearly string SKUs', () => {
    expect(Object.keys(SUBSCRIPTION_SKUS.android).sort()).toEqual([
      'monthly',
      'yearly',
    ]);
    expect(typeof SUBSCRIPTION_SKUS.android.monthly).toBe('string');
    expect(typeof SUBSCRIPTION_SKUS.android.yearly).toBe('string');
    expect(SUBSCRIPTION_SKUS.android.monthly.length).toBeGreaterThan(0);
    expect(SUBSCRIPTION_SKUS.android.yearly.length).toBeGreaterThan(0);
  });
});

describe('ALL_SUBSCRIPTION_SKUS', () => {
  it('is an array', () => {
    expect(Array.isArray(ALL_SUBSCRIPTION_SKUS)).toBe(true);
  });

  it('contains every value from SUBSCRIPTION_SKUS', () => {
    const expectedValues = [
      ...Object.values(SUBSCRIPTION_SKUS.ios),
      ...Object.values(SUBSCRIPTION_SKUS.android),
    ];

    expect(ALL_SUBSCRIPTION_SKUS.sort()).toEqual(expectedValues.sort());
  });

  it('has no duplicate values', () => {
    const uniqueValues = new Set(ALL_SUBSCRIPTION_SKUS);
    expect(uniqueValues.size).toBe(ALL_SUBSCRIPTION_SKUS.length);
  });

  it('has the same length as the combined ios and android SKUs', () => {
    const iosCount = Object.keys(SUBSCRIPTION_SKUS.ios).length;
    const androidCount = Object.keys(SUBSCRIPTION_SKUS.android).length;
    expect(ALL_SUBSCRIPTION_SKUS.length).toBe(iosCount + androidCount);
  });
});
