let checkingInterval;
let currentOverlayTimeout = null;
let activeFile = null;
let playedFiles = new Set();
let player;
let isYoutubeApiLoaded = false;
let youtubePlayerPromise = null;
let userInteracted = false;
let contentLocks = {}; 

const isMobileOrTV = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|SmartTV|TV|Xbox|PlayStation|Nintendo|Apple TV|Samsung TV/i.test(navigator.userAgent);
console.log(`Dispositivo detectado: ${isMobileOrTV ? 'Móvil/TV' : 'Computadora'}`);

function onYouTubeIframeAPIReady() {
  console.log("API de YouTube lista.");
  isYoutubeApiLoaded = true;
  if (youtubePlayerPromise) youtubePlayerPromise.resolve();
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
    try { player.destroy(); } catch (e) { console.log("Error player:", e); }
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
  playedFiles.add(contentId);  // ✅ Se marca como reproducido
  
  // Bloqueo temporal: duración + 5 segundos de margen
  const lockTime = Date.now() + (duracion * 1000) + 5000;
  contentLocks[contentId] = lockTime;
  
  mainIframe.style.display = "none";
  overlay.style.display = "flex";
  callback();
  
  if (duracion) {
    currentOverlayTimeout = setTimeout(() => {
      if (activeFile === contentId) clearAll();
    }, (duracion * 1000) + 8000);
  }
}

function showBirthdayMessage(nombre, duracion) {
  const contentId = `cumpleanos_${nombre}`;  // ✅ ID consistente
  showOverlay(contentId, () => {
    const dynamicContent = document.getElementById("dynamic-content");
    const birthdayText = document.getElementById("birthday-text");
    dynamicContent.innerHTML = `<img src="/static/avisos/cumpleanos.png" alt="Feliz Cumpleaños">`;
    dynamicContent.style.display = 'block';
    birthdayText.innerHTML = `${nombre}`;
    birthdayText.style.display = 'block';
  }, duracion);
}

async function playYoutubeVideo(videoId, duracion) {
  const cleanVideoId = videoId.trim();
  const muted = isMobileOrTV ? true : !userInteracted;
  
  // ✅ ID CONSISTENTE: tipo_archivo (igual que en checkEstado)
  const contentId = `video_${cleanVideoId}`;
  
  // Verificar bloqueo
  if (contentLocks[contentId] && Date.now() < contentLocks[contentId]) {
    console.log(`🔒 Bloqueado: ${contentId}`);
    return;
  }

  console.log(`📱 Dispositivo: ${isMobileOrTV ? 'Móvil/TV' : 'PC'} | Muted: ${muted}`);
  
  showOverlay(contentId, async () => {
    const dynamicContent = document.getElementById("dynamic-content");
    dynamicContent.innerHTML = `<div id="youtube-player" style="width:100%;height:100%;position:relative;"></div>`;
    dynamicContent.style.display = 'flex';
    document.getElementById('audio-button').style.display = 'none';
    
    try {
      await loadYoutubeApi();
      
      player = new YT.Player('youtube-player', {
        host: 'https://www.youtube-nocookie.com',
        height: '100%', width: '100%', videoId: cleanVideoId,
        playerVars: {
          'autoplay': 1, 'playsinline': 1, 'controls': 0, 'modestbranding': 1,
          'mute': muted ? 1 : 0, 'rel': 0, 'showinfo': 0, 'iv_load_policy': 3,
          'origin': window.location.origin
        },
        events: {
          'onReady': (event) => {
            console.log("✅ Video listo");
            event.target.playVideo();
            if (!muted) { event.target.setVolume(100); event.target.unMute(); }
          },
          'onStateChange': (event) => {
            if (event.data === YT.PlayerState.ENDED) {
              console.log("✅ Video terminado");
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
      console.error("❌ Error API:", error);
      delete contentLocks[contentId];
      clearAll();
    }
  }, duracion);
}

// ✅ FUNCIÓN PARA LIMPIAR DATOS JSON (trim recursivo)
function limpiarDatos(obj) {
  if (typeof obj === 'string') return obj.trim();
  if (Array.isArray(obj)) return obj.map(limpiarDatos);
  if (typeof obj === 'object' && obj !== null) {
    const limpio = {};
    for (let [k, v] of Object.entries(obj)) {
      limpio[k.trim()] = limpiarDatos(v);
    }
    return limpio;
  }
  return obj;
}

async function checkEstado() {
  if (document.getElementById('init-overlay')?.style.display === 'flex') return;

  try {
    const timestamp = Date.now();
    const [cumpleResponse, horarioResponse] = await Promise.all([
      fetch(`/data/cumpleanos.json?t=${timestamp}`),
      fetch(`/data/horarios.json?t=${timestamp}`)
    ]);

    if (!cumpleResponse.ok || !horarioResponse.ok) {
      throw new Error(`Error HTTP: ${cumpleResponse.status}, ${horarioResponse.status}`);
    }

    // ✅ LIMPIAR los datos al cargar
    let cumpleanosData = limpiarDatos(await cumpleResponse.json());
    let horariosData = limpiarDatos(await horarioResponse.json());
    
    const cumpleanosArray = Array.isArray(cumpleanosData) ? cumpleanosData : [cumpleanosData];
    
    const now = new Date();
    const dayOfWeek = now.getDay();
    const todayConfig = horariosData[dayOfWeek.toString()] || horariosData["0"];
    
    if (!todayConfig) return;

    const cumpleanosHorarios = todayConfig.cumpleanos || [];
    const anunciosVideo = todayConfig.anuncios_video || [];
    const pausasActivas = todayConfig.pausas_activas || {};

    const currentTime = now.getHours() * 60 + now.getMinutes();
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

    // 2. Anuncios de video
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

    // 3. Pausas activas
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

    // === VISUALIZACIÓN ===
    if (activeContent) {
      // ✅ GENERAR contentId CONSISTENTE (igual formato en todas partes)
      let contentId;
      if (activeContent.tipo === "cumpleanos") {
        contentId = `cumpleanos_${activeContent.nombre}`;
      } else {
        // ✅ Para videos: "video_ID" (coincide con playYoutubeVideo)
        contentId = `video_${activeContent.archivo}`;
      }

      // Verificar bloqueo por tiempo
      if (contentLocks[contentId] && Date.now() < contentLocks[contentId]) {
        console.log(`⏳ Esperando: ${contentId}`);
        return;
      }

      // Verificar si ya se reprodujo HOY
      if (!playedFiles.has(contentId)) {
        console.log(`🎯 REPRODUCIENDO: ${contentId}`);
        if (activeContent.tipo === "cumpleanos") {
          showBirthdayMessage(activeContent.nombre, activeContent.duracion);
        } else if (activeContent.archivo && /^[a-zA-Z0-9_-]{11}$/.test(activeContent.archivo.trim())) {
          playYoutubeVideo(activeContent.archivo, activeContent.duracion);
        }
      } else {
        console.log(`⏭️ Ya reproducido hoy: ${contentId}`);
      }
    } else {
      // Limpiar locks expirados
      const nowTime = Date.now();
      for (const key in contentLocks) {
        if (contentLocks[key] < nowTime) delete contentLocks[key];
      }
      
      const overlay = document.getElementById("overlay");
      if (overlay?.style.display !== "none") clearAll();
      
      // ✅ SOLO limpiar playedFiles a medianoche (NO en cada ciclo sin contenido)
      if (now.getHours() === 0 && now.getMinutes() < 2) {
        playedFiles.clear();
        console.log("🔄 playedFiles limpiado para nuevo día");
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
    checkingInterval = setInterval(checkEstado, 30000); // 30 segundos
  }
}

function handleStartSound() {
  userInteracted = true;
  document.getElementById('init-overlay').style.display = 'none';
  document.getElementById('main-iframe').style.display = 'block';
  checkEstado();
  checkingInterval = setInterval(checkEstado, 30000);
}

window.addEventListener('load', initializeApplication);
