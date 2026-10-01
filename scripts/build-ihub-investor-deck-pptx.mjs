import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PptxGenJS from 'pptxgenjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const imagesDir = path.join(projectRoot, 'public', 'images', 'investor-deck', 'ihub-v2');
const outputPath = path.join(imagesDir, 'XpressBNB-iHUB-Investor-Deck.pptx');
const tempPath = path.join(imagesDir, 'XpressBNB-iHUB-Investor-Deck.building.pptx');

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

for (const file of slideImages) {
  const fullPath = path.join(imagesDir, file);
  if (!fs.existsSync(fullPath)) {
    console.error(`Missing slide image: ${fullPath}`);
    process.exit(1);
  }
}

const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'XpressBNB';
pptx.company = 'XpressBNB';
pptx.subject = 'iHUB Investor Deck';
pptx.title = 'XpressBNB — India\'s AI-Powered Hospitality Operating System';

const slideW = 13.333;
const slideH = 7.5;

for (const file of slideImages) {
  const slide = pptx.addSlide();
  slide.background = { color: 'FCFCFC' };
  slide.addImage({
    path: path.join(imagesDir, file),
    x: 0,
    y: 0,
    w: slideW,
    h: slideH,
    sizing: { type: 'cover', w: slideW, h: slideH },
  });
}

await pptx.writeFile({ fileName: tempPath });

try {
  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
  }
  fs.renameSync(tempPath, outputPath);
  console.log(`Created: ${outputPath}`);
} catch (err) {
  const fallbackPath = path.join(imagesDir, 'XpressBNB-iHUB-Investor-Deck-latest.pptx');
  if (fs.existsSync(fallbackPath)) {
    fs.unlinkSync(fallbackPath);
  }
  fs.renameSync(tempPath, fallbackPath);
  console.log(`Main file locked. Created: ${fallbackPath}`);
  console.error(err.message);
}
