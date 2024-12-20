@echo off
setlocal EnableDelayedExpansion

REM Create temporary file in current directory instead of temp folder
set "tempjs=metadata_generator_temp.js"

(
  echo const fs = require('fs'^);
  echo const path = require('path'^);
  echo const readline = require('readline'^);
  echo.
  echo const games = [
  echo   'Phoenix Wright: Ace Attorney',
  echo   'Phoenix Wright: Ace Attorney - Justice For All',
  echo   'Phoenix Wright: Ace Attorney - Trials and Tribulations',
  echo   'Apollo Justice: Ace Attorney',
  echo   'Phoenix Wright: Ace Attorney - Dual Destinies',
  echo   'Phoenix Wright: Ace Attorney - Spirit of Justice',
  echo   'The Great Ace Attorney Chronicles',
  echo   'Ace Attorney Investigations: Miles Edgeworth'
  echo ];
  echo.
  echo const categoryPatterns = [
  echo   { pattern: /Cross-Examination^|Pursuit^|Objection/, category: 'Court' },
  echo   { pattern: /Investigation^|Search/, category: 'Investigation' },
  echo   { pattern: /Theme/, category: 'Character Theme' },
  echo   { pattern: /Victory^|Won^|Success/, category: 'Victory' },
  echo   { pattern: /Suspense^|Tension^|Mystery/, category: 'Suspense' },
  echo   { pattern: /Lobby/, category: 'Lobby' },
  echo   { pattern: /Reminiscence/, category: 'Reminiscence' }
  echo ];
  echo.
  echo function cleanTitle(filename^) {
  echo   let title = filename.replace(/.mp3$/, ''^);
  echo   title = title.replace(/^\d+[-.]?\d*\.\s*/, ''^);
  echo   return title.trim(^);
  echo }
  echo.
  echo const rl = readline.createInterface({ input: process.stdin, output: process.stdout }^);
  echo const currentDir = process.cwd(^);
  echo const files = fs.readdirSync(currentDir^);
  echo const mp3Files = files.filter(file =^> file.endsWith('.mp3'^)^);
  echo.
  echo if (mp3Files.length === 0^) {
  echo   console.log('No MP3 files found in current directory'^);
  echo   process.exit(0^);
  echo }
  echo.
  echo console.log('Available games:'^);
  echo games.forEach((game, index^) =^> console.log(`${index + 1}. ${game}`^)^);
  echo console.log('0. Other/Unknown Game'^);
  echo.
  echo rl.question('Select game number: ', answer =^> {
  echo   const gameIndex = parseInt(answer^);
  echo   const selectedGame = gameIndex === 0 ? 'Unknown Game' : games[gameIndex - 1];
  echo   const metadata = {};
  echo   for (const file of mp3Files^) {
  echo     let category = 'Other';
  echo     for (const {pattern, category: catName} of categoryPatterns^) {
  echo       if (pattern.test(file^)^) { category = catName; break; }
  echo     }
  echo     metadata[file] = {
  echo       game: selectedGame,
  echo       category,
  echo       alternateNames: [],
  echo       cleanTitle: cleanTitle(file^)
  echo     };
  echo   }
  echo   fs.writeFileSync(path.join(currentDir, 'metadata.json'^), JSON.stringify(metadata, null, 2^)^);
  echo   console.log('Generated metadata.json successfully!'^);
  echo   console.log(`Processed ${mp3Files.length} songs`^);
  echo   rl.close(^);
  echo }^);
) > "%~dp0%tempjs%"

node "%~dp0%tempjs%"
del "%~dp0%tempjs%"
pause