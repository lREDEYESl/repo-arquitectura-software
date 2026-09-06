(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;

  function typewriter(el) {
    if (!el || reduceMotion) return;
    const text = el.textContent.replace(/\s+/g, " ").trim();
    if (!text) return;
    el.setAttribute("aria-label", text);
    el.textContent = "";
    el.classList.add("rpg-typewriter");
    let i = 0;
    const step = () => {
      i += 1;
      el.textContent = text.slice(0, i);
      if (i < text.length) {
        window.setTimeout(step, 32);
      } else {
        el.classList.add("rpg-typewriter-done");
      }
    };
    step();
  }

  function enterStage() {
    const nodes = document.querySelectorAll(
      ".hero, .mission, .level, .form-box, .glass-card, .card, .panel, .quest-card"
    );
    nodes.forEach((el, index) => {
      if (el.dataset.rpgEnter === "1") return;
      el.dataset.rpgEnter = "1";
      if (reduceMotion) return;
      el.classList.add("rpg-enter");
      el.style.animationDelay = `${Math.min(index, 12) * 70}ms`;
    });
  }

  function spawnRipple(event, target) {
    if (reduceMotion) return;
    const rect = target.getBoundingClientRect();
    target.classList.add("rpg-ripple-host", "rpg-hit");
    const ripple = document.createElement("span");
    ripple.className = "rpg-ripple";
    ripple.style.left = `${event.clientX - rect.left}px`;
    ripple.style.top = `${event.clientY - rect.top}px`;
    target.appendChild(ripple);
    window.setTimeout(() => ripple.remove(), 560);
    window.setTimeout(() => target.classList.remove("rpg-hit"), 220);
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (finePointer) document.documentElement.classList.add("rpg-cursor");
    typewriter(document.querySelector("main.page-wrap h1"));
    enterStage();
  });

  document.addEventListener("click", (event) => {
    const target = event.target.closest(".nav-links a, .nav-links button, .btn, button.nav-toggle");
    if (!target) return;
    spawnRipple(event, target);
  });

  const tasks = document.querySelectorAll(".tasks");
  if (tasks.length && "MutationObserver" in window) {
    const observer = new MutationObserver(enterStage);
    tasks.forEach((node) => observer.observe(node, { childList: true, subtree: true }));
  }
})();
