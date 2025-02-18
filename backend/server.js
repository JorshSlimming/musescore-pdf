// Importación de módulos requeridos
const express = require('express'); // Framework para crear el servidor
const puppeteer = require('puppeteer'); // Librería para controlar navegador headless
const axios = require('axios'); // Cliente HTTP para hacer peticiones
const sharp = require('sharp'); // Procesamiento de imágenes
const fs = require('fs'); // Módulo de sistema de archivos
const path = require('path'); // Utilidades para manejar rutas de archivos
const { PDFDocument } = require('pdf-lib'); // Generación de PDFs
const cors = require('cors'); // Middleware para habilitar CORS

const app = express(); // Crear instancia de Express
const PORT = process.env.PORT || 5000; // Puerto del servidor

// Middlewares
app.use(express.json()); // Parsear cuerpos de solicitud en formato JSON
app.use(cors()); // Habilitar CORS para todas las rutas

const handleMetadataRequest = async (req, res) => {
  const { url } = req.body;
  try {
      const browser = await puppeteer.launch({ 
          headless: true, 
          args: ['--no-sandbox'] 
      });
      const page = await browser.newPage();
      
      // Añadir misma configuración que en la ruta principal
      await page.setUserAgent('Mozilla/5.0...');
      await page.setViewport({ width: 1280, height: 800 }); // <- AÑADIR

      await page.goto(url, { 
          waitUntil: 'networkidle2', // <- CAMBIAR a mismo wait
          timeout: 30000 // <- Aumentar timeout
      });

      // Esperar explícitamente por el contenedor del nombre
      await page.waitForSelector('.nFRPI.V4kyC.z85vg.N30cN', { 
          timeout: 10000 
      });

      const name = await page.evaluate(() => {
        // Selectores específicos (probablemente de Google Docs)
        const container = document.querySelector('.nFRPI.V4kyC.z85vg.N30cN');
        const span = container ? container.querySelector('span') : null;
        return span ? span.textContent.trim() : 'Documento'; // Nombre predeterminado si falla
    });

    console.log(`🔖 Nombre extraído: ${name}`);

      await browser.close();
      res.json({ name });

  } catch (error) {
      console.error('❌ Error metadata:', error);
      res.status(500).json({ error: 'Failed to get metadata' });
  }
};

// Ruta POST principal que maneja la generación del PDF
app.post('/backend', async (req, res) => {
    const { url, metadataOnly } = req.body; // Extraer URL del cuerpo de la solicitud
    if (!url) return res.status(400).json({ error: 'URL is required' }); // Validación básica
    if (metadataOnly) return handleMetadataRequest(req, res);

    try {
        // Iniciar navegador Puppeteer con configuración para entorno headless
        const browser = await puppeteer.launch({ 
            headless: true, 
            args: ['--no-sandbox'] // Argumento necesario para entornos restringidos
        });
        const page = await browser.newPage(); // Crear nueva pestaña/página
        
        // Configurar User-Agent para simular navegador real
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        // Definir tamaño de la ventana de navegación
        await page.setViewport({ width: 1280, height: 800 });

        console.log('🚀 Navegando a la página...');
        // Navegar a la URL con opciones de espera
        await page.goto(url, { 
            waitUntil: 'networkidle2', // Esperar a que la red esté inactiva
            timeout: 30000 // Timeout de 30 segundos
        });

        // Extraer nombre del documento desde elemento específico en la página
        console.log('🔍 Extrayendo el nombre para el PDF...');
        const name = await page.evaluate(() => {
            // Selectores específicos (probablemente de Google Docs)
            const container = document.querySelector('.nFRPI.V4kyC.z85vg.N30cN');
            const span = container ? container.querySelector('span') : null;
            return span ? span.textContent.trim() : 'Documento'; // Nombre predeterminado si falla
        });

        console.log(`🔖 Nombre extraído: ${name}`);

        // Buscar contenedores de imágenes en la página
        console.log('🔍 Buscando contenedores...');
        await page.waitForSelector('.EEnGW.F16e6', { timeout: 15000 }); // Esperar por selectores
        const containers = await page.$$('.EEnGW.F16e6'); // Obtener todos los elementos

        const allImageUrls = []; // Almacenar todas las URLs de imágenes
        for (let i = 0; i < containers.length; i++) {
            // Hacer scroll al contenedor para cargar imágenes lazy-load
            await containers[i].scrollIntoView();
            
            // Pequeña pausa para permitir renderizado
            await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 500)));

            // Extraer URLs de imágenes dentro del contenedor
            const urls = await page.evaluate(container => {
                return Array.from(container.querySelectorAll('.KfFlO')) // Selector de imágenes
                    .map(element => element.tagName === 'IMG' ? element.src || element.dataset.src : null)
                    .filter(url => url); // Filtrar elementos nulos
            }, containers[i]);

            allImageUrls.push(...urls); // Agregar URLs al array principal
        }

        console.log(`📌 Enlaces de imágenes encontrados: ${allImageUrls.length}`);

        const images = []; // Rutas de archivos de imágenes temporales
        for (let i = 0; i < allImageUrls.length; i++) {
            const imagePath = path.join(__dirname, `image${i + 1}.png`); // Ruta única por imagen
            
            // Descargar imagen con Axios
            const response = await axios.get(allImageUrls[i], { 
                responseType: 'arraybuffer' // Especificar tipo de respuesta binaria
            });
            
            // Procesar imagen con Sharp
            await sharp(response.data)
                .resize({ width: 4000 }) // Redimensionar manteniendo relación de aspecto
                .toFormat('png') // Convertir a PNG
                .toFile(imagePath); // Guardar en archivo
            
            images.push(imagePath); // Registrar ruta de la imagen
        }

        // Crear nuevo documento PDF
        const pdfDoc = await PDFDocument.create();
        const pageWidth = 612, // Ancho de página carta en puntos (8.5 pulgadas)
              pageHeight = 792; // Alto de página carta (11 pulgadas)

        // Añadir cada imagen como página del PDF
        for (let imagePath of images) {
            const imageBytes = fs.readFileSync(imagePath); // Leer imagen del disco
            const image = await pdfDoc.embedPng(imageBytes); // Incrustar en PDF
            
            // Calcular escalado para ajustar a la página
            const scale = Math.min(
                pageWidth / image.width,
                pageHeight / image.height
            );
            
            // Crear nueva página y dibujar imagen centrada
            const page = pdfDoc.addPage([pageWidth, pageHeight]);
            page.drawImage(image, { 
                x: (pageWidth - image.width * scale) / 2, // Centrado horizontal
                y: (pageHeight - image.height * scale) / 2, // Centrado vertical
                width: image.width * scale,
                height: image.height * scale
            });
        }

        // Guardar PDF en bytes y escribir en disco
        const pdfBytes = await pdfDoc.save();
        const pdfPath = path.join(__dirname, `${name}.pdf`);
        fs.writeFileSync(pdfPath, pdfBytes);

        // Limpieza de imágenes temporales
        images.forEach(imagePath => fs.unlinkSync(imagePath));

        await browser.close(); // Cerrar navegador

        // Enviar PDF como descarga y luego eliminarlo
        res.download(pdfPath, `${name}.pdf`, (err) => {
            if (err) console.error('❌ Error enviando el archivo:', err);
            fs.unlinkSync(pdfPath); // Eliminar PDF después de enviarlo
        });

        console.log('✅ PDF generado y enviado');

    } catch (error) {
        console.error('❌ Error:', error); // Mantener log original de error
        res.status(500).json({ error: 'Failed to generate PDF' }); // Respuesta de error
    }
});

// Iniciar servidor
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));