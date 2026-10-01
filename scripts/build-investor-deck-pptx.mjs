import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PptxGenJS from 'pptxgenjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const imagesDir = path.join(projectRoot, 'public', 'images', 'investor-deck');
const outputPath = path.join(imagesDir, 'XpressBNB-Investor-Deck.pptx');
const tempPath = path.join(imagesDir, 'XpressBNB-Investor-Deck.building.pptx');

const slideImages = [
  'investor-deck-01-problem.png',
  'investor-deck-02-solution.png',
  'investor-deck-03-business-model.png',
  'investor-deck-04-why-we-win.png',
  'investor-deck-05-vision.png',
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
pptx.subject = 'Investor Deck';
pptx.title = 'XpressBNB Investor Deck';

// 16:9 widescreen slide size in inches (LAYOUT_WIDE).
const slideW = 13.333;
const slideH = 7.5;

for (const file of slideImages) {
  const slide = pptx.addSlide();
  slide.background = { color: 'FFFFFF' };
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
  const fallbackPath = path.join(imagesDir, 'XpressBNB-Investor-Deck-latest.pptx');
  if (fs.existsSync(fallbackPath)) {
    fs.unlinkSync(fallbackPath);
  }
  fs.renameSync(tempPath, fallbackPath);
  console.log(`Main file locked. Created: ${fallbackPath}`);
  console.error(err.message);
}
