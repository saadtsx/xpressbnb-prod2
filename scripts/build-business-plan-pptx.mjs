import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PptxGenJS from 'pptxgenjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const imagesDir = path.join(projectRoot, 'public', 'images', 'business-plan');
const outputPath = path.join(imagesDir, 'XpressBNB-Business-Plan.pptx');
const tempPath = path.join(imagesDir, 'XpressBNB-Business-Plan.building.pptx');

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
pptx.subject = 'Business Plan';
pptx.title = 'XpressBNB — Business Plan';

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
  const fallbackPath = path.join(imagesDir, 'XpressBNB-Business-Plan-latest.pptx');
  if (fs.existsSync(fallbackPath)) {
    fs.unlinkSync(fallbackPath);
  }
  fs.renameSync(tempPath, fallbackPath);
  console.log(`Main file locked. Created: ${fallbackPath}`);
  console.error(err.message);
}
