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
import { API_URL } from "./config.js";

let currentSong = null;
let _currentAttempt = 0;
let songList = [];
let useJapaneseTitle = false;

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
  const cleanGuess = input.toLowerCase().trim();
  if (useJapaneseTitle) {
    const altName = song.alternateNames?.[0]?.toLowerCase().trim();
    return altName && cleanGuess === altName;
  } else {
    const cleanTitle = song.title.toLowerCase().trim();
    return cleanGuess === cleanTitle;
  }
}

export async function initGame() {
  initTheme();
  initLivesDisplay();
  initTitleModeButtons();
  try {
    const playButton = document.getElementById("playButton");
    const skipButton = document.getElementById("skipButton");
    playButton.disabled = true;
    skipButton.disabled = true;

    songList = await getSongList();
    currentSong = await getRandomSong();
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

    const matches = songList
      .filter((song) => {
        const searchValue = value.toLowerCase();
        if (useJapaneseTitle) {
          const altName = song.alternateNames?.[0]?.toLowerCase();
          return altName && altName.includes(searchValue);
        } else {
          return song.title.toLowerCase().includes(searchValue);
        }
      })
      .slice(0, 15);

    if (matches.length > 0) {
      container.style.display = "block";
      container.innerHTML = matches
        .map((song) => {
          const displayTitle = useJapaneseTitle
            ? song.alternateNames?.[0]
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

  currentAttemptEl.classList.remove("correct-game", "wrong-game");
  currentAttemptEl.classList.add(isCorrect ? "correct" : "wrong");

  if (guessedGame && actualGame) {
    currentAttemptEl.classList.add(
      guessedGame === actualGame ? "correct-game" : "wrong-game"
    );
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

  const savedMode = localStorage.getItem("useJapaneseTitle") === "true";
  setTitleMode(savedMode);
  if (savedMode) {
    japaneseMode.classList.add("active");
    englishMode.classList.remove("active");
  } else {
    englishMode.classList.add("active");
    japaneseMode.classList.remove("active");
  }

  englishMode.addEventListener("click", () => {
    englishMode.classList.add("active");
    japaneseMode.classList.remove("active");
    setTitleMode(false);
  });

  japaneseMode.addEventListener("click", () => {
    japaneseMode.classList.add("active");
    englishMode.classList.remove("active");
    setTitleMode(true);
  });
}

document.getElementById("submitGuess").addEventListener("click", () => {
  const guessInput = document.getElementById("guessInput");
  const guess = guessInput.value.toLowerCase().trim();
  const currentSong = getCurrentSong();

  if (!guess || !currentSong || getCurrentAttempt() >= 5) return;

  // Get list of all valid titles for the current song
  const validTitles = [currentSong.title.toLowerCase().trim()];

  if (currentSong.alternateNames?.[0]) {
    validTitles.push(currentSong.alternateNames[0].toLowerCase().trim());
  }

  // Only check the relevant title based on language mode
  const isCorrect = useJapaneseTitle
    ? currentSong.alternateNames?.[0]?.toLowerCase().trim() === guess
    : currentSong.title.toLowerCase().trim() === guess;

  guessInput.value = "";
  updateAttempt(isCorrect, currentSong.game, currentSong.game);

  if (isCorrect) {
    showObjection();
    setTimeout(() => showResults(true), 2500);
  } else if (getCurrentAttempt() >= 5) {
    showResults(false);
  }
});

export { songList };
