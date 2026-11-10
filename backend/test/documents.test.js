const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const app = require('../src/app');

async function createTestContext(t) {
  const storageDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'dms-endpoint-test-'));
  t.after(() => fs.rm(storageDirectory, { recursive: true, force: true }));
  const server = app.createApp({ storageDirectory, owner: 'test-user' }).listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    storageDirectory
  };
}

async function uploadFile(baseUrl, contents, filename) {
  const form = new FormData();
  form.append('file', new Blob([contents]), filename);
  return fetch(`${baseUrl}/upload`, { method: 'POST', body: form });
}

test('POST /upload persiste o arquivo e retorna os metadados públicos', async (t) => {
  const { baseUrl, storageDirectory } = await createTestContext(t);
  const contents = Buffer.from([0, 1, 127, 128, 255]);
  const response = await uploadFile(baseUrl, contents, 'document.bin');

  assert.equal(response.status, 201);
  const document = await response.json();
  assert.match(document.id, /^[0-9a-f-]{36}$/i);
  assert.equal(document.originalName, 'document.bin');
  assert.equal(document.size, contents.length);
  assert.equal(document.owner, 'test-user');
  assert.equal(new Date(document.uploadedAt).toISOString(), document.uploadedAt);
  assert.deepEqual(Object.keys(document).sort(), ['id', 'originalName', 'owner', 'size', 'uploadedAt']);

  const storedFiles = await fs.readdir(storageDirectory);
  assert.equal(storedFiles.length, 1);
  assert.deepEqual(await fs.readFile(path.join(storageDirectory, storedFiles[0])), contents);
});

test('GET /documents retorna uma lista vazia e inclui todos os uploads', async (t) => {
  const { baseUrl } = await createTestContext(t);
  const emptyResponse = await fetch(`${baseUrl}/documents`);
  assert.equal(emptyResponse.status, 200);
  assert.deepEqual(await emptyResponse.json(), []);

  const documents = [];
  for (const filename of ['first.txt', 'second.txt']) {
    const response = await uploadFile(baseUrl, filename, filename);
    assert.equal(response.status, 201);
    documents.push(await response.json());
  }

  const response = await fetch(`${baseUrl}/documents`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), documents);
});

test('GET /documents/:id/download preserva os bytes e retorna 404 para ID inexistente', async (t) => {
  const { baseUrl } = await createTestContext(t);
  const contents = Buffer.from([0, 10, 13, 128, 255]);
  const uploadResponse = await uploadFile(baseUrl, contents, 'document.bin');
  assert.equal(uploadResponse.status, 201);
  const document = await uploadResponse.json();

  const response = await fetch(`${baseUrl}/documents/${document.id}/download`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-disposition'), /attachment;.*filename="document\.bin"/);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), contents);

  const missingResponse = await fetch(`${baseUrl}/documents/nonexistent/download`);
  assert.equal(missingResponse.status, 404);
  assert.equal((await missingResponse.json()).error.code, 'DOCUMENT_NOT_FOUND');
});

test('a API de documentos envia, lista, baixa e valida arquivos', async (t) => {
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

  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const emptyListResponse = await fetch(`${baseUrl}/documents`);
  assert.equal(emptyListResponse.status, 200);
  assert.deepEqual(await emptyListResponse.json(), []);

  const form = new FormData();
  form.append('file', new Blob(['document contents']), 'report.txt');
  const uploadResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    body: form
  });

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

  const listResponse = await fetch(`${baseUrl}/documents`);
  assert.deepEqual(await listResponse.json(), [uploadedDocument]);

  const downloadResponse = await fetch(`${baseUrl}/documents/${uploadedDocument.id}/download`);
  assert.equal(downloadResponse.status, 200);
  assert.match(downloadResponse.headers.get('content-disposition'), /attachment/);
  assert.match(downloadResponse.headers.get('content-disposition'), /report\.txt/);
  assert.equal(downloadResponse.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(await downloadResponse.text(), 'document contents');

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
  assert.deepEqual(await fs.readdir(storageDirectory), storedFiles);

  const listAfterRejectedUploads = await fetch(`${baseUrl}/documents`);
  assert.deepEqual(await listAfterRejectedUploads.json(), [uploadedDocument]);

  const notFoundResponse = await fetch(`${baseUrl}/documents/not-a-document/download`);
  assert.equal(notFoundResponse.status, 404);
  assert.equal((await notFoundResponse.json()).error.code, 'DOCUMENT_NOT_FOUND');
});