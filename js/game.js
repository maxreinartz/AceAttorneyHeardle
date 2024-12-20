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

// Export currentSong as a getter to ensure it's always current
export const getCurrentSong = () => currentSong;
export const getCurrentAttempt = () => _currentAttempt;
export const setCurrentAttempt = (value) => {
  _currentAttempt = value;
};

export async function initGame() {
  initTheme();
  initLivesDisplay();
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
      .filter((song) => song.title.toLowerCase().includes(value.toLowerCase()))
      .slice(0, 15);

    if (matches.length > 0) {
      container.style.display = "block";
      container.innerHTML = matches
        .map((song) => `<div class="song-suggestion">${song.title}</div>`)
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
    if (e.target.classList.contains("song-suggestion")) {
      input.value = e.target.textContent;
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
  objection.classList.remove("hidden");
  objection.classList.add("show");
  setTimeout(() => {
    objection.classList.remove("show");
    objection.classList.add("hidden");
  }, 2000);
}

export function updateAttempt(isCorrect, guessedGame, actualGame) {
  const attempts = document.querySelectorAll(".lives-display .attempt");
  const attempt = getCurrentAttempt();
  const currentAttemptEl = attempts[attempt];

  if (!currentAttemptEl.classList.contains("skipped")) {
    // Reset any existing game-related classes
    currentAttemptEl.classList.remove("correct-game", "wrong-game");

    // Add correct/wrong class for the song guess
    currentAttemptEl.classList.add(isCorrect ? "correct" : "wrong");

    // Add game match/mismatch indicator if we have both games to compare
    if (guessedGame && actualGame) {
      currentAttemptEl.classList.add(
        guessedGame === actualGame ? "correct-game" : "wrong-game"
      );
    }
  }
  setCurrentAttempt(attempt + 1);
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

export { songList };
