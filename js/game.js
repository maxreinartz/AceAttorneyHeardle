import { showMessage } from "./utils.js";
import {
  getAudio,
  setAudio,
  setIsPlaying,
  getIsPlaying,
  stopAudio,
  updateProgressBar,
  resetProgressMarkers,
} from "./audio.js";
import { updateLeaderboard } from "./leaderboard.js";
import { currentUser, updateUserScore, checkAuthentication } from "./user.js";
import { getRandomSong, getSongList, updateScore } from "./api.js";
import { API_URL, FEATURES } from "./config.js";

const games = [
  "Phoenix Wright: Ace Attorney",
  "Phoenix Wright: Ace Attorney - Justice For All",
  "Phoenix Wright: Ace Attorney - Trials and Tribulations",
  "Apollo Justice: Ace Attorney",
  "Phoenix Wright: Ace Attorney - Dual Destinies",
  "Phoenix Wright: Ace Attorney - Spirit of Justice",
  "The Great Ace Attorney Chronicles",
  "Ace Attorney Investigations: Miles Edgeworth",
];

let currentSong = null;
let _currentAttempt = 0;
let songList = [];
let useJapaneseTitle = false;
let enabledGames = new Set(
  JSON.parse(localStorage.getItem("enabledGames")) || [
    "Phoenix Wright: Ace Attorney",
    "Phoenix Wright: Ace Attorney - Justice For All",
    "Phoenix Wright: Ace Attorney - Trials and Tribulations",
    "The Great Ace Attorney Chronicles",
  ]
);

// Export currentSong as a getter to ensure it's always current
export const getCurrentSong = () => currentSong;
export const getCurrentAttempt = () => _currentAttempt;
export const setCurrentAttempt = (value) => {
  _currentAttempt = value;
};

export function setTitleMode(isJapanese) {
  useJapaneseTitle = isJapanese;
  localStorage.setItem("useJapaneseTitle", isJapanese);

  const input = document.getElementById("guessInput");
  const currentSong = getCurrentSong();
  if (currentSong) {
    input.placeholder =
      isJapanese && currentSong.alternateNames?.[0]
        ? "Enter Japanese title..."
        : "Enter English title...";
  }
}

export function checkGuess(input, song) {
  // Normalize strings by removing special characters and extra spaces
  const normalizeString = (str) => {
    return str
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ");
  };

  const cleanGuess = normalizeString(input);
  if (useJapaneseTitle) {
    const altName = song.alternateNames?.[0];
    if (altName) {
      return cleanGuess === normalizeString(altName);
    }
    return cleanGuess === normalizeString(song.title);
  } else {
    return cleanGuess === normalizeString(song.title);
  }
}

export async function initGame() {
  initTheme();
  initLivesDisplay();
  initTitleModeButtons();
  initGameFilters();
  try {
    const playButton = document.getElementById("playButton");
    const skipButton = document.getElementById("skipButton");
    playButton.disabled = true;
    skipButton.disabled = true;

    songList = await getSongList();
    const filteredSongs = songList.filter((song) =>
      enabledGames.has(song.game)
    );
    currentSong = await getRandomSong(
      filteredSongs.length === 0 ? null : [...enabledGames]
    );
    await setupSongSuggestions();

    playButton.disabled = false;
    skipButton.disabled = false;
  } catch (error) {
    console.error("Failed to load song:", error);
  }
}

export function initTheme() {
  const savedTheme = localStorage.getItem("theme") || "court";
  setTheme(savedTheme);
}

export function setTheme(theme) {
  document.body.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
}

export function initLivesDisplay() {
  const livesDisplay = document.querySelector(".lives-display");
  if (!livesDisplay) return;

  livesDisplay.innerHTML = "";

  for (let i = 0; i < 5; i++) {
    const attempt = document.createElement("div");
    attempt.className = "attempt";
    livesDisplay.appendChild(attempt);
  }
}

async function setupSongSuggestions() {
  const input = document.getElementById("guessInput");
  let container = document.querySelector(".song-suggestions");

  if (container) {
    container.remove();
  }

  container = document.createElement("div");
  container.className = "song-suggestions";
  container.style.display = "none";
  input.parentElement.appendChild(container);

  if (!songList.length) {
    try {
      songList = await getSongList();
    } catch (error) {
      console.error("Failed to load song list:", error);
      return;
    }
  }

  const updateSuggestions = (value) => {
    if (!value || value.length < 2) {
      container.style.display = "none";
      return;
    }

    // Filter songs by enabled games first
    const gameFilteredSongs = songList.filter((song) =>
      enabledGames.has(song.game)
    );

    // Then filter by search term
    const matches = gameFilteredSongs
      .filter((song) => {
        const searchValue = value.toLowerCase();
        if (useJapaneseTitle) {
          const altName = song.alternateNames?.[0]?.toLowerCase();
          if (altName) {
            return altName.includes(searchValue);
          }
          return song.title.toLowerCase().includes(searchValue);
        } else {
          return song.title.toLowerCase().includes(searchValue);
        }
      })
      .slice(0, 15);

    if (matches.length > 0) {
      container.style.display = "block";
      container.innerHTML = matches
        .map((song) => {
          const displayTitle =
            useJapaneseTitle && song.alternateNames?.[0]
              ? song.alternateNames[0]
              : song.title;
          return `<div class="song-suggestion">
            <div class="song-title">${displayTitle}</div>
          </div>`;
        })
        .join("");
    } else {
      container.style.display = "none";
    }
  };

  let debounceTimer;
  input.addEventListener("input", (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      updateSuggestions(e.target.value);
    }, 150);
  });

  container.addEventListener("click", (e) => {
    const suggestionEl = e.target.closest(".song-suggestion");
    if (suggestionEl) {
      input.value = suggestionEl.querySelector(".song-title").textContent;
      container.style.display = "none";
    }
  });

  document.addEventListener("click", (e) => {
    if (!input.contains(e.target) && !container.contains(e.target)) {
      container.style.display = "none";
    }
  });
}

export async function nextSong() {
  const playButton = document.getElementById("playButton");
  const skipButton = document.getElementById("skipButton");
  playButton.disabled = true;
  skipButton.disabled = true;

  const audio = getAudio();
  if (audio) {
    setIsPlaying(false);
    audio.pause();
    audio.src = "";
    audio.onended = null;
  }

  closeModal();
  setCurrentAttempt(0);
  resetProgressMarkers();

  document.querySelectorAll(".attempt").forEach((attempt) => {
    attempt.classList.remove("correct", "wrong", "skipped");
  });

  document.getElementById("guessInput").value = "";

  setAudio(new Audio());
  await initGame();

  playButton.disabled = false;
  skipButton.disabled = false;
}

function closeModal() {
  const modal = document.getElementById("resultModal");
  modal.classList.remove("show");
}

export async function playSegment() {
  if (!currentSong || !currentSong.segments || getCurrentAttempt() >= 5) return;

  const playButton = document.getElementById("playButton");
  const skipButton = document.getElementById("skipButton");
  playButton.disabled = true;
  skipButton.disabled = true;

  setIsPlaying(true);
  const base64Audio = currentSong.segments[getCurrentAttempt()];
  const audio = getAudio();
  audio.src = `data:audio/mp3;base64,${base64Audio}`;

  try {
    await audio.play();
    updateProgressBar();

    audio.onended = () => {
      setIsPlaying(false);
      playButton.disabled = false;
      skipButton.disabled = false;
      const progressFill = document.querySelector(".progress-fill");
      progressFill.style.width = "100%";
    };
  } catch (error) {
    console.error("Playback failed:", error);
    setIsPlaying(false);
    playButton.disabled = false;
    skipButton.disabled = false;
  }
}

export function showObjection() {
  const objection = document.getElementById("objection");
  if (!objection) return;

  objection.classList.remove("hidden");
  objection.classList.add("show");
  setTimeout(() => {
    objection.classList.remove("show");
    objection.classList.add("hidden");
  }, 2000);
}

export function updateAttempt(isCorrect, guessedGame, actualGame) {
  const currentAttempt = getCurrentAttempt();
  if (currentAttempt >= 5) return;

  const attempts = document.querySelectorAll(".lives-display .attempt");
  const currentAttemptEl = attempts[currentAttempt];

  if (
    !currentAttemptEl ||
    currentAttemptEl.classList.contains("correct") ||
    currentAttemptEl.classList.contains("wrong") ||
    currentAttemptEl.classList.contains("skipped")
  ) {
    return;
  }

  // Remove any existing class first
  currentAttemptEl.classList.remove(
    "correct",
    "wrong",
    "skipped",
    "correct-game",
    "wrong-game"
  );

  // Add the result class
  currentAttemptEl.classList.add(isCorrect ? "correct" : "wrong");

  // Add game match class if we have both games to compare
  if (guessedGame && actualGame) {
    const isGameMatch = guessedGame === actualGame;
    currentAttemptEl.classList.add(isGameMatch ? "correct-game" : "wrong-game");
  }

  setCurrentAttempt(currentAttempt + 1);
}

export async function showResults(won = true) {
  const modal = document.getElementById("resultModal");
  const title = document.getElementById("modalTitle");
  const text = document.getElementById("modalText");

  title.textContent = won ? "Congratulations!" : "Game Over";
  text.textContent = won
    ? "You guessed the song correctly!"
    : `The song was: ${currentSong.title}`;

  const audio = getAudio();
  setIsPlaying(false);
  audio.pause();
  audio.src = `${API_URL}/songs/${currentSong.file}`;
  try {
    await audio.play();
    setIsPlaying(true);
  } catch (error) {
    console.error("Failed to play full song:", error);
  }

  modal.classList.add("show");

  if (currentUser) {
    try {
      const isAuth = await checkAuthentication();
      if (isAuth) {
        await updateScore(currentUser, getCurrentAttempt(), won);
        await Promise.all([updateLeaderboard(), updateUserScore()]);
      }
    } catch (error) {
      console.error("Failed to update score:", error);
    }
  }
}

export function initTitleModeButtons() {
  const englishMode = document.getElementById("englishMode");
  const japaneseMode = document.getElementById("japaneseMode");
  const mobileEnglishMode = document.getElementById("mobileEnglishMode");
  const mobileJapaneseMode = document.getElementById("mobileJapaneseMode");

  const savedMode = localStorage.getItem("useJapaneseTitle") === "true";
  setTitleMode(savedMode);

  function updateButtons(isJapanese) {
    if (isJapanese) {
      japaneseMode?.classList.add("active");
      englishMode?.classList.remove("active");
      mobileJapaneseMode?.classList.add("active");
      mobileEnglishMode?.classList.remove("active");
    } else {
      englishMode?.classList.add("active");
      japaneseMode?.classList.remove("active");
      mobileEnglishMode?.classList.add("active");
      mobileJapaneseMode?.classList.remove("active");
    }
  }

  updateButtons(savedMode);

  // Desktop handlers
  englishMode?.addEventListener("click", () => {
    setTitleMode(false);
    updateButtons(false);
  });

  japaneseMode?.addEventListener("click", () => {
    setTitleMode(true);
    updateButtons(true);
  });

  // Mobile handlers
  mobileEnglishMode?.addEventListener("click", () => {
    setTitleMode(false);
    updateButtons(false);
  });

  mobileJapaneseMode?.addEventListener("click", () => {
    setTitleMode(true);
    updateButtons(true);
  });
}

document.getElementById("submitGuess").addEventListener("click", () => {
  const guessInput = document.getElementById("guessInput");
  const currentSong = getCurrentSong();

  if (!guessInput.value || !currentSong || getCurrentAttempt() >= 5) return;

  // Find the matching song from the full song list to get its game
  const guessedSong = songList.find((song) => {
    const normalizeString = (str) =>
      str
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, " ");
    const cleanGuess = normalizeString(guessInput.value);
    const cleanTitle = normalizeString(song.title);
    const cleanAltName = song.alternateNames?.[0]
      ? normalizeString(song.alternateNames[0])
      : "";

    return useJapaneseTitle
      ? cleanAltName && cleanGuess === cleanAltName
      : cleanGuess === cleanTitle;
  });

  const isCorrect = checkGuess(guessInput.value, currentSong);
  const guessedGame = guessedSong?.game || null;

  guessInput.value = "";
  updateAttempt(isCorrect, guessedGame, currentSong.game);

  if (isCorrect) {
    showObjection();
    setTimeout(() => showResults(true), 2500);
  } else if (getCurrentAttempt() >= 5) {
    showResults(false);
  }
});

export function initGameFilters() {
  // Check if container already exists and remove it
  const existingContainer = document.querySelector(".game-filters");
  if (existingContainer) {
    existingContainer.remove();
  }

  const filterContainer = document.createElement("div");
  filterContainer.className = "game-filters";
  filterContainer.innerHTML = `
    <div class="filter-popup hidden">
      <h3>Select Game Collection</h3>
      <div class="game-checkboxes">
        <div class="game-option ${
          enabledGames.has("Phoenix Wright: Ace Attorney") ? "selected" : ""
        }" data-collection="trilogy">
          Phoenix Wright Trilogy
        </div>
        <div class="game-option ${
          enabledGames.has("The Great Ace Attorney Chronicles")
            ? "selected"
            : ""
        }" data-collection="chronicles">
          The Great Ace Attorney Chronicles
        </div>
      </div>
    </div>
  `;

  document.querySelector(".theme-selector").after(filterContainer);

  const popup = filterContainer.querySelector(".filter-popup");
  const mobileToggleBtn = document.getElementById("mobileToggleFilters");
  const gameOptions = filterContainer.querySelectorAll(".game-option");

  const handleFilterClick = (e) => {
    e.stopPropagation();
    popup.classList.toggle("hidden");
  };

  mobileToggleBtn?.addEventListener("click", handleFilterClick);

  const trilogyGames = [
    "Phoenix Wright: Ace Attorney",
    "Phoenix Wright: Ace Attorney - Justice For All",
    "Phoenix Wright: Ace Attorney - Trials and Tribulations",
  ];

  const updateGames = async (option, collection) => {
    const isSelected = option.classList.toggle("selected");

    if (collection === "trilogy") {
      trilogyGames.forEach((game) => {
        if (isSelected) enabledGames.add(game);
        else enabledGames.delete(game);
      });
    } else if (collection === "chronicles") {
      if (isSelected) enabledGames.add("The Great Ace Attorney Chronicles");
      else enabledGames.delete("The Great Ace Attorney Chronicles");
    }

    // Ensure at least one collection is selected
    if (enabledGames.size === 0) {
      option.classList.add("selected");
      if (collection === "trilogy") {
        trilogyGames.forEach((game) => enabledGames.add(game));
      } else {
        enabledGames.add("The Great Ace Attorney Chronicles");
      }
    }

    localStorage.setItem("enabledGames", JSON.stringify([...enabledGames]));

    // Reset game state and get a new song
    await nextSong();
  };

  gameOptions.forEach((option) => {
    option.addEventListener("click", () => {
      updateGames(option, option.dataset.collection);
    });
  });

  document.addEventListener("click", (e) => {
    if (!filterContainer.contains(e.target)) {
      popup.classList.add("hidden");
    }
  });

  // Initialize the new track list
  initTrackList();
}

// Update track list initialization to handle mobile button
async function initTrackList() {
  const trackListContainer = document.createElement("div");
  trackListContainer.className = "track-list-container";
  document.body.appendChild(trackListContainer);

  // Create overlay first
  const overlay = document.createElement("div");
  overlay.className = "track-list-overlay";
  document.body.appendChild(overlay);

  // Rest of initialization
  trackListContainer.innerHTML = `
    <button id="showTrackList" class="filter-toggle desktop-only">View Track List</button>
    <div class="track-list-popup hidden" id="trackListPopup">
      <div class="track-list-header">
        <h3>Game Soundtracks</h3>
        <div class="track-list-controls">
          <button id="trackListEnglish" class="mode-button active">English</button>
          <button id="trackListJapanese" class="mode-button">Japanese</button>
        </div>
        <button class="close-button">×</button>
      </div>
      <div class="game-list"></div>
      <div class="song-list hidden"></div>
    </div>
  `;

  const popup = trackListContainer.querySelector(".track-list-popup");
  const showTrackListBtn = document.getElementById("showTrackList");
  const mobileShowTrackListBtn = document.getElementById("mobileShowTrackList");

  const handleTrackListClick = async (e) => {
    if (popup.classList.contains("hidden")) {
      popup.classList.remove("hidden");
      overlay.classList.add("show");
      try {
        const songs = await getSongList();
        const gameMap = new Map();

        songs.forEach((song) => {
          if (!gameMap.has(song.game)) {
            gameMap.set(song.game, []);
          }
          gameMap.get(song.game).push(song);
        });

        gameList.innerHTML = `
          <div class="game-items">
            ${Array.from(gameMap.keys())
              .map(
                (game) => `<div class="game-item" data-game="${game}">
                  ${game}
                  <span class="song-count">${
                    gameMap.get(game).length
                  } tracks</span>
                </div>`
              )
              .join("")}
          </div>
        `;

        gameList.querySelectorAll(".game-item").forEach((item) => {
          item.addEventListener("click", () => {
            const game = item.dataset.game;
            currentGame = game;
            currentGameSongs = gameMap.get(game);
            displaySongs(currentGameSongs, game);
          });
        });
      } catch (error) {
        console.error("Failed to load track list:", error);
        gameList.innerHTML = '<p class="error">Failed to load track list</p>';
      }
    } else {
      closeTrackList();
    }
    e.stopPropagation(); // Prevent event from reaching document click handler
  };

  // Add click handlers to both desktop and mobile buttons
  showTrackListBtn?.addEventListener("click", handleTrackListClick);
  mobileShowTrackListBtn?.addEventListener("click", handleTrackListClick);

  function closeTrackList() {
    popup.classList.add("hidden");
    overlay.classList.remove("show");
  }

  const closeBtn = popup.querySelector(".close-button");
  closeBtn.addEventListener("click", closeTrackList);

  overlay.addEventListener("click", closeTrackList);

  // Stop propagation of clicks inside popup
  popup.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  let currentGame = null;
  let currentGameSongs = null;

  const displaySongs = (songs, game) => {
    songList.innerHTML = `
      <div class="song-list-header">
        <button class="back-button">← Back</button>
        <h3>${game}</h3>
      </div>
      <div class="song-items">
        ${songs
          .map(
            (song) => `<div class="song-item" data-file="${song.file}">
              ${
                isJapanese && song.alternateNames?.[0]
                  ? song.alternateNames[0]
                  : song.title
              }
            </div>`
          )
          .join("")}
      </div>
    `;

    gameList.classList.add("hidden");
    songList.classList.remove("hidden");

    // Add click handlers for songs
    const songItems = songList.querySelectorAll(".song-item");
    let currentlyPlaying = null;

    songItems.forEach((item) => {
      item.addEventListener("click", async () => {
        if (!FEATURES.TRACKLIST_PLAYBACK) {
          // showMessage("Feature Disabled", "Song preview is currently disabled");
          return;
        }

        const file = item.dataset.file;
        const audio = getAudio();

        // Stop current playback if clicking same song
        if (currentlyPlaying === item) {
          audio.pause();
          audio.src = "";
          currentlyPlaying.classList.remove("playing");
          currentlyPlaying = null;
          return;
        }

        // Play the new song
        try {
          audio.src = `${API_URL}/songs/${file}`;
          await audio.play();
          item.classList.add("playing");
          currentlyPlaying = item;

          // Remove playing state when song ends
          audio.onended = () => {
            item.classList.remove("playing");
            currentlyPlaying = null;
          };
        } catch (error) {
          console.error("Failed to play song:", error);
        }
      });
    });

    songList.querySelector(".back-button").addEventListener("click", () => {
      const audio = getAudio();
      audio.pause();
      audio.src = "";
      songList.classList.add("hidden");
      gameList.classList.remove("hidden");
    });
  };

  const gameList = popup.querySelector(".game-list");
  const songList = popup.querySelector(".song-list");
  const englishBtn = document.getElementById("trackListEnglish");
  const japaneseBtn = document.getElementById("trackListJapanese");
  let isJapanese = false;

  // Language toggle handlers
  englishBtn.addEventListener("click", () => {
    isJapanese = false;
    englishBtn.classList.add("active");
    japaneseBtn.classList.remove("active");
    if (!songList.classList.contains("hidden")) {
      displaySongs(currentGameSongs, currentGame);
    }
  });

  japaneseBtn.addEventListener("click", () => {
    isJapanese = true;
    japaneseBtn.classList.add("active");
    englishBtn.classList.remove("active");
    if (!songList.classList.contains("hidden")) {
      displaySongs(currentGameSongs, currentGame);
    }
  });
}

export { songList };
