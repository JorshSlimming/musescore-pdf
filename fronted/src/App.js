import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [url, setUrl] = useState('');
  const [scoreName, setScoreName] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url) {
      setError('Por favor ingresa una URL');
      return;
    }
    
    setLoading(true);
    setError('');
    setScoreName('');

    try {
      // Primera llamada para obtener solo el nombre
      const nameResponse = await axios.post('http://localhost:5000/backend', { 
        url,
        metadataOnly: true 
      });
      
      // Mostrar el nombre inmediatamente
      setScoreName(nameResponse.data.name);

      // Segunda llamada para generar el PDF
      const pdfResponse = await axios.post('http://localhost:5000/backend', { 
        url 
      }, {
        responseType: 'blob',
        onDownloadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setProgress(percent);
        }
      });

      // Descargar el PDF
      const urlBlob = window.URL.createObjectURL(new Blob([pdfResponse.data]));
      const link = document.createElement('a');
      link.href = urlBlob;
      link.setAttribute('download', `${scoreName}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();

    } catch (err) {
      setError('Error al procesar la partitura');
      console.error(err);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Descargador de Partituras</h1>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Pega la URL de la partitura"
            disabled={loading}
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Procesando...' : 'Generar PDF'}
          </button>
        </form>

        {error && <p className="error">{error}</p>}
        
        {scoreName && (
          <div className="download-info">
            <p>📄 Partitura detectada:</p>
            <h3>{scoreName}</h3>
            {loading && (
              <div className="progress-container">
                <div 
                  className="progress-bar"
                  style={{ width: `${progress}%` }}
                ></div>
                <span>{progress}% completado</span>
              </div>
            )}
          </div>
        )}
      </header>
    </div>
  );
}

export default App;