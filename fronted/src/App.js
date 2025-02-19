import React, { useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import './App.css';

const socket = io('http://localhost:5000');

function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pdfName, setPdfName] = useState('');
  const [pdfBlob, setPdfBlob] = useState(null);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Buscando partitura...');
  const totalSteps = 10; // Ajusta este valor según el número total de pasos en el backend

  useEffect(() => {
    socket.on('progress', (data) => {
      console.log(data.step);
      setProgress((prevProgress) => prevProgress + 1);
      if (data.step.includes('Nombre extraído')) {
        setStatusMessage(`Partitura ${data.name} encontrada`);
      }
    });

    return () => {
      socket.off('progress');
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url) {
      setError('Por favor ingresa una URL de MuseScore');
      return;
    }
    
    setLoading(true);
    setError('');
    setProgress(0);
    setStatusMessage('Buscando partitura...');

    try {
      // Paso 1: Obtener el nombre del PDF
      const nameResponse = await axios.post('http://localhost:5000/get-pdf-name', { url });
      const fileName = nameResponse.data.name;
      setPdfName(fileName);
      setStatusMessage(`Partitura encontrada: ${fileName}`);

      // Paso 2: Generar el PDF
      const response = await axios.post('http://localhost:5000/generate-pdf', { url, name: fileName + ".pdf" }, {
        responseType: 'blob'
      });

      setPdfBlob(response.data);

    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Error al procesar la partitura';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (pdfBlob && pdfName) {
      const downloadUrl = window.URL.createObjectURL(new Blob([pdfBlob]));
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', pdfName + ".pdf");
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        window.URL.revokeObjectURL(downloadUrl);
        link.remove();
      }, 1000);

      // Reiniciar el estado de la aplicación
      setUrl('');
      setPdfName('');
      setPdfBlob(null);
      setProgress(0);
      setError(''); // Limpiar el estado de error
      setStatusMessage('Buscando partitura...');
    }
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
            onClick={pdfBlob ? handleDownload : handleSubmit}
          >
            {loading ? 'Generando PDF...' : (pdfBlob ? 'Descargar PDF' : 'Generar PDF')}
          </button>
        </form>

        {error && <div className="error-banner">{error}</div>}

        {loading && (
          <>
            <div className="status-message">{statusMessage}</div>
            <div className="progress-bar">
              <div className="progress" style={{ width: `${(progress / totalSteps) * 100}%` }}></div>
            </div>
          </>
        )}
      </header>
    </div>
  );
}

export default App;