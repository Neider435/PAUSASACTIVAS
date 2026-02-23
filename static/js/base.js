let checkingInterval;
let currentOverlayTimeout = null;
let activeFile = null;
let playedFiles = new Set();
let player;
let isYoutubeApiLoaded = false;
let youtubePlayerPromise = null;
let userInteracted = false; // <<< BANDERA CLAVE

// Detectar si estamos en una TV o dispositivo móvil
const isMobileOrTV = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|SmartTV|TV|Xbox|PlayStation|Nintendo|Apple TV|Samsung TV/i.test(navigator.userAgent);
console.log(`Dispositivo detectado: ${isMobileOrTV ? 'Móvil/TV' : 'Computadora'}`);

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

// ============================================
// FUNCIÓN CORREGIDA: playYoutubeVideo() - Funciona en TV y Celular
// ============================================
async function playYoutubeVideo(videoId, duracion) {
  // En móviles y TV, SIEMPRE MUTEADO para que funcione el autoplay
  const muted = isMobileOrTV ? true : !userInteracted;
  console.log(`📱 Dispositivo: ${isMobileOrTV ? 'Móvil/TV' : 'Computadora'} | Muted: ${muted}`);
  
  showOverlay(
    `youtube_${videoId}`, 
    async () => {
      const dynamicContent = document.getElementById("dynamic-content");
      
      // Asegurar que el contenedor del video esté visible
      dynamicContent.innerHTML = `<div id="youtube-player" style="width: 100%; height: 100%; position: relative;"></div>`;
      dynamicContent.style.display = 'flex';
      document.getElementById('audio-button').style.display = 'none';
      
      try {
        // Intentar usar la API de YouTube
        await loadYoutubeApi();
        
        // Añadir parámetro 'origin' para evitar errores CORS
        player = new YT.Player('youtube-player', {
          host: 'https://www.youtube-nocookie.com',
          height: '100%',
          width: '100%',
          videoId: videoId,
          playerVars: {
            'autoplay': 1,
            'playsinline': 1, // Crucial para móviles
            'controls': 0,
            'modestbranding': 1,
            'mute': muted ? 1 : 0,
            'rel': 0,
            'showinfo': 0,
            'iv_load_policy': 3,
            'origin': window.location.origin // Dinámico para cualquier dominio
          },
          events: {
            'onReady': (event) => {
              console.log("✅ Video YouTube listo para reproducir");
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
              console.error("❌ Error en YouTube Player:", event.data);
              
              // ✅ FALLBACK: Si hay error, usar iframe directo
              console.log("🔄 Intentando fallback con iframe...");
              dynamicContent.innerHTML = `
                <iframe 
                  width="100%" 
                  height="100%" 
                  src="https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&iv_load_policy=3&playsinline=1" 
                  frameborder="0" 
                  allow="autoplay; encrypted-media; fullscreen" 
                  allowfullscreen
                  style="border: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%;">
                </iframe>
              `;
              dynamicContent.style.display = 'flex';
            }
          }
        });
        
      } catch (error) {
        console.error("❌ Error al cargar la API de YouTube:", error);
        
        // ✅ FALLBACK: Si la API falla, usar iframe directo
        console.log("🔄 Usando iframe directo como fallback...");
        dynamicContent.innerHTML = `
          <iframe 
            width="100%" 
            height="100%" 
            src="https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&iv_load_policy=3&playsinline=1" 
            frameborder="0" 
            allow="autoplay; encrypted-media; fullscreen" 
            allowfullscreen
            style="border: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%;">
          </iframe>
        `;
        dynamicContent.style.display = 'flex';
        
        // Configurar timeout para cerrar el overlay
        if (duracion) {
          currentOverlayTimeout = setTimeout(() => {
            console.log(`Duración terminada. Cerrando overlay.`);
            clearAll();
          }, duracion * 1000);
        }
      }
    }, 
    duracion
  );
}

// ============================================
// FUNCIÓN COMPLETA: checkEstado() - Maneja TODO
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
      fetch("/data/cumpleanos.json"),
      fetch("/data/horarios.json")
    ]);

    if (!cumpleResponse.ok || !horarioResponse.ok) {
      throw new Error(`Error al cargar JSONs: cumple=${cumpleResponse.status}, horarios=${horarioResponse.status}`);
    }

    const cumpleanosData = await cumpleResponse.json();
    const horariosData = await horarioResponse.json();

    const cumpleanosArray = Array.isArray(cumpleanosData) ? cumpleanosData : [cumpleanosData];
    
    // Obtener el día de la semana actual (0 = Domingo, 1 = Lunes, ..., 6 = Sábado)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0-6
    const todayKey = dayOfWeek.toString();
    
    console.log(`Día de la semana: ${dayOfWeek} (Clave: "${todayKey}")`);

    // Obtener la configuración para el día actual
    const todayConfig = horariosData[todayKey] || horariosData["0"];
    
    if (!todayConfig) {
      console.error(`No se encontró configuración para el día ${todayKey}`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      return;
    }

    // Extraer los diferentes tipos de contenido
    const cumpleanosHorarios = todayConfig.cumpleanos || [];
    const anunciosVideo = todayConfig.anuncios_video || [];
    const pausasActivas = todayConfig.pausas_activas || {};
    
    console.log("Configuración del día:");
    console.log(`  - Cumpleaños: ${cumpleanosHorarios.length} horarios`);
    console.log(`  - Anuncios: ${anunciosVideo.length} videos`);
    console.log(`  - Pausas activas: ${Object.keys(pausasActivas).length} grupos`);

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;
    
    console.log(`Hora actual: ${currentHour}:${currentMinute.toString().padStart(2, '0')} (${currentTime} minutos desde medianoche)`);
    console.log(`Fecha actual: ${today.toDateString()}`);

    let activeContent = null;

    // ============================================
    // 1. Verificar si hay cumpleaños HOY
    // ============================================
    let birthdayPerson = null;
    for (const persona of cumpleanosArray) {
      const [mesStr, diaStr] = persona.fecha.split('-');
      const mes = parseInt(mesStr, 10);
      const dia = parseInt(diaStr, 10);
      
      const birthDate = new Date(now.getFullYear(), mes - 1, dia);
      
      if (birthDate.toDateString() === today.toDateString()) {
        birthdayPerson = persona;
        console.log(`✓ CUMPLEAÑOS HOY: ${persona.nombre}`);
        break;
      }
    }

    // Si hay cumpleaños, verificar horarios
    if (birthdayPerson) {
      console.log(`Verificando horarios de cumpleaños...`);
      
      for (const horario of cumpleanosHorarios) {
        const timeParts = horario.hora_inicio.split(':').map(Number);
        const horaStr = timeParts[0];
        const minutoStr = timeParts[1] || 0;
        
        const startTime = horaStr * 60 + minutoStr;
        const duracionMinutos = (horario.duracion_por_persona || 60) / 60;
        const endTime = startTime + duracionMinutos;
        
        console.log(`  Horario: ${horaStr}:${minutoStr.toString().padStart(2, '0')} - Duración: ${horario.duracion_por_persona || 60} seg`);
        console.log(`  Rango: ${startTime} - ${endTime} minutos`);
        
        if (currentTime >= startTime && currentTime <= endTime) {
          activeContent = {
            activo: true,
            tipo: "cumpleanos",
            nombre: birthdayPerson.nombre,
            duracion: horario.duracion_por_persona || 60
          };
          console.log(`  ✓ ESTAMOS EN HORARIO DE CUMPLEAÑOS!`);
          break;
        }
      }
    }

    // ============================================
    // 2. Verificar anuncios de video (si no hay cumpleaños activo)
    // ============================================
    if (!activeContent) {
      console.log(`Verificando anuncios de video...`);
      
      for (const anuncio of anunciosVideo) {
        const timeParts = anuncio.hora_inicio.split(':').map(Number);
        const horaStr = timeParts[0];
        const minutoStr = timeParts[1] || 0;
        
        const startTime = horaStr * 60 + minutoStr;
        const duracionMinutos = (anuncio.duracion || 60) / 60;
        const endTime = startTime + duracionMinutos;
        
        console.log(`  Anuncio: ${anuncio.archivo} - ${horaStr}:${minutoStr.toString().padStart(2, '0')} - Duración: ${anuncio.duracion || 60} seg`);
        console.log(`  Rango: ${startTime} - ${endTime} minutos`);
        
        if (currentTime >= startTime && currentTime <= endTime) {
          activeContent = {
            activo: true,
            tipo: "anuncio_video",
            archivo: anuncio.archivo,
            duracion: anuncio.duracion || 60
          };
          console.log(`  ✓ ESTAMOS EN HORARIO DE ANUNCIO!`);
          break;
        }
      }
    }

    // ============================================
    // 3. Verificar pausas activas (si no hay nada activo)
    // ============================================
    if (!activeContent) {
      console.log(`Verificando pausas activas...`);
      
      // Iterar sobre todos los grupos de pausas (pausa_1, pausa_2, etc.)
      for (const pausaGroup of Object.values(pausasActivas)) {
        const pausas = Array.isArray(pausaGroup) ? pausaGroup : [pausaGroup];
        
        for (const pausa of pausas) {
          const timeParts = pausa.hora_inicio.split(':').map(Number);
          const horaStr = timeParts[0];
          const minutoStr = timeParts[1] || 0;
          
          const startTime = horaStr * 60 + minutoStr;
          const duracionMinutos = (pausa.duracion || 600) / 60;
          const endTime = startTime + duracionMinutos;
          
          console.log(`  Pausa: ${pausa.archivo} - ${horaStr}:${minutoStr.toString().padStart(2, '0')} - Duración: ${pausa.duracion || 600} seg`);
          console.log(`  Rango: ${startTime} - ${endTime} minutos`);
          
          if (currentTime >= startTime && currentTime <= endTime) {
            activeContent = {
              activo: true,
              tipo: "pausas_activas",
              archivo: pausa.archivo,
              duracion: pausa.duracion || 600
            };
            console.log(`  ✓ ESTAMOS EN HORARIO DE PAUSA ACTIVA!`);
            break;
          }
        }
        
        if (activeContent) break; // Salir si ya encontramos algo
      }
    }

    // ============================================
    // 4. Si no hay contenido activo
    // ============================================
    if (!activeContent) {
      console.log("✗ No hay contenido activo en este momento");
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
        console.log(`🎯 MOSTRANDO: ${activeContent.tipo} - ${activeContent.nombre || activeContent.archivo} (${activeContent.duracion} seg)`);
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
      } else {
        console.log(`⏭️  Ya se mostró este contenido hoy: ${contentId}`);
      }
    } else {
      if (isOverlayVisible) {
        console.log("Cerrando overlay - no hay contenido activo.");
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

