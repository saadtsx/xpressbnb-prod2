import type { Json } from '../lib/database.types';

/** Card layout: mobile carousel peek 85vw, grid columns, 380px card cap. */
export const PROPERTY_CARD_IMAGE_WIDTHS = [320, 480, 640, 768] as const;

export const PROPERTY_CARD_IMAGE_SIZES =
  '(max-width: 639px) 85vw, (max-width: 1023px) 45vw, 380px';

/** Property page hero — full-bleed gallery above the fold. */
export const PROPERTY_HERO_IMAGE_WIDTHS = [375, 480, 768, 1280, 1600] as const;

export const PROPERTY_HERO_IMAGE_SIZES = '100vw';

/** Default hero `src` width — mobile-first LCP (not the largest srcset entry). */
export const PROPERTY_HERO_DEFAULT_WIDTH = PROPERTY_HERO_IMAGE_WIDTHS[2];

/**
 * Lightbox / fullscreen viewer — progressive widths for pinch-zoom quality.
 */
export const PROPERTY_LIGHTBOX_IMAGE_WIDTHS = [768, 1280, 1920] as const;

export const PROPERTY_LIGHTBOX_IMAGE_SIZES = '92vw';

/**
 * Desktop PropertyGallery side-column thumbnails — ~⅓ grid width, ~⅓ gallery height.
 * 640w covers 2× on ~320px cells; avoids hero widths (480–1600).
 */
export const PROPERTY_GALLERY_THUMB_WIDTHS = [240, 320, 480, 640] as const;

export const PROPERTY_GALLERY_THUMB_SIZES =
  '(min-width: 1280px) 320px, (min-width: 640px) 30vw, 0px';

/**
 * Supabase Image Transformations (/render/image) is a paid-plan feature. When it is not
 * enabled for the project every transformed URL returns 403 FeatureNotEnabled and images
 * vanish, so we serve the original object URL unless explicitly opted in.
 * Set VITE_SUPABASE_IMAGE_TRANSFORMS=true once the plan supports it.
 */
const SUPABASE_TRANSFORMS_ENABLED = import.meta.env.VITE_SUPABASE_IMAGE_TRANSFORMS === 'true';

function canResizeUrl(url: string): boolean {
  return (
    (SUPABASE_TRANSFORMS_ENABLED && url.includes('/storage/v1/object/public/')) ||
    url.includes('images.pexels.com')
  );
}

const CARD_IMAGE_QUALITY = 80;
const HERO_IMAGE_QUALITY = 82;
const GALLERY_THUMB_QUALITY = 80;

/** Normalized property image URLs for gallery components. */
export function listPropertyImages(
  images: Json | string[] | null | undefined,
): string[] {
  if (!Array.isArray(images)) return [];
  const out: string[] = [];
  for (const item of images) {
    if (item != null && typeof item === 'string' && item.trim().length > 0) {
      out.push(item.trim());
    }
  }
  return out;
}

function withPexelsWidth(url: string, width: number): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('auto', 'compress');
    parsed.searchParams.set('cs', 'tinysrgb');
    parsed.searchParams.set('w', String(width));
    return parsed.toString();
  } catch {
    return url;
  }
}

function toSupabaseRenderUrl(url: string, width: number, quality = CARD_IMAGE_QUALITY): string {
  if (!SUPABASE_TRANSFORMS_ENABLED || !url.includes('/storage/v1/object/public/')) return url;
  const renderUrl = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
  try {
    const parsed = new URL(renderUrl);
    parsed.searchParams.set('width', String(width));
    // `contain` scales to the requested width preserving aspect ratio.
    // The default (`cover`) keeps the original height when `height` is
    // omitted, so portrait photos came back as e.g. 640×4032 (~4× payload).
    parsed.searchParams.set('resize', 'contain');
    parsed.searchParams.set('quality', String(quality));
    return parsed.toString();
  } catch {
    return url;
  }
}

/** Resize-aware URL for a single property card image at the given width. */
export function propertyCardImageUrl(url: string, width: number): string {
  return buildResizedImageUrl(url, width, CARD_IMAGE_QUALITY);
}

/** Fallback `src` — largest card width (matches 2× on 380px cards). */
export function propertyCardImageSrc(url: string): string {
  return propertyCardImageUrl(url, PROPERTY_CARD_IMAGE_WIDTHS[PROPERTY_CARD_IMAGE_WIDTHS.length - 1]);
}

/** Responsive srcset for property card images; undefined when URL cannot be resized. */
export function propertyCardImageSrcSet(url: string): string | undefined {
  const trimmed = url.trim();
  if (!trimmed) return undefined;

  if (!canResizeUrl(trimmed)) return undefined;

  return PROPERTY_CARD_IMAGE_WIDTHS.map((w) => `${propertyCardImageUrl(trimmed, w)} ${w}w`).join(', ');
}

function buildResizedImageUrl(url: string, width: number, quality: number): string {
  const trimmed = url.trim();
  if (!trimmed) return '';

  if (trimmed.includes('/storage/v1/object/public/')) {
    return toSupabaseRenderUrl(trimmed, width, quality);
  }

  if (trimmed.includes('images.pexels.com')) {
    return withPexelsWidth(trimmed, width);
  }

  return trimmed;
}

/** Resize-aware URL for property page hero at a given width. */
export function propertyHeroImageUrl(url: string, width: number): string {
  return buildResizedImageUrl(url, width, HERO_IMAGE_QUALITY);
}

/** Fallback `src` for property page hero — mobile-first default width. */
export function propertyHeroImageSrc(url: string): string {
  return propertyHeroImageUrl(url, PROPERTY_HERO_DEFAULT_WIDTH);
}

/** Responsive srcset for property page hero images. */
export function propertyHeroImageSrcSet(url: string): string | undefined {
  const trimmed = url.trim();
  if (!trimmed) return undefined;

  if (!canResizeUrl(trimmed)) return undefined;

  return PROPERTY_HERO_IMAGE_WIDTHS.map(
    (w) => `${buildResizedImageUrl(trimmed, w, HERO_IMAGE_QUALITY)} ${w}w`,
  ).join(', ');
}

/** Resize-aware URL for a PropertyGallery desktop thumbnail at the given width. */
export function propertyGalleryThumbUrl(url: string, width: number): string {
  return buildResizedImageUrl(url, width, GALLERY_THUMB_QUALITY);
}

/** Fallback `src` for gallery thumbnails — largest thumb width (2× on ~320px cells). */
export function propertyGalleryThumbSrc(url: string): string {
  const maxW = PROPERTY_GALLERY_THUMB_WIDTHS[PROPERTY_GALLERY_THUMB_WIDTHS.length - 1];
  return propertyGalleryThumbUrl(url, maxW);
}

/** Responsive srcset for PropertyGallery desktop thumbnails. */
export function propertyGalleryThumbSrcSet(url: string): string | undefined {
  const trimmed = url.trim();
  if (!trimmed) return undefined;

  if (!canResizeUrl(trimmed)) return undefined;

  return PROPERTY_GALLERY_THUMB_WIDTHS.map(
    (w) => `${propertyGalleryThumbUrl(trimmed, w)} ${w}w`,
  ).join(', ');
}

/** Resize-aware URL for lightbox at a given width. */
export function propertyLightboxImageUrl(url: string, width: number): string {
  return buildResizedImageUrl(url, width, HERO_IMAGE_QUALITY);
}

/** Fallback `src` for lightbox — mid-width for fast open. */
export function propertyLightboxImageSrc(url: string): string {
  return propertyLightboxImageUrl(url, PROPERTY_LIGHTBOX_IMAGE_WIDTHS[1]);
}

/** Responsive srcset for lightbox images. */
export function propertyLightboxImageSrcSet(url: string): string | undefined {
  const trimmed = url.trim();
  if (!trimmed) return undefined;

  if (!canResizeUrl(trimmed)) return undefined;

  return PROPERTY_LIGHTBOX_IMAGE_WIDTHS.map(
    (w) => `${propertyLightboxImageUrl(trimmed, w)} ${w}w`,
  ).join(', ');
}
