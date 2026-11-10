const fs = require('node:fs');
const multer = require('multer');
const { randomUUID } = require('node:crypto');

function createUploadMiddleware({ storageDirectory, maxFileSizeBytes }) {
  fs.mkdirSync(storageDirectory, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, callback) => callback(null, storageDirectory),
    filename: (req, file, callback) => callback(null, randomUUID())
  });

  return multer({
    storage,
    limits: {
      fileSize: maxFileSizeBytes,
      files: 1
    }
  });
}

module.exports = createUploadMiddleware;