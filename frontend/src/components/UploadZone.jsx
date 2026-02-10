import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileArchive, FileCode, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MAX_SIZE = 50 * 1024 * 1024; // 50MB

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadZone({ file, onFileSelect, onFileRemove }) {
  const onDrop = useCallback(
    (accepted) => {
      if (accepted.length > 0) {
        onFileSelect(accepted[0]);
      }
    },
    [onFileSelect]
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } =
    useDropzone({
      onDrop,
      accept: { 'application/zip': ['.zip'], 'text/html': ['.html', '.htm'] },
      maxSize: MAX_SIZE,
      maxFiles: 1,
      disabled: !!file,
    });

  const rejection = fileRejections[0]?.errors[0];
  const rejectionMessage = rejection
    ? rejection.code === 'file-too-large'
      ? 'File exceeds 50MB limit'
      : rejection.code === 'file-invalid-type'
        ? 'Only ZIP or HTML files are accepted'
        : rejection.message
    : null;

  return (
    <div className="space-y-3">
      <AnimatePresence mode="wait">
        {!file ? (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <div
              {...getRootProps()}
              className={`
                relative cursor-pointer
                border-2 border-dashed rounded-card p-12
                flex flex-col items-center justify-center gap-4
                transition-all duration-200
                ${
                  isDragActive
                    ? 'border-brand-green bg-brand-green/5 shadow-[0_0_30px_rgba(0,255,133,0.1)]'
                    : 'border-surface-border hover:border-surface-mid hover:bg-surface-dark/50'
                }
              `}
            >
              <input {...getInputProps()} />
              <Upload
                className={`w-10 h-10 transition-colors ${
                  isDragActive ? 'text-brand-green' : 'text-text-secondary'
                }`}
              />
              <div className="text-center">
                <p className="text-white font-medium">
                  {isDragActive
                    ? 'Drop your file here'
                    : 'Drop your file here or click to browse'}
                </p>
                <p className="text-text-secondary text-sm mt-1">
                  Accepted: .zip, .html (max 50MB)
                </p>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="file-preview"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-surface-dark border border-surface-border rounded-card p-4 flex items-center gap-4"
          >
            <div className="bg-brand-green/10 rounded-lg p-3">
              {file.name.toLowerCase().endsWith('.html') || file.name.toLowerCase().endsWith('.htm') ? (
                <FileCode className="w-6 h-6 text-brand-green" />
              ) : (
                <FileArchive className="w-6 h-6 text-brand-green" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium truncate">{file.name}</p>
              <p className="text-text-secondary text-sm">
                {formatSize(file.size)}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFileRemove();
              }}
              className="text-text-secondary hover:text-white transition-colors p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {rejectionMessage && (
        <p className="text-brand-error text-sm">{rejectionMessage}</p>
      )}
    </div>
  );
}
