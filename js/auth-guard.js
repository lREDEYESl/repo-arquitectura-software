import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

export const ROOT = location.pathname.includes("/pages/") ? "../" : "./";

const GUARD_ROLES = {
  staff: ["editor", "admin"],
  editor: ["editor", "admin"],
  admin: ["admin"],
};

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function showAchievement(title, message, type = "ok") {
  let stack = document.querySelector(".toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "toast-stack";
    document.body.appendChild(stack);
  }
  const toast = document.createElement("div");
  toast.className = `toast ${type === "error" ? "error" : ""}`;
  toast.innerHTML = `<small>${type === "error" ? "MISIÓN FALLIDA" : "MISIÓN CUMPLIDA"}</small><strong>${title}</strong><div>${message}</div>`;
  stack.appendChild(toast);
  setTimeout(() => toast.remove(), 4200);
}

export function setLoader(active) {
  const overlay = document.getElementById("loader");
  if (overlay) overlay.classList.toggle("active", Boolean(active));
}

function roleFromSnap(snap) {
  if (!snap?.exists()) return null;
  const raw = snap.data()?.rol ?? snap.data()?.role ?? null;
  if (!raw) return null;
  const value = String(raw).trim().toLowerCase();
  if (value === "superadmin") return "admin";
  if (value === "admin" || value === "editor") return value;
  return value;
}

export async function getUserRoleByEmail(email) {
  const emailClean = String(email || "").trim().toLowerCase();
  if (!emailClean) return null;

  try {
    const docSnap = await getDoc(doc(db, "roles_usuarios", emailClean));
    if (!docSnap.exists()) return null;
    return roleFromSnap(docSnap);
  } catch (error) {
    console.error("No se pudo leer roles_usuarios/" + emailClean, error);
    return null;
  }
}

export function loginUrl() {
  return `${ROOT}pages/login.html`;
}

export function homeForRole(rol) {
  if (rol === "admin") return `${ROOT}pages/index_admin.html`;
  if (rol === "editor") return `${ROOT}pages/editor.html`;
  return `${ROOT}index.html`;
}

export function requireRoles(allowedRoles = []) {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) {
          showAchievement("Acceso restringido", "Debes iniciar sesión para entrar a esta zona.", "error");
          location.href = loginUrl();
          return;
        }
        const emailClean = user.email.trim().toLowerCase();
        const rol = await getUserRoleByEmail(emailClean);
        if (!rol || !allowedRoles.includes(rol)) {
          showAchievement(
            "Acceso pendiente",
            rol ? "Tu rango no puede cruzar esta puerta." : "Tu acceso está pendiente de aprobación del gremio.",
            "error"
          );
          location.href = rol ? homeForRole(rol) : loginUrl();
          return;
        }
        resolve({ user, rol, emailClean });
      } catch (error) {
        console.error("Error al verificar rol en roles_usuarios:", error);
        showAchievement("Error de gremio", "No se pudo verificar el rol en Firestore.", "error");
        location.href = loginUrl();
      }
    });
  });
}

let pageGuardPromise;

export function initPageGuard() {
  if (pageGuardPromise) return pageGuardPromise;
  const guard = document.body.dataset.guard;
  if (!guard || guard === "public") {
    pageGuardPromise = Promise.resolve(null);
    return pageGuardPromise;
  }
  const allowed = GUARD_ROLES[guard];
  pageGuardPromise = allowed ? requireRoles(allowed) : Promise.resolve(null);
  return pageGuardPromise;
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, async (user) => {
    let rol = null;
    if (user) {
      try {
        const emailClean = user.email.trim().toLowerCase();
        rol = await getUserRoleByEmail(emailClean);
      } catch (error) {
        console.error("Error al leer rol:", error);
        rol = null;
      }
    }
    callback({ user, rol });
  });
}

export async function logoutPlayer() {
  await signOut(auth);
  showAchievement("Partida guardada", "Has salido del gremio. ¡Hasta la próxima misión!");
  location.href = `${ROOT}index.html`;
}
