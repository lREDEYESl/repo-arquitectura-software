import { signInWithPopup } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getDownloadURL, ref, uploadBytes } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";
import { auth, db, googleProvider, storage } from "./firebase-config.js";
import {
  bindNavbar,
  requireRoles,
  setLoader,
  showAchievement,
  watchAuth,
} from "./auth-guard.js";

bindNavbar();

const page = document.body.dataset.page;

if (page === "unidades") {
  renderTareas();
}

if (page === "login") {
  initLogin();
}

if (page === "editor") {
  initEditor();
}

if (page === "superadmin") {
  initSuperadmin();
}

async function renderTareas() {
  const slots = [1, 2, 3, 4].map((n) => document.getElementById(`tareas-unidad-${n}`));
  slots.forEach((slot) => {
    if (slot) slot.innerHTML = "<p class='muted'>Cargando bitácora de entregas...</p>";
  });

  try {
    const snap = await getDocs(query(collection(db, "tareas_entregadas"), orderBy("creadoEn", "desc")));
    const byUnit = { 1: [], 2: [], 3: [], 4: [] };
    snap.forEach((item) => {
      const data = item.data();
      const unidad = Number(data.unidad);
      if (byUnit[unidad]) byUnit[unidad].push({ id: item.id, ...data });
    });

    slots.forEach((slot, index) => {
      const files = byUnit[index + 1];
      if (!slot) return;
      if (!files.length) {
        slot.innerHTML = "<p class='muted'>Aún no hay artefactos entregados en este nivel.</p>";
        return;
      }
      slot.innerHTML = files
        .map(
          (file) => `
          <article class="file-chip">
            <div>
              <strong>${escapeHtml(file.nombreArchivo || "Archivo")}</strong>
              <div class="muted">Semana ${escapeHtml(String(file.semana || "-"))} · ${escapeHtml(file.autor || "aventurero")}</div>
            </div>
            <a class="btn btn-cyan" href="${file.url}" target="_blank" rel="noopener">Abrir</a>
          </article>`
        )
        .join("");
    });
  } catch (error) {
    slots.forEach((slot) => {
      if (slot) {
        slot.innerHTML =
          "<p class='muted'>No se pudieron leer las entregas. Configura Firebase y las reglas de Firestore.</p>";
      }
    });
  }
}

function initLogin() {
  const requestForm = document.getElementById("form-solicitud");
  const googleBtn = document.getElementById("btn-google");

  requestForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(requestForm));
    setLoader(true);
    try {
      await addDoc(collection(db, "solicitudes_acceso"), {
        nombre: data.nombre.trim(),
        correo: data.correo.trim(),
        motivo: data.motivo.trim(),
        estado: "pendiente",
        creadoEn: serverTimestamp(),
      });
      requestForm.reset();
      showAchievement("Solicitud enviada", "El maestro del gremio revisará tu petición.");
    } catch (error) {
      showAchievement("No se envió la solicitud", "Revisa la configuración de Firestore.", "error");
    } finally {
      setLoader(false);
    }
  });

  googleBtn?.addEventListener("click", async () => {
    setLoader(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      showAchievement("Bienvenido", `Sesión iniciada como ${result.user.displayName || result.user.email}.`);
    } catch (error) {
      showAchievement("Login fallido", "No se pudo completar el acceso con Google.", "error");
    } finally {
      setLoader(false);
    }
  });

  watchAuth(({ user, rol }) => {
    const status = document.getElementById("login-status");
    if (!status) return;
    if (!user) {
      status.textContent = "Sin sesión. Elige un héroe con Google o solicita acceso.";
      return;
    }
    status.textContent = rol
      ? `Conectado: ${user.email} · rango ${rol}`
      : `Conectado: ${user.email}. Tu rango aún no fue asignado.`;
  });
}

async function initEditor() {
  setLoader(true);
  const session = await requireRoles(["editor", "superadmin"]);
  setLoader(false);
  const form = document.getElementById("form-entrega");
  const who = document.getElementById("editor-user");
  if (who) who.textContent = `${session.user.email} · ${session.rol}`;

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form));
    const file = form.archivo.files[0];
    if (!file) {
      showAchievement("Falta el artefacto", "Selecciona un archivo para subir.", "error");
      return;
    }

    setLoader(true);
    try {
      const path = `tareas/${session.user.uid}/unidad-${payload.unidad}/semana-${payload.semana}/${Date.now()}-${file.name}`;
      const fileRef = ref(storage, path);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      await addDoc(collection(db, "tareas_entregadas"), {
        uid: session.user.uid,
        autor: session.user.displayName || session.user.email,
        unidad: Number(payload.unidad),
        semana: Number(payload.semana),
        nombreArchivo: file.name,
        url,
        creadoEn: serverTimestamp(),
      });
      form.reset();
      showAchievement("Entrega registrada", "El archivo quedó guardado en Storage y en la bitácora.");
    } catch (error) {
      showAchievement("Subida fallida", "Verifica Storage, reglas y tu sesión.", "error");
    } finally {
      setLoader(false);
    }
  });
}

async function initSuperadmin() {
  setLoader(true);
  await requireRoles(["superadmin"]);
  setLoader(false);
  await loadSolicitudes();
}

async function loadSolicitudes() {
  const list = document.getElementById("lista-solicitudes");
  if (!list) return;
  list.innerHTML = "<p class='muted'>Consultando el libro de registros...</p>";

  try {
    const snap = await getDocs(query(collection(db, "solicitudes_acceso"), orderBy("creadoEn", "desc")));
    if (snap.empty) {
      list.innerHTML = "<p class='muted'>No hay solicitudes todavía.</p>";
      return;
    }

    list.innerHTML = "";
    snap.forEach((item) => {
      const data = item.data();
      const card = document.createElement("article");
      card.className = "card";
      card.innerHTML = `
        <p class="kicker">${escapeHtml(data.estado || "pendiente")}</p>
        <h3>${escapeHtml(data.nombre || "Aspirante")}</h3>
        <p>${escapeHtml(data.correo || "")}</p>
        <p class="muted">${escapeHtml(data.motivo || "")}</p>
        <div class="stats">
          <button class="btn" data-action="aprobar" data-rol="editor">Aprobar editor</button>
          <button class="btn btn-cyan" data-action="aprobar" data-rol="superadmin">Aprobar admin</button>
          <button class="btn btn-danger" data-action="rechazar">Rechazar</button>
        </div>`;

      card.querySelectorAll("button").forEach((btn) => {
        btn.addEventListener("click", () => handleSolicitud(item.id, data, btn.dataset.action, btn.dataset.rol));
      });
      list.appendChild(card);
    });
  } catch (error) {
    list.innerHTML = "<p class='muted'>No se pudieron leer las solicitudes. Revisa índices y reglas de Firestore.</p>";
  }
}

async function handleSolicitud(id, data, action, rol) {
  setLoader(true);
  try {
    const refDoc = doc(db, "solicitudes_acceso", id);
    if (action === "rechazar") {
      await updateDoc(refDoc, { estado: "rechazada" });
      showAchievement("Solicitud rechazada", `${data.nombre} no entra al gremio.`);
    } else {
      const uidGuess = data.uid;
      if (uidGuess) {
        await setDoc(doc(db, "roles_usuarios", uidGuess), {
          email: data.correo,
          rol,
          nombre: data.nombre,
          actualizadoEn: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, "roles_pendientes"), {
          correo: data.correo,
          rol,
          nombre: data.nombre,
          creadoEn: serverTimestamp(),
        });
        showAchievement(
          "Aprobación registrada",
          "Cuando esa cuenta inicie sesión, asigna el rol en roles_usuarios con su UID."
        );
      }
      await updateDoc(refDoc, { estado: "aprobada", rolAsignado: rol });
      showAchievement("Aspirante aceptado", `${data.nombre} queda como ${rol}.`);
    }
    await loadSolicitudes();
  } catch (error) {
    showAchievement("Acción fallida", "No se pudo actualizar la solicitud.", "error");
  } finally {
    setLoader(false);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
