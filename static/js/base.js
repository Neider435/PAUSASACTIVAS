let checkingInterval;
let currentOverlayTimeout = null;
let player = null;
let userInteracted = false;

// Cargar API de YouTube
function loadYoutubeApi() {
  if (!window.YT) {
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  }
}

// Limpiar todo
function clearAll() {
  if (currentOverlayTimeout) {
    clearTimeout(currentOverlayTimeout);
    currentOverlayTimeout = null;
  }
  if (player) {
    try { player.destroy(); } catch (e) {}
    player = null;
  }
  document.getElementById("overlay").style.display = "none";
  document.getElementById("main-iframe").style.display = "block";
}

// Mostrar overlay y reproducir video
function showVideo(videoId, duration) {
  clearAll();
  document.getElementById("main-iframe").style.display = "none";
  document.getElementById("overlay").style.display = "flex";
  
  const container = document.getElementById("dynamic-content");
  container.innerHTML = `<div id="youtube-player"></div>`;
  
  // Esperar un momento para asegurar el DOM
  setTimeout(() => {
    player = new YT.Player('youtube-player', {
      height: '100%',
      width: '100%',
      videoId: videoId,
      playerVars: {
        autoplay: 1,
        controls: 0,
        modestbranding: 1,
        mute: !userInteracted ? 1 : 0,
        playsinline: 1,
        rel: 0,
        iv_load_policy: 3
      },
      events: {
        onReady: (event) => {
          event.target.playVideo();
          if (userInteracted) {
            event.target.unMute();
          }
        },
        onError: () => {
          clearAll();
        }
      }
    });
  }, 100);

  // Cerrar después de la duración especificada
  currentOverlayTimeout = setTimeout(clearAll, duration * 1000);
}

// Mostrar cumpleaños
function showBirthday(nombre, duracion) {
  clearAll();
  document.getElementById("main-iframe").style.display = "none";
  document.getElementById("overlay").style.display = "flex";
  
  document.getElementById("dynamic-content").innerHTML = 
    `<img src="/static/avisos/cumpleanos.png" alt="Feliz Cumpleaños" class="birthday-background-image">`;
  document.getElementById("birthday-text").innerHTML = nombre;
  document.getElementById("birthday-text").style.display = "block";
  
  currentOverlayTimeout = setTimeout(clearAll, duracion * 1000);
}

// Verificar estado
async function checkEstado() {
  if (!userInteracted) return;

  try {
    const [horariosRes, cumpleanosRes] = await Promise.all([
      fetch('/horarios.json'),
      fetch('/cumpleanos.json')
    ]);
    
    if (!horariosRes.ok || !cumpleanosRes.ok) throw new Error("JSON no cargado");

    const horarios = await horariosRes.json();
    const cumpleanos = await cumpleanosRes.json();

    const ahora = new Date();
    const dia = ahora.getDay();
    const horaActual = ahora.getHours() * 3600 + ahora.getMinutes() * 60 + ahora.getSeconds();
    const hoyFecha = ("0" + (ahora.getMonth() + 1)).slice(-2) + "-" + ("0" + ahora.getDate()).slice(-2);
    const cumpleHoy = cumpleanos.filter(p => p.fecha === hoyFecha).map(p => p.nombre);
    const horarioHoy = horarios[dia] || {};

    // 1. Videos (prioridad máxima)
    const todosVideos = [
      ...(horarioHoy.anuncios_video || []),
      ...(Object.values(horarioHoy.pausas_activas || {}).flat() || [])
    ];

    for (const v of todosVideos) {
      const [h, m, s] = v.hora_inicio.split(':').map(Number);
      const inicio = h * 3600 + m * 60 + s;
      if (horaActual >= inicio && horaActual < inicio + 5) {
        showVideo(v.archivo, v.duracion || 60);
        return;
      }
    }

    // 2. Cumpleaños
    if (horarioHoy.cumpleanos && cumpleHoy.length > 0) {
      for (const c of horarioHoy.cumpleanos) {
        const [h, m, s] = c.hora_inicio.split(':').map(Number);
        const inicio = h * 3600 + m * 60 + s;
        const totalDuracion = cumpleHoy.length * (c.duracion_por_persona || 60);
        if (horaActual >= inicio && horaActual <= inicio + totalDuracion) {
          const idx = Math.floor((horaActual - inicio) / (c.duracion_por_persona || 60));
          if (idx < cumpleHoy.length) {
            showBirthday(cumpleHoy[idx], c.duracion_por_persona || 60);
            return;
          }
        }
      }
    }

  } catch (error) {
    console.error("Error:", error);
    clearAll();
  }
}

// Iniciar
function start() {
  userInteracted = true;
  document.getElementById('init-overlay').style.display = 'none';
  loadYoutubeApi();
  checkEstado();
  checkingInterval = setInterval(checkEstado, 1000); // ← Chequeo cada 1 segundo
}

// Cargar
window.addEventListener('load', () => {
  if (!window.YT) {
    window.onYouTubeIframeAPIReady = () => {};
  }
  document.getElementById('start-button').onclick = start;
});
