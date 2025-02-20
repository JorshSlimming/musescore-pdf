import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pdfName, setPdfName] = useState('');
  const [pdfBlob, setPdfBlob] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [logMessages, setLogMessages] = useState([]);

  useEffect(() => {
    const eventSource = new EventSource(`${process.env.REACT_APP_API_URL}/events`);
    eventSource.onmessage = (event) => {
      setLogMessages((prevMessages) => [...prevMessages, event.data]);
    };
    return () => {
      eventSource.close();
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url) {
      setError('Por favor ingresa una URL valida');
      return;
    }

    const urlPattern = /^https:\/\/musescore\.com/;
    if (!urlPattern.test(url)) {
      setError('Formato URL incorrecto');
      return;
    }
    
    setLoading(true);
    setError('');
    setStatusMessage('Buscando partitura...');
    setLogMessages([]);

    try {
      // Paso 1: Obtener el nombre del PDF
      const nameResponse = await axios.post(`${process.env.REACT_APP_API_URL}/get-pdf-name`, { url });
      const fileName = nameResponse.data.name;
      setPdfName(fileName);
      setStatusMessage(`Partitura encontrada: ${fileName}`);

      // Paso 2: Generar el PDF
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/generate-pdf`, { url, name: fileName + ".pdf" }, {
        responseType: 'blob'
      });

      setPdfBlob(response.data);

    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Error al procesar la partitura';
      setStatusMessage('');
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
      setLogMessages([]); // Limpiar los mensajes de log
    }
  };
  
  return (
    <div className="App">
      <header className="App-header">
        <h1>Descargador de Partituras MuseScore</h1>
        <p>
          Visita <a href="https://musescore.com" target="_blank" rel="noopener noreferrer">musescore.com</a> para buscar partituras.
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Ej: https://musescore.com/user/12345/scores/67890"
            pattern="https://musescore.com/user/\d+/scores/\d+"
            required
            disabled={loading}
          />
          <button 
            type="submit" 
            disabled={loading}
            className={loading ? 'loading' : ''}
            onClick={pdfBlob ? handleDownload : handleSubmit}
          >
            {loading ? '' : (pdfBlob ? 'Descargar PDF' : 'Generar PDF')}
          </button>
        </form>

        {error && <div className="error-banner">{error}</div>}

        <div className="status-message">{statusMessage}</div>
        <div className="log-messages">
          {logMessages.map((message, index) => (
            <div key={index}>{message}</div>
          ))}
        </div>
      </header>
    </div>
  );
}

export default App;