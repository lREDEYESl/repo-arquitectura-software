import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { auth } from "./firebase-config.js";
import { ROOT, getUserRoleByEmail, initPageGuard, logoutPlayer } from "./auth-guard.js";

function setHidden(el, hidden) {
  if (!el) return;
  el.classList.toggle("hidden", hidden);
}

function bindNavbar() {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".navbar");
  toggle?.addEventListener("click", () => nav.classList.toggle("open"));

  const navAdmin = document.getElementById("nav-admin");
  const btnLogout = document.getElementById("btn-logout");

  btnLogout?.addEventListener("click", () => logoutPlayer());

  initPageGuard().finally(() => {
    if (document.body.dataset.page !== "editor" && document.body.dataset.page !== "superadmin") {
      document.getElementById("loader")?.classList.remove("active");
    }
  });

  onAuthStateChanged(auth, async (user) => {
    const page = document.body.dataset.page;
    const guard = document.body.dataset.guard;

    if (!user) {
      setHidden(navAdmin, true);
      return;
    }

    const rol = await getUserRoleByEmail(user.email.toLowerCase());

    if (guard === "public" && (page === "inicio" || page === "unidades") && (rol === "admin" || rol === "editor")) {
      location.href = page === "unidades" ? `${ROOT}pages/unidades_admin.html` : `${ROOT}pages/index_admin.html`;
      return;
    }

    if (page === "login" && (rol === "admin" || rol === "editor")) {
      location.href = `${ROOT}pages/index_admin.html`;
      return;
    }

    setHidden(navAdmin, rol !== "admin");
  });
}

bindNavbar();
