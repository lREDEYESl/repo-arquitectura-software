import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { collection, doc, getDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

export const ROOT = location.pathname.includes("/pages/") ? "../" : "./";

const GUARD_ROLES = {
  staff: ["editor", "admin"],
  editor: ["editor", "admin"],
  admin: ["admin"],
};

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

function normalizeRole(rol) {
  if (!rol) return null;
  if (rol === "superadmin") return "admin";
  return rol;
}

function roleFromData(data) {
  return normalizeRole(data?.rol || data?.role || null);
}

export async function getUserRoleByEmail(email) {
  if (!email) return null;

  const byEmailId = await getDoc(doc(db, "roles_usuarios", email));
  if (byEmailId.exists()) return roleFromData(byEmailId.data());

  const snap = await getDocs(query(collection(db, "roles_usuarios"), where("email", "==", email)));
  if (!snap.empty) return roleFromData(snap.docs[0].data());

  return null;
}

export function loginUrl() {
  return `${ROOT}pages/login.html`;
}

export function homeForRole(rol) {
  if (rol === "admin" || rol === "editor") {
    return `${ROOT}pages/index_admin.html`;
  }
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
        const rol = await getUserRoleByEmail(user.email);
        if (!rol || !allowedRoles.includes(rol)) {
          showAchievement("Permiso insuficiente", "Tu rango no puede cruzar esta puerta.", "error");
          location.href = rol ? homeForRole(rol) : loginUrl();
          return;
        }
        resolve({ user, rol });
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
        rol = await getUserRoleByEmail(user.email);
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
