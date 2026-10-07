import { describe, expect, it } from 'vitest';
import {
  propertyCardImageSrc,
  propertyCardImageSrcSet,
  propertyGalleryThumbSrcSet,
  propertyHeroImageSrc,
  propertyHeroImageSrcSet,
  propertyLightboxImageSrcSet,
} from './propertyImages';

const SUPA =
  'https://x.supabase.co/storage/v1/object/public/property-images/a.jpeg';

describe('property image URLs (Supabase transforms disabled by default)', () => {
  it('serves the original object URL, never /render/image', () => {
    expect(propertyCardImageSrc(SUPA)).toBe(SUPA);
    expect(propertyHeroImageSrc(SUPA)).toBe(SUPA);
    expect(propertyCardImageSrc(SUPA)).not.toContain('/render/image/');
  });

  it('does not emit a transformed srcset for Supabase images', () => {
    expect(propertyCardImageSrcSet(SUPA)).toBeUndefined();
    expect(propertyHeroImageSrcSet(SUPA)).toBeUndefined();
    expect(propertyGalleryThumbSrcSet(SUPA)).toBeUndefined();
    expect(propertyLightboxImageSrcSet(SUPA)).toBeUndefined();
  });

  it('still resizes Pexels images', () => {
    const pexels = 'https://images.pexels.com/photos/1/x.jpeg';
    expect(propertyCardImageSrcSet(pexels)).toContain('w=320');
  });
});
