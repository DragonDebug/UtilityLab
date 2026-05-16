const counterElement = document.getElementById("counter");
const incrementButton = document.getElementById("incrementBtn");

let count = 0;

incrementButton.addEventListener("click", () => {
  count += 1;
  counterElement.textContent = count;
});
