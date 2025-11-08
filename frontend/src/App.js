import axios from 'axios';
import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import './App.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

function App() {
  const [file, setFile] = useState(null);
  const [conversion, setConversion] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, uploading, processing, completed, error
  const [error, setError] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0];
      setFile(selectedFile);
      setError(null);
      setConversion(null);
      setAudioUrl(null);
      setStatus('idle');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1
  });

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a PDF file first');
      return;
    }

    setStatus('uploading');
    setError(null);

    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const response = await axios.post(`${API_BASE_URL}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setConversion(response.data);
      setStatus('processing');
      pollStatus(response.data.id);
    } catch (err) {
      setError(err.response?.data?.error || 'Error uploading file');
      setStatus('error');
    }
  };

  const pollStatus = async (id) => {
    const interval = setInterval(async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/status/${id}`);
        const conversionStatus = response.data;

        if (conversionStatus.status === 'completed') {
          clearInterval(interval);
          setStatus('completed');
          setConversion(conversionStatus);
          setAudioUrl(`${API_BASE_URL}/audio/${id}`);
        } else if (conversionStatus.status === 'failed') {
          clearInterval(interval);
          setStatus('error');
          setError('Conversion failed. Please try again.');
        }
      } catch (err) {
        clearInterval(interval);
        setStatus('error');
        setError('Error checking status');
      }
    }, 2000); // Poll every 2 seconds
  };

  const handleReset = () => {
    setFile(null);
    setConversion(null);
    setStatus('idle');
    setError(null);
    setAudioUrl(null);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="App">
      <div className="container">
        <header className="header">
          <h1 className="title">PDF to Audiobook Converter</h1>
          <p className="subtitle">Transform your PDF documents into audio files</p>
        </header>

        <main className="main-content">
          {status === 'idle' && !conversion && (
            <div className="upload-section">
              <div
                {...getRootProps()}
                className={`dropzone ${isDragActive ? 'active' : ''}`}
              >
                <input {...getInputProps()} />
                <div className="dropzone-content">
                  <svg
                    className="upload-icon"
                    width="64"
                    height="64"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  {isDragActive ? (
                    <p className="dropzone-text">Drop the PDF file here...</p>
                  ) : (
                    <>
                      <p className="dropzone-text">
                        Drag & drop a PDF file here, or click to select
                      </p>
                      <p className="dropzone-hint">Supports PDF files up to 50MB</p>
                    </>
                  )}
                </div>
              </div>

              {file && (
                <div className="file-info">
                  <div className="file-details">
                    <svg
                      className="file-icon"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <div className="file-text">
                      <p className="file-name">{file.name}</p>
                      <p className="file-size">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                  <button onClick={handleUpload} className="btn btn-primary">
                    Convert to Audiobook
                  </button>
                </div>
              )}
            </div>
          )}

          {status === 'uploading' && (
            <div className="status-section">
              <div className="spinner"></div>
              <p className="status-text">Uploading your PDF...</p>
            </div>
          )}

          {status === 'processing' && (
            <div className="status-section">
              <div className="spinner"></div>
              <p className="status-text">Processing your PDF...</p>
              <p className="status-subtext">
                Extracting text and converting to audio. This may take a few moments.
              </p>
              {conversion && conversion.text_length && (
                <p className="status-info">
                  Text extracted: {conversion.text_length.toLocaleString()} characters
                </p>
              )}
            </div>
          )}

          {status === 'completed' && audioUrl && (
            <div className="result-section">
              <div className="success-icon">
                <svg
                  width="64"
                  height="64"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <h2 className="success-title">Conversion Complete!</h2>
              <p className="success-text">Your audiobook is ready to download</p>

              <div className="audio-player-section">
                <audio controls className="audio-player" src={audioUrl}>
                  Your browser does not support the audio element.
                </audio>
              </div>

              <div className="action-buttons">
                <a
                  href={audioUrl}
                  download={`${conversion.original_filename.replace('.pdf', '')}.mp3`}
                  className="btn btn-download"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download Audio
                </a>
                <button onClick={handleReset} className="btn btn-secondary">
                  Convert Another PDF
                </button>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="error-section">
              <div className="error-icon">
                <svg
                  width="64"
                  height="64"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h2 className="error-title">Something went wrong</h2>
              <p className="error-text">{error || 'An error occurred during conversion'}</p>
              <button onClick={handleReset} className="btn btn-primary">
                Try Again
              </button>
            </div>
          )}
        </main>

        <footer className="footer">
          <p>Powered by React & Node.js</p>
        </footer>
      </div>
    </div>
  );
}

export default App;

