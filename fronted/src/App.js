import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  // Estados del componente
  const [url, setUrl] = useState(''); // Almacena la URL ingresada por el usuario
  const [loading, setLoading] = useState(false); // Controla el estado de carga
  const [error, setError] = useState(''); // Maneja mensajes de error
  const [pdfName, setPdfName] = useState(''); // Nombre del archivo PDF obtenido
  const [pdfBlob, setPdfBlob] = useState(null); // Blob del PDF generado
  const [statusMessage, setStatusMessage] = useState(''); // Mensajes de estado del proceso
  const [logMessages, setLogMessages] = useState([]); // Registro de logs del servidor

  // Conexión SSE para recibir logs en tiempo real
  useEffect(() => {
    const eventSource = new EventSource(`${process.env.REACT_APP_API_URL}/events`);
    eventSource.onmessage = (event) => {
      setLogMessages((prevMessages) => [...prevMessages, event.data]);
    };
    
    // Limpieza al desmontar el componente
    return () => {
      eventSource.close();
    };
  }, []);

  // Maneja el envío del formulario
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validaciones iniciales
    if (!url) {
      setError('Por favor ingresa una URL valida');
      return;
    }

    const urlPattern = /^https:\/\/musescore\.com/;
    if (!urlPattern.test(url)) {
      setError('Formato URL incorrecto');
      return;
    }
    
    // Resetear estados y preparar UI para carga
    setLoading(true);
    setError('');
    setStatusMessage('Buscando partitura...');
    setLogMessages([]);

    try {
      // Paso 1: Obtener nombre del archivo
      const nameResponse = await axios.post(`${process.env.REACT_APP_API_URL}/get-pdf-name`, { url });
      const fileName = nameResponse.data.name;
      setPdfName(fileName);
      setStatusMessage(`Partitura encontrada: ${fileName}`);

      // Paso 2: Generar el PDF
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/generate-pdf`, 
        { url, name: fileName + ".pdf" }, 
        { responseType: 'blob' }
      );

      setPdfBlob(response.data);

    } catch (err) {
      // Manejo de errores
      const errorMessage = err.response?.data?.error || 'Error al procesar la partitura';
      setStatusMessage('');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Maneja la descarga del PDF
  const handleDownload = () => {
    if (pdfBlob && pdfName) {
      // Crear enlace temporal para descarga
      const downloadUrl = window.URL.createObjectURL(new Blob([pdfBlob]));
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', pdfName + ".pdf");
      document.body.appendChild(link);
      link.click();
  
      // Limpieza después de 1 segundo
      setTimeout(() => {
        window.URL.revokeObjectURL(downloadUrl);
        link.remove();
      }, 1000);
  
      // Resetear estados de la aplicación
      setUrl('');
      setPdfName('');
      setPdfBlob(null);
      setError(''); 
      setStatusMessage(''); 
      setLogMessages([]); 
    }
  };
  
  return (
    <div className="App">
      <header className="App-header">
        {/* Sección principal de la UI */}
        <h1>Descargador de Partituras MuseScore</h1>
        <p>
          Visita <a href="https://musescore.com" target="_blank" rel="noopener noreferrer">musescore.com</a> para buscar partituras.
        </p>
        
        {/* Formulario de entrada */}
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
          {/* Botón dinámico según estado */}
          <button 
            type="submit" 
            disabled={loading}
            className={loading ? 'loading' : ''}
            onClick={pdfBlob ? handleDownload : handleSubmit}
          >
            {loading ? '' : (pdfBlob ? 'Descargar PDF' : 'Generar PDF')}
          </button>
        </form>

        {/* Sección de mensajes y logs */}
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