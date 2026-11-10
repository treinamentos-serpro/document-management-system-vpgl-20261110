// Seed do servidor backend do Document Management System.
//
// Este arquivo é apenas um ponto de partida mínimo. Ao longo do workshop você
// vai usar o Agent Mode do GitHub Copilot para construir as camadas:
//   - routes/       (definição das rotas)
//   - controllers/  (entrada HTTP e validação)
//   - services/     (regras de negócio)
//   - repositories/ (persistência: arquivos locais + metadados em memória)
//
// Restrição do projeto: uploads são gravados no filesystem local da aplicação
// usando multer com diskStorage. Não utilize provedores externos.

const express = require('express');
const multer = require('multer');
const path = require('node:path');
const DocumentController = require('./controllers/documentController');
const DocumentRepository = require('./repositories/documentRepository');
const createDocumentRouter = require('./routes/documentRoutes');
const DocumentService = require('./services/documentService');
const createUploadMiddleware = require('./routes/uploadMiddleware');

const DEFAULT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const INVALID_MULTIPART_MESSAGES = new Set([
  'Multipart: Boundary not found',
  'Malformed part header',
  'Unexpected end of form'
]);

function parseMaxFileSizeBytes(value) {
  const maxFileSizeBytes = Number(value);

  if (!Number.isSafeInteger(maxFileSizeBytes) || maxFileSizeBytes <= 0) {
    throw new Error('MAX_FILE_SIZE_BYTES deve ser um inteiro positivo.');
  }

  return maxFileSizeBytes;
}

function createApp(options = {}) {
  const storageDirectory = options.storageDirectory || path.resolve(__dirname, '..', 'storage');
  const owner = options.owner ?? process.env.DMS_DEFAULT_OWNER ?? 'local-user';
  const maxFileSizeBytes = options.maxFileSizeBytes
    ?? parseMaxFileSizeBytes(process.env.MAX_FILE_SIZE_BYTES ?? DEFAULT_MAX_FILE_SIZE_BYTES);

  if (!owner.trim()) {
    throw new Error('DMS_DEFAULT_OWNER deve ter um valor não vazio.');
  }

  const repository = new DocumentRepository(storageDirectory);
  const service = new DocumentService(repository, owner);
  const controller = new DocumentController(service);
  const upload = createUploadMiddleware({ storageDirectory, maxFileSizeBytes });
  const app = express();

  app.use(express.json());
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });
  app.use(createDocumentRouter(controller, upload));
  app.use((error, req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }

    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          error: {
            code: 'FILE_TOO_LARGE',
            message: 'O arquivo excede o tamanho máximo permitido.'
          }
        });
      }

      return res.status(400).json({
        error: {
          code: 'INVALID_UPLOAD',
          message: 'Não foi possível processar o envio do arquivo.'
        }
      });
    }

    if (req.path === '/upload' && INVALID_MULTIPART_MESSAGES.has(error.message)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_UPLOAD',
          message: 'A requisição de envio do arquivo é inválida.'
        }
      });
    }

    if (req.path === '/documents') {
      return res.status(500).json({
        error: {
          code: 'DOCUMENT_LIST_ERROR',
          message: 'Não foi possível listar os documentos.'
        }
      });
    }

    return res.status(500).json({
      error: {
        code: 'STORAGE_ERROR',
        message: 'Não foi possível acessar o arquivo.'
      }
    });
  });

  return app;
}

const app = createApp();
app.createApp = createApp;

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`DMS backend ouvindo na porta ${PORT}`);
  });
}

module.exports = app;
