import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from 'pdf-lib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const imagesDir = path.join(projectRoot, 'public', 'images', 'investor-deck', 'ihub-v2');
const outputPath = path.join(imagesDir, 'XpressBNB-iHUB-Investor-Deck.pdf');

const slideImages = [
  'ihub-deck-01-cover.png',
  'ihub-deck-02-problem.png',
  'ihub-deck-03-solution.png',
  'ihub-deck-04-ecosystem.png',
  'ihub-deck-05-technology.png',
  'ihub-deck-06-business-model.png',
  'ihub-deck-07-market.png',
  'ihub-deck-08-why-now.png',
  'ihub-deck-09-competitive.png',
  'ihub-deck-10-vision.png',
  'ihub-deck-11-roadmap.png',
  'ihub-deck-12-ask.png',
];

const pdfDoc = await PDFDocument.create();
pdfDoc.setTitle('XpressBNB — iHUB Investor Deck');
pdfDoc.setAuthor('XpressBNB');
pdfDoc.setSubject('Investor Deck');

for (const file of slideImages) {
  const fullPath = path.join(imagesDir, file);
  if (!fs.existsSync(fullPath)) {
    console.error(`Missing slide image: ${fullPath}`);
    process.exit(1);
  }

  const pngBytes = fs.readFileSync(fullPath);
  const image = await pdfDoc.embedPng(pngBytes);
  const width = image.width;
  const height = image.height;
  const page = pdfDoc.addPage([width, height]);
  page.drawImage(image, { x: 0, y: 0, width, height });
  console.log(`Added: ${file}`);
}

const pdfBytes = await pdfDoc.save();
fs.writeFileSync(outputPath, pdfBytes);
console.log(`Created: ${outputPath} (${(pdfBytes.length / 1024 / 1024).toFixed(2)} MB)`);
