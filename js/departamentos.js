/**
 * departamentos.js — BairesRental
 * Catálogo, filtros, detalle de propiedad y panel de administración
 *
 * =====================================================
 * CÓMO AGREGAR UNA PROPIEDAD (modo desarrollador):
 * 1. Copiá un bloque de CATALOGO_INICIAL
 * 2. Cambiá el "id" por uno único
 * 3. Completá todos los campos
 * 4. Guardá y recargá la página
 *
 * MODO FÁCIL: usá el panel "Administrar catálogo" en el footer
 * =====================================================
 */

// ======================================================
// DATOS DEL CATÁLOGO
// ======================================================
const CATALOGO_INICIAL = [
  {
    id: "casa-duggan",
    titulo: "Quinta de verano en Duggan",
    barrio: "Duggan",
    tipo: "casa",
    precio: 0,
    moneda: "USD",
    disponibilidad: "disponible",
    amueblado: true,
    mascotas: true,
    amenities: ["pileta", "parrilla", "cochera"],
    serviciosIncluidos: false,
    minimoMeses: 1,
    descripcion: "Hermosa casa rodeada de naturaleza, ideal para descansar y desconectarse. Late check-out 18hs! Terreno de 3.500 m², pileta de uso exclusivo (14×6 m), gazebo y baño exterior. 2 habitaciones, 6 camas. Pet friendly (tenemos un perro macho muy dócil). Consultá por precios y disponibilidad.",
    imagen: "./images/casa-duggan/duggan.JPG",
    fotos: "https://photos.app.goo.gl/JzFQsaeE91TViuTC8",
    fichaUrl: "https://www.airbnb.com.ar/rooms/1599265620721654934",
    disponibleDesde: "",
    whatsappMsg: "Hola! Me interesa la Quinta de verano en Duggan. ¿Podría darme más información sobre precios y disponibilidad?",
    esPropio: true
  },
  {
    id: "teodoro-garcia-2500",
    titulo: "Hermoso Duplex en Belgrano",
    barrio: "Belgrano",
    tipo: "2 ambientes",
    precio: 1100,
    moneda: "USD",
    disponibilidad: "disponible",
    amueblado: true,
    mascotas: false,
    amenities: ["laundry"],
    serviciosIncluidos: true,
    minimoMeses: 1,
    descripcion: "PH dúplex en Teodoro García al 2500. 48m² en dos plantas: living luminoso con balcón, cocina completamente equipada, lavarropas propio, toilette y WiFi. En la planta alta: dormitorio con placard, escritorio, Smart TV, aire acondicionado y baño en suite.",
    imagen: "./images/teodoro-garcia-2500/20240407_214133.jpg",
    fotos: "https://photos.app.goo.gl/XnDV11FvcQZsheQv8",
    fichaUrl: "https://www.airbnb.com.ar/rooms/1096449223624441831",
    disponibleDesde: "2026-07-04",
    whatsappMsg: "Hola! Me interesa el Duplex en Belgrano (Teodoro García 2500). ¿Podría darme más información?",
    esPropio: true
  },
  {
    id: "lima-1125",
    titulo: "Ideal estudiantes + amenities",
    barrio: "Centro",
    tipo: "monoambiente",
    precio: 750,
    moneda: "USD",
    disponibilidad: "disponible",
    amueblado: true,
    mascotas: false,
    amenities: ["pileta", "sauna", "laundry", "parrilla", "gimnasio"],
    serviciosIncluidos: true,
    minimoMeses: 1,
    descripcion: "Monoambiente en Lima al 1100, a pasos de UADE y UAI. Edificio con pileta, SUM con parrilla, sauna, jacuzzi, gimnasio, laundry y terraza. Balcón amplio con mesa y sillas. Cama matrimonial, Smart TV, cocina equipada, baño completo. No incluye blanquería.",
    imagen: "./images/lima 1125/lima-1125.jpg",
    fotos: "https://photos.app.goo.gl/6JnHRBiHgUb8W55c6",
    fichaUrl: "",
    disponibleDesde: "",
    whatsappMsg: "Hola! Me interesa el departamento en Lima 1125 (Centro). ¿Podría darme más información?",
    esPropio: true
  },
  {
    id: "julian-alvarez-1509",
    titulo: "Moderno estudio con amenities en Palermo",
    barrio: "Palermo",
    tipo: "monoambiente",
    precio: 700,
    moneda: "USD",
    disponibilidad: "disponible",
    amueblado: true,
    mascotas: false,
    amenities: ["laundry", "terraza", "parrilla"],
    serviciosIncluidos: true,
    minimoMeses: 1,
    descripcion: "Nuevo y moderno departamento en edificio con parrilla, terraza y lavandería en Palermo. Cerca del Jardín botánico, Parque las Heras, Plaza Armenia, Alto Palermo shopping y transporte público. Completamente equipado con todas las comodidades.",
    imagen: "./images/julian-alvarez-1509/moderno-estudio.jpg",
    fotos: "https://photos.app.goo.gl/VE9oQkrg1gi3ArWX7",
    fichaUrl: "https://www.airbnb.com.ar/rooms/1201506393468756933",
    disponibleDesde: "2026-08-01",
    whatsappMsg: "Hola! Me interesa el Moderno estudio en Palermo (Julián Álvarez 1509). ¿Podría darme más información?",
    esPropio: true
  },
  {
    id: "beruti-2390",
    titulo: "Moderno estudio en Recoleta",
    barrio: "Recoleta",
    tipo: "monoambiente",
    precio: 750,
    moneda: "USD",
    disponibilidad: "disponible",
    amueblado: true,
    mascotas: false,
    amenities: [],
    serviciosIncluidos: true,
    minimoMeses: 1,
    descripcion: "Monoambiente a estrenar en Recoleta, moderno y muy luminoso con balcón privado. Zona residencial, elegante y súper conectada. A pasos de cafés, restaurantes, museos, hospitales y del Subte. Ideal tanto para estadías cortas como largas.",
    imagen: "./images/beruti-2390/beruti-2390.jpg",
    fotos: "https://photos.app.goo.gl/n7nnp1SmZvMZaz6ZA",
    fichaUrl: "https://www.booking.com/hotel/ar/modern-apartment-with-balcony-and-desk-for-students.es.html",
    disponibleDesde: "2027-01-01",
    whatsappMsg: "Hola! Me interesa el Moderno estudio en Recoleta (Beruti 2390). ¿Podría darme más información?",
    esPropio: true
  },
  {
    id: "beruti-2390-b",
    titulo: "Fantástico estudio en Recoleta",
    barrio: "Recoleta",
    tipo: "monoambiente",
    precio: 900,
    moneda: "USD",
    disponibilidad: "disponible",
    amueblado: true,
    mascotas: false,
    amenities: [],
    serviciosIncluidos: true,
    minimoMeses: 1,
    descripcion: "Monoambiente completamente nuevo en Recoleta, amplio, muy luminoso y con balcón privado. Zona residencial, elegante y súper conectada. A pasos de cafés, restaurantes, museos, hospitales y del Subte. Ideal para estadías largas.",
    imagen: "./images/beruti-2390 B/beruti-2390-B.JPG",
    fotos: "https://photos.app.goo.gl/DuuJCtz4rX8aDPwv7",
    fichaUrl: "",
    disponibleDesde: "",
    whatsappMsg: "Hola! Me interesa el Fantástico estudio en Recoleta (Beruti 2390 B). ¿Podría darme más información?",
    esPropio: true
  },
  {
    id: "teodoro-garcia-mono",
    titulo: "Monoambiente luminoso en Belgrano",
    barrio: "Belgrano",
    tipo: "monoambiente",
    precio: 775,
    moneda: "USD",
    disponibilidad: "no disponible",
    amueblado: true,
    mascotas: false,
    amenities: [],
    serviciosIncluidos: true,
    minimoMeses: 1,
    descripcion: "Departamento muy luminoso en Belgrano, a media cuadra de Av. Cabildo con Subte línea D. Cama de 2 plazas + sillón individual, escritorio, ropa de cama, cocina con horno y anafe, microondas, heladera, WiFi y Smart TV. Cerca de Barrancas de Belgrano y Cañitas.",
    imagen: "./images/Teodoro-garcia/teodoro-garcia.jpg",
    fotos: "https://photos.app.goo.gl/bibXNHzeacUSjVZ97",
    fichaUrl: "",
    disponibleDesde: "",
    whatsappMsg: "Hola! Me interesa el Monoambiente en Belgrano (Teodoro García). ¿Podría darme más información?",
    esPropio: true
  },
  {
    id: "medrano-828",
    titulo: "Elegante estudio con amenities en Almagro",
    barrio: "Almagro",
    tipo: "monoambiente",
    precio: 800,
    moneda: "USD",
    disponibilidad: "no disponible",
    amueblado: true,
    mascotas: false,
    amenities: ["pileta", "gimnasio", "laundry"],
    serviciosIncluidos: true,
    minimoMeses: 1,
    descripcion: "Departamento nuevo y elegante en edificio con pileta, gimnasio y laundry. Ubicado en Almagro, a metros del subte B estación Medrano y Av. Corrientes. A 4 cuadras del Hospital Italiano, cerca de Parque Centenario, Sanatorio Güemes y shopping Abasto.",
    imagen: "./images/medrano-828-sunset/medrano 828 9C 17.jpg",
    fotos: "https://photos.app.goo.gl/ZNvp5HwtVeje8rkc9",
    fichaUrl: "https://www.airbnb.com.ar/rooms/841872244620287447",
    disponibleDesde: "",
    whatsappMsg: "Hola! Me interesa el Elegante estudio en Almagro (Medrano 828). ¿Podría darme más información?",
    esPropio: true
  }
];

// ======================================================
// CONFIG
// ======================================================
const ADMIN_PASSWORD = "baires2025";
const WA_BASE = "https://wa.me/5491173735757";

// ======================================================
// ESTADO
// ======================================================
let catalogoActual = [];
let filtrosActivos = {
  barrio: "", tipo: "", precioMax: 5000,
  soloDisponibles: false, amueblado: "", amenities: [], mascotas: false
};
let adminLogueado = false;
let propiedadEditando = null;

// ======================================================
// INICIALIZACIÓN
// ======================================================
document.addEventListener("DOMContentLoaded", async () => {
  await cargarCatalogo();
  inicializarFiltros();
  leerQueryParams();
  initAdminPanel();
  initDetalleModal();
});

// ======================================================
// CATÁLOGO (JSON file + localStorage como borrador)
// ======================================================
async function cargarCatalogo() {
  // localStorage guarda cambios del admin que todavía no se subieron al servidor
  const borrador = localStorage.getItem("br_catalogo");
  if (borrador) {
    try {
      catalogoActual = JSON.parse(borrador).map(p => ({
        imagen: "", fichaUrl: "", disponibleDesde: "", tipo: "monoambiente", ...p
      }));
      return;
    } catch (e) {
      localStorage.removeItem("br_catalogo");
    }
  }
  // Fuente de verdad: data/departamentos.json en el servidor
  try {
    const resp = await fetch("data/departamentos.json?v=" + Date.now());
    if (!resp.ok) throw new Error();
    const datos = await resp.json();
    catalogoActual = datos.map(p => ({
      imagen: "", fichaUrl: "", disponibleDesde: "", tipo: "monoambiente", ...p
    }));
  } catch (e) {
    catalogoActual = [];
    console.warn("No se pudo cargar data/departamentos.json");
  }
}

function guardarCatalogo() {
  localStorage.setItem("br_catalogo", JSON.stringify(catalogoActual));
}

// ======================================================
// FILTROS
// ======================================================
function inicializarFiltros() {
  const barrios = [...new Set(catalogoActual.map(p => p.barrio))].sort();
  const selectBarrio = document.getElementById("filtro-barrio");
  if (selectBarrio) {
    while (selectBarrio.options.length > 1) selectBarrio.remove(1);
    barrios.forEach(b => {
      const opt = document.createElement("option");
      opt.value = b; opt.textContent = b;
      selectBarrio.appendChild(opt);
    });
    selectBarrio.addEventListener("change", () => {
      filtrosActivos.barrio = selectBarrio.value;
      aplicarFiltros();
    });
  }

  document.querySelectorAll(".filtro-tipo-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const mismo = filtrosActivos.tipo === btn.dataset.tipo;
      document.querySelectorAll(".filtro-tipo-btn").forEach(b => b.classList.remove("active"));
      filtrosActivos.tipo = mismo ? "" : btn.dataset.tipo;
      if (!mismo) btn.classList.add("active");
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

  const toggleDisp = document.getElementById("filtro-disponible");
  if (toggleDisp) {
    toggleDisp.addEventListener("change", () => {
      filtrosActivos.soloDisponibles = toggleDisp.checked;
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

  const toggleMascotas = document.getElementById("filtro-mascotas");
  if (toggleMascotas) {
    toggleMascotas.addEventListener("change", () => {
      filtrosActivos.mascotas = toggleMascotas.checked;
      aplicarFiltros();
    });
  }

  document.querySelectorAll(".filtro-amenity").forEach(cb => {
    cb.addEventListener("change", () => {
      filtrosActivos.amenities = [...document.querySelectorAll(".filtro-amenity:checked")].map(c => c.value);
      aplicarFiltros();
    });
  });

  document.getElementById("btn-limpiar-filtros")?.addEventListener("click", limpiarFiltros);
}

function aplicarFiltros() {
  actualizarQueryParams();
  renderizarCatalogo();
}

function limpiarFiltros() {
  filtrosActivos = { barrio: "", tipo: "", precioMax: 5000, soloDisponibles: false, amueblado: "", amenities: [], mascotas: false };
  const sb = document.getElementById("filtro-barrio");
  if (sb) sb.value = "";
  document.querySelectorAll(".filtro-tipo-btn, .filtro-amueblado-btn").forEach(b => b.classList.remove("active"));
  const sp = document.getElementById("filtro-precio");
  if (sp) { sp.value = 5000; document.getElementById("label-precio").textContent = "USD 5.000"; }
  const td = document.getElementById("filtro-disponible");
  if (td) td.checked = false;
  const tm = document.getElementById("filtro-mascotas");
  if (tm) tm.checked = false;
  document.querySelectorAll(".filtro-amenity").forEach(c => c.checked = false);
  renderizarCatalogo();
  actualizarQueryParams();
}

function filtrarPropiedades() {
  return catalogoActual
    .filter(p => {
      if (filtrosActivos.barrio && p.barrio !== filtrosActivos.barrio) return false;
      if (filtrosActivos.tipo && p.tipo !== filtrosActivos.tipo) return false;
      if (p.precio > 0 && p.precio > filtrosActivos.precioMax) return false;
      if (filtrosActivos.soloDisponibles && p.disponibilidad !== "disponible") return false;
      if (filtrosActivos.amueblado === "si" && !p.amueblado) return false;
      if (filtrosActivos.amueblado === "no" && p.amueblado) return false;
      if (filtrosActivos.mascotas && !p.mascotas) return false;
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
  if (contador) contador.textContent = `Mostrando ${resultados.length} de ${total} propiedades`;

  grid.style.opacity = "0";
  setTimeout(() => {
    if (resultados.length === 0) {
      grid.innerHTML = `
        <div class="br-grid-full">
          <div class="text-center py-5">
            <div class="mb-3" style="font-size:3rem">🔍</div>
            <h4 class="mb-2" style="font-family:'DM Sans',sans-serif;">No encontramos propiedades con esos filtros</h4>
            <p class="text-muted mb-4" style="font-family:'DM Sans',sans-serif;">Probá ajustando los filtros o consultanos directamente</p>
            <a href="${WA_BASE}?text=${encodeURIComponent('Hola! Estoy buscando un departamento en Buenos Aires. ¿Podrían ayudarme?')}"
               target="_blank" class="br-btn-wa d-inline-flex" style="width:auto;padding:.65rem 1.5rem;">
              Consultar por WhatsApp
            </a>
          </div>
        </div>`;
    } else {
      grid.innerHTML = resultados.map(p => crearCardHTML(p)).join("");
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

function crearCardHTML(p) {
  let badgeDisp = "";
  if (p.disponibilidad === "disponible") badgeDisp = `<span class="br-badge br-badge-disponible">● Disponible</span>`;
  else if (p.disponibilidad === "reservado") badgeDisp = `<span class="br-badge br-badge-reservado">● Reservado</span>`;
  else badgeDisp = `<span class="br-badge br-badge-nodisponible">● No disponible</span>`;

  const desdeHTML = (p.disponibilidad === "disponible" && p.disponibleDesde)
    ? `<div class="br-prop-desde">📅 Disponible desde el <strong>${formatearFecha(p.disponibleDesde)}</strong></div>`
    : "";

  const amenitiesHTML = p.amenities.slice(0, 4).map(a =>
    `<span class="br-amenity-tag">${ICONOS_AMENITIES[a] || "✦"} ${a}</span>`
  ).join("");

  const badgePropio = p.esPropio ? `<span class="br-badge br-badge-propio">★ BairesRental</span>` : "";
  const serviciosLabel = p.serviciosIncluidos ? `<span class="br-tag-servicios">Servicios incl.</span>` : "";
  const minimoLabel = p.minimoMeses > 1 ? `<span class="br-tag-minimo">Mín. ${p.minimoMeses} meses</span>` : "";

  const precioHTML = p.precio > 0
    ? `<span class="br-precio">USD ${p.precio.toLocaleString()}</span><span class="br-precio-sub">/mes ${serviciosLabel}${minimoLabel}</span>`
    : `<span class="br-precio" style="font-size:1rem;font-weight:700;">Consultar precio</span>`;

  const waLink = p.fichaUrl || p.fotos || "";
  const waMsgCompleto = waLink ? `${p.whatsappMsg}\n\nFotos / ficha: ${waLink}` : p.whatsappMsg;
  const waUrl = `${WA_BASE}?text=${encodeURIComponent(waMsgCompleto)}`;

  const imagenHTML = p.imagen
    ? `<img src="${p.imagen}" alt="${p.titulo}" loading="lazy" />`
    : `<div class="br-prop-img-placeholder">📸</div>`;

  return `
    <div class="br-prop-card">
        <div class="br-prop-img" onclick="verDetalle('${p.id}')">
          ${imagenHTML}
          <div class="br-prop-badges">
            ${badgePropio}
            ${badgeDisp}
          </div>
        </div>
        <div class="br-prop-body">
          <div class="br-prop-clickzone" onclick="verDetalle('${p.id}')">
            <div class="br-prop-location">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10zm0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/>
              </svg>
              ${p.barrio} · <em style="font-style:normal;font-weight:500;">${p.tipo}</em>
              ${p.mascotas ? `<span class="br-mascota-inline">🐾 Acepta mascotas</span>` : ""}
            </div>
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
              Consultar por WhatsApp
            </a>
            <button class="br-btn-detalle" onclick="event.stopPropagation(); verDetalle('${p.id}')">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                <path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/>
                <path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8zm8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/>
              </svg>
              Ver detalles completos
            </button>
          </div>
        </div>
      </div>`;
}

// ======================================================
// MODAL DE DETALLE DE PROPIEDAD
// ======================================================
function initDetalleModal() {
  document.getElementById("detalle-overlay")?.addEventListener("click", cerrarDetalle);
  document.getElementById("detalle-close")?.addEventListener("click", cerrarDetalle);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      cerrarDetalle();
      cerrarPanelAdmin();
    }
  });
}

function verDetalle(id) {
  const p = catalogoActual.find(x => x.id === id);
  if (!p) return;

  // — Imagen —
  const imgWrap = document.getElementById("detalle-img-wrap");
  const badgesHTML = `
    <div class="detalle-img-badges">
      ${p.esPropio ? `<span class="br-badge br-badge-propio">★ BairesRental</span>` : ""}
      ${p.disponibilidad === "disponible" ? `<span class="br-badge br-badge-disponible">● Disponible</span>`
        : p.disponibilidad === "reservado" ? `<span class="br-badge br-badge-reservado">● Reservado</span>`
        : `<span class="br-badge br-badge-nodisponible">● No disponible</span>`}
    </div>
    ${p.mascotas ? `<div class="br-mascota-flag" style="position:absolute;bottom:.6rem;right:.6rem;">🐾</div>` : ""}
  `;
  imgWrap.innerHTML = p.imagen
    ? `<img src="${p.imagen}" alt="${p.titulo}" style="width:100%;height:100%;object-fit:cover;" />${badgesHTML}`
    : `<div class="detalle-img-placeholder">📸</div>${badgesHTML}`;

  // — Ubicación —
  document.getElementById("detalle-location").innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor" viewBox="0 0 16 16">
      <path d="M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10zm0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/>
    </svg>
    ${p.barrio} · <em style="font-style:normal;font-weight:500;">${p.tipo}</em>
  `;

  // — Título —
  document.getElementById("detalle-titulo").textContent = p.titulo;

  // — Precio —
  const serviciosLabel = p.serviciosIncluidos ? `<span class="br-tag-servicios">Servicios incluidos</span>` : "";
  const minimoLabel = p.minimoMeses > 1 ? `<span class="br-tag-minimo">Mín. ${p.minimoMeses} meses</span>` : "";
  document.getElementById("detalle-precio-row").innerHTML = p.precio > 0
    ? `<span class="detalle-precio">USD ${p.precio.toLocaleString()}</span>
       <span class="detalle-precio-sub">/mes ${serviciosLabel}${minimoLabel}</span>`
    : `<span class="detalle-precio" style="font-size:1.2rem;">Consultar precio</span>`;

  // — Disponible desde —
  const desdeEl = document.getElementById("detalle-desde");
  if (p.disponibilidad === "disponible" && p.disponibleDesde) {
    desdeEl.innerHTML = `<div class="detalle-desde">📅 Disponible desde el <strong>${formatearFecha(p.disponibleDesde)}</strong></div>`;
  } else {
    desdeEl.innerHTML = "";
  }

  // — Descripción (completa, sin clamp) —
  document.getElementById("detalle-desc").textContent = p.descripcion;

  // — Amenities —
  const amenitiesSection = document.getElementById("detalle-amenities-section");
  const amenitiesRow = document.getElementById("detalle-amenities-row");
  if (p.amenities.length > 0) {
    amenitiesRow.innerHTML = p.amenities.map(a =>
      `<span class="detalle-amenity-tag">${ICONOS_AMENITIES[a] || "✦"} ${a}</span>`
    ).join("");
    amenitiesSection.style.display = "block";
  } else {
    amenitiesSection.style.display = "none";
  }

  // — Características —
  const opcionesSection = document.getElementById("detalle-opciones-section");
  const opcionesRow = document.getElementById("detalle-opciones-row");
  const opciones = [];
  if (p.amueblado) opciones.push("🛋️ Amueblado");
  if (p.mascotas) opciones.push("🐾 Acepta mascotas");
  if (p.serviciosIncluidos) opciones.push("💡 Servicios incluidos");
  if (p.minimoMeses > 1) opciones.push(`📅 Mínimo ${p.minimoMeses} meses`);
  if (opciones.length > 0) {
    opcionesRow.innerHTML = opciones.map(o => `<span class="detalle-opcion-tag">${o}</span>`).join("");
    opcionesSection.style.display = "block";
  } else {
    opcionesSection.style.display = "none";
  }

  // — Acciones —
  const waLink = p.fichaUrl || p.fotos || "";
  const waMsgCompleto = waLink ? `${p.whatsappMsg}\n\nFotos / ficha: ${waLink}` : p.whatsappMsg;
  const waUrl = `${WA_BASE}?text=${encodeURIComponent(waMsgCompleto)}`;
  const linkFotos = p.fichaUrl || p.fotos || "";
  const iconWa = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/></svg>`;

  document.getElementById("detalle-actions").innerHTML = `
    <a href="${waUrl}" target="_blank" class="br-btn-wa">${iconWa} Consultar por WhatsApp</a>
    ${linkFotos
      ? `<a href="${linkFotos}" target="_blank" class="detalle-btn-fotos">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="currentColor" viewBox="0 0 16 16">
            <path d="M6.002 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/>
            <path d="M2.002 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2h-12zm12 1a1 1 0 0 1 1 1v6.5l-3.777-1.947a.5.5 0 0 0-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 0 0-.63.062L1.002 12V3a1 1 0 0 1 1-1h12z"/>
          </svg>
          Ver fotos y detalles
        </a>`
      : ""
    }
  `;

  // — Mostrar —
  document.getElementById("detalle-overlay").classList.add("active");
  document.getElementById("detalle-modal").classList.add("active");
  document.body.style.overflow = "hidden";
}

function cerrarDetalle() {
  document.getElementById("detalle-overlay")?.classList.remove("active");
  document.getElementById("detalle-modal")?.classList.remove("active");
  document.body.style.overflow = "";
}

// ======================================================
// QUERY PARAMS
// ======================================================
function actualizarQueryParams() {
  const params = new URLSearchParams();
  if (filtrosActivos.barrio) params.set("barrio", filtrosActivos.barrio);
  if (filtrosActivos.tipo) params.set("tipo", filtrosActivos.tipo);
  if (filtrosActivos.precioMax < 5000) params.set("precioMax", filtrosActivos.precioMax);
  if (filtrosActivos.soloDisponibles) params.set("disponibles", "1");
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
    filtrosActivos.tipo = params.get("tipo");
    document.querySelectorAll(".filtro-tipo-btn").forEach(btn => {
      if (btn.dataset.tipo === filtrosActivos.tipo) btn.classList.add("active");
    });
  }
  if (params.get("precioMax")) {
    filtrosActivos.precioMax = parseInt(params.get("precioMax"));
    const sl = document.getElementById("filtro-precio");
    if (sl) { sl.value = filtrosActivos.precioMax; document.getElementById("label-precio").textContent = `USD ${filtrosActivos.precioMax.toLocaleString()}`; }
  }
  if (params.get("disponibles") === "1") {
    filtrosActivos.soloDisponibles = true;
    const td = document.getElementById("filtro-disponible");
    if (td) td.checked = true;
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

// ======================================================
// PANEL DE ADMINISTRACIÓN
// ======================================================
function initAdminPanel() {
  const btnAdmin = document.getElementById("btn-admin-access");
  if (btnAdmin) {
    btnAdmin.addEventListener("click", () => {
      if (adminLogueado) {
        abrirPanelAdmin();
      } else {
        const pwd = prompt("Contraseña de administrador:");
        if (pwd === ADMIN_PASSWORD) {
          adminLogueado = true;
          abrirPanelAdmin();
        } else if (pwd !== null) {
          alert("Contraseña incorrecta.");
        }
      }
    });
  }

  document.getElementById("admin-modal-close")?.addEventListener("click", cerrarPanelAdmin);
  document.getElementById("admin-overlay")?.addEventListener("click", cerrarPanelAdmin);
  document.getElementById("btn-nueva-propiedad")?.addEventListener("click", () => abrirFormulario(null));
  document.getElementById("btn-exportar")?.addEventListener("click", exportarCatalogo);
  document.getElementById("btn-importar")?.addEventListener("click", importarCatalogo);
  document.getElementById("btn-cancelar-form")?.addEventListener("click", cerrarFormulario);
  document.getElementById("form-propiedad")?.addEventListener("submit", guardarPropiedad);

  document.getElementById("admin-buscar")?.addEventListener("input", (e) => {
    adminBusqueda = e.target.value;
    renderizarTablaAdmin();
  });

  document.querySelectorAll(".admin-tipo-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".admin-tipo-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      adminFiltroTipo = btn.dataset.tipo;
      renderizarTablaAdmin();
    });
  });

  document.getElementById("admin-img-file")?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target.result;
      const urlInput = document.getElementById("admin-img-url");
      if (urlInput) urlInput.value = base64;
      actualizarPreviewImagen(base64);
      actualizarPreviewAdmin();
    };
    reader.readAsDataURL(file);
  });

  document.getElementById("admin-img-url")?.addEventListener("input", (e) => {
    actualizarPreviewImagen(e.target.value);
    actualizarPreviewAdmin();
  });

  document.getElementById("form-propiedad")?.querySelectorAll("input, select, textarea").forEach(el => {
    el.addEventListener("input", actualizarPreviewAdmin);
    el.addEventListener("change", actualizarPreviewAdmin);
  });
}

function abrirPanelAdmin() {
  document.getElementById("admin-modal")?.classList.add("active");
  document.getElementById("admin-overlay")?.classList.add("active");
  document.body.style.overflow = "hidden";
  renderizarTablaAdmin();
}

function cerrarPanelAdmin() {
  document.getElementById("admin-modal")?.classList.remove("active");
  document.getElementById("admin-overlay")?.classList.remove("active");
  document.body.style.overflow = "";
  cerrarFormulario();
  adminLogueado = false;
}

let adminFiltroTipo = "";
let adminBusqueda = "";

function renderizarTablaAdmin() {
  const lista = document.getElementById("admin-lista");
  const contador = document.getElementById("admin-contador-lista");
  if (!lista) return;

  const q = adminBusqueda.toLowerCase().trim();
  const resultados = catalogoActual
    .map((p, idx) => ({ p, idx }))
    .filter(({ p }) => {
      if (q && !p.titulo.toLowerCase().includes(q) && !p.barrio.toLowerCase().includes(q)) return false;
      if (adminFiltroTipo === "3+") {
        const tipos3 = ["3 ambientes", "4 ambientes", "5 ambientes"];
        if (!tipos3.includes(p.tipo)) return false;
      } else if (adminFiltroTipo === "sin-amoblar") {
        if (p.amueblado !== false) return false;
      } else if (adminFiltroTipo && p.tipo !== adminFiltroTipo) {
        return false;
      }
      return true;
    });

  if (contador) contador.textContent = `${resultados.length} de ${catalogoActual.length}`;

  if (resultados.length === 0) {
    lista.innerHTML = `<p style="text-align:center;color:#888;padding:2rem;font-family:'DM Sans',sans-serif;">Sin resultados</p>`;
    return;
  }

  lista.innerHTML = resultados.map(({ p, idx }) => {
    const thumb = p.imagen
      ? `<img src="${p.imagen}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="admin-thumb-placeholder" style="display:none;">📸</div>`
      : `<div class="admin-thumb-placeholder">📸</div>`;
    const precio = p.precio > 0 ? `USD ${p.precio.toLocaleString()}` : "Consultar";
    const dispClass = p.disponibilidad.replace(/ /g, "-");
    return `
      <div class="admin-prop-card">
        <div class="admin-prop-thumb">${thumb}</div>
        <div class="admin-prop-info">
          <div class="admin-prop-titulo">${p.titulo}</div>
          <div class="admin-prop-meta">${p.barrio} · ${p.tipo} · ${precio}</div>
          <span class="admin-disp-badge admin-disp-${dispClass}">${p.disponibilidad}</span>
        </div>
        <div class="admin-prop-btns">
          <button class="btn-admin-edit" onclick="abrirFormulario(${idx})">✏️ Editar</button>
          <button class="btn-admin-dup" onclick="duplicarPropiedad(${idx})">⧉</button>
          <button class="btn-admin-del" onclick="eliminarPropiedad(${idx})">🗑</button>
        </div>
      </div>`;
  }).join("");
}

function abrirFormulario(idx) {
  propiedadEditando = idx;
  const form = document.getElementById("form-propiedad");
  const seccion = document.getElementById("admin-form-section");
  const titulo = document.getElementById("form-titulo-label");
  if (seccion) seccion.style.display = "block";
  if (titulo) titulo.textContent = idx === null ? "Nueva Propiedad" : "Editar Propiedad";

  if (idx !== null) {
    const p = catalogoActual[idx];
    form.querySelector('[name="id"]').value = p.id;
    form.querySelector('[name="titulo"]').value = p.titulo;
    form.querySelector('[name="barrio"]').value = p.barrio;
    form.querySelector('[name="tipo"]').value = p.tipo;
    form.querySelector('[name="precio"]').value = p.precio;
    form.querySelector('[name="moneda"]').value = p.moneda;
    form.querySelector('[name="disponibilidad"]').value = p.disponibilidad;
    form.querySelector('[name="amueblado"]').checked = p.amueblado;
    form.querySelector('[name="mascotas"]').checked = p.mascotas;
    form.querySelector('[name="serviciosIncluidos"]').checked = p.serviciosIncluidos;
    form.querySelector('[name="minimoMeses"]').value = p.minimoMeses;
    form.querySelector('[name="descripcion"]').value = p.descripcion;
    form.querySelector('[name="imagen"]').value = p.imagen || "";
    actualizarPreviewImagen(p.imagen || "");
    form.querySelector('[name="fotos"]').value = p.fotos || "";
    form.querySelector('[name="fichaUrl"]').value = p.fichaUrl || "";
    form.querySelector('[name="disponibleDesde"]').value = p.disponibleDesde || "";
    form.querySelector('[name="whatsappMsg"]').value = p.whatsappMsg;
    form.querySelector('[name="esPropio"]').checked = p.esPropio;
    form.querySelectorAll('[name="amenities"]').forEach(cb => { cb.checked = p.amenities.includes(cb.value); });
    document.querySelectorAll(".disp-btn").forEach(b => b.classList.remove("selected"));
    document.querySelector(`.disp-btn[data-disp="${p.disponibilidad}"]`)?.classList.add("selected");
  } else {
    form.reset();
    form.querySelector('[name="moneda"]').value = "USD";
    form.querySelector('[name="disponibilidad"]').value = "disponible";
    form.querySelector('[name="minimoMeses"]').value = 1;
    document.querySelectorAll(".disp-btn").forEach(b => b.classList.remove("selected"));
    document.querySelector('.disp-btn[data-disp="disponible"]')?.classList.add("selected");
    actualizarPreviewImagen("");
    const fileInput = document.getElementById("admin-img-file");
    if (fileInput) fileInput.value = "";
  }

  actualizarPreviewAdmin();
  seccion.scrollIntoView({ behavior: "smooth" });
}

function cerrarFormulario() {
  const seccion = document.getElementById("admin-form-section");
  if (seccion) seccion.style.display = "none";
  propiedadEditando = null;
}

function guardarPropiedad(e) {
  e.preventDefault();
  const form = document.getElementById("form-propiedad");
  const amenitiesSeleccionados = [...form.querySelectorAll('[name="amenities"]:checked')].map(cb => cb.value);

  const propiedad = {
    id: form.querySelector('[name="id"]').value.trim(),
    titulo: form.querySelector('[name="titulo"]').value.trim(),
    barrio: form.querySelector('[name="barrio"]').value.trim(),
    tipo: form.querySelector('[name="tipo"]').value,
    precio: parseFloat(form.querySelector('[name="precio"]').value) || 0,
    moneda: form.querySelector('[name="moneda"]').value,
    disponibilidad: form.querySelector('[name="disponibilidad"]').value,
    amueblado: form.querySelector('[name="amueblado"]').checked,
    mascotas: form.querySelector('[name="mascotas"]').checked,
    amenities: amenitiesSeleccionados,
    serviciosIncluidos: form.querySelector('[name="serviciosIncluidos"]').checked,
    minimoMeses: parseInt(form.querySelector('[name="minimoMeses"]').value) || 1,
    descripcion: form.querySelector('[name="descripcion"]').value.trim(),
    imagen: form.querySelector('[name="imagen"]').value.trim(),
    fotos: form.querySelector('[name="fotos"]').value.trim(),
    fichaUrl: form.querySelector('[name="fichaUrl"]').value.trim(),
    disponibleDesde: form.querySelector('[name="disponibleDesde"]').value,
    whatsappMsg: form.querySelector('[name="whatsappMsg"]').value.trim(),
    esPropio: form.querySelector('[name="esPropio"]').checked
  };

  if (!propiedad.id || !propiedad.titulo || !propiedad.barrio) {
    alert("Completá los campos obligatorios: ID, Título y Barrio.");
    return;
  }

  if (propiedadEditando !== null) {
    catalogoActual[propiedadEditando] = propiedad;
  } else {
    if (catalogoActual.find(p => p.id === propiedad.id)) {
      alert(`Ya existe una propiedad con el ID "${propiedad.id}". Usá un ID único.`);
      return;
    }
    catalogoActual.push(propiedad);
  }

  guardarCatalogo();
  inicializarFiltros();
  renderizarTablaAdmin();
  renderizarCatalogo();
  cerrarFormulario();
  mostrarToast("Propiedad guardada ✓");
}

function eliminarPropiedad(idx) {
  const p = catalogoActual[idx];
  if (confirm(`¿Eliminar "${p.titulo}"? Esta acción no se puede deshacer.`)) {
    catalogoActual.splice(idx, 1);
    guardarCatalogo();
    inicializarFiltros();
    renderizarTablaAdmin();
    renderizarCatalogo();
    mostrarToast("Propiedad eliminada.");
  }
}

function duplicarPropiedad(idx) {
  const original = catalogoActual[idx];
  const copia = { ...original, id: original.id + "-copia", titulo: original.titulo + " (copia)" };
  catalogoActual.push(copia);
  guardarCatalogo();
  renderizarTablaAdmin();
  renderizarCatalogo();
  mostrarToast("Propiedad duplicada.");
}

function exportarCatalogo() {
  const json = JSON.stringify(catalogoActual, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "departamentos.json";
  a.click();
  URL.revokeObjectURL(url);
  localStorage.removeItem("br_catalogo");
  mostrarToast("✅ Subí el archivo departamentos.json a la carpeta data/ del servidor por FTP para publicar los cambios.");
}

function importarCatalogo() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const datos = JSON.parse(ev.target.result);
        if (!Array.isArray(datos)) throw new Error();
        if (confirm(`Importar ${datos.length} propiedades? Reemplaza el catálogo actual.`)) {
          catalogoActual = datos;
          guardarCatalogo();
          inicializarFiltros();
          renderizarTablaAdmin();
          renderizarCatalogo();
          mostrarToast(`${datos.length} propiedades importadas.`);
        }
      } catch {
        alert("Archivo inválido. Usá un JSON exportado de este panel.");
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function actualizarPreviewImagen(src) {
  const wrap = document.getElementById("admin-img-preview");
  if (!wrap) return;
  if (src && src.trim()) {
    wrap.innerHTML = `<img src="${src}" alt="preview" onerror="this.parentElement.innerHTML='📸'" />`;
  } else {
    wrap.innerHTML = "📸";
  }
}

function actualizarPreviewAdmin() {
  const form = document.getElementById("form-propiedad");
  const preview = document.getElementById("admin-card-preview");
  if (!form || !preview) return;

  const amenities = [...form.querySelectorAll('[name="amenities"]:checked')].map(cb => cb.value);
  const p = {
    id: form.querySelector('[name="id"]')?.value || "",
    titulo: form.querySelector('[name="titulo"]')?.value || "Sin título",
    barrio: form.querySelector('[name="barrio"]')?.value || "—",
    tipo: form.querySelector('[name="tipo"]')?.value || "—",
    precio: parseFloat(form.querySelector('[name="precio"]')?.value) || 0,
    moneda: form.querySelector('[name="moneda"]')?.value || "USD",
    disponibilidad: form.querySelector('[name="disponibilidad"]')?.value || "disponible",
    amueblado: form.querySelector('[name="amueblado"]')?.checked || false,
    mascotas: form.querySelector('[name="mascotas"]')?.checked || false,
    amenities,
    serviciosIncluidos: form.querySelector('[name="serviciosIncluidos"]')?.checked || false,
    minimoMeses: parseInt(form.querySelector('[name="minimoMeses"]')?.value) || 1,
    descripcion: form.querySelector('[name="descripcion"]')?.value || "",
    imagen: form.querySelector('[name="imagen"]')?.value.trim() || "",
    fotos: form.querySelector('[name="fotos"]')?.value.trim() || "",
    fichaUrl: form.querySelector('[name="fichaUrl"]')?.value.trim() || "",
    disponibleDesde: form.querySelector('[name="disponibleDesde"]')?.value || "",
    whatsappMsg: form.querySelector('[name="whatsappMsg"]')?.value || "",
    esPropio: form.querySelector('[name="esPropio"]')?.checked || false
  };

  preview.innerHTML = `<div style="max-width:360px;">${crearCardHTML(p)}</div>`;
}

function setDisponibilidad(btn, valor) {
  document.querySelectorAll(".disp-btn").forEach(b => b.classList.remove("selected"));
  btn.classList.add("selected");
  const sel = document.querySelector('[name="disponibilidad"]');
  if (sel) sel.value = valor;
  actualizarPreviewAdmin();
}

// ======================================================
// TOAST
// ======================================================
function mostrarToast(msg) {
  const toast = document.getElementById("br-toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}
