const { randomUUID } = require('node:crypto');

class DocumentService {
  constructor(documentRepository, owner) {
    this.documentRepository = documentRepository;
    this.owner = owner;
  }

  createDocument({ originalName, size, storageKey }) {
    return this.documentRepository.create({
      id: randomUUID(),
      originalName,
      size,
      uploadedAt: new Date().toISOString(),
      owner: this.owner
    }, storageKey);
  }

  listDocuments() {
    return this.documentRepository.findAllByOwner(this.owner);
  }

  getDocumentForDownload(id) {
    return this.documentRepository.findForDownload(id, this.owner);
  }
}

module.exports = DocumentService;