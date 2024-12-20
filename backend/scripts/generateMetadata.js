const fs = require("fs").promises;
const path = require("path");

const gamePatterns = [
  { pattern: /Phoenix Wright/i, game: "Phoenix Wright: Ace Attorney" },
  {
    pattern: /Justice for All/i,
    game: "Phoenix Wright: Ace Attorney - Justice For All",
  },
  {
    pattern: /Trials and Tribulations/i,
    game: "Phoenix Wright: Ace Attorney - Trials and Tribulations",
  },
  { pattern: /Apollo Justice/i, game: "Apollo Justice: Ace Attorney" },
  {
    pattern: /Dual Destinies/i,
    game: "Phoenix Wright: Ace Attorney - Dual Destinies",
  },
  {
    pattern: /Spirit of Justice/i,
    game: "Phoenix Wright: Ace Attorney - Spirit of Justice",
  },
  { pattern: /Great Ace Attorney/i, game: "The Great Ace Attorney Chronicles" },
  {
    pattern: /Investigations/i,
    game: "Ace Attorney Investigations: Miles Edgeworth",
  },
];

const categoryPatterns = [
  { pattern: /(Cross-Examination|Pursuit|Objection)/i, category: "Court" },
  { pattern: /(Investigation|Search)/i, category: "Investigation" },
  { pattern: /Theme/i, category: "Character Theme" },
  { pattern: /(Victory|Won|Success)/i, category: "Victory" },
  { pattern: /(Suspense|Tension|Mystery)/i, category: "Suspense" },
  { pattern: /Lobby/i, category: "Lobby" },
];

async function generateMetadata() {
  try {
    const songsDir = path.join(__dirname, "..", "songs");
    const files = await fs.readdir(songsDir);
    const mp3Files = files.filter((file) => file.endsWith(".mp3"));

    const metadata = {};
    for (const file of mp3Files) {
      let game = "Unknown Game";
      let category = "Other";

      // Determine game
      for (const { pattern, game: gameName } of gamePatterns) {
        if (pattern.test(file)) {
          game = gameName;
          break;
        }
      }

      // Determine category
      for (const { pattern, category: catName } of categoryPatterns) {
        if (pattern.test(file)) {
          category = catName;
          break;
        }
      }

      // Generate clean title (remove game name, numbers, etc.)
      let cleanTitle = file
        .replace(/^\d+\s*-\s*/, "") // Remove leading numbers
        .replace(/.mp3$/, "") // Remove extension
        .replace(/Phoenix Wright -\s*/i, "") // Remove game prefix
        .replace(/Ace Attorney -\s*/i, "") // Remove game prefix
        .trim();

      metadata[file] = {
        game,
        category,
        alternateNames: [],
        cleanTitle,
      };
    }

    await fs.writeFile(
      path.join(songsDir, "metadata.json"),
      JSON.stringify(metadata, null, 2),
      "utf8"
    );

    console.log("Generated metadata.json successfully!");
    console.log(`Processed ${mp3Files.length} songs`);
  } catch (error) {
    console.error("Error generating metadata:", error);
  }
}

generateMetadata();
