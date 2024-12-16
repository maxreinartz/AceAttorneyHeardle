import { API_URL } from "./config.js";

// Update the fetch options helper
function getFetchOptions(method = "GET", body = null, needsAuth = false) {
  const options = {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (needsAuth) {
    const user = localStorage.getItem("user");
    const auth = localStorage.getItem("auth");
    if (!user || !auth) {
      throw new Error("Authentication required");
    }
    // Fix header names to match what the server expects
    options.headers["username"] = user;
    options.headers["hashedpassword"] = auth;
  }

  if (body) {
    options.body = JSON.stringify(body);
  }

  return options;
}

export async function getUserScore(username) {
  try {
    const response = await fetch(
      `${API_URL}/api/user-score/${username}`,
      getFetchOptions("GET", null, true)
    );

    if (response.status === 401) {
      throw new Error("Authentication required");
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get user score");
    }

    return await response.json();
  } catch (error) {
    console.error("Score fetch error:", error);
    throw error;
  }
}

export async function updateScore(username, attempt, success) {
  try {
    const response = await fetch(
      `${API_URL}/api/score`,
      getFetchOptions("POST", { username, attempt, success }, true)
    );
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update score");
    }
    return await response.json();
  } catch (error) {
    console.error("Score update error:", error);
    throw error;
  }
}

export async function getUserStats(username) {
  try {
    const response = await fetch(
      `${API_URL}/api/stats/${username}`,
      getFetchOptions("GET", null, true)
    );
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get user stats");
    }
    return await response.json();
  } catch (error) {
    console.error("Stats fetch error:", error);
    throw error;
  }
}

export async function deleteAccount(username, password) {
  try {
    const response = await fetch(
      `${API_URL}/api/delete-account`,
      getFetchOptions("DELETE", { username, password }, true)
    );
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete account");
    }
    return await response.json();
  } catch (error) {
    console.error("Account deletion error:", error);
    throw error;
  }
}

export async function uploadProfilePicture(username, file) {
  const formData = new FormData();
  formData.append("profilePic", file);
  formData.append("username", username);

  const headers = {
    username: localStorage.getItem("user"),
    hashedPassword: localStorage.getItem("auth"),
  };

  try {
    const response = await fetch(`${API_URL}/api/profile-pic`, {
      method: "POST",
      headers,
      body: formData,
      credentials: "include",
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to upload profile picture");
    }
    return await response.json();
  } catch (error) {
    console.error("Profile picture upload error:", error);
    throw error;
  }
}

export async function loginUser(username, password) {
  try {
    const response = await fetch(
      `${API_URL}/api/login`,
      getFetchOptions("POST", { username, password })
    );
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to login");
    }
    return await response.json();
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
}

export async function signupUser(username) {
  try {
    const response = await fetch(
      `${API_URL}/api/signup`,
      getFetchOptions("POST", { username })
    );
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to signup");
    }
    return await response.json();
  } catch (error) {
    console.error("Signup error:", error);
    throw error;
  }
}

export async function getRandomSong() {
  try {
    const response = await fetch(`${API_URL}/api/random-song`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get random song");
    }
    return await response.json();
  } catch (error) {
    console.error("Random song fetch error:", error);
    throw error;
  }
}

export async function getSongList() {
  try {
    const response = await fetch(`${API_URL}/api/songs`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get song list");
    }
    return await response.json();
  } catch (error) {
    console.error("Song list fetch error:", error);
    throw error;
  }
}

export async function verifySession(username, hashedPassword) {
  try {
    const response = await fetch(
      `${API_URL}/api/verify`,
      getFetchOptions("POST", { username, hashedPassword })
    );
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to verify session");
    }
    return await response.json();
  } catch (error) {
    console.error("Session verification error:", error);
    throw error;
  }
}

export async function getLeaderboard() {
  try {
    const response = await fetch(`${API_URL}/api/leaderboard`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get leaderboard");
    }
    return await response.json();
  } catch (error) {
    console.error("Leaderboard fetch error:", error);
    throw error;
  }
}
