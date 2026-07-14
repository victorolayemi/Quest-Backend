import fs from 'fs';

const urls = [
  "https://images.unsplash.com/photo-1504052434569-70ad5836ab65?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1490730141103-6cac27aaab94?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1493612276216-ee3925520721?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1506748686214-e9df14d4d9d0?auto=format&fit=crop&w=800&q=80"
];

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let urlIndex = 0;
  
  content = content.replace(/["']assets\/images\/[^"']*["']/g, () => {
    const url = urls[urlIndex % urls.length];
    urlIndex++;
    return `"${url}"`;
  });

  // Also replace the broken URL
  content = content.replace(/https:\/\/images\.unsplash\.com\/photo-1529156069898-49953eb1b5e4\?auto=format&fit=crop&w=800&q=80/g, urls[0]);
  
  fs.writeFileSync(filePath, content);
}

replaceInFile('prisma/seed-devotions.ts');
replaceInFile('prisma/seed.sql');
console.log('Seed files updated.');
