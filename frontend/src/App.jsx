import { useEffect, useState } from 'react';
import DocumentList from './components/DocumentList.jsx';
import UploadComponent from './components/UploadComponent.jsx';
import { listDocuments, uploadDocument } from './services/documentApi.js';
import './styles.css';

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let isCurrent = true;

    listDocuments()
      .then((items) => {
        if (isCurrent) {
          setDocuments(items);
        }
      })
      .catch((requestError) => {
        if (isCurrent) {
          setListError(requestError.message);
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  async function handleUpload(file) {
    setIsUploading(true);
    setError('');
    setNotice('');

    try {
      const document = await uploadDocument(file);
      setDocuments((currentDocuments) => [...currentDocuments, document]);
      setNotice(`"${document.originalName}" enviado.`);
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="/" aria-label="Arquivo, início">
            <span className="brand-mark" aria-hidden="true"><span /></span>
            <span className="brand-copy">
              <strong>Arquivo</strong>
              <small>DOCUMENT MANAGEMENT</small>
            </span>
          </a>
          <div className="storage-indicator">
            <span className="status-dot" aria-hidden="true" />
            <span>Armazenamento local</span>
          </div>
        </div>
      </header>

      <main className="workspace">
        <section className="page-heading" aria-labelledby="page-title">
          <div>
            <p className="eyebrow">ESPAÇO DE TRABALHO</p>
            <h1 id="page-title">Documentos</h1>
          </div>
          <div className="document-count" aria-live="polite">
            <strong>{documents.length.toString().padStart(2, '0')}</strong>
            <span>{documents.length === 1 ? 'documento' : 'documentos'}</span>
          </div>
        </section>

        {error && <p className="feedback feedback-error" role="alert">{error}</p>}
        {notice && <p className="feedback feedback-success" role="status">{notice}</p>}

        <div className="content-grid">
          <aside className="upload-panel" aria-labelledby="upload-title">
            <div className="panel-heading">
              <span className="panel-index">01</span>
              <h2 id="upload-title">Novo envio</h2>
            </div>
            <UploadComponent
              disabled={isLoading}
              isUploading={isUploading}
              onUpload={handleUpload}
            />
          </aside>

          <section className="documents-panel" aria-labelledby="documents-title">
            <div className="documents-heading">
              <div>
                <p className="eyebrow">BIBLIOTECA</p>
                <h2 id="documents-title">Seus arquivos</h2>
              </div>
              <span className="list-count">{documents.length} itens</span>
            </div>
            <DocumentList documents={documents} error={listError} isLoading={isLoading} />
          </section>
        </div>
      </main>

      <footer className="page-footer">
        <span>DMS</span>
        <span>ARQUIVOS NO DISPOSITIVO DO SERVIDOR</span>
      </footer>
    </div>
  );
}
