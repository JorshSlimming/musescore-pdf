const puppeteer = require('puppeteer');
const axios = require('axios');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const express = require('express');
const cors = require('cors');


const app = express();
const port = 5000;

app.use(cors());
app.use(express.json())

app.use(express.json());

app.post('/generate-pdf', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    console.log('🚀 Navegando a la página...');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    console.log('🔍 Extrayendo el nombre para el PDF...');
    const name = await page.evaluate(() => {
      const container = document.querySelector('.nFRPI.V4kyC.z85vg.N30cN');
      const span = container ? container.querySelector('span') : null;
      return span ? span.textContent.trim() : 'Documento';
    });
    console.log(`🔖 Nombre extraído: ${name}`);

    console.log('🔍 Buscando contenedores...');
    await page.waitForSelector('.EEnGW.F16e6', { timeout: 15000 });
    const containers = await page.$$('.EEnGW.F16e6');
    console.log(`🔄 Total de contenedores encontrados: ${containers.length}`);

    const allImageUrls = [];
    for (let i = 0; i < containers.length; i++) {
      await containers[i].scrollIntoView();
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 500)));
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

    console.log('\n📌 Enlaces de imágenes encontrados:');
    allImageUrls.forEach((url, i) => console.log(`${i + 1}. ${url}`));

    const images = [];
    for (let i = 0; i < allImageUrls.length; i++) {
      const url = allImageUrls[i];
      const imagePath = path.join(__dirname, `image${i + 1}.svg`);
      const response = await axios({ method: 'get', url: url, responseType: 'arraybuffer' });
      await sharp(response.data)
        .resize({ width: 4000 })
        .toFormat('png')
        .toFile(imagePath.replace('.svg', '.png'));
      console.log(`✔️ Imagen descargada y convertida a PNG: ${imagePath.replace('.svg', '.png')}`);
      images.push(imagePath.replace('.svg', '.png'));
    }

    const pdfDoc = await PDFDocument.create();
    const pageWidth = 612;
    const pageHeight = 792;
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
      console.log(`✔️ Imagen ${i + 1} añadida al PDF.`);
    }

    const pdfBytes = await pdfDoc.save();
    const pdfPath = path.join(__dirname, `${name}.pdf`);
    fs.writeFileSync(pdfPath, pdfBytes);
    console.log(`📄 PDF generado con éxito: ${pdfPath}`);

    images.forEach(imagePath => fs.unlinkSync(imagePath));
    await browser.close();

    res.download(pdfPath, `${name}.pdf`, () => fs.unlinkSync(pdfPath));
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(port, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
});
