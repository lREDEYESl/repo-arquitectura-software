import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { auth } from "./firebase-config.js";
import { ROOT, getUserRoleByEmail } from "./auth-guard.js";

function setHidden(el, hidden) {
  if (!el) return;
  el.classList.toggle("hidden", hidden);
}

function bindNavbar() {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".navbar");
  toggle?.addEventListener("click", () => nav.classList.toggle("open"));

  const navEditor = document.getElementById("nav-editor");
  const navAdmin = document.getElementById("nav-admin");
  const navLogin = document.getElementById("nav-login");
  const btnLogout = document.getElementById("btn-logout");

  btnLogout?.addEventListener("click", async () => {
    await signOut(auth);
    location.href = `${ROOT}index.html`;
  });

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      setHidden(navLogin, false);
      setHidden(navEditor, true);
      setHidden(navAdmin, true);
      setHidden(btnLogout, true);
      return;
    }

    const rol = await getUserRoleByEmail(user.email);

    if (rol === "admin") {
      setHidden(navEditor, false);
      setHidden(navAdmin, false);
      setHidden(btnLogout, false);
      setHidden(navLogin, true);
      return;
    }

    if (rol === "editor") {
      setHidden(navEditor, false);
      setHidden(btnLogout, false);
      setHidden(navAdmin, true);
      setHidden(navLogin, true);
      return;
    }

    setHidden(navEditor, true);
    setHidden(navAdmin, true);
    setHidden(btnLogout, false);
    setHidden(navLogin, true);
    if (document.body.dataset.page !== "login") {
      alert("Tu acceso aún está siendo evaluado por el gremio");
    }
  });
}

bindNavbar();
