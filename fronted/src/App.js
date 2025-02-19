import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pdfName, setPdfName] = useState('');
  const [pdfBlob, setPdfBlob] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url) {
      setError('Por favor ingresa una URL de MuseScore');
      return;
    }
    
    setLoading(true);
    setError('');
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
      setError(''); // Limpiar el estado de error
      setStatusMessage(''); // Limpiar el mensaje de estado
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

        <div className="status-message">{statusMessage}</div>
      </header>
    </div>
  );
}

export default App;