// Photos of a product, main photo first. Older API responses only have image_url.
export const MAX_PHOTOS = 4;

export function photosOf(product) {
  if (!product) return [];
  if (Array.isArray(product.images) && product.images.length) return product.images;
  return product.image_url ? [product.image_url] : [];
}
