let audio = new Audio();
let isPlaying = false;
let animationFrame = null;
let audioTimeout = null;

export function setIsPlaying(value) {
  isPlaying = value;
}

export function getIsPlaying() {
  return isPlaying;
}

export function getAudio() {
  return audio;
}

export function setAudio(newAudio) {
  audio = newAudio;
}

export function stopAudio() {
  if (audio) {
    isPlaying = false;
    audio.pause();
    audio.currentTime = 0;
    resetProgressMarkers();

    if (audio.timeCheckInterval) {
      clearInterval(audio.timeCheckInterval);
      audio.timeCheckInterval = null;
    }

    if (audioTimeout) {
      clearTimeout(audioTimeout);
      audioTimeout = null;
    }

    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
  }
}

export function updateProgressBar() {
  if (!isPlaying) {
    cancelAnimationFrame(animationFrame);
    return;
  }

  const progressFill = document.querySelector(".progress-fill");
  const currentTime = audio.currentTime;
  const percentage = (currentTime / audio.duration) * 100;
  progressFill.style.width = `${percentage}%`;
  if (isPlaying) {
    animationFrame = requestAnimationFrame(updateProgressBar);
  }
}

export function resetProgressMarkers() {
  const progressFill = document.querySelector(".progress-fill");
  progressFill.style.width = "0";
}
