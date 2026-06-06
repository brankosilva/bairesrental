// departamentos.js — BairesRental
// Catálogo, filtros y renderizado de cards

// ======================================================
// CONFIG
// ======================================================
const WA_BASE = "https://wa.me/5491173735757";

// ======================================================
// ESTADO
// ======================================================
let catalogoActual = [];
let filtrosActivos = {
  barrio: "", tipo: [], precioMax: 8000,
  amueblado: "", amenities: [], mascotas: false,
  soloBairesRental: false, busqueda: ""
};
let filtrosListenersRegistrados = false;

// ======================================================
// INICIALIZACIÓN
// ======================================================
document.addEventListener("DOMContentLoaded", async () => {
  await cargarCatalogo();
  inicializarFiltros();
  leerQueryParams();
});

// ======================================================
// CATÁLOGO (desde data/departamentos.json)
// ======================================================
async function cargarCatalogo() {
  const defaults = { imagen: "", fichaUrl: "", disponibleDesde: "", tipo: "monoambiente", direccion: "", direccionUrl: "" };
  try {
    const resp = await fetch("data/departamentos.json?v=" + Date.now());
    if (resp.ok) {
      const data = await resp.json();
      catalogoActual = data.map(p => ({ ...defaults, ...p }));
    }
  } catch (e) {
    console.warn("No se pudo cargar data/departamentos.json");
  }
}

// ======================================================
// FILTROS
// ======================================================
function normalizarBarrio(b) {
  return b.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function inicializarFiltros() {
  // Actualizar el dropdown de barrios (normalizado para evitar duplicados por mayúsculas)
  const barrios = [...new Set(catalogoActual.map(p => normalizarBarrio(p.barrio)))].sort();
  const selectBarrio = document.getElementById("filtro-barrio");
  if (selectBarrio) {
    while (selectBarrio.options.length > 1) selectBarrio.remove(1);
    barrios.forEach(b => {
      const opt = document.createElement("option");
      opt.value = b; opt.textContent = b;
      selectBarrio.appendChild(opt);
    });
  }

  // Los event listeners solo se registran una vez
  if (filtrosListenersRegistrados) return;
  filtrosListenersRegistrados = true;

  if (selectBarrio) {
    selectBarrio.addEventListener("change", () => {
      filtrosActivos.barrio = selectBarrio.value;
      aplicarFiltros();
    });
  }

  document.querySelectorAll(".filtro-tipo-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = filtrosActivos.tipo.indexOf(btn.dataset.tipo);
      if (idx === -1) {
        filtrosActivos.tipo.push(btn.dataset.tipo);
        btn.classList.add("active");
      } else {
        filtrosActivos.tipo.splice(idx, 1);
        btn.classList.remove("active");
      }
      aplicarFiltros();
    });
  });

  const sliderPrecio = document.getElementById("filtro-precio");
  const labelPrecio = document.getElementById("label-precio");
  if (sliderPrecio) {
    sliderPrecio.addEventListener("input", () => {
      filtrosActivos.precioMax = parseInt(sliderPrecio.value);
      labelPrecio.textContent = `USD ${parseInt(sliderPrecio.value).toLocaleString()}`;
      aplicarFiltros();
    });
  }

  document.querySelectorAll(".filtro-amueblado-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const mismo = filtrosActivos.amueblado === btn.dataset.amueblado;
      document.querySelectorAll(".filtro-amueblado-btn").forEach(b => b.classList.remove("active"));
      filtrosActivos.amueblado = mismo ? "" : btn.dataset.amueblado;
      if (!mismo) btn.classList.add("active");
      aplicarFiltros();
    });
  });

  const btnMascotas = document.getElementById("filtro-mascotas");
  if (btnMascotas) {
    btnMascotas.addEventListener("click", () => {
      filtrosActivos.mascotas = !filtrosActivos.mascotas;
      btnMascotas.classList.toggle("active", filtrosActivos.mascotas);
      aplicarFiltros();
    });
  }

  document.querySelectorAll(".filtro-amenity").forEach(cb => {
    cb.addEventListener("change", () => {
      filtrosActivos.amenities = [...document.querySelectorAll(".filtro-amenity:checked")].map(c => c.value);
      aplicarFiltros();
    });
  });

  const btnBaires = document.getElementById("filtro-bairesrental");
  if (btnBaires) {
    btnBaires.addEventListener("click", () => {
      filtrosActivos.soloBairesRental = !filtrosActivos.soloBairesRental;
      btnBaires.classList.toggle("active", filtrosActivos.soloBairesRental);
      aplicarFiltros();
    });
  }

  document.getElementById("btn-limpiar-filtros")?.addEventListener("click", limpiarFiltros);

  const inputBusqueda = document.getElementById("filtro-busqueda");
  if (inputBusqueda) {
    inputBusqueda.addEventListener("input", () => {
      filtrosActivos.busqueda = inputBusqueda.value.trim();
      aplicarFiltros();
    });
  }
}

function aplicarFiltros() {
  actualizarQueryParams();
  renderizarCatalogo();
}

function limpiarFiltros() {
  filtrosActivos = { barrio: "", tipo: [], precioMax: 8000, soloDisponibles: false, amueblado: "", amenities: [], mascotas: false, soloBairesRental: false, busqueda: "" };
  document.getElementById("filtro-bairesrental")?.classList.remove("active");
  document.getElementById("filtro-mascotas")?.classList.remove("active");
  const sb = document.getElementById("filtro-barrio");
  if (sb) sb.value = "";
  document.querySelectorAll(".filtro-tipo-btn, .filtro-amueblado-btn").forEach(b => b.classList.remove("active"));
  const sp = document.getElementById("filtro-precio");
  if (sp) { sp.value = 8000; document.getElementById("label-precio").textContent = "USD 8.000"; }
  const ib = document.getElementById("filtro-busqueda");
  if (ib) ib.value = "";
  document.querySelectorAll(".filtro-amenity").forEach(c => c.checked = false);
  renderizarCatalogo();
  actualizarQueryParams();
}

function filtrarPropiedades() {
  return catalogoActual
    .filter(p => {
      if (filtrosActivos.barrio && normalizarBarrio(p.barrio) !== filtrosActivos.barrio) return false;
      if (filtrosActivos.tipo.length > 0 && !filtrosActivos.tipo.includes(p.tipo)) return false;
      if (p.precio > 0 && (p.moneda === 'USD' || !p.moneda) && p.precio > filtrosActivos.precioMax) return false;
      if (filtrosActivos.busqueda) {
        const q = filtrosActivos.busqueda.toLowerCase();
        const hayCoincidencia = [p.titulo, p.barrio, p.tipo, p.descripcion, p.direccion].some(c => c && c.toLowerCase().includes(q));
        if (!hayCoincidencia) return false;
      }
      if (filtrosActivos.amueblado === "si" && !p.amueblado) return false;
      if (filtrosActivos.amueblado === "no" && p.amueblado) return false;
      if (filtrosActivos.mascotas && !p.mascotas) return false;
      if (filtrosActivos.soloBairesRental && !p.esPropio) return false;
      if (filtrosActivos.amenities.length > 0) {
        for (const a of filtrosActivos.amenities) {
          if (!p.amenities.includes(a)) return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      if (a.esPropio && !b.esPropio) return -1;
      if (!a.esPropio && b.esPropio) return 1;
      const ord = { disponible: 0, reservado: 1, "no disponible": 2 };
      return (ord[a.disponibilidad] || 0) - (ord[b.disponibilidad] || 0);
    });
}

// ======================================================
// RENDERIZADO DE CARDS
// ======================================================
const ICONOS_AMENITIES = {
  "pileta": "🏊", "gimnasio": "🏋️", "laundry": "🫧",
  "parrilla": "🔥", "terraza": "🌿", "cochera": "🚗",
  "sauna": "♨️", "solárium": "☀️", "seguridad 24hs": "🔒", "jacuzzi": "🛁",
  "lavarropas": "🧺"
};

function renderizarCatalogo() {
  const grid = document.getElementById("catalogo-grid");
  const contador = document.getElementById("contador-resultados");
  if (!grid) return;

  const resultados = filtrarPropiedades();
  const total = catalogoActual.length;
  if (contador) contador.textContent = `${window.BR_T ? BR_T('c-mostrando') : 'Mostrando'} ${resultados.length} ${window.BR_T ? BR_T('c-de') : 'de'} ${total} ${window.BR_T ? BR_T('c-propiedades') : 'propiedades'}`;
  const contadorInline = document.getElementById("contador-resultados-inline");
  if (contadorInline) contadorInline.textContent = `${resultados.length}/${total} props.`;

  grid.style.opacity = "0";
  setTimeout(() => {
    if (resultados.length === 0) {
      const noTitle = window.BR_T ? BR_T('c-no-results-title') : 'No encontramos propiedades con esos filtros';
      const noSub = window.BR_T ? BR_T('c-no-results-sub') : 'Probá ajustando los filtros o consultanos directamente';
      const noWa = window.BR_T ? BR_T('c-no-results-wa') : 'Consultar por WhatsApp';
      grid.innerHTML = `
        <div class="br-grid-full">
          <div class="text-center py-5">
            <div class="mb-3" style="font-size:3rem">🔍</div>
            <h4 class="mb-2" style="font-family:'DM Sans',sans-serif;">${noTitle}</h4>
            <p class="text-muted mb-4" style="font-family:'DM Sans',sans-serif;">${noSub}</p>
            <a href="${WA_BASE}?text=${encodeURIComponent('Hola! Estoy buscando un departamento en Buenos Aires. ¿Podrían ayudarme?')}"
               target="_blank" class="br-btn-wa d-inline-flex" style="width:auto;padding:.65rem 1.5rem;">
              ${noWa}
            </a>
          </div>
        </div>`;
    } else {
      grid.innerHTML = resultados.map(p => crearCardHTML(p, catalogoActual.indexOf(p))).join("");
    }
    grid.style.opacity = "1";
  }, 180);
}

function formatearFecha(fechaStr) {
  if (!fechaStr) return "";
  const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const [, mes, dia] = fechaStr.split("-");
  return `${parseInt(dia)} de ${meses[parseInt(mes) - 1]}`;
}

function crearCardHTML(p, idx) {
  const t = window.BR_T || (k => k);
  let badgeDisp = "";
  if (p.disponibilidad === "disponible") badgeDisp = `<span class="br-badge br-badge-disponible">${t('c-disp')}</span>`;
  else if (p.disponibilidad === "reservado") badgeDisp = `<span class="br-badge br-badge-reservado">${t('c-res')}</span>`;
  else badgeDisp = `<span class="br-badge br-badge-nodisponible">${t('c-no')}</span>`;

  const desdeHTML = (p.disponibilidad === "disponible" && p.disponibleDesde)
    ? `<div class="br-prop-desde">${t('c-desde')} <strong>${formatearFecha(p.disponibleDesde)}</strong></div>`
    : "";

  const amenitiesHTML = p.amenities.slice(0, 4).map(a =>
    `<span class="br-amenity-tag">${ICONOS_AMENITIES[a] || "✦"} ${a}</span>`
  ).join("");

  const badgePropio = p.esPropio ? `<span class="br-badge br-badge-propio">★ BairesRental</span>` : "";
  const serviciosLabel = p.serviciosIncluidos
    ? `<span class="br-tag-servicios">${t('c-svc-incl')}</span>`
    : `<span class="br-tag-servicios-aparte">${t('c-svc-extra')}</span>`;
  const minimoLabel = p.minimoMeses > 1 ? `<span class="br-tag-minimo">${t('c-min')} ${p.minimoMeses} ${p.minimoMeses === 1 ? t('c-mes') : t('c-meses')}</span>` : "";

  const monedaLabel = p.moneda || 'USD';
  const precioHTML = p.precio > 0
    ? `<span class="br-precio">${monedaLabel} ${p.precio.toLocaleString()}</span><span class="br-precio-sub">/mes ${serviciosLabel}${minimoLabel}</span>`
    : `<span class="br-precio" style="font-size:1rem;font-weight:700;">${t('c-consultar')}</span><span class="br-precio-sub">${serviciosLabel}${minimoLabel}</span>`;

  const waLink = p.fichaUrl || p.fotos || "";
  const brBase = window.location.origin + window.location.pathname.replace("departamentos.html", "");
  const brLink = brBase + "departamento.html?id=" + p.id;
  const waMsgCompleto = (waLink ? `${p.whatsappMsg}\n\nFotos / ficha: ${waLink}` : p.whatsappMsg) + `\n\nLink BairesRental: ${brLink}\n\nCod: ${p.id}`;
  const waUrl = `${WA_BASE}?text=${encodeURIComponent(waMsgCompleto)}`;

  const direccionHTML = p.direccion && p.direccionUrl
    ? `<div class="br-prop-direccion">
        <a href="${p.direccionUrl}" target="_blank" class="br-btn-ver-mapa" onclick="event.stopPropagation()">
          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" fill="currentColor" viewBox="0 0 16 16">
            <path d="M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10zm0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/>
          </svg>
          ${p.direccion} — ${t('c-ver-mapa')}
        </a>
       </div>`
    : "";

  const imagenHTML = p.imagen
    ? `<img src="${p.imagen}" alt="${p.titulo}" loading="lazy" />`
    : `<div class="br-prop-img-placeholder">📸</div>`;

  return `
    <div class="br-prop-card">
        <div class="br-prop-img" onclick="verDetalle(${idx})">
          ${imagenHTML}
          <div class="br-prop-badges">
            ${badgePropio}
            ${badgeDisp}
          </div>
        </div>
        <div class="br-prop-body">
          <div class="br-prop-clickzone" onclick="verDetalle(${idx})">
            <div class="br-prop-location">
              ${p.barrio} · <em style="font-style:normal;font-weight:500;">${p.tipo}</em>
              ${p.mascotas ? `<span class="br-mascota-inline">${t('c-mascotas')}</span>` : ""}
            </div>
            ${direccionHTML}
            <h3 class="br-prop-titulo">${p.titulo}</h3>
            ${desdeHTML}
            <div class="br-prop-precio-row">${precioHTML}</div>
            <div class="br-amenities-row">${amenitiesHTML}</div>
            <p class="br-prop-desc">${p.descripcion.length > 120 ? p.descripcion.slice(0, 120).trimEnd() + "…" : p.descripcion}</p>
          </div>
          <div class="br-prop-actions">
            <a href="${waUrl}" target="_blank" class="br-btn-wa w-100 mb-2" onclick="event.stopPropagation()">
              <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" fill="currentColor" viewBox="0 0 16 16">
                <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
              </svg>
              ${t('c-wa')}
            </a>
            <div class="br-btn-detalle-row">
              <button class="br-btn-detalle" onclick="event.stopPropagation(); verDetalle(${idx})">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/>
                  <path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8zm8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/>
                </svg>
                ${t('c-det')}
              </button>
              <button class="br-btn-compartir" title="Compartir enlace" onclick="event.stopPropagation(); compartirPropiedad('${p.id}')">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M13.5 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM11 2.5a2.5 2.5 0 1 1 .603 1.628l-6.718 3.12a2.499 2.499 0 0 1 0 1.504l6.718 3.12a2.5 2.5 0 1 1-.488.876l-6.718-3.12a2.5 2.5 0 1 1 0-3.256l6.718-3.12A2.5 2.5 0 0 1 11 2.5zm-8.5 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm11 5.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>`;
}

function verDetalle(ref) {
  const p = typeof ref === "number"
    ? catalogoActual[ref]
    : catalogoActual.find(x => x.id === ref);
  if (!p) return;
  window.location.href = "departamento.html?id=" + encodeURIComponent(p.id);
}

function compartirPropiedad(id) {
  const p = catalogoActual.find(x => x.id === id);
  if (!p) return;
  const base = window.location.origin + (window.location.pathname.replace("departamentos.html", ""));
  const url = base + "departamento.html?id=" + id;
  if (navigator.share) {
    navigator.share({ title: p.titulo + " — BairesRental", url });
  } else {
    navigator.clipboard.writeText(url).then(() => mostrarToast("Link copiado al portapapeles ✓"));
  }
}

function actualizarQueryParams() {
  const params = new URLSearchParams();
  if (filtrosActivos.barrio) params.set("barrio", filtrosActivos.barrio);
  if (filtrosActivos.tipo.length) params.set("tipo", filtrosActivos.tipo.join(","));
  if (filtrosActivos.precioMax < 8000) params.set("precioMax", filtrosActivos.precioMax);
  if (filtrosActivos.amueblado) params.set("amueblado", filtrosActivos.amueblado);
  if (filtrosActivos.amenities.length) params.set("amenities", filtrosActivos.amenities.join(","));
  const nuevaURL = window.location.pathname + (params.toString() ? "?" + params.toString() : "");
  history.replaceState(null, "", nuevaURL);
}

function leerQueryParams() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("barrio")) {
    filtrosActivos.barrio = params.get("barrio");
    const sel = document.getElementById("filtro-barrio");
    if (sel) sel.value = filtrosActivos.barrio;
  }
  if (params.get("tipo")) {
    filtrosActivos.tipo = params.get("tipo").split(",");
    document.querySelectorAll(".filtro-tipo-btn").forEach(btn => {
      if (filtrosActivos.tipo.includes(btn.dataset.tipo)) btn.classList.add("active");
    });
  }
  if (params.get("precioMax")) {
    filtrosActivos.precioMax = parseInt(params.get("precioMax"));
    const sl = document.getElementById("filtro-precio");
    if (sl) { sl.value = filtrosActivos.precioMax; document.getElementById("label-precio").textContent = `USD ${filtrosActivos.precioMax.toLocaleString('es-AR')}`; }
  }
  if (params.get("amueblado")) {
    filtrosActivos.amueblado = params.get("amueblado");
    document.querySelectorAll(".filtro-amueblado-btn").forEach(btn => {
      if (btn.dataset.amueblado === filtrosActivos.amueblado) btn.classList.add("active");
    });
  }
  if (params.get("amenities")) {
    filtrosActivos.amenities = params.get("amenities").split(",");
    filtrosActivos.amenities.forEach(a => {
      const cb = document.querySelector(`.filtro-amenity[value="${a}"]`);
      if (cb) cb.checked = true;
    });
  }
  renderizarCatalogo();
}
