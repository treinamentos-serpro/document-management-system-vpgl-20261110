import DownloadButton from './DownloadButton.jsx';
import { formatFileSize } from '../utils/formatFileSize.js';

function formatUploadDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Data indisponível';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

export default function DocumentList({ documents, error, isLoading }) {
  if (isLoading) {
    return <p className="list-state" role="status">Carregando documentos...</p>;
  }

  if (error) {
    return <p className="list-state feedback-error" role="alert">{error}</p>;
  }

  if (documents.length === 0) {
    return (
      <div className="list-state list-empty">
        <span className="empty-mark" aria-hidden="true">0</span>
        <p>Nenhum documento</p>
      </div>
    );
  }

  return (
    <ul className="document-list">
      {documents.map((document) => (
        <li className="document-row" key={document.id}>
          <span className="file-stamp" aria-hidden="true">DOC</span>
          <div className="document-details">
            <span className="document-name" title={document.originalName}>
              {document.originalName}
            </span>
            <span className="document-meta">
              {formatUploadDate(document.uploadedAt)}
              <span className="meta-separator" aria-hidden="true">/</span>
              {formatFileSize(document.size)}
            </span>
          </div>
          <DownloadButton documentId={document.id} fileName={document.originalName} />
        </li>
      ))}
    </ul>
  );
}