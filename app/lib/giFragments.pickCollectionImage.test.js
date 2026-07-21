import {describe, it, expect} from 'vitest';
import {pickCollectionImage} from './giFragments.js';

describe('pickCollectionImage', () => {
  it('returns null for a missing collection', () => {
    expect(pickCollectionImage(null)).toBeNull();
    expect(pickCollectionImage(undefined)).toBeNull();
  });

  it('prefers the collection\'s own image when set', () => {
    const c = {
      image: {url: 'https://x/collection.jpg'},
      products: {nodes: [{featuredImage: {url: 'https://x/product-1.jpg'}}]},
    };
    expect(pickCollectionImage(c)).toBe('https://x/collection.jpg');
  });

  it('falls back to the first product WITH an image, skipping image-less ones', () => {
    const c = {
      image: null,
      products: {
        nodes: [
          {featuredImage: null},
          {featuredImage: {url: null}},
          {featuredImage: {url: 'https://x/product-3.jpg'}},
          {featuredImage: {url: 'https://x/product-4.jpg'}},
        ],
      },
    };
    expect(pickCollectionImage(c)).toBe('https://x/product-3.jpg');
  });

  it('returns null when neither the collection nor any sampled product has an image', () => {
    const c = {
      image: null,
      products: {nodes: [{featuredImage: null}, {featuredImage: {url: null}}]},
    };
    expect(pickCollectionImage(c)).toBeNull();
  });

  it('tolerates a collection with no products field at all', () => {
    expect(pickCollectionImage({image: null})).toBeNull();
    expect(pickCollectionImage({})).toBeNull();
  });
});
