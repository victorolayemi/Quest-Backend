const fs = require('fs');
const content = fs.readFileSync('/Users/victor/Documents/Apps/bible-app/Backend/src/routes/media.ts', 'utf8');

// Regex to find prisma.<something>.(findMany|findUnique|findFirst|create|update|delete)
const regex = /prisma\.[a-zA-Z]+\.[a-zA-Z]+\(\{(?:[^{}]|{(?:[^{}]|{[^{}]*})*})*\}\)/g;
const matches = content.match(regex);

if (matches) {
    matches.forEach(m => console.log(m + '\n---'));
}
