import {
  initGame,
  playSegment,
  showObjection,
  updateAttempt,
  showResults,
  getCurrentSong,
  getCurrentAttempt,
  setCurrentAttempt,
  nextSong,
  setTheme,
  songList, // Add this import
} from "./game.js";
import {
  loadSession,
  currentUser,
  saveSession,
  updateAccountButton,
  initializeAccountUI,
  checkAuthentication,
  showUserProfile, // Add this import
} from "./user.js";
import { updateLeaderboard } from "./leaderboard.js";
import {
  loginUser,
  signupUser,
  deleteAccount,
  verifySession,
  updateScore,
} from "./api.js";
import { showMessage } from "./utils.js";
import { API_URL } from "./config.js";

function initializeEventListeners() {
  // Theme handlers
  window.setTheme = setTheme;
  window.showLogin = () => {
    document.getElementById("loginForm").classList.remove("hidden");
    document.getElementById("signupForm").classList.add("hidden");
    document.getElementById("accountButtons").classList.add("hidden");
  };
  window.showSignup = () => {
    document.getElementById("loginForm").classList.add("hidden");
    document.getElementById("signupForm").classList.remove("hidden");
    document.getElementById("accountButtons").classList.add("hidden");
  };

  // Account button handlers
  document.getElementById("accountButton").addEventListener("click", () => {
    if (currentUser) {
      const detailsPopup = document.getElementById("accountDetails");
      const detailsUsername = document.getElementById("detailsUsername");
      const detailsScore = document.getElementById("detailsScore");

      detailsUsername.textContent = currentUser;
      detailsScore.textContent =
        document.getElementById("accountScore").textContent;
      detailsPopup.classList.toggle("hidden");
    } else {
      document.getElementById("accountModal").classList.add("show");
    }
  });

  // Login handler
  document.getElementById("loginButton").addEventListener("click", async () => {
    const username = document.getElementById("loginUsername").value;
    const password = document.getElementById("loginPassword").value;

    try {
      const data = await loginUser(username, password);
      if (data.error) {
        showMessage("Error", data.error);
        return;
      }

      await saveSession(username, data.hashedPassword);
      document.getElementById("accountModal").classList.remove("show");
      showMessage("Success", "Logged in successfully!");
      await updateLeaderboard();
      updateAccountButton();
    } catch (error) {
      showMessage("Error", "Failed to log in");
    }
  });

  // Signup handler
  document
    .getElementById("signupButton")
    .addEventListener("click", async () => {
      const username = document.getElementById("signupUsername").value;
      if (!username) {
        showMessage("Error", "Please enter a username");
        return;
      }

      try {
        const data = await signupUser(username);
        if (data.error) {
          showMessage("Error", data.error);
          return;
        }

        await saveSession(username, data.hashedPassword);
        document.getElementById("accountModal").classList.remove("show");

        const passwordModal = document.getElementById("passwordModal");
        document.getElementById("passwordDisplay").textContent = data.password;
        passwordModal.classList.add("show");

        document.getElementById("passwordConfirmButton").onclick = () => {
          passwordModal.classList.remove("show");
          updateLeaderboard();
        };
        updateAccountButton();
      } catch (error) {
        showMessage("Error", "Failed to create account");
      }
    });

  // Game controls
  document.getElementById("playButton").addEventListener("click", playSegment);
  document.getElementById("nextSongButton").addEventListener("click", nextSong);

  document.getElementById("skipButton").addEventListener("click", () => {
    const attempts = document.querySelectorAll(".attempt");
    const currentAttempt = getCurrentAttempt();
    attempts[currentAttempt].classList.add("skipped");
    setCurrentAttempt(currentAttempt + 1);

    if (getCurrentAttempt() < 5) {
      playSegment();
    } else {
      showResults(false);
    }
  });

  // Logout handler
  document
    .getElementById("logoutButton")
    .addEventListener("click", async () => {
      await saveSession(null, null);
      updateAccountButton();
      document.getElementById("accountDetails").classList.add("hidden");
      showMessage("Success", "Logged out successfully!");
      await updateLeaderboard();
    });

  // Delete account handler
  document
    .getElementById("deleteAccountButton")
    .addEventListener("click", () => {
      document.getElementById("deleteConfirmModal").classList.add("show");
    });

  document
    .getElementById("confirmDeleteButton")
    .addEventListener("click", async () => {
      const password = document.getElementById("deletePassword").value;
      if (!password || !currentUser) return;

      try {
        const data = await deleteAccount(currentUser, password);
        if (data.error) {
          showMessage("Error", data.error);
          return;
        }

        await saveSession(null, null);
        document.getElementById("deleteConfirmModal").classList.remove("show");
        document.getElementById("accountDetails").classList.add("hidden");
        showMessage("Success", "Account deleted successfully");
        await updateLeaderboard();
      } catch (error) {
        showMessage("Error", "Failed to delete account");
      }
    });

  // Add search functionality
  const searchButton = document.getElementById("searchButton");
  const searchModal = document.getElementById("searchModal");
  const searchInput = document.getElementById("searchInput");
  const searchResults = document.getElementById("searchResults");
  const closeSearchButton = document.getElementById("closeSearchButton");

  searchButton.addEventListener("click", () => {
    searchModal.classList.add("show");
    searchInput.value = "";
    searchResults.innerHTML = "";
  });

  closeSearchButton.addEventListener("click", () => {
    searchModal.classList.remove("show");
  });

  let searchTimeout;
  searchInput.addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      const query = e.target.value.trim();
      if (query.length < 2) {
        searchResults.innerHTML = "";
        return;
      }

      try {
        const response = await fetch(
          `${API_URL}/api/search-users?query=${encodeURIComponent(query)}`
        );
        const users = await response.json();

        searchResults.innerHTML = users
          .map(
            (user) => `
          <div class="search-result">
            <img src="${user.profilePic || "assets/img/default-avatar.png"}" 
                 alt="${user.username}'s avatar"
                 onerror="this.src='assets/img/default-avatar.png'">
            <div class="user-info">
              <div class="username">${user.username}</div>
              <div class="stats">
                Score: ${user.score} • Games: ${user.stats.gamesPlayed} • 
                Wins: ${user.stats.gamesWon} • Streak: ${user.stats.winStreak}
              </div>
            </div>
          </div>
        `
          )
          .join("");
      } catch (error) {
        console.error("Search failed:", error);
        searchResults.innerHTML =
          "<div class='search-error'>Failed to search users</div>";
      }
    }, 300);
  });

  // Add click handler for search results
  searchResults.addEventListener("click", (e) => {
    const searchResult = e.target.closest(".search-result");
    if (searchResult) {
      const username = searchResult.querySelector(".username").textContent;
      showUserProfile(username);
      searchModal.classList.remove("show");
    }
  });

  // Add click handler for leaderboard items
  document.getElementById("leaderboardList").addEventListener("click", (e) => {
    const leaderboardItem = e.target.closest(".leaderboard-item");
    if (leaderboardItem) {
      const username = leaderboardItem.querySelector(
        ".leaderboard-user span"
      ).textContent;
      showUserProfile(username);
    }
  });

  // Add mobile button handlers
  document
    .getElementById("mobileAccountButton")
    .addEventListener("click", () => {
      const accountButton = document.getElementById("accountButton");
      if (accountButton) {
        accountButton.click();
      }
    });

  document
    .getElementById("mobileSearchButton")
    .addEventListener("click", () => {
      const searchButton = document.getElementById("searchButton");
      if (searchButton) {
        searchButton.click();
      }
    });
}

// ...existing code...

const updateSuggestions = (value) => {
  if (!value || value.length < 2) {
    container.style.display = "none";
    return;
  }

  const matches = songList
    .filter((song) => {
      const cleanTitle = song.title.toLowerCase();
      const altName = song.alternateNames?.[0]?.toLowerCase();
      const searchValue = value.toLowerCase();
      return (
        cleanTitle.includes(searchValue) ||
        (altName && altName.includes(searchValue))
      );
    })
    .slice(0, 15);

  if (matches.length > 0) {
    container.style.display = "block";
    container.innerHTML = matches
      .map((song) => {
        const altName = song.alternateNames?.[0];
        return `<div class="song-suggestion">
          <div class="song-title">${song.title}</div>
          ${altName ? `<div class="song-alt-name">${altName}</div>` : ""}
        </div>`;
      })
      .join("");
  } else {
    container.style.display = "none";
  }
};

async function initializeApp() {
  try {
    await loadSession(); // Load session first
    initializeAccountUI(); // Then initialize UI
    initializeEventListeners(); // Then event listeners

    const isAuthenticated = await checkAuthentication();
    if (!isAuthenticated) {
      await saveSession(null, null);
      updateAccountButton();
    }

    await initGame(); // Finally initialize game
    await updateLeaderboard();
  } catch (error) {
    console.error("Failed to initialize app:", error);
    showMessage(
      "Error",
      "Failed to initialize application. Please refresh the page."
    );
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // Remove the beforeunload event listener
  initializeApp().catch((error) => {
    console.error("App initialization error:", error);
    showMessage(
      "Error",
      "Failed to initialize application. Please refresh the page."
    );
  });
});
