import assert from 'node:assert/strict';
import test from 'node:test';
import { detectAdCreativeExtension } from './adCreativeUpload';

test('recognizes supported ad creative image signatures', () => {
  assert.equal(detectAdCreativeExtension(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), 'jpg');
  assert.equal(detectAdCreativeExtension(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'png');
  assert.equal(detectAdCreativeExtension(Buffer.from('RIFF0000WEBP')), 'webp');
  assert.equal(detectAdCreativeExtension(Buffer.from('GIF89a')), 'gif');
});

test('rejects files without a supported image signature', () => {
  assert.equal(detectAdCreativeExtension(Buffer.from('<svg onload="alert(1)">')), null);
  assert.equal(detectAdCreativeExtension(Buffer.from('not an image')), null);
});