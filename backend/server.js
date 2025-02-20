const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const axios = require('axios');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

const app = express();
const port = process.env.PORT || 5000;
const corsOptions = {
  exposedHeaders: ['X-PDF-Name'],
};

app.use(cors(corsOptions));
app.use(express.json());

let clients = [];

app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  clients.push(res);

  req.on('close', () => {
    clients = clients.filter(client => client !== res);
  });
});

function sendEvent(message) {
  clients.forEach(client => client.write(`data: ${message}\n\n`));
}

async function retryGoto(page, url, options, retries) {
  for (let i = 0; i < retries; i++) {
    try {
      await page.goto(url, options);
      return; // Si la navegación es exitosa, salir de la función
    } catch (error) {
      console.error(`❌ Error al navegar a la URL (intento ${i + 1} de ${retries}):`, error);
      if (i === retries - 1) {
        throw error; // Si es el último intento, lanzar el error
      }
    }
  }
}

app.post('/get-pdf-name', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    await retryGoto(page, url, { waitUntil: 'networkidle2', timeout: 5000 }, 6);
    console.log('🚀 Navegando a la página...');

    console.log('🔍 Extrayendo el nombre para el PDF...');
    const name = await page.evaluate(() => {
      const container = document.querySelector('.nFRPI.V4kyC.z85vg.N30cN');
      const span = container ? container.querySelector('span') : null;
      return span ? span.textContent.trim() : 'Documento';
    });
    console.log(`🔖 Nombre extraído: ${name}`);

    await browser.close();
    res.json({ name: `${name}` });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/generate-pdf', async (req, res) => {
  const { url, name } = req.body;
  if (!url || !name) {
    return res.status(400).json({ error: 'URL and name are required' });
  }

  try {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    sendEvent('🚀 Navegando a la página...');
    console.log('🚀 Navegando a la página...');
    await retryGoto(page, url, { waitUntil: 'networkidle2', timeout: 10000 }, 6);
    
    sendEvent('🔍 Buscando imagenes...');
    console.log('🔍 Buscando imagenes...');
    await page.waitForSelector('.EEnGW.F16e6', { timeout: 15000 });
    const containers = await page.$$('.EEnGW.F16e6');

    const allImageUrls = [];
    for (let i = 0; i < containers.length; i++) {
      await containers[i].scrollIntoView();
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1000)));
      const urls = await page.evaluate(container => {
        return Array.from(container.querySelectorAll('.KfFlO'))
          .map(element => {
            if (element.tagName === 'IMG') {
              return element.src || element.dataset.src;
            }
            const bg = window.getComputedStyle(element).backgroundImage;
            return bg.replace(/url\(["']?(.*?)["']?\)/i, '$1');
          })
          .filter(url => url && url !== 'none');
      }, containers[i]);
      allImageUrls.push(...urls);
    }

    sendEvent(`📌 Imágenes encontradas ${allImageUrls.length}/${containers.length} `);
    console.log(`📌 Imágenes encontradas ${allImageUrls.length}/${containers.length} `);

    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }

    const images = [];
    sendEvent(`⚙️ Convirtiendo imágenes...`);
    console.log(`⚙️ Convirtiendo imágenes...`);
    for (let i = 0; i < allImageUrls.length; i++) {
      const url = allImageUrls[i];
      const imagePath = path.join(tempDir, `image${i + 1}.svg`);
      const response = await axios({ method: 'get', url: url, responseType: 'arraybuffer' });
      await sharp(response.data)
        .resize({ width: 4000 })
        .toFormat('png')
        .toFile(imagePath.replace('.svg', '.png'));
      images.push(imagePath.replace('.svg', '.png'));
    }

    const pdfDoc = await PDFDocument.create();
    const pageWidth = 612;
    const pageHeight = 792;

    sendEvent(`📄 Añadiendo imágenes al PDF...`);
    console.log(`📄 Añadiendo imágenes al PDF...`);
    for (let i = 0; i < images.length; i++) {
      const imageBytes = fs.readFileSync(images[i]);
      const image = await pdfDoc.embedPng(imageBytes);
      const scale = Math.min(pageWidth / image.width, pageHeight / image.height);
      const scaledWidth = image.width * scale;
      const scaledHeight = image.height * scale;
      const page = pdfDoc.addPage([pageWidth, pageHeight]);
      page.drawImage(image, {
        x: (pageWidth - scaledWidth) / 2,
        y: (pageHeight - scaledHeight) / 2,
        width: scaledWidth,
        height: scaledHeight
      });
    }

    const pdfBytes = await pdfDoc.save();
    const pdfPath = path.join(tempDir, `${name}`);
    fs.writeFileSync(pdfPath, pdfBytes);
    sendEvent(`✅ PDF generado con éxito`);
    console.log(`✅ PDF generado con éxito`);

    images.forEach(imagePath => fs.unlinkSync(imagePath));
    await browser.close();

    res.download(pdfPath, name, () => fs.unlinkSync(pdfPath));
    
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});