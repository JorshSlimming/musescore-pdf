import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [currentStep, setCurrentStep] = useState(0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url) {
      setError('Por favor ingresa una URL de MuseScore');
      return;
    }
    
    setLoading(true);
    setError('');
    setCurrentStep(1);

    try {
      // Paso 1: Enviar URL al backend para generar el PDF
      setCurrentStep(1);
      const response = await axios.post('http://localhost:5000/generate-pdf', { url }, {
        responseType: 'blob',
        onDownloadProgress: (progressEvent) => {
          const percent = Math.min(95, Math.round((progressEvent.loaded * 100) / progressEvent.total));
          setProgress(percent);
        }
      });

      // Obtener el nombre del archivo desde los headers
      const contentDisposition = response.headers['content-disposition'];
      const filenameMatch = contentDisposition ? contentDisposition.match(/filename="(.+)"/) : null;
      const fileName = filenameMatch ? filenameMatch[1] : 'partitura.pdf';

      // Paso 2: Descargar el PDF
      setCurrentStep(2);
      setProgress(100);

      const downloadUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        window.URL.revokeObjectURL(downloadUrl);
        link.remove();
      }, 1000);

    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Error al procesar la partitura';
      setError(errorMessage);
    } finally {
      setLoading(false);
      setProgress(0);
      setCurrentStep(0);
    }
  };

  const getStepLabel = () => {
    const steps = {
      1: 'Generando PDF...',
      2: 'Descargando...'
    };
    return steps[currentStep] || '';
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Descargador de Partituras MuseScore</h1>
        <form onSubmit={handleSubmit}>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Ej: https://musescore.com/user/12345/scores/67890"
            pattern="https://musescore.com/.*"
            disabled={loading}
          />
          <button 
            type="submit" 
            disabled={loading}
            className={loading ? 'loading' : ''}
          >
            {loading ? getStepLabel() : 'Generar PDF'}
          </button>
        </form>

        {error && <div className="error-banner">{error}</div>}
        
        {loading && (
          <div className="progress-container">
            <div 
              className="progress-bar"
              style={{ width: `${progress}%` }}
            />
            <div className="progress-stats">
              <span>{progress}% completado</span>
              <span>Paso {currentStep} de 2</span>
            </div>
          </div>
        )}
      </header>
    </div>
  );
}

export default App;
