let checkingInterval;
let currentOverlayTimeout = null;
let activeFile = null;
let playedFiles = new Set();
let player;
let isYoutubeApiLoaded = false;
let youtubePlayerPromise = null;
let userInteracted = false;

// Esta función es llamada automáticamente por la API de YouTube
function onYouTubeIframeAPIReady() {
  console.log("API de YouTube lista.");
  isYoutubeApiLoaded = true;
  if (youtubePlayerPromise) {
    youtubePlayerPromise.resolve();
  }
}

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

function clearAll() {
  if (currentOverlayTimeout) {
    clearTimeout(currentOverlayTimeout);
    currentOverlayTimeout = null;
  }
  if (player) {
    try {
      player.destroy();
    } catch (e) {
      console.log("Error al destruir player:", e);
    }
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
  activeFile = null;
}

function showOverlay(contentId, callback, duracion) {
  if (activeFile === contentId) return;
  clearAll();
  const overlay = document.getElementById("overlay");
  const mainIframe = document.getElementById("main-iframe");
  activeFile = contentId;
  playedFiles.add(contentId);
  mainIframe.style.display = "none";
  overlay.style.display = "flex";
  callback();
  if (duracion) {
    currentOverlayTimeout = setTimeout(() => {
      console.log(`Duración de ${contentId} terminada. Cerrando overlay.`);
      clearAll();
    }, duracion * 1000);
  }
}

function showBirthdayMessage(nombre, duracion) {
  showOverlay(`cumpleanos_${nombre}_${new Date().getFullYear()}-${new Date().getMonth()}-${new Date().getDate()}`, () => {
    const dynamicContent = document.getElementById("dynamic-content");
    const birthdayText = document.getElementById("birthday-text");

    dynamicContent.innerHTML = `<img src="/static/avisos/cumpleanos.png" alt="Feliz Cumpleaños" class="birthday-background-image">`;
    dynamicContent.style.display = 'block';

    birthdayText.innerHTML = `${nombre}`;
    birthdayText.style.display = 'block';
  }, duracion);
}

async function playYoutubeVideo(videoId, duracion) {
  const muted = !userInteracted;
  console.log(`Intentando reproducir video de YouTube con ID: ${videoId}. Muted: ${muted}`);
  showOverlay(`youtube_${videoId}`, async () => {
    const dynamicContent = document.getElementById("dynamic-content");
    dynamicContent.innerHTML = `<div id="youtube-player" style="width: 100%; height: 100%;"></div>`;
    dynamicContent.style.display = 'block';
    document.getElementById('audio-button').style.display = 'none';

    try {
      await loadYoutubeApi();
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
          'mute': muted ? 1 : 0,
          'rel': 0,
          'showinfo': 0,
          'iv_load_policy': 3
        },
        events: {
          'onReady': (event) => {
            console.log("Video YouTube listo para reproducir");
            event.target.playVideo();
            if (!muted) {
              event.target.setVolume(100);
              event.target.unMute();
            }
          },
          'onStateChange': (event) => {
            if (event.data === YT.PlayerState.ENDED) {
              console.log("Video YouTube terminado");
              clearAll();
            }
          },
          'onError': (event) => {
            console.error("Error en YouTube Player:", event.data);
            clearAll();
          }
        }
      });
    } catch (error) {
      console.error("Error al cargar la API o crear el reproductor:", error);
      dynamicContent.innerHTML = '<div style="color:red; text-align:center;">Error al cargar el reproductor de YouTube</div>';
      clearAll();
    }
  }, duracion);
}

// ✅ FUNCIÓN REEMPLAZADA: TODO EN FRONTEND
async function checkEstado() {
  if (document.getElementById('init-overlay').style.display === 'flex') {
    console.log("Esperando interacción de inicio...");
    return;
  }

  try {
    const [horariosRes, cumpleanosRes] = await Promise.all([
      fetch('/horarios.json'),
      fetch('/cumpleanos.json')
    ]);

    if (!horariosRes.ok || !cumpleanosRes.ok) {
      throw new Error("No se pudieron cargar los archivos JSON");
    }

    const horarios_semanales = await horariosRes.json();
    const cumpleanos = await cumpleanosRes.json();

    const ahora = new Date();
    const dia_semana = ahora.getDay(); // 0 = domingo, 1 = lunes, ..., 6 = sábado
    const ahora_time = ahora.toTimeString().split(' ')[0];
    const [h, m, s] = ahora_time.split(':').map(Number);
    const ahora_segundos = h * 3600 + m * 60 + s;

    const hoy_str = ("0" + (ahora.getMonth() + 1)).slice(-2) + "-" + ("0" + ahora.getDate()).slice(-2); // "MM-DD"

    const cumpleaneros_hoy = cumpleanos
      .filter(p => p.fecha === hoy_str)
      .map(p => p.nombre);

    const horarios_hoy = horarios_semanales[dia_semana] || {};

    // 1. Verificar cumpleaños
    if (horarios_hoy.cumpleanos && cumpleaneros_hoy.length > 0) {
      for (const evento of horarios_hoy.cumpleanos) {
        const [hi, mi, si] = evento.hora_inicio.split(':').map(Number);
        const inicio_segundos = hi * 3600 + mi * 60 + si;
        const duracion_por_persona = evento.duracion_por_persona || 60;
        const total_duracion = cumpleaneros_hoy.length * duracion_por_persona;
        const fin_segundos = inicio_segundos + total_duracion;

        if (ahora_segundos >= inicio_segundos && ahora_segundos <= fin_segundos) {
          const segundos_transcurridos = ahora_segundos - inicio_segundos;
          const indice_persona = Math.floor(segundos_transcurridos / duracion_por_persona);
          if (indice_persona < cumpleaneros_hoy.length) {
            const nombre_actual = cumpleaneros_hoy[indice_persona];
            showBirthdayMessage(nombre_actual, duracion_por_persona);
            return;
          }
        }
      }
    }

    // 2. Verificar anuncios_video
    if (horarios_hoy.anuncios_video) {
      for (const evento of horarios_hoy.anuncios_video) {
        const [hi, mi, si] = evento.hora_inicio.split(':').map(Number);
        const inicio_segundos = hi * 3600 + mi * 60 + si;
        const duracion_evento = evento.duracion || 60;
        if (ahora_segundos >= inicio_segundos && ahora_segundos <= inicio_segundos + duracion_evento) {
          playYoutubeVideo(evento.archivo, duracion_evento);
          return;
        }
      }
    }

    // 3. Verificar pausas_activas
    if (horarios_hoy.pausas_activas) {
      for (const lista_pausa of Object.values(horarios_hoy.pausas_activas)) {
        for (const evento of lista_pausa) {
          const [hi, mi, si] = evento.hora_inicio.split(':').map(Number);
          const inicio_segundos = hi * 3600 + mi * 60 + si;
          const duracion_evento = evento.duracion || 60;
          if (ahora_segundos >= inicio_segundos && ahora_segundos <= inicio_segundos + duracion_evento) {
            playYoutubeVideo(evento.archivo, duracion_evento);
            return;
          }
        }
      }
    }

    // Si no hay contenido activo
    const overlay = document.getElementById("overlay");
    const isOverlayVisible = overlay.style.display !== "none";
    if (isOverlayVisible) {
      console.log("No hay contenido programado. Volviendo a la página principal.");
      clearAll();
    }
    playedFiles.clear();

  } catch (error) {
    console.error("Error al verificar estado (frontend):", error);
    clearAll();
    const overlay = document.getElementById("overlay");
    const dynamicContent = document.getElementById("dynamic-content");
    overlay.style.display = "flex";
    dynamicContent.innerHTML = '<div style="color:red; text-align:center;">Error al cargar datos. Reintentando...</div>';
    setTimeout(() => {
      overlay.style.display = "none";
    }, 5000);
  }
}

function initializeApplication() {
  console.log("Página cargada. Iniciando.");
  if (!userInteracted) {
    document.getElementById('init-overlay').style.display = 'flex';
    document.getElementById('main-iframe').style.display = 'none';
  } else {
    checkEstado();
    checkingInterval = setInterval(checkEstado, 15000);
  }
}

function handleStartSound() {
  userInteracted = true;
  document.getElementById('init-overlay').style.display = 'none';
  document.getElementById('main-iframe').style.display = 'block';
  console.log("Interacción de usuario registrada. Habilitando sonido.");
  checkEstado();
  checkingInterval = setInterval(checkEstado, 15000);
}

window.addEventListener('load', initializeApplication);