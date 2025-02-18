const puppeteer = require('puppeteer');
const axios = require('axios');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

(async () => {
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    console.log('🚀 Navegando a la página...');
    await page.goto('https://musescore.com/user/90375058/scores/23336374', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Paso 1: Extraer el nombre del archivo desde la clase nFRPI V4kyC z85vg N30cN
    console.log('🔍 Extrayendo el nombre para el PDF...');
    const name = await page.evaluate(() => {
      const container = document.querySelector('.nFRPI.V4kyC.z85vg.N30cN');
      const span = container ? container.querySelector('span') : null;
      return span ? span.textContent.trim() : 'Documento';  // Si no se encuentra, ponemos un nombre por defecto
    });

    console.log(`🔖 Nombre extraído: ${name}`);

    // Paso 2: Buscar los contenedores de imágenes
    console.log('🔍 Buscando contenedores...');
    await page.waitForSelector('.EEnGW.F16e6', { timeout: 15000 });
    const containers = await page.$$('.EEnGW.F16e6');
    console.log(`🔄 Total de contenedores encontrados: ${containers.length}`);

    const allImageUrls = [];

    for (let i = 0; i < containers.length; i++) {
      console.log(`📦 Procesando contenedor ${i + 1}/${containers.length}`);
      
      // Scroll al contenedor
      await containers[i].scrollIntoView();
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 500)));

      // Extraer URLs
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

    // Paso 3: Descargar las imágenes y convertirlas a PNG
    const images = [];
    for (let i = 0; i < allImageUrls.length; i++) {
      const url = allImageUrls[i];
      const imagePath = path.join(__dirname, `image${i + 1}.svg`);

      // Descargar imagen
      const response = await axios({
        method: 'get',
        url: url,
        responseType: 'arraybuffer'
      });

      // Si es SVG, lo convertimos a PNG con alta resolución
      await sharp(response.data)
        .resize({ width: 4000 }) // Aumentar la resolución de la imagen (tamaño grande)
        .toFormat('png')
        .toFile(imagePath.replace('.svg', '.png')); // Guarda el archivo como PNG

      console.log(`✔️ Imagen descargada y convertida a PNG: ${imagePath.replace('.svg', '.png')}`);
      images.push(imagePath.replace('.svg', '.png'));
    }

    // Paso 4: Crear un PDF con las imágenes en tamaño carta (8.5 x 11 pulgadas)
    const pdfDoc = await PDFDocument.create();
    const pageWidth = 612;  // Ancho de la página de tamaño carta en puntos
    const pageHeight = 792; // Alto de la página de tamaño carta en puntos

    for (let i = 0; i < images.length; i++) {
      const imageBytes = fs.readFileSync(images[i]);

      const image = await pdfDoc.embedPng(imageBytes);
      const imageWidth = image.width;
      const imageHeight = image.height;

      // Escalar la imagen para que se ajuste a la página de tamaño carta sin perder calidad
      const scale = Math.min(pageWidth / imageWidth, pageHeight / imageHeight);
      const scaledWidth = imageWidth * scale;
      const scaledHeight = imageHeight * scale;

      const page = pdfDoc.addPage([pageWidth, pageHeight]);

      page.drawImage(image, {
        x: (pageWidth - scaledWidth) / 2, // Centrar la imagen horizontalmente
        y: (pageHeight - scaledHeight) / 2, // Centrar la imagen verticalmente
        width: scaledWidth,
        height: scaledHeight
      });

      console.log(`✔️ Imagen ${i + 1} añadida al PDF.`);
    }

    // Guardar el PDF con el nombre extraído
    const pdfBytes = await pdfDoc.save();
    const pdfPath = path.join(__dirname, `${name}.pdf`); // Usamos el nombre extraído para el archivo PDF
    fs.writeFileSync(pdfPath, pdfBytes);

    console.log(`📄 PDF generado con éxito: ${pdfPath}`);

    // Limpiar imágenes temporales
    images.forEach(imagePath => fs.unlinkSync(imagePath));

    await browser.close();

  } catch (error) {
    console.error('❌ Error:', error);
  }
})();
