export function showMessage(title, message) {
  const modal = document.getElementById("resultModal").cloneNode(true);
  modal.id = "messageModal";
  modal.querySelector(".modal-title").textContent = title;
  modal.querySelector(".modal-text").textContent = message;
  const button = modal.querySelector(".modal-button");
  button.textContent = "OK";
  button.onclick = () => document.body.removeChild(modal);
  document.body.appendChild(modal);
  modal.classList.add("show");
}
