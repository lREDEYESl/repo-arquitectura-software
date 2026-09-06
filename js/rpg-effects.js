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

  // ── Boot sequence (index character card) ──────────────────────────
  function runBootSequence() {
    const boot = document.getElementById("boot-screen");
    if (!boot) return;
    if (reduceMotion) {
      boot.classList.add("boot-skip");
      return;
    }
    window.setTimeout(() => boot.classList.add("boot-skip"), 2300);
  }

  // ── HP bar fill (character card stat block) ────────────────────────
  function animateHpBars() {
    document.querySelectorAll(".hp-fill[data-target]").forEach((bar) => {
      const target = Math.max(0, Math.min(100, Number(bar.dataset.target) || 0));
      if (reduceMotion) {
        bar.style.width = `${target}%`;
        return;
      }
      window.requestAnimationFrame(() => {
        window.setTimeout(() => {
          bar.style.width = `${target}%`;
        }, 250);
      });
    });
  }

  // ── Number counters (HP value, mission/achievement totals) ─────────
  function animateCounter(el) {
    const target = Number(el.dataset.target) || 0;
    if (reduceMotion || target <= 0) {
      el.textContent = String(target);
      return;
    }
    const duration = 700;
    const start = performance.now();
    const step = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      el.textContent = String(Math.round(progress * target));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }

  // ── Scroll reveal for new index sections (.reveal) ─────────────────
  function initScrollReveal() {
    const revealNodes = document.querySelectorAll(".reveal");
    if (!revealNodes.length) return;

    if (reduceMotion || !("IntersectionObserver" in window)) {
      revealNodes.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const io = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          entry.target.querySelectorAll("[data-counter]").forEach(animateCounter);
          if (entry.target.hasAttribute("data-counter")) {
            animateCounter(entry.target);
          }
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.2, rootMargin: "0px 0px -8% 0px" }
    );

    revealNodes.forEach((el) => io.observe(el));
  }

  // Counters outside any .reveal section (e.g. inside the hero character
  // card, which is visible immediately) animate right away.
  function animateStandaloneCounters() {
    document.querySelectorAll("[data-counter]").forEach((el) => {
      if (el.closest(".reveal")) return;
      animateCounter(el);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (finePointer) document.documentElement.classList.add("rpg-cursor");
    runBootSequence();
    typewriter(document.querySelector("main.page-wrap h1"));
    enterStage();
    animateHpBars();
    animateStandaloneCounters();
    initScrollReveal();
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
