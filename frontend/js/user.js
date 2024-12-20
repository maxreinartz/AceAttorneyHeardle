import { API_URL } from "./config.js";
import { updateLeaderboard } from "./leaderboard.js";
import { showMessage } from "./utils.js";
import { getUserScore, getUserStats, verifySession } from "./api.js";

export let currentUser = null;

export async function checkAuthentication() {
  const savedUser = localStorage.getItem("user");
  const savedAuth = localStorage.getItem("auth");

  if (!savedUser || !savedAuth) {
    return false;
  }

  try {
    const data = await verifySession(savedUser, savedAuth);
    return data.verified;
  } catch (error) {
    console.error("Authentication check failed:", error);
    return false;
  }
}

export async function updateUserScore() {
  if (!currentUser) return;

  try {
    // Skip score update if not authenticated
    const isAuth = await checkAuthentication();
    if (!isAuth) {
      console.log("Not authenticated, skipping score update");
      return;
    }

    const { score } = await getUserScore(currentUser);
    const accountScore = document.getElementById("accountScore");
    if (score !== undefined) {
      accountScore.textContent = `Score: ${score}`;
      accountScore.classList.remove("hidden");
    }
  } catch (error) {
    if (error.message.includes("Authentication")) {
      console.log("Authentication failed, clearing session");
      await saveSession(null, null);
      document.getElementById("accountScore").classList.add("hidden");
    }
  }
}

export async function updateUserStats() {
  if (!currentUser) return;

  try {
    const stats = await getUserStats(currentUser);
    if (stats.error) return;

    document.getElementById("gamesPlayed").textContent = stats.gamesPlayed;
    document.getElementById("winRate").textContent = `${
      Math.round((stats.gamesWon / stats.gamesPlayed) * 100) || 0
    }%`;
    document.getElementById("currentStreak").textContent = stats.winStreak;
    document.getElementById("bestStreak").textContent = stats.bestStreak;

    // Update distribution display including losses
    const distributionContainer = document.getElementById("guessDistribution");
    distributionContainer.innerHTML = "";

    // Calculate maximum value for scaling and get the available width
    const allCounts = [...stats.distribution, stats.gamesLost];
    const maxCount = Math.max(...allCounts);
    const container = document.getElementById("guessDistribution");
    const availableWidth = container.offsetWidth - 100; // Subtract space for labels and padding

    // Helper function to calculate width percentage
    const getWidthPercent = (count) => {
      if (count === 0) return 1; // Minimum 1% width for empty bars
      return Math.max(5, (count / maxCount) * 100); // At least 5% width, scale up to 100%
    };

    // Add guesses distribution (1-5 attempts)
    stats.distribution.forEach((count, index) => {
      const bar = document.createElement("div");
      bar.className = "distribution-bar";
      const widthPercent = getWidthPercent(count);
      bar.innerHTML = `
        <span class="distribution-label">${index + 1}</span>
        <div class="distribution-fill" style="width: ${widthPercent}%"></div>
        <span class="distribution-value">${count}</span>
      `;
      distributionContainer.appendChild(bar);
    });

    // Add losses distribution if available
    if (stats.gamesLost > 0) {
      const widthPercent = getWidthPercent(stats.gamesLost);
      const lossBar = document.createElement("div");
      lossBar.className = "distribution-bar loss";
      lossBar.innerHTML = `
        <span class="distribution-label">✕</span>
        <div class="distribution-fill loss" style="width: ${widthPercent}%"></div>
        <span class="distribution-value">${stats.gamesLost}</span>
      `;
      distributionContainer.appendChild(lossBar);
    }

    // Update width calculation in resize handler
    const updateWidths = () => {
      const bars = container.querySelectorAll(".distribution-fill");
      bars.forEach((bar, index) => {
        const count = index < 5 ? stats.distribution[index] : stats.gamesLost;
        const widthPercent = getWidthPercent(count);
        bar.style.width = `${widthPercent}%`;
      });
    };

    // Cleanup old listener if exists
    if (window.updateDistributionWidths) {
      window.removeEventListener("resize", window.updateDistributionWidths);
    }
    window.updateDistributionWidths = updateWidths;
    window.addEventListener("resize", updateWidths);
  } catch (error) {
    console.error("Failed to update user stats:", error);
  }
}

export function updateAccountButton() {
  const accountUsername = document.getElementById("accountUsername");
  const accountScore = document.getElementById("accountScore");
  const accountDetailsOverlay = document.getElementById(
    "accountDetailsOverlay"
  );

  if (currentUser) {
    accountUsername.textContent = currentUser;
    // Don't throw errors if score update fails
    updateUserScore().catch(() => {
      accountScore.classList.add("hidden");
    });
  } else {
    accountUsername.textContent = "Account";
    accountScore.classList.add("hidden");
    accountDetailsOverlay.classList.remove("show");
  }
}

export function initializeAccountUI() {
  const accountButton = document.getElementById("accountButton");
  const accountDetailsOverlay = document.getElementById(
    "accountDetailsOverlay"
  );
  const accountDetails = document.getElementById("accountDetails");

  accountButton.addEventListener("click", async () => {
    if (!currentUser) {
      document.getElementById("accountModal").classList.add("show");
      return;
    }

    try {
      const data = await verifySession(
        currentUser,
        localStorage.getItem("auth")
      );
      if (data.verified) {
        // Update all user information at once
        await Promise.all([updateUserScore(), updateUserStats()]);

        // Show the popup
        accountDetailsOverlay.classList.add("show");
        accountDetails.classList.remove("hidden");

        // Update profile picture
        if (data.profilePicUrl) {
          document.getElementById(
            "userProfilePic"
          ).src = `${API_URL}${data.profilePicUrl}`;
        }
      }
    } catch (error) {
      console.error("Failed to load account details:", error);
      showMessage(
        "Error",
        "Failed to load account details. Please try logging in again."
      );
      await saveSession(null, null);
      updateAccountButton();
    }
  });

  // Add profile picture upload handling
  const profileUpload = document.getElementById("profileUpload");
  profileUpload.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Show loading state
    const profilePic = document.getElementById("userProfilePic");
    profilePic.classList.add("loading");

    try {
      const formData = new FormData();
      formData.append("profilePic", file);
      formData.append("username", currentUser);

      console.log("Uploading file:", file.name, "size:", file.size);

      const response = await fetch(`${API_URL}/api/profile-pic`, {
        method: "POST",
        headers: {
          username: localStorage.getItem("user"),
          hashedpassword: localStorage.getItem("auth"),
        },
        body: formData,
      });

      console.log("Upload response status:", response.status);
      const data = await response.json();
      console.log("Upload response data:", data);

      if (!response.ok) {
        throw new Error(data.error || "Failed to upload profile picture");
      }

      // Update profile picture
      profilePic.src = `${API_URL}${data.profilePicUrl}`;
      showMessage("Success", "Profile picture updated successfully!");
    } catch (error) {
      console.error("Profile picture upload error:", error);
      showMessage(
        "Error",
        `Failed to upload profile picture: ${error.message}`
      );
    } finally {
      profilePic.classList.remove("loading");
      // Reset the input to allow uploading the same file again
      profileUpload.value = "";
    }
  });

  accountDetailsOverlay.addEventListener("click", (e) => {
    if (e.target === accountDetailsOverlay) {
      accountDetailsOverlay.classList.remove("show");
      accountDetails.classList.add("hidden");
    }
  });
}

export async function saveSession(username, hashedPassword) {
  if (username && hashedPassword) {
    localStorage.setItem("user", username);
    localStorage.setItem("auth", hashedPassword);
    currentUser = username;
  } else {
    localStorage.removeItem("user");
    localStorage.removeItem("auth");
    currentUser = null;
  }
}

export async function loadSession() {
  const savedUser = localStorage.getItem("user");
  const savedAuth = localStorage.getItem("auth");

  if (!savedUser || !savedAuth) {
    await saveSession(null, null);
    return false;
  }

  try {
    const data = await verifySession(savedUser, savedAuth);
    if (data.verified) {
      currentUser = savedUser;
      updateAccountButton();
      return true;
    }
  } catch (error) {
    console.error("Session verification failed:", error);
  }

  // Clear invalid session
  await saveSession(null, null);
  return false;
}

export async function showUserProfile(username) {
  try {
    const [stats, scores] = await Promise.all([
      getUserStats(username),
      getUserScore(username),
    ]);

    const popup = document.getElementById("accountDetails").cloneNode(true);
    popup.id = "userProfile";

    // Update content
    popup.querySelector("h3").textContent = username;
    popup.querySelector("p").textContent = `Score: ${scores.score || 0}`;

    // Update stats
    if (stats) {
      popup.querySelector("#gamesPlayed").textContent = stats.gamesPlayed;
      popup.querySelector("#winRate").textContent = `${
        Math.round((stats.gamesWon / stats.gamesPlayed) * 100) || 0
      }%`;
      popup.querySelector("#currentStreak").textContent = stats.winStreak;
      popup.querySelector("#bestStreak").textContent = stats.bestStreak;

      // Update distribution
      const distributionContainer = popup.querySelector("#guessDistribution");
      // ... (keep existing distribution code)
    }

    // Remove account actions section
    const actionsSection = popup.querySelector(".account-actions");
    if (actionsSection) actionsSection.remove();

    // Add close button
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "Close";
    closeBtn.onclick = () => {
      document.getElementById("accountDetailsOverlay").classList.remove("show");
      popup.remove();
    };
    popup.appendChild(closeBtn);

    // Show popup
    const overlay = document.getElementById("accountDetailsOverlay");
    overlay.innerHTML = "";
    overlay.appendChild(popup);
    overlay.classList.add("show");
    popup.classList.remove("hidden");
  } catch (error) {
    console.error("Failed to load user profile:", error);
    showMessage("Error", "Failed to load user profile");
  }
}
