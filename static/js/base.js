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

function showOverlay(contentId, callback, duracion, isYoutubeVideo = false) {
    if (activeFile === contentId) return;

    clearAll();
    const overlay = document.getElementById("overlay");
    const mainIframe = document.getElementById("main-iframe");

    activeFile = contentId;
    playedFiles.add(contentId);

    mainIframe.style.display = "none";
    overlay.style.display = "flex";

    callback();

    // Solo establecer timeout si NO es video de YouTube
    if (duracion && !isYoutubeVideo) {
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
    }, duracion, true);
}

async function checkEstado() {
    // Si el overlay de inicio está activo, no hacemos nada más.
    if (document.getElementById('init-overlay').style.display === 'flex') {
        console.log("Esperando interacción de inicio...");
        return;
    }

    try {
        console.log("Verificando estado...");
        const response = await fetch("/estado");
        if (!response.ok) {
            throw new Error(`Error de red: ${response.status}`);
        }
        
        const data = await response.json();
        const overlay = document.getElementById("overlay");
        const isOverlayVisible = overlay.style.display !== "none";
        
        if (data.activo) {
            let contentId;
            if (data.tipo === "cumpleanos") {
                contentId = `cumpleanos_${data.nombre}_${new Date().getFullYear()}-${new Date().getMonth()}-${new Date().getDate()}`;
            } else {
                contentId = `${data.tipo}_${data.archivo}`;
            }

            if (!playedFiles.has(contentId)) {
                console.log(`Nuevo contenido activo: ${data.tipo} - ${data.archivo || data.nombre}`);
                
                if (data.tipo === "cumpleanos") {
                    showBirthdayMessage(data.nombre, data.duracion);
                } else if (data.tipo === "anuncio_video" || data.tipo === "pausas_activas") {
                    if (data.archivo && data.archivo.length === 11 && /^[a-zA-Z0-9_-]+$/.test(data.archivo)) {
                        playYoutubeVideo(data.archivo, data.duracion); 
                    } else {
                        console.error("ID de YouTube inválido:", data.archivo);
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
        console.error("Error al verificar estado:", error);
        clearAll();
        
        const mainIframe = document.getElementById("main-iframe");
        mainIframe.style.display = "block";
        
        const dynamicContent = document.getElementById("dynamic-content");
        dynamicContent.innerHTML = `<div style="color:red; text-align:center;">Error de conexión. Reintentando...</div>`;
        dynamicContent.style.display = 'block';
        const overlay = document.getElementById("overlay");
        overlay.style.display = "flex";
        
        // ✅ CORRECCIÓN CLAVE: Después de 5s, no solo oculta el overlay, sino que vuelve a intentar
        setTimeout(() => {
            overlay.style.display "none";
            // 👇 Vuelve a llamar a checkEstado() para reintentar inmediatamente
            checkEstado();
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
