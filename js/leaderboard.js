import { API_URL } from "./config.js";
import { getLeaderboard } from "./api.js";

export async function updateLeaderboard() {
  try {
    const leaderboard = await getLeaderboard();

    const list = document.getElementById("leaderboardList");
    list.innerHTML = "";

    leaderboard.forEach(({ username, score, profilePic }, index) => {
      const item = document.createElement("div");
      item.className = "leaderboard-item";
      item.innerHTML = `
        <div class="leaderboard-user">
          <img class="leaderboard-pic" 
               src="${
                 profilePic
                   ? `${API_URL}${profilePic}`
                   : "assets/img/default-avatar.png"
               }" 
               alt="${username}'s avatar"
               onerror="this.src='assets/img/default-avatar.png'" />
          <span>${index + 1}. ${username}</span>
        </div>
        <span>${score}</span>
      `;
      list.appendChild(item);
    });
  } catch (error) {
    console.error("Failed to update leaderboard:", error);
  }
}
