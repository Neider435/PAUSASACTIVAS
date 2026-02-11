let checkingInterval;
let currentOverlayTimeout = null;
let activeFile = null;
let playedFiles = new Set();
let player;
let isYoutubeApiLoaded = false;
let youtubePlayerPromise = null;
let userInteracted = false; // <<< BANDERA CLAVE

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
  showOverlay(
    `cumpleanos_${nombre}_${new Date().getFullYear()}-${new Date().getMonth()}-${new Date().getDate()}`, 
    () => {
      const dynamicContent = document.getElementById("dynamic-content");
      const birthdayText = document.getElementById("birthday-text"); // Este es el contenedor del texto
      
      // 1. Inyectar la imagen de fondo en dynamicContent (Usando la corrección de imagen)
      dynamicContent.innerHTML = `<img src="/static/avisos/cumpleanos.png" alt="Feliz Cumpleaños" class="birthday-background-image">`;
      dynamicContent.style.display = 'block';
      
      // 2. Colocar solo el nombre dentro del div 'birthday-text' (Usando la corrección de texto)
      birthdayText.innerHTML = `${nombre}`;
      birthdayText.style.display = 'block';
    }, 
    duracion
  );
}

async function playYoutubeVideo(videoId, duracion) {
  // Si el usuario ya interactuó, muted es false (con audio). Si no, es true (sin audio).
  const muted = !userInteracted;
  console.log(`Intentando reproducir video de YouTube con ID: ${videoId}. Muted: ${muted}`);
  
  showOverlay(
    `youtube_${videoId}`, 
    async () => {
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
            'mute': muted ? 1 : 0, // Utiliza la bandera muted
            'rel': 0,
            'showinfo': 0,
            'iv_load_policy': 3
          },
          events: {
            'onReady': (event) => {
              console.log("Video YouTube listo para reproducir");
              event.target.playVideo();
              // Si no está muteado, nos aseguramos de que el volumen esté al 100
              if (!muted) {
                event.target.setVolume(100);
                event.target.unMute();
              }
            },
            'onStateChange': (event) => {
              console.log("Estado del video YouTube:", event.data);
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
    }, 
    duracion
  );
}

// ============================================
// FUNCIÓN MODIFICADA: checkEstado()
// ============================================
async function checkEstado() {
  // Si el overlay de inicio está activo, no hacemos nada más.
  if (document.getElementById('init-overlay').style.display === 'flex') {
    console.log("Esperando interacción de inicio...");
    return;
  }

  try {
    console.log("Verificando estado desde archivos JSON locales...");

    // Cargar ambos archivos JSON directamente
    const [cumpleResponse, horarioResponse] = await Promise.all([
      fetch("cumpleanos.json"),
      fetch("horarios.json")
    ]);

    if (!cumpleResponse.ok || !horarioResponse.ok) {
      throw new Error(`Error al cargar JSONs: cumple=${cumpleResponse.status}, horarios=${horarioResponse.status}`);
    }

    const cumpleanosData = await cumpleResponse.json();
    const horariosData = await horarioResponse.json();

    // Aseguramos que cumpleanosData sea un array
    const cumpleanosArray = Array.isArray(cumpleanosData) ? cumpleanosData : [cumpleanosData];
    
    // Extraer los horarios de la clave "0" si existe
    let horariosArray = [];
    if (horariosData && horariosData["0"] && horariosData["0"].cumpleanos) {
      horariosArray = Array.isArray(horariosData["0"].cumpleanos) ? horariosData["0"].cumpleanos : [horariosData["0"].cumpleanos];
    }

    // Fecha y hora actual
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;

    let activeContent = null;

    // 1. Verificar cumpleaños
    for (const persona of cumpleanosArray) {
      // Parsear la fecha en formato "MM-DD"
      const [mesStr, diaStr] = persona.fecha.split('-');
      const mes = parseInt(mesStr, 10);
      const dia = parseInt(diaStr, 10);
      
      const birthDate = new Date(now.getFullYear(), mes - 1, dia);
      if (birthDate.toDateString() === today.toDateString()) {
        activeContent = {
          activo: true,
          tipo: "cumpleanos",
          nombre: persona.nombre,
          duracion: 10
        };
        break;
      }
    }

    // 2. Si hay cumpleaños, verificar si estamos en una de las horas programadas
    if (activeContent) {
      let isInScheduledTime = false;
      let scheduledDuration = 60; // Duración por defecto
      
      for (const horario of horariosArray) {
        const [horaStr, minutoStr] = horario.hora_inicio.split(':').map(Number);
        const startTime = horaStr * 60 + minutoStr;
        const endTime = startTime + (horario.duracion_por_persona || 60);
        
        if (currentTime >= startTime && currentTime <= endTime) {
          isInScheduledTime = true;
          scheduledDuration = horario.duracion_por_persona || 60;
          break;
        }
      }
      
      if (!isInScheduledTime) {
        // No estamos en horario programado para cumpleaños
        activeContent = { activo: false };
      } else {
        // Estamos en horario programado, usar la duración especificada
        activeContent.duracion = scheduledDuration;
      }
    }

    // --- Lógica de visualización (igual que antes) ---
    const overlay = document.getElementById("overlay");
    const isOverlayVisible = overlay.style.display !== "none";

    if (activeContent.activo) {
      let contentId;
      if (activeContent.tipo === "cumpleanos") {
        contentId = `cumpleanos_${activeContent.nombre}_${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
      } else {
        contentId = `${activeContent.tipo}_${activeContent.archivo}`;
      }

      if (!playedFiles.has(contentId)) {
        console.log(`Nuevo contenido activo: ${activeContent.tipo} - ${activeContent.archivo || activeContent.nombre}`);
        if (activeContent.tipo === "cumpleanos") {
          showBirthdayMessage(activeContent.nombre, activeContent.duracion);
        } else if (activeContent.tipo === "anuncio_video" || activeContent.tipo === "pausas_activas") {
          if (activeContent.archivo && /^[a-zA-Z0-9_-]{11}$/.test(activeContent.archivo)) {
            playYoutubeVideo(activeContent.archivo, activeContent.duracion);
          } else {
            console.error("ID de YouTube inválido:", activeContent.archivo);
            clearAll();
          }
        }
      }
    } else {
      if (isOverlayVisible) {
        console.log("No hay contenido programado. Volviendo a la página principal.");
        clearAll();
      }
      playedFiles.clear();
    }

  } catch (error) {
    console.error("Error al verificar estado desde JSONs:", error);
    clearAll();
    const mainIframe = document.getElementById("main-iframe");
    mainIframe.style.display = "block";
    const dynamicContent = document.getElementById("dynamic-content");
    dynamicContent.innerHTML = `<div style="color:red; text-align:center;">Error al cargar configuración.</div>`;
    dynamicContent.style.display = 'block';
    document.getElementById("overlay").style.display = "flex";
    setTimeout(() => {
      document.getElementById("overlay").style.display = "none";
    }, 5000);
  }
}

function initializeApplication() {
  console.log("Página cargada. Iniciando.");
  // Muestra el overlay de inicio si el usuario no ha interactuado.
  if (!userInteracted) {
    document.getElementById('init-overlay').style.display = 'flex';
    document.getElementById('main-iframe').style.display = 'none';
  } else {
    // Si ya interactuó, inicia el chequeo de estado inmediatamente.
    checkEstado();
    checkingInterval = setInterval(checkEstado, 15000);
  }
}

// <<< FUNCIÓN DE INTERACCIÓN DE USUARIO (LA TRAMPA LEGAL) >>>
function handleStartSound() {
  userInteracted = true;
  document.getElementById('init-overlay').style.display = 'none';
  document.getElementById('main-iframe').style.display = 'block';
  console.log("Interacción de usuario registrada. Habilitando sonido.");
  // Inicia el chequeo de estado después de la interacción
  checkEstado();
  checkingInterval = setInterval(checkEstado, 15000);
}

window.addEventListener('load', initializeApplication);
