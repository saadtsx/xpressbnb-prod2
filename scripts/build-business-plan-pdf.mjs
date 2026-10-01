import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from 'pdf-lib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const imagesDir = path.join(projectRoot, 'public', 'images', 'business-plan');
const outputPath = path.join(imagesDir, 'XpressBNB-Business-Plan.pdf');

const slideImages = [
  'bp-deck-01-executive-summary.png',
  'bp-deck-02-problem.png',
  'bp-deck-03-solution.png',
  'bp-deck-04-architecture.png',
  'bp-deck-05-technology.png',
  'bp-deck-06-business-model.png',
  'bp-deck-07-market.png',
  'bp-deck-08-revenue.png',
  'bp-deck-09-marketing.png',
  'bp-deck-10-competition.png',
  'bp-deck-11-swot.png',
  'bp-deck-12-financials.png',
  'bp-deck-13-impact.png',
  'bp-deck-14-roadmap.png',
  'bp-deck-15-funding.png',
];

const pdfDoc = await PDFDocument.create();
pdfDoc.setTitle('XpressBNB — Business Plan');
pdfDoc.setAuthor('XpressBNB');
pdfDoc.setSubject('Business Plan');

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
