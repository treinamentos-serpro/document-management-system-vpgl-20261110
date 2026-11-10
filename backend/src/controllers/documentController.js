const fs = require('node:fs/promises');

class DocumentController {
  constructor(documentService) {
    this.documentService = documentService;
  }

  upload = async (req, res, next) => {
    if (!req.file) {
      return res.status(400).json({
        error: {
          code: 'FILE_REQUIRED',
          message: 'Envie um arquivo no campo "file".'
        }
      });
    }

    try {
      const document = this.documentService.createDocument({
        originalName: req.file.originalname,
        size: req.file.size,
        storageKey: req.file.filename
      });
      return res.status(201).json(document);
    } catch (error) {
      await fs.unlink(req.file.path).catch(() => {});
      return next(error);
    }
  };

  list = (req, res, next) => {
    try {
      return res.status(200).json(this.documentService.listDocuments());
    } catch (error) {
      return next(error);
    }
  };

  download = (req, res, next) => {
    try {
      const result = this.documentService.getDocumentForDownload(req.params.id);

      if (!result) {
        return res.status(404).json({
          error: {
            code: 'DOCUMENT_NOT_FOUND',
            message: 'Documento não encontrado.'
          }
        });
      }

      res.set('X-Content-Type-Options', 'nosniff');
      return res.download(result.filePath, result.document.originalName, (error) => {
        if (error) {
          next(error);
        }
      });
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = DocumentController;