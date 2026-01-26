let checkingInterval;
let currentOverlayTimeout = null;
let player;
let isYoutubeApiLoaded = false;
let youtubePlayerPromise = null;
let userInteracted = false;

// ✅ PRE-CARGAR LA API AL INICIO
function loadYoutubeApi() {
  if (!isYoutubeApiLoaded && !document.getElementById('youtube-api-script')) {
    const tag = document.createElement('script');
    tag.id = 'youtube-api-script';
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    youtubePlayerPromise = new Promise((resolve) => {
      window.onYouTubeIframeAPIReady = () => {
        isYoutubeApiLoaded = true;
        resolve();
      };
    });
  }
  return youtubePlayerPromise || Promise.resolve();
}

// Llamar inmediatamente
loadYoutubeApi();

function clearAll() {
  if (currentOverlayTimeout) {
    clearTimeout(currentOverlayTimeout);
    currentOverlayTimeout = null;
  }
  if (player) {
    try { player.destroy(); } catch (e) { console.log("Error al destruir player:", e); }
    player = null;
  }
  const overlay = document.getElementById("overlay");
  const dynamicContent = document.getElementById("dynamic-content");
  const birthdayText = document.getElementById("birthday-text");
  const audioButton = document.getElementById("audio-button");
  const mainIframe = document.getElementById("main-iframe");

  dynamicContent.innerHTML = '';
  dynamicContent.style.display = 'none';
  birthdayText.innerHTML = '';
  birthdayText.style.display = 'none';
  audioButton.style.display = 'none';
  overlay.style.display = "none";
  mainIframe.style.display = "block";
}

function showOverlay(contentId, callback, duracion) {
  clearAll();
  const overlay = document.getElementById("overlay");
  const mainIframe = document.getElementById("main-iframe");
  mainIframe.style.display = "none";
  overlay.style.display = "flex";
  callback();
  // ✅ USAR LA DURACIÓN PARA CERRAR
  if (duracion) {
    currentOverlayTimeout = setTimeout(() => {
      console.log(`Duración de ${contentId} terminada.`);
      clearAll();
    }, duracion * 1000);
  }
}

function showBirthdayMessage(nombre, duracion) {
  showOverlay(`cumpleanos_${nombre}`, () => {
    const dynamicContent = document.getElementById("dynamic-content");
    const birthdayText = document.getElementById("birthday-text");
    dynamicContent.innerHTML = `<img src="/static/avisos/cumpleanos.png" alt="Feliz Cumpleaños" class="birthday-background-image">`;
    dynamicContent.style.display = 'block';
    birthdayText.innerHTML = `${nombre}`;
    birthdayText.style.display = 'block';
  }, duracion);
}

// ✅ ACEPTA DURACIÓN Y NO DEPENDE DE ENDED
async function playYoutubeVideo(videoId, duracion) {
  console.log(`Reproduciendo video: ${videoId} por ${duracion} segundos`);
  showOverlay(`youtube_${videoId}`, async () => {
    const dynamicContent = document.getElementById("dynamic-content");
    dynamicContent.innerHTML = `<div id="youtube-player" style="width:100%;height:100%;"></div>`;
    dynamicContent.style.display = 'block';
    document.getElementById('audio-button').style.display = 'none';

    try {
      await loadYoutubeApi(); // Asegurar que la API esté lista
      player = new YT.Player('youtube-player', {
        host: 'https://www.youtube-nocookie.com',
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: {
          'autoplay': 1,
          'playsinline': 1,
          'controls': 0,
          'modestbranding': 1,
          'mute': 1, // ← SIEMPRE EN SILENCIO (evita bloqueos)
          'rel': 0,
          'iv_load_policy': 3
        },
        events: {
          'onReady': (event) => {
            event.target.playVideo();
          },
          // ❌ NO USAR onStateChange → confiamos en la duración
          'onError': (event) => {
            console.error("Error en YouTube:", event.data);
            clearAll();
          }
        }
      });
    } catch (error) {
      console.error("Error al crear reproductor:", error);
      dynamicContent.innerHTML = '<div style="color:red;text-align:center;">Error al cargar video</div>';
      clearAll();
    }
  }, duracion); // ← ¡DURACIÓN AQUÍ!
}

// ✅ LÓGICA PRINCIPAL
async function checkEstado() {
  if (document.getElementById('init-overlay').style.display === 'flex') {
    return;
  }

  try {
    const [horariosRes, cumpleanosRes] = await Promise.all([
      fetch('/horarios.json'),
      fetch('/cumpleanos.json')
    ]);

    if (!horariosRes.ok || !cumpleanosRes.ok) {
      throw new Error("No se cargaron los JSON");
    }

    const horarios_semanales = await horariosRes.json();
    const cumpleanos = await cumpleanosRes.json();

    const ahora = new Date();
    const dia_semana = ahora.getDay();
    const ahora_time = ahora.toTimeString().split(' ')[0];
    const [h, m, s] = ahora_time.split(':').map(Number);
    const ahora_segundos = h * 3600 + m * 60 + s;

    const hoy_str = ("0" + (ahora.getMonth() + 1)).slice(-2) + "-" + ("0" + ahora.getDate()).slice(-2);
    const cumpleaneros_hoy = cumpleanos.filter(p => p.fecha === hoy_str).map(p => p.nombre);
    const horarios_hoy = horarios_semanales[dia_semana] || {};

    // --- Videos: usar duración del evento ---
    if (horarios_hoy.anuncios_video) {
      for (const evento of horarios_hoy.anuncios_video) {
        const [hi, mi, si] = evento.hora_inicio.split(':').map(Number);
        const inicio_segundos = hi * 3600 + mi * 60 + si;
        if (ahora_segundos >= inicio_segundos && ahora_segundos < inicio_segundos + 5) {
          playYoutubeVideo(evento.archivo, evento.duracion || 60);
          return;
        }
      }
    }

    if (horarios_hoy.pausas_activas) {
      for (const lista_pausa of Object.values(horarios_hoy.pausas_activas)) {
        for (const evento of lista_pausa) {
          const [hi, mi, si] = evento.hora_inicio.split(':').map(Number);
          const inicio_segundos = hi * 3600 + mi * 60 + si;
          if (ahora_segundos >= inicio_segundos && ahora_segundos < inicio_segundos + 5) {
            playYoutubeVideo(evento.archivo, evento.duracion || 60);
            return;
          }
        }
      }
    }

    // --- Cumpleaños ---
    if (horarios_hoy.cumpleanos && cumpleaneros_hoy.length > 0) {
      for (const evento of horarios_hoy.cumpleanos) {
        const [hi, mi, si] = evento.hora_inicio.split(':').map(Number);
        const inicio_segundos = hi * 3600 + mi * 60 + si;
        const duracion_por_persona = evento.duracion_por_persona || 60;
        const total_duracion = cumpleaneros_hoy.length * duracion_por_persona;
        const fin_segundos = inicio_segundos + total_duracion;

        if (ahora_segundos >= inicio_segundos && ahora_segundos <= fin_segundos) {
          const idx = Math.floor((ahora_segundos - inicio_segundos) / duracion_por_persona);
          if (idx < cumpleaneros_hoy.length) {
            showBirthdayMessage(cumpleaneros_hoy[idx], duracion_por_persona);
            return;
          }
        }
      }
    }

    const overlay = document.getElementById("overlay");
    if (overlay.style.display !== "none") {
      clearAll();
    }

  } catch (error) {
    console.error("Error:", error);
    clearAll();
    const overlay = document.getElementById("overlay");
    overlay.style.display = "flex";
    document.getElementById("dynamic-content").innerHTML = '<div style="color:red;font-size:2em;text-align:center;">⚠️ Error</div>';
    setTimeout(() => overlay.style.display = "none", 5000);
  }
}

function initializeApplication() {
  if (!userInteracted) {
    document.getElementById('init-overlay').style.display = 'flex';
    document.getElementById('main-iframe').style.display = 'none';
  } else {
    checkEstado();
    checkingInterval = setInterval(checkEstado, 10000); // ← Chequear cada 10s
  }
}

function handleStartSound() {
  userInteracted = true;
  document.getElementById('init-overlay').style.display = 'none';
  document.getElementById('main-iframe').style.display = 'block';
  checkEstado();
  checkingInterval = setInterval(checkEstado, 10000);
}

window.addEventListener('load', initializeApplication);
