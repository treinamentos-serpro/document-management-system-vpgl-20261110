import { useRef, useState } from 'react';
import { formatFileSize } from '../utils/formatFileSize.js';

export default function UploadComponent({ disabled, isUploading, onUpload }) {
  const [file, setFile] = useState(null);
  const inputRef = useRef(null);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!file || disabled || isUploading) {
      return;
    }

    const uploaded = await onUpload(file);
    if (uploaded) {
      setFile(null);
      inputRef.current.value = '';
    }
  }

  return (
    <form className="upload-form" onSubmit={handleSubmit}>
      <label className="file-picker">
        <input
          ref={inputRef}
          type="file"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          disabled={disabled || isUploading}
        />
        <span className="file-picker-action">Selecionar arquivo</span>
        <span className="file-picker-name">{file?.name ?? 'Nenhum arquivo selecionado'}</span>
      </label>

      {file && (
        <div className="selected-file" aria-live="polite">
          <span className="selected-file-label">PRONTO PARA ENVIO</span>
          <span>{formatFileSize(file.size)}</span>
        </div>
      )}

      <button
        className="primary-button"
        type="submit"
        disabled={!file || disabled || isUploading}
      >
        {isUploading ? 'Enviando...' : 'Enviar documento'}
      </button>
    </form>
  );
}