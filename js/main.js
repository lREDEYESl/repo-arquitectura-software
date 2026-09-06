import { signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";
import { auth, db, googleProvider, storage } from "./firebase-config.js";
import {
  getUserRoleByEmail,
  initPageGuard,
  normalizeEmail,
  setLoader,
  showAchievement,
  watchAuth,
} from "./auth-guard.js";

const page = document.body.dataset.page;
const canManageTareas = page === "unidades_admin" || page === "editor";

if (page === "unidades" || page === "unidades_admin") {
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

function fileUrl(file) {
  return file.urlArchivo || file.url || "";
}

function fileKind(name = "") {
  const ext = String(name).split(".").pop().toLowerCase();
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  return "doc";
}

function storagePathFromUrl(url) {
  try {
    const parsed = new URL(url);
    const marker = "/o/";
    const index = parsed.pathname.indexOf(marker);
    if (index === -1) return null;
    return decodeURIComponent(parsed.pathname.slice(index + marker.length));
  } catch {
    return null;
  }
}

function previewMarkup(file) {
  const url = fileUrl(file);
  const kind = fileKind(file.nombreArchivo || url);
  if (!url) return "";
  if (kind === "image") {
    return `
      <div class="quest-thumb-wrap">
        <img class="quest-thumb" src="${url}" alt="Vista previa de la misión" />
      </div>`;
  }
  const embedSrc =
    kind === "pdf"
      ? url
      : `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
  return `
    <details class="quest-viewer">
      <summary>Previsualizar artefacto</summary>
      <iframe src="${embedSrc}" title="Vista previa" loading="lazy"></iframe>
    </details>`;
}

function adminMarkup(file) {
  if (!canManageTareas) return "";
  return `
    <div class="quest-admin">
      <button class="btn btn-purple" type="button" data-action="edit">Editar</button>
      <button class="btn btn-danger" type="button" data-action="delete">Destruir artefacto</button>
    </div>
    <form class="edit-form hidden" data-edit-form>
      <label class="field">Unidad
        <select name="unidad" required>
          <option value="1" ${Number(file.unidad) === 1 ? "selected" : ""}>I · Fundamentos</option>
          <option value="2" ${Number(file.unidad) === 2 ? "selected" : ""}>II · Modelado</option>
          <option value="3" ${Number(file.unidad) === 3 ? "selected" : ""}>III · Integración</option>
          <option value="4" ${Number(file.unidad) === 4 ? "selected" : ""}>IV · Frameworks</option>
        </select>
      </label>
      <label class="field">Semana
        <input name="semana" type="number" min="1" max="16" required value="${escapeHtml(String(file.semana || 1))}" />
      </label>
      <label class="field">Descripción de la tarea / misión
        <textarea name="descripcion" rows="3" required>${escapeHtml(file.descripcion || "")}</textarea>
      </label>
      <button class="btn" type="submit">Guardar cambios</button>
    </form>`;
}

function questCardMarkup(file) {
  const url = fileUrl(file);
  const storagePath = file.storagePath || storagePathFromUrl(url) || "";
  return `
    <article class="quest-card" data-id="${escapeHtml(file.id)}" data-url="${escapeHtml(url)}" data-storage="${escapeHtml(storagePath)}">
      <p>${escapeHtml(file.descripcion || "Sin descripción de misión.")}</p>
      ${previewMarkup(file)}
      ${url ? `<a class="btn btn-cyan" href="${url}" target="_blank" rel="noopener"><i class="fa-solid fa-download"></i> Descargar / Ver</a>` : ""}
      ${adminMarkup(file)}
    </article>`;
}

function groupByWeek(files) {
  const weeks = new Map();
  files.forEach((file) => {
    const week = Number(file.semana) || 0;
    if (!weeks.has(week)) weeks.set(week, []);
    weeks.get(week).push(file);
  });
  return [...weeks.entries()].sort((a, b) => a[0] - b[0]);
}

async function renderTareas() {
  const slots = [1, 2, 3, 4].map((n) => document.getElementById(`tareas-unidad-${n}`));
  slots.forEach((slot) => {
    if (slot) slot.innerHTML = "<p class='muted'>Cargando bitácora de misiones...</p>";
  });

  try {
    let snap;
    try {
      snap = await getDocs(query(collection(db, "tareas_entregadas"), orderBy("fecha", "desc")));
    } catch (indexError) {
      console.warn("Índice fecha no disponible, leyendo sin orderBy:", indexError);
      snap = await getDocs(collection(db, "tareas_entregadas"));
    }

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
      slot.innerHTML = groupByWeek(files)
        .map(
          ([week, items]) => `
          <section class="week-row">
            <p class="kicker">Semana ${escapeHtml(String(week || "-"))}</p>
            <div class="week-grid">
              ${items.map(questCardMarkup).join("")}
            </div>
          </section>`
        )
        .join("");
    });

    if (canManageTareas) bindTaskControls();
  } catch (error) {
    console.error("Error al renderizar tareas_entregadas:", error);
    slots.forEach((slot) => {
      if (slot) {
        slot.innerHTML =
          "<p class='muted'>No se pudieron leer las entregas. Configura Firebase y las reglas de Firestore.</p>";
      }
    });
  }
}

function bindTaskControls() {
  document.querySelectorAll(".quest-card").forEach((card) => {
    const id = card.dataset.id;
    card.querySelector('[data-action="edit"]')?.addEventListener("click", () => {
      card.querySelector("[data-edit-form]")?.classList.toggle("hidden");
    });
    card.querySelector('[data-action="delete"]')?.addEventListener("click", () => destroyTarea(id, card));
    card.querySelector("[data-edit-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(event.currentTarget));
      updateTarea(id, payload);
    });
  });
}

async function updateTarea(id, payload) {
  setLoader(true);
  try {
    await updateDoc(doc(db, "tareas_entregadas", id), {
      unidad: Number(payload.unidad),
      semana: Number(payload.semana),
      descripcion: String(payload.descripcion || "").trim(),
    });
    showAchievement("Misión Cumplida", "El artefacto fue actualizado en el grimorio.");
    await renderTareas();
  } catch (error) {
    console.error("Error al editar tarea:", error, { id, payload, code: error?.code, message: error?.message });
    showAchievement("Misión Fallida", "No se pudo editar el artefacto.", "error");
  } finally {
    setLoader(false);
  }
}

async function destroyTarea(id, card) {
  if (!confirm("¿Destruir este artefacto para siempre?")) return;
  setLoader(true);
  try {
    const path = card.dataset.storage || storagePathFromUrl(card.dataset.url);
    if (path) {
      try {
        await deleteObject(ref(storage, path));
      } catch (storageError) {
        console.warn("No se pudo borrar el archivo en Storage:", storageError);
      }
    }
    await deleteDoc(doc(db, "tareas_entregadas", id));
    card.remove();
    showAchievement("Misión Cumplida", "El artefacto fue destruido.");
  } catch (error) {
    console.error("Error al destruir tarea:", error, { id, code: error?.code, message: error?.message });
    showAchievement("Misión Fallida", "No se pudo destruir el artefacto.", "error");
  } finally {
    setLoader(false);
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
        correo: normalizeEmail(data.correo),
        motivo: data.motivo.trim(),
        estado: "pendiente",
        creadoEn: serverTimestamp(),
      });
      requestForm.reset();
      showAchievement("Misión Cumplida", "El maestro del gremio revisará tu petición.");
    } catch (error) {
      console.error("Error al enviar solicitud de acceso:", error);
      showAchievement("Misión Fallida", "Revisa la configuración de Firestore.", "error");
    } finally {
      setLoader(false);
    }
  });

  googleBtn?.addEventListener("click", async () => {
    setLoader(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const rol = await getUserRoleByEmail(result.user.email.toLowerCase());
      if (rol === "admin" || rol === "editor") {
        location.href = "index_admin.html";
        return;
      }
      await signOut(auth);
      alert("Error: No tienes rango en el gremio. Envía una solicitud de acceso primero.");
    } catch (error) {
      console.error("Error en login con Google:", error);
      showAchievement("Misión Fallida", "No se pudo completar el acceso con Google.", "error");
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

function bindFilePreview(form) {
  const input = form.querySelector('input[name="archivo"]');
  const preview = document.getElementById("file-preview");
  const previewImage = document.getElementById("preview-image");
  const previewFile = document.getElementById("preview-file");
  const previewName = document.getElementById("preview-name");
  if (!input || !preview) return;

  input.addEventListener("change", () => {
    const file = input.files[0];
    if (!file) {
      preview.classList.add("hidden");
      previewImage?.classList.add("hidden");
      previewFile?.classList.add("hidden");
      if (previewImage) previewImage.src = "";
      return;
    }

    preview.classList.remove("hidden");
    if (file.type.startsWith("image/")) {
      previewFile?.classList.add("hidden");
      previewImage?.classList.remove("hidden");
      previewImage.src = URL.createObjectURL(file);
    } else {
      previewImage?.classList.add("hidden");
      previewFile?.classList.remove("hidden");
      if (previewName) previewName.textContent = file.name;
      const icon = previewFile?.querySelector("i");
      if (icon) {
        icon.className = file.type.includes("pdf")
          ? "fa-solid fa-file-pdf"
          : "fa-solid fa-file-lines";
      }
    }
  });
}

async function initEditor() {
  setLoader(true);
  const session = await initPageGuard();
  setLoader(false);
  if (!session) return;

  const form = document.getElementById("form-entrega");
  const who = document.getElementById("editor-user");
  if (who) who.textContent = `${session.user.email} · ${session.rol}`;
  bindFilePreview(form);

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form));
    const file = form.archivo.files[0];
    const descripcion = String(payload.descripcion || "").trim();
    if (!file) {
      showAchievement("Misión Fallida", "Selecciona un archivo para subir.", "error");
      return;
    }
    if (!descripcion) {
      showAchievement("Misión Fallida", "La descripción de la misión es obligatoria.", "error");
      return;
    }

    setLoader(true);
    try {
      const storagePath = `tareas/${session.user.uid}/unidad-${payload.unidad}/semana-${payload.semana}/${Date.now()}-${file.name}`;
      const fileRef = ref(storage, storagePath);
      await uploadBytes(fileRef, file);
      const urlArchivo = await getDownloadURL(fileRef);
      await addDoc(collection(db, "tareas_entregadas"), {
        unidad: Number(payload.unidad),
        semana: Number(payload.semana),
        nombreArchivo: file.name,
        urlArchivo,
        storagePath,
        descripcion,
        fecha: serverTimestamp(),
      });
      form.reset();
      document.getElementById("file-preview")?.classList.add("hidden");
      showAchievement("Misión Cumplida", "El artefacto quedó guardado en el baúl del gremio.");
    } catch (error) {
      console.error("Error al subir tarea:", error);
      showAchievement("Misión Fallida", "Verifica Storage, reglas y tu sesión.", "error");
    } finally {
      setLoader(false);
    }
  });
}

async function initSuperadmin() {
  setLoader(true);
  const session = await initPageGuard();
  setLoader(false);
  if (!session) return;
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
          <button class="btn" data-action="aprobar" data-rol="editor">Aprobar Editor</button>
          <button class="btn btn-cyan" data-action="aprobar" data-rol="admin">Aprobar Admin</button>
          <button class="btn btn-danger" data-action="rechazar">Rechazar</button>
        </div>`;

      card.querySelectorAll("button").forEach((btn) => {
        btn.addEventListener("click", () => handleSolicitud(item.id, data, btn.dataset.action, btn.dataset.rol));
      });
      list.appendChild(card);
    });
  } catch (error) {
    console.error("Error al leer solicitudes_acceso:", error);
    list.innerHTML = "<p class='muted'>No se pudieron leer las solicitudes. Revisa índices y reglas de Firestore.</p>";
  }
}

async function handleSolicitud(id, data, action, rol) {
  setLoader(true);
  try {
    const solicitudRef = doc(db, "solicitudes_acceso", id);
    if (action === "rechazar") {
      await deleteDoc(solicitudRef);
      showAchievement("Misión Cumplida", `${data.nombre} no entra al gremio.`);
    } else {
      const correo = normalizeEmail(data.correo);
      if (!correo) {
        throw new Error("La solicitud no tiene correo para usar como ID en roles_usuarios.");
      }
      await setDoc(doc(db, "roles_usuarios", correo), { rol });
      await deleteDoc(solicitudRef);
      showAchievement("Misión Cumplida", `${data.nombre} queda como ${rol}.`);
    }
    await loadSolicitudes();
  } catch (error) {
    console.error("Error al procesar solicitud de acceso:", error, {
      id,
      action,
      rol,
      correo: data?.correo,
      code: error?.code,
      message: error?.message,
    });
    showAchievement("Misión Fallida", "No se pudo actualizar la solicitud. Revisa la consola.", "error");
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
