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
      const birthdayText = document.getElementById("birthday-text");
      
      dynamicContent.innerHTML = `<img src="/static/avisos/cumpleanos.png" alt="Feliz Cumpleaños" class="birthday-background-image">`;
      dynamicContent.style.display = 'block';
      
      birthdayText.innerHTML = `${nombre}`;
      birthdayText.style.display = 'block';
    }, 
    duracion
  );
}

async function playYoutubeVideo(videoId, duracion) {
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
// FUNCIÓN CORREGIDA: checkEstado()
// ============================================
async function checkEstado() {
  if (document.getElementById('init-overlay').style.display === 'flex') {
    console.log("Esperando interacción de inicio...");
    return;
  }

  try {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Verificando estado desde archivos JSON...");
    
    const [cumpleResponse, horarioResponse] = await Promise.all([
      fetch("cumpleanos.json"),
      fetch("horarios.json")
    ]);

    if (!cumpleResponse.ok || !horarioResponse.ok) {
      throw new Error(`Error al cargar JSONs: cumple=${cumpleResponse.status}, horarios=${horarioResponse.status}`);
    }

    const cumpleanosData = await cumpleResponse.json();
    const horariosData = await horarioResponse.json();

    const cumpleanosArray = Array.isArray(cumpleanosData) ? cumpleanosData : [cumpleanosData];
    
    // Extraer los horarios de la clave "0" si existe
    let horariosArray = [];
    if (horariosData && horariosData["0"] && horariosData["0"].cumpleanos) {
      horariosArray = Array.isArray(horariosData["0"].cumpleanos) ? horariosData["0"].cumpleanos : [horariosData["0"].cumpleanos];
    }
    
    console.log("Horarios cargados:", horariosArray);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;
    
    console.log(`Hora actual: ${currentHour}:${currentMinute.toString().padStart(2, '0')} (${currentTime} minutos desde medianoche)`);
    console.log(`Fecha actual: ${today.toDateString()}`);

    let activeContent = null;
    let birthdayPerson = null;

    // 1. Verificar si hay cumpleaños HOY
    for (const persona of cumpleanosArray) {
      const [mesStr, diaStr] = persona.fecha.split('-');
      const mes = parseInt(mesStr, 10);
      const dia = parseInt(diaStr, 10);
      
      const birthDate = new Date(now.getFullYear(), mes - 1, dia);
      
      console.log(`Verificando cumpleaños: ${persona.nombre} - ${dia}/${mes} - Fecha: ${birthDate.toDateString()}`);
      
      if (birthDate.toDateString() === today.toDateString()) {
        birthdayPerson = persona;
        console.log(`✓ CUMPLEAÑOS HOY: ${persona.nombre}`);
        break;
      }
    }

    // 2. Si hay cumpleaños HOY, verificar si estamos en un horario programado
    if (birthdayPerson) {
      console.log(`Hay cumpleaños hoy. Verificando horarios programados...`);
      
      let isInScheduledTime = false;
      let scheduledDuration = 60;
      
      for (const horario of horariosArray) {
        // Parsear hora_inicio que puede ser "HH:MM:SS" o "HH:MM"
        const timeParts = horario.hora_inicio.split(':').map(Number);
        const horaStr = timeParts[0];
        const minutoStr = timeParts[1] || 0;
        
        const startTime = horaStr * 60 + minutoStr;
        // ⚠️ CORRECCIÓN: Convertir segundos a minutos para el cálculo del rango
        const duracionMinutos = (horario.duracion_por_persona || 60) / 60;
        const endTime = startTime + duracionMinutos;
        
        console.log(`  Horario: ${horaStr}:${minutoStr.toString().padStart(2, '0')} - Duración: ${horario.duracion_por_persona || 60} seg (${duracionMinutos} min)`);
        console.log(`  Rango: ${startTime} - ${endTime} minutos`);
        
        if (currentTime >= startTime && currentTime <= endTime) {
          isInScheduledTime = true;
          scheduledDuration = horario.duracion_por_persona || 60;
          console.log(`  ✓ ESTAMOS EN HORARIO PROGRAMADO!`);
          break;
        } else {
          console.log(`  ✗ Fuera de este horario`);
        }
      }
      
      if (isInScheduledTime) {
        activeContent = {
          activo: true,
          tipo: "cumpleanos",
          nombre: birthdayPerson.nombre,
          duracion: scheduledDuration
        };
        console.log(`✓ CONTENIDO ACTIVO: Cumpleaños de ${birthdayPerson.nombre} por ${scheduledDuration} segundos`);
      } else {
        console.log(`✗ No estamos en ningún horario programado para mostrar el cumpleaños`);
        activeContent = { activo: false };
      }
    } else {
      console.log("No hay cumpleaños hoy.");
      activeContent = { activo: false };
    }

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // --- Lógica de visualización ---
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
        console.log(`Mostrando contenido: ${activeContent.tipo} - ${activeContent.nombre || activeContent.archivo}`);
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
        console.log("No hay contenido activo. Cerrando overlay.");
        clearAll();
      }
      playedFiles.clear();
    }

  } catch (error) {
    console.error("Error al verificar estado:", error);
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
  console.log("Página cargada. Iniciando aplicación...");
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
