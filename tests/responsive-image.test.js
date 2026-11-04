import test from 'node:test';
import assert from 'node:assert/strict';
import {responsiveImage} from '../src/utils/responsiveImage.js';

test('known CDN gets responsive widths without changing photo or crop',()=>{
 const result=responsiveImage('https://images.unsplash.com/photo-123?fit=crop&w=900&q=80','100vw');
 assert.equal(result.sizes,'100vw');
 assert.ok(result.srcSet.includes('w=320'));
 assert.ok(result.srcSet.includes('w=1440'));
 assert.ok(result.srcSet.includes('fit=crop'));
 assert.ok(result.srcSet.includes('q=80'));
});
test('uploaded, SVG, other hosts and invalid images retain their source',()=>{
 for(const src of ['/images/uploads/x.jpg','/images/keyboard.svg','https://cdn.example.test/product.jpg','not-a-url',null])assert.deepEqual(responsiveImage(src),{});
});
