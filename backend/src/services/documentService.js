const { randomUUID } = require('node:crypto');

class DocumentService {
  constructor(documentRepository, owner) {
    this.documentRepository = documentRepository;
    this.owner = owner;
  }

  createDocument(file) {
    return this.documentRepository.create({
      id: randomUUID(),
      originalName: file.originalname,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      owner: this.owner
    }, file.filename);
  }

  listDocuments() {
    return this.documentRepository.findAllByOwner(this.owner);
  }

  getDocumentForDownload(id) {
    return this.documentRepository.findForDownload(id, this.owner);
  }
}

module.exports = DocumentService;