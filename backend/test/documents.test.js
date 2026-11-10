const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const app = require('../src/app');

async function createTestServer(t) {
  const storageDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'dms-test-'));
  const testApp = app.createApp({
    storageDirectory,
    owner: 'test-user',
    maxFileSizeBytes: 64
  });
  const server = testApp.listen(0, '127.0.0.1');

  await new Promise((resolve) => server.once('listening', resolve));
  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    await fs.rm(storageDirectory, { recursive: true, force: true });
  });

  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    storageDirectory
  };
}

async function uploadFile(baseUrl, contents = 'document contents', filename = 'report.txt') {
  const form = new FormData();
  form.append('file', new Blob([contents]), filename);

  return fetch(`${baseUrl}/upload`, {
    method: 'POST',
    body: form
  });
}

test('POST /upload grava o arquivo e retorna metadados públicos', async (t) => {
  const { baseUrl, storageDirectory } = await createTestServer(t);

  const uploadResponse = await uploadFile(baseUrl);
  assert.equal(uploadResponse.status, 201);
  const uploadedDocument = await uploadResponse.json();
  assert.match(uploadedDocument.id, /^[0-9a-f-]{36}$/i);
  assert.equal(uploadedDocument.originalName, 'report.txt');
  assert.equal(uploadedDocument.size, Buffer.byteLength('document contents'));
  assert.equal(uploadedDocument.owner, 'test-user');
  assert.equal(Object.hasOwn(uploadedDocument, 'storedFilename'), false);

  const storedFiles = await fs.readdir(storageDirectory);
  assert.equal(storedFiles.length, 1);
  assert.match(storedFiles[0], /^[0-9a-f-]{36}$/i);
});

test('GET /documents lista metadados dos documentos enviados', async (t) => {
  const { baseUrl } = await createTestServer(t);
  const emptyListResponse = await fetch(`${baseUrl}/documents`);
  assert.equal(emptyListResponse.status, 200);
  assert.deepEqual(await emptyListResponse.json(), []);

  const uploadResponse = await uploadFile(baseUrl);
  assert.equal(uploadResponse.status, 201);
  const uploadedDocument = await uploadResponse.json();

  const listResponse = await fetch(`${baseUrl}/documents`);
  assert.equal(listResponse.status, 200);
  assert.deepEqual(await listResponse.json(), [uploadedDocument]);
});

test('GET /documents/:id/download retorna o conteúdo do documento', async (t) => {
  const { baseUrl } = await createTestServer(t);
  const uploadResponse = await uploadFile(baseUrl);
  assert.equal(uploadResponse.status, 201);
  const uploadedDocument = await uploadResponse.json();

  const downloadResponse = await fetch(`${baseUrl}/documents/${uploadedDocument.id}/download`);
  assert.equal(downloadResponse.status, 200);
  assert.match(downloadResponse.headers.get('content-disposition'), /attachment/);
  assert.match(downloadResponse.headers.get('content-disposition'), /report\.txt/);
  assert.equal(downloadResponse.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(await downloadResponse.text(), 'document contents');
});

test('POST /upload rejeita arquivos ausentes, multipart inválido e arquivos grandes', async (t) => {
  const { baseUrl, storageDirectory } = await createTestServer(t);

  const missingFileResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    body: new FormData()
  });
  assert.equal(missingFileResponse.status, 400);
  assert.equal((await missingFileResponse.json()).error.code, 'FILE_REQUIRED');

  const malformedResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'multipart/form-data; boundary=broken-boundary' },
    body: '--broken-boundary\r\nContent-Disposition: form-data; name="file"; filename="broken.txt"\r\n'
  });
  assert.equal(malformedResponse.status, 400);
  assert.equal((await malformedResponse.json()).error.code, 'INVALID_UPLOAD');

  const oversizedForm = new FormData();
  oversizedForm.append('file', new Blob(['x'.repeat(65)]), 'large.txt');
  const oversizedResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    body: oversizedForm
  });
  assert.equal(oversizedResponse.status, 413);
  assert.equal((await oversizedResponse.json()).error.code, 'FILE_TOO_LARGE');
  assert.deepEqual(await fs.readdir(storageDirectory), []);
});

test('GET /documents/:id/download retorna 404 para documento inexistente', async (t) => {
  const { baseUrl } = await createTestServer(t);
  const notFoundResponse = await fetch(`${baseUrl}/documents/not-a-document/download`);
  assert.equal(notFoundResponse.status, 404);
  assert.equal((await notFoundResponse.json()).error.code, 'DOCUMENT_NOT_FOUND');
});