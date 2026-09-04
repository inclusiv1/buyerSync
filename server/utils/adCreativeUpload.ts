const startsWith = (buffer: Buffer, signature: number[]) =>
  signature.every((byte, index) => buffer[index] === byte);

export const detectAdCreativeExtension = (buffer: Buffer): string | null => {
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return 'jpg';
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.toString('ascii', 0, 6))) return 'gif';
  return null;
};