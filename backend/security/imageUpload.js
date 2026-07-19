import fs from 'fs/promises';

const IMAGE_SIGNATURES = {
  'image/jpeg': (buffer) =>
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff,
  'image/png': (buffer) =>
    buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    ),
  'image/webp': (buffer) =>
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP',
  'image/gif': (buffer) => {
    const signature = buffer.subarray(0, 6).toString('ascii');
    return signature === 'GIF87a' || signature === 'GIF89a';
  }
};

async function readUploadHeader(file) {
  if (file.buffer) {
    return file.buffer.subarray(0, 16);
  }

  if (file.path) {
    const handle = await fs.open(file.path, 'r');
    const buffer = Buffer.alloc(16);

    try {
      await handle.read(buffer, 0, buffer.length, 0);
      return buffer;
    } finally {
      await handle.close();
    }
  }

  return Buffer.alloc(0);
}

async function removeRejectedUpload(file) {
  if (!file?.path) return;
  await fs.unlink(file.path).catch(() => {});
}

export async function verifyImageUpload(req, res, next) {
  const file = req.file;

  if (!file) {
    return next();
  }

  try {
    const matchesSignature = IMAGE_SIGNATURES[file.mimetype];
    const header = await readUploadHeader(file);

    if (!matchesSignature || !matchesSignature(header)) {
      await removeRejectedUpload(file);
      return res.status(400).json({
        message: 'Nội dung file không đúng định dạng ảnh đã khai báo'
      });
    }

    return next();
  } catch (error) {
    await removeRejectedUpload(file);
    return next(error);
  }
}
