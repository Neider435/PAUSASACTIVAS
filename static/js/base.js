let checkingInterval;
let currentOverlayTimeout = null;
let activeFile = null;
let playedFiles = new Set();
let player;
let isYoutubeApiLoaded = false;
let youtubePlayerPromise = null;
let userInteracted = false;

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
  // Solo aplica setTimeout si se pasa una duración válida (útil para cumpleaños)
  if (duracion !== null && duracion !== undefined) {
    currentOverlayTimeout = setTimeout(() => {
      console.log(`Duración de ${contentId} terminada. Cerrando overlay.`);
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

async function playYoutubeVideo(videoId) {
  const muted = !userInteracted;
  console.log(`Reproduciendo video YouTube: ${videoId}. Muted: ${muted}`);
  
  // NO se pasa duración → no hay setTimeout
  showOverlay(`youtube_${videoId}`, async () => {
    const dynamicContent = document.getElementById("dynamic-content");
    dynamicContent.innerHTML = `<div id="youtube-player" style="width:100%;height:100%;"></div>`;
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
          'iv_load_policy': 3
        },
        events: {
          'onReady': (event) => {
            event.target.playVideo();
            if (!muted) {
              event.target.setVolume(100);
              event.target.unMute();
            }
          },
          'onStateChange': (event) => {
            if (event.data === YT.PlayerState.ENDED) {
              console.log("Video YouTube terminado. Cerrando overlay.");
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
      console.error("Error al crear reproductor YouTube:", error);
      dynamicContent.innerHTML = '<div style="color:red;text-align:center;">Error al cargar video</div>';
      clearAll();
    }
  }, null); // ← null: desactiva cierre automático
}

// ✅ LÓGICA FRONTEND CON PRIORIDAD A VIDEOS
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
    const dia_semana = ahora.getDay(); // 0 = dom, 4 = jue
    const ahora_time = ahora.toTimeString().split(' ')[0];
    const [h, m, s] = ahora_time.split(':').map(Number);
    const ahora_segundos = h * 3600 + m * 60 + s;

    const hoy_str = ("0" + (ahora.getMonth() + 1)).slice(-2) + "-" + ("0" + ahora.getDate()).slice(-2);

    const cumpleaneros_hoy = cumpleanos
      .filter(p => p.fecha === hoy_str)
      .map(p => p.nombre);

    const horarios_hoy = horarios_semanales[dia_semana] || {};

    // --- 1. PRIORIDAD MÁXIMA: Anuncios de video ---
    if (horarios_hoy.anuncios_video) {
      for (const evento of horarios_hoy.anuncios_video) {
        const [hi, mi, si] = evento.hora_inicio.split(':').map(Number);
        const inicio_segundos = hi * 3600 + mi * 60 + si;
        if (ahora_segundos >= inicio_segundos && ahora_segundos < inicio_segundos + 5) {
          playYoutubeVideo(evento.archivo);
          return;
        }
      }
    }

    // --- 2. PRIORIDAD ALTA: Pausas activas ---
    if (horarios_hoy.pausas_activas) {
      for (const lista_pausa of Object.values(horarios_hoy.pausas_activas)) {
        for (const evento of lista_pausa) {
          const [hi, mi, si] = evento.hora_inicio.split(':').map(Number);
          const inicio_segundos = hi * 3600 + mi * 60 + si;
          if (ahora_segundos >= inicio_segundos && ahora_segundos < inicio_segundos + 5) {
            playYoutubeVideo(evento.archivo);
            return;
          }
        }
      }
    }

    // --- 3. SOLO SI NO HAY VIDEO: Cumpleaños ---
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

    // Nada activo
    const overlay = document.getElementById("overlay");
    if (overlay.style.display !== "none") {
      clearAll();
    }
    playedFiles.clear();

  } catch (error) {
    console.error("Error en checkEstado:", error);
    clearAll();
    const overlay = document.getElementById("overlay");
    overlay.style.display = "flex";
    document.getElementById("dynamic-content").innerHTML = '<div style="color:red;font-size:2em;text-align:center;">⚠️ Error en datos</div>';
    setTimeout(() => overlay.style.display = "none", 5000);
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
  console.log("Interacción registrada. Sonido habilitado.");
  checkEstado();
  checkingInterval = setInterval(checkEstado, 15000);
}

window.addEventListener('load', initializeApplication);

