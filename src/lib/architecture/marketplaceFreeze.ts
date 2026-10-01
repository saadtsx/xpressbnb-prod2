/**
 * Phase MP-Freeze — marketplace vs editorial surface registry.
 *
 * Used by static architecture tests to prevent presentation leakage.
 */

/** Files allowed to import `ConversionPropertyCard`. */
export const MARKETPLACE_CARD_IMPORT_ALLOWLIST = [
  'components/ConversionPropertyCard.tsx',
  'components/FeaturedStaysCarousel.tsx',
  'components/homepage/HomepageStaysRail.tsx',
  'components/listing/ListingPropertyCardSkeleton.tsx',
  'components/nearby/NearbyMapDiscovery.tsx',
  'pages/CityListingPage.tsx',
  'pages/RishikeshStaysPage.tsx',
  'pages/SavedListingsPage.tsx',
] as const;

/** Path prefixes allowed to import property-page editorial discovery UI. */
export const EDITORIAL_DISCOVERY_IMPORT_ALLOWLIST = [
  'components/property/',
  'components/property/editorial/',
] as const;

/** Marketplace surfaces that must not import editorial discovery modules. */
export const MARKETPLACE_SURFACE_FILES = [
  'components/NewHomepage.tsx',
  'components/HomepageBelowFold.tsx',
  'components/FeaturedStaysCarousel.tsx',
  'components/nearby/NearbyStaysSection.tsx',
  'components/nearby/PersonalizedHomeFeed.tsx',
  'components/nearby/NearbyMapDiscovery.tsx',
  'pages/CityListingPage.tsx',
  'pages/RishikeshStaysPage.tsx',
  'pages/SavedListingsPage.tsx',
] as const;

export const EDITORIAL_DISCOVERY_IMPORT_PATTERN =
  /from\s+['"][^'"]*property\/editorial|from\s+['"][^'"]*EditorialDiscoveryModules/;

export const MARKETPLACE_CARD_IMPORT_PATTERN =
  /from\s+['"][^'"]*ConversionPropertyCard['"]/;
