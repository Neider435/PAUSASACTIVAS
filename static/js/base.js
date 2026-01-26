let checkingInterval;
let currentOverlayTimeout = null;
let activeFile = null;
let playedFiles = new Set();
let player;
let isYoutubeApiLoaded = false;
let youtubePlayerPromise = null;
let userInteracted = false;

function onYouTubeIframeAPIReady() {
    console.log("✅ API de YouTube lista.");
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
    
    activeFile = null;
}

function showOverlay(contentId, callback, duracion) {
    // Permitir pruebas
    const urlParams = new URLSearchParams(window.location.search);
    const modoPrueba = urlParams.has('prueba');
    
    if (activeFile === contentId && !modoPrueba) return;
    
    clearAll();
    
    const overlay = document.getElementById("overlay");
    const mainIframe = document.getElementById("main-iframe");
    
    activeFile = contentId;
    playedFiles.add(contentId);
    
    mainIframe.style.display = "none";
    overlay.style.display = "flex";
    
    callback();
    
    if (duracion !== null && duracion !== undefined) {
        currentOverlayTimeout = setTimeout(() => {
            console.log(`Duración de ${contentId} terminada. Cerrando overlay.`);
            clearAll();
        }, duracion * 1000);
    }
}

function showBirthdayMessage(nombre, duracion) {
    console.log(`🎂 Mostrando cumpleaños: ${nombre} por ${duracion} segundos`);
    
    showOverlay(`cumpleanos_${nombre}`, () => {
        const dynamicContent = document.getElementById("dynamic-content");
        const birthdayText = document.getElementById("birthday-text");
        
        dynamicContent.innerHTML = `<img src="avisos/cumpleanos.png" alt="Feliz Cumpleaños" class="birthday-background-image">`;
        dynamicContent.style.display = 'block';
        
        birthdayText.innerHTML = `${nombre}`;
        birthdayText.style.display = 'block';
        
    }, duracion);
}

async function playYoutubeVideo(videoId) {
    const muted = !userInteracted;
    console.log(`🎬 Reproduciendo video: ${videoId}`);
    
    showOverlay(`youtube_${videoId}`, async () => {
        const dynamicContent = document.getElementById("dynamic-content");
        dynamicContent.innerHTML = `<div id="youtube-player" style="width:100%;height:100%;"></div>`;
        dynamicContent.style.display = 'block';
        document.getElementById('audio-button').style.display = 'none';
        
        try {
            await loadYoutubeApi();
            
            player = new YT.Player('youtube-player', {
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
                    'iv_load_policy': 3,
                    'loop': 0
                },
                events: {
                    'onReady': (event) => {
                        console.log("▶️ Video listo, reproduciendo...");
                        event.target.playVideo();
                        
                        if (!muted) {
                            event.target.unMute();
                            event.target.setVolume(100);
                        }
                    },
                    'onStateChange': (event) => {
                        if (event.data === YT.PlayerState.PLAYING) {
                            console.log("▶️ Video en reproducción");
                        }
                        if (event.data === YT.PlayerState.ENDED) {
                            console.log("⏹️ Video terminado. Cerrando overlay.");
                            clearAll();
                        }
                    },
                    'onError': (event) => {
                        console.error("❌ Error en YouTube Player:", event.data);
                        clearAll();
                    }
                }
            });
            
        } catch (error) {
            console.error("❌ Error al crear reproductor YouTube:", error);
            dynamicContent.innerHTML = '<div style="color:red;text-align:center;font-size:2em;">Error al cargar video</div>';
            setTimeout(() => clearAll(), 3000);
        }
        
    }, null);
}

// ✅ FUNCIONES PARA PRUEBAS MANUALES
function forzarReproduccionVideo(videoId) {
    console.log("🧪 Forzando reproducción de video:", videoId);
    playedFiles.clear();
    playYoutubeVideo(videoId);
}

function forzarCumpleanos(nombre) {
    console.log("🧪 Forzando mensaje de cumpleaños:", nombre);
    playedFiles.clear();
    showBirthdayMessage(nombre, 10);
}

function resetPlayedFiles() {
    console.log("🔄 Reset de playedFiles");
    playedFiles.clear();
}

// ✅ LÓGICA PRINCIPAL
async function checkEstado() {
    if (document.getElementById('init-overlay').style.display === 'flex') {
        console.log("⏳ Esperando interacción del usuario...");
        return;
    }
    
    try {
        const [horariosRes, cumpleanosRes] = await Promise.all([
            fetch('horarios.json'),
            fetch('cumpleanos.json')
        ]);
        
        if (!horariosRes.ok || !cumpleanosRes.ok) {
            throw new Error(`HTTP error! horarios: ${horariosRes.status}, cumpleanos: ${cumpleanosRes.status}`);
        }
        
        const horarios_semanales = await horariosRes.json();
        const cumpleanos = await cumpleanosRes.json();
        
        const ahora = new Date();
        const dia_semana = ahora.getDay();
        const ahora_time = ahora.toTimeString().split(' ')[0];
        const [h, m, s] = ahora_time.split(':').map(Number);
        const ahora_segundos = h * 3600 + m * 60 + s;
        
        console.log(`📅 Día: ${dia_semana}, ⏰ Hora: ${ahora_time} (${ahora_segundos}s)`);
        
        const hoy_str = ("0" + (ahora.getMonth() + 1)).slice(-2) + "-" + ("0" + ahora.getDate()).slice(-2);
        const cumpleaneros_hoy = cumpleanos.filter(p => p.fecha === hoy_str).map(p => p.nombre);
        
        console.log(`🎂 Cumpleañeros hoy (${hoy_str}):`, cumpleaneros_hoy.length > 0 ? cumpleaneros_hoy : 'Ninguno');
        
        const horarios_hoy = horarios_semanales[dia_semana] || {};
        
        // --- 1. PRIORIDAD MÁXIMA: Anuncios de video ---
        if (horarios_hoy.anuncios_video && horarios_hoy.anuncios_video.length > 0) {
            for (const evento of horarios_hoy.anuncios_video) {
                const [hi, mi, si] = evento.hora_inicio.split(':').map(Number);
                const inicio_segundos = hi * 3600 + mi * 60 + si;
                
                console.log(`🎬 Anuncio: ${evento.hora_inicio} (${inicio_segundos}s) - ID: ${evento.archivo}`);
                
                // ✅ VENTANA DE 60 SEGUNDOS
                if (ahora_segundos >= inicio_segundos && ahora_segundos < inicio_segundos + 60) {
                    const key = `anuncio_${evento.archivo}_${inicio_segundos}`;
                    if (!playedFiles.has(key)) {
                        console.log(`✅ Activando anuncio: ${evento.archivo}`);
                        playedFiles.add(key);
                        playYoutubeVideo(evento.archivo);
                        return;
                    }
                }
            }
        }
        
        // --- 2. PRIORIDAD ALTA: Pausas activas ---
        if (horarios_hoy.pausas_activas) {
            for (const lista_pausa of Object.values(horarios_hoy.pausas_activas)) {
                for (const evento of lista_pausa) {
                    const [hi, mi, si] = evento.hora_inicio.split(':').map(Number);
                    const inicio_segundos = hi * 3600 + mi * 60 + si;
                    
                    console.log(`🧘 Pausa activa: ${evento.hora_inicio} (${inicio_segundos}s) - ID: ${evento.archivo}`);
                    
                    // ✅ VENTANA DE 60 SEGUNDOS
                    if (ahora_segundos >= inicio_segundos && ahora_segundos < inicio_segundos + 60) {
                        const key = `pausa_${evento.archivo}_${inicio_segundos}`;
                        if (!playedFiles.has(key)) {
                            console.log(`✅ Activando pausa activa: ${evento.archivo}`);
                            playedFiles.add(key);
                            playYoutubeVideo(evento.archivo);
                            return;
                        }
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
                
                console.log(`🎂 Cumpleaños: ${evento.hora_inicio} (${inicio_segundos}s - ${fin_segundos}s)`);
                
                if (ahora_segundos >= inicio_segundos && ahora_segundos <= fin_segundos) {
                    const segundos_transcurridos = ahora_segundos - inicio_segundos;
                    const indice_persona = Math.floor(segundos_transcurridos / duracion_por_persona);
                    
                    if (indice_persona < cumpleaneros_hoy.length) {
                        const nombre_actual = cumpleaneros_hoy[indice_persona];
                        const key = `cumple_${nombre_actual}_${inicio_segundos}`;
                        
                        if (!playedFiles.has(key)) {
                            console.log(`✅ Mostrando cumpleaños ${indice_persona + 1}/${cumpleaneros_hoy.length}: ${nombre_actual}`);
                            playedFiles.add(key);
                            showBirthdayMessage(nombre_actual, duracion_por_persona);
                            return;
                        }
                    }
                }
            }
        }
        
        // --- Nada activo ---
        const overlay = document.getElementById("overlay");
        if (overlay.style.display !== "none") {
            console.log("❌ Cerrando overlay - nada activo");
            clearAll();
        }
        
    } catch (error) {
        console.error("❌ Error en checkEstado:", error);
        clearAll();
        
        const overlay = document.getElementById("overlay");
        overlay.style.display = "flex";
        document.getElementById("dynamic-content").innerHTML = '<div style="color:red;font-size:2em;text-align:center;">⚠️ Error al cargar datos</div>';
        
        setTimeout(() => {
            overlay.style.display = "none";
        }, 5000);
    }
}

function initializeApplication() {
    console.log("🚀 Inicializando aplicación...");
    
    if (!userInteracted) {
        document.getElementById('init-overlay').style.display = 'flex';
        document.getElementById('main-iframe').style.display = 'none';
    } else {
        checkEstado();
        checkingInterval = setInterval(checkEstado, 5000); // ✅ 5 segundos
    }
}

function handleStartSound() {
    userInteracted = true;
    document.getElementById('init-overlay').style.display = 'none';
    document.getElementById('main-iframe').style.display = 'block';
    
    console.log("🔊 Sonido habilitado. Iniciando chequeo...");
    checkEstado();
    checkingInterval = setInterval(checkEstado, 5000); // ✅ 5 segundos
}

window.addEventListener('load', initializeApplication);

// ✅ Exportar funciones para pruebas en consola
window.forzarReproduccionVideo = forzarReproduccionVideo;
window.forzarCumpleanos = forzarCumpleanos;
window.resetPlayedFiles = resetPlayedFiles;
