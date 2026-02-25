let checkingInterval;
let currentOverlayTimeout = null;
let activeFile = null;
let playedFiles = new Set();
let player;
let isYoutubeApiLoaded = false;
let youtubePlayerPromise = null;
let userInteracted = false;

// NUEVO: Registro para bloquear contenidos mientras se reproducen
let contentLocks = {}; 

const isMobileOrTV = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|SmartTV|TV|Xbox|PlayStation|Nintendo|Apple TV|Samsung TV/i.test(navigator.userAgent);
console.log(`Dispositivo detectado: ${isMobileOrTV ? 'Móvil/TV' : 'Computadora'}`);

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
  // Doble verificación de seguridad
  if (activeFile === contentId) return;
  
  clearAll();
  
  const overlay = document.getElementById("overlay");
  const mainIframe = document.getElementById("main-iframe");
  
  activeFile = contentId;
  
  // MARCAR como reproducido INMEDIATAMENTE para evitar duplicados en los próximos 15s
  playedFiles.add(contentId);
  
  // Crear bloqueo temporal
  const lockTime = Date.now() + (duracion * 1000) + 2000; // Duración + 2s margen
  contentLocks[contentId] = lockTime;
  
  mainIframe.style.display = "none";
  overlay.style.display = "flex";
  
  callback();
  
  // Solo usamos el timeout externo como respaldo de seguridad, no como principal
  if (duracion) {
    currentOverlayTimeout = setTimeout(() => {
      // Solo limpiar si el player no ha reportado que terminó ya
      if (activeFile === contentId) {
        console.log(`[Respaldo] Duración de ${contentId} terminada. Cerrando.`);
        clearAll();
      }
    }, (duracion * 1000) + 5000); // Margen extra de 5s por si el player falla
  }
}

function showBirthdayMessage(nombre, duracion) {
  const contentId = `cumpleanos_${nombre}_${new Date().getFullYear()}-${new Date().getMonth()}-${new Date().getDate()}`;
  showOverlay(contentId, () => {
    const dynamicContent = document.getElementById("dynamic-content");
    const birthdayText = document.getElementById("birthday-text");
    
    dynamicContent.innerHTML = `<img src="/static/avisos/cumpleanos.png" alt="Feliz Cumpleaños" class="birthday-background-image">`;
    dynamicContent.style.display = 'block';
    
    birthdayText.innerHTML = `${nombre}`;
    birthdayText.style.display = 'block';
  }, duracion);
}

async function playYoutubeVideo(videoId, duracion) {
  const muted = isMobileOrTV ? true : !userInteracted;
  const contentId = `youtube_${videoId}`;
  
  // Verificar bloqueo antes de iniciar
  if (contentLocks[contentId] && Date.now() < contentLocks[contentId]) {
    console.log(`🔒 Contenido bloqueado activamente: ${contentId}`);
    return;
  }

  console.log(`📱 Dispositivo: ${isMobileOrTV ? 'Móvil/TV' : 'Computadora'} | Muted: ${muted}`);
  
  showOverlay(contentId, async () => {
    const dynamicContent = document.getElementById("dynamic-content");
    dynamicContent.innerHTML = `<div id="youtube-player" style="width: 100%; height: 100%; position: relative;"></div>`;
    dynamicContent.style.display = 'flex';
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
          'iv_load_policy': 3,
          'origin': window.location.origin
        },
        events: {
          'onReady': (event) => {
            console.log("✅ Video YouTube listo");
            event.target.playVideo();
            if (!muted) {
              event.target.setVolume(100);
              event.target.unMute();
            }
          },
          'onStateChange': (event) => {
            console.log("Estado del video:", event.data);
            if (event.data === YT.PlayerState.ENDED) {
              console.log("✅ Video terminado naturalmente");
              // Limpiar bloqueo explícitamente
              delete contentLocks[contentId];
              clearAll();
            }
          },
          'onError': (event) => {
            console.error("❌ Error YouTube:", event.data);
            delete contentLocks[contentId];
            clearAll();
          }
        }
      });
    } catch (error) {
      console.error("❌ Error API YouTube:", error);
      delete contentLocks[contentId];
      clearAll();
    }
  }, duracion);
}

async function checkEstado() {
  if (document.getElementById('init-overlay').style.display === 'flex') return;

  try {
    const [cumpleResponse, horarioResponse] = await Promise.all([
      fetch("/data/cumpleanos.json"),
      fetch("/data/horarios.json")
    ]);

    if (!cumpleResponse.ok || !horarioResponse.ok) throw new Error("Error cargando JSONs");

    const cumpleanosData = await cumpleResponse.json();
    const horariosData = await horarioResponse.json();
    const cumpleanosArray = Array.isArray(cumpleanosData) ? cumpleanosData : [cumpleanosData];
    
    const now = new Date();
    const dayOfWeek = now.getDay();
    const todayConfig = horariosData[dayOfWeek.toString()] || horariosData["0"];
    
    if (!todayConfig) return;

    const cumpleanosHorarios = todayConfig.cumpleanos || [];
    const anunciosVideo = todayConfig.anuncios_video || [];
    const pausasActivas = todayConfig.pausas_activas || {};

    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;

    let activeContent = null;

    // 1. Cumpleaños
    let birthdayPerson = null;
    for (const persona of cumpleanosArray) {
      const [mesStr, diaStr] = persona.fecha.split('-');
      const birthDate = new Date(now.getFullYear(), parseInt(mesStr) - 1, parseInt(diaStr));
      if (birthDate.toDateString() === now.toDateString()) {
        birthdayPerson = persona;
        break;
      }
    }

    if (birthdayPerson) {
      for (const horario of cumpleanosHorarios) {
        const [h, m] = horario.hora_inicio.split(':').map(Number);
        const start = h * 60 + m;
        const end = start + ((horario.duracion_por_persona || 60) / 60);
        
        if (currentTime >= start && currentTime <= end) {
          activeContent = { tipo: "cumpleanos", nombre: birthdayPerson.nombre, duracion: horario.duracion_por_persona || 60 };
          break;
        }
      }
    }

    // 2. Anuncios
    if (!activeContent) {
      for (const anuncio of anunciosVideo) {
        const [h, m] = anuncio.hora_inicio.split(':').map(Number);
        const start = h * 60 + m;
        const end = start + ((anuncio.duracion || 60) / 60);
        
        if (currentTime >= start && currentTime <= end) {
          activeContent = { tipo: "anuncio_video", archivo: anuncio.archivo, duracion: anuncio.duracion || 60 };
          break;
        }
      }
    }

    // 3. Pausas
    if (!activeContent) {
      for (const grupo of Object.values(pausasActivas)) {
        const pausas = Array.isArray(grupo) ? grupo : [grupo];
        for (const pausa of pausas) {
          const [h, m] = pausa.hora_inicio.split(':').map(Number);
          const start = h * 60 + m;
          const end = start + ((pausa.duracion || 600) / 60);
          
          if (currentTime >= start && currentTime <= end) {
            activeContent = { tipo: "pausas_activas", archivo: pausa.archivo, duracion: pausa.duracion || 600 };
            break;
          }
        }
        if (activeContent) break;
      }
    }

    // LÓGICA DE VISUALIZACIÓN CORREGIDA
    if (activeContent) {
      let contentId;
      if (activeContent.tipo === "cumpleanos") {
        contentId = `cumpleanos_${activeContent.nombre}_${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
      } else {
        contentId = `${activeContent.tipo}_${activeContent.archivo}`;
      }

      // VERIFICACIÓN DE BLOQUEO POR TIEMPO
      if (contentLocks[contentId] && Date.now() < contentLocks[contentId]) {
        console.log(`⏳ Esperando... ${contentId} aún está en periodo de bloqueo.`);
        return; // SALIR SIN HACER NADA
      }

      // Verificar si ya se reprodujo HOY (solo si no hay bloqueo activo)
      if (!playedFiles.has(contentId)) {
        console.log(`🎯 REPRODUCIENDO: ${contentId}`);
        if (activeContent.tipo === "cumpleanos") {
          showBirthdayMessage(activeContent.nombre, activeContent.duracion);
        } else if (activeContent.archivo && /^[a-zA-Z0-9_-]{11}$/.test(activeContent.archivo)) {
          playYoutubeVideo(activeContent.archivo, activeContent.duracion);
        }
      } else {
        console.log(`⏭️ Ya reproducido hoy: ${contentId}`);
      }
    } else {
      // Si no hay contenido activo en este instante, limpiamos locks antiguos
      const nowTime = Date.now();
      for (const key in contentLocks) {
        if (contentLocks[key] < nowTime) {
          delete contentLocks[key];
        }
      }
      
      const overlay = document.getElementById("overlay");
      if (overlay.style.display !== "none") {
        clearAll();
      }
      // Opcional: Limpiar playedFiles a medianoche o dejarlo así por día
      if (now.getHours() === 0 && now.getMinutes() < 2) {
        playedFiles.clear();
      }
    }

  } catch (error) {
    console.error("Error checkEstado:", error);
  }
}

function initializeApplication() {
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
  checkEstado();
  checkingInterval = setInterval(checkEstado, 15000);
}

window.addEventListener('load', initializeApplication);
