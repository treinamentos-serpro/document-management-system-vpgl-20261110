const path = require('node:path');

class DocumentRepository {
  constructor(storageDirectory) {
    this.storageDirectory = path.resolve(storageDirectory);
    this.documents = new Map();
  }

  create(document, storedFilename) {
    const record = { ...document, storedFilename };
    this.documents.set(record.id, record);
    return this.toPublicDocument(record);
  }

  findAllByOwner(owner) {
    return Array.from(this.documents.values())
      .filter((record) => record.owner === owner)
      .map((record) => this.toPublicDocument(record));
  }

  findForDownload(id, owner) {
    const record = this.documents.get(id);

    if (!record || record.owner !== owner) {
      return null;
    }

    return {
      document: this.toPublicDocument(record),
      filePath: path.join(this.storageDirectory, record.storedFilename)
    };
  }

  toPublicDocument(record) {
    const { id, originalName, size, uploadedAt, owner } = record;
    return { id, originalName, size, uploadedAt, owner };
  }
}

module.exports = DocumentRepository;