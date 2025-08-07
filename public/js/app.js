/**
 * @file app.js
 * @description Orquestador principal de la Single Page Application (SPA).
 * Gestiona el enrutamiento del lado del cliente, la carga de plantillas HTML
 * y la ejecución de los scripts asociados a cada vista.
 */


// ===================================
//  ELEMENTOS PRINCIPALES DEL DOM
// ===================================

// Elementos principales del DOM para la renderización de vistas.
const appRoot = document.getElementById('app-root');
const loaderContainer = document.getElementById('loader-container');


// ===================================
//  FUNCIONES DE AYUDA
// ===================================

/**
 * Crea y devuelve el elemento HTML para una única tarjeta de mensaje.
 * @param {object} message - El objeto del mensaje con datos del sender populados.
 * @returns {HTMLElement} El elemento del DOM para la tarjeta del mensaje.
 */
function createMessageCard(message) {
    const card = document.createElement('div');
    card.className = 'message-card';
    card.setAttribute('data-message-id', message._id); // Atributo para identificar la tarjeta

    const author = message.sender || { username: 'Usuario Eliminado', profilePicturePath: '../images/default-avatar.webp', _id: null };
    
    const authorId = author._id;
    const authorUsername = author.username;
    const authorAvatar = author.profilePicturePath;

    const likeCount = message.likeCount !== undefined ? message.likeCount : (message.likes ? message.likes.length : 0);
    
    // Si message.isLiked es true, se añade la clase 'liked', si no, se añade una cadena vacía.
    const likedClass = message.isLiked ? 'liked' : '';

    card.innerHTML = `
        <div class="card-header">
            <div class="author-info">
                <img src="${authorAvatar}" alt="Avatar de ${authorUsername}" id="author-avatar">
                ${
                    authorUsername === 'Usuario Eliminado' || !authorId
                        ? `<span class="author-username">@${authorUsername}</span>`
                        : `<a href="/view-profile?username=${authorUsername}" class="author-username">@${authorUsername}</a>`
                }
            </div>
            <div class="likes-info">
                <span class="like-count">${likeCount}</span>
                <svg class="like-button ${likedClass}" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
            </div>
        </div>
        <div class="card-body">
            <h4 class="message-title">${message.title}</h4>
            <p class="message-content">${message.content}</p>
        </div>
    `;
    
    return card;
}


// ===================================
//  LÓGICA PRINCIPAL DE LA APLICACIÓN
// ===================================

/**
 * Carga y ejecuta dinámicamente el script asociado a una plantilla específica.
 * Elimina el script de la vista anterior para evitar conflictos de variables o listeners.
 * @param {string} templatePath - La ruta de la plantilla que se ha cargado (ej. './templates/register.html').
 * @returns {Promise<void>} Una promesa que se resuelve una vez el script ha sido añadido al DOM.
 */
async function loadAndExecuteScript(templatePath) {
    // Elimina el script de la vista anterior si existe para evitar duplicados o conflictos.
    const oldScript = document.getElementById('view-script');
    if (oldScript) {
        oldScript.remove();
    }

    // Determina qué script cargar basado en la ruta de la plantilla.
    let scriptSrc;
    if (templatePath.includes('register.html')) {
        scriptSrc = './js/register.js';
    } else if (templatePath.includes('login.html')) {
        scriptSrc = './js/login.js';
    } else if (templatePath.includes('profile.html')) {
        scriptSrc = './js/profile.js';
    }

    // Si no hay un script específico para esta vista, no se realiza ninguna acción.
    if (!scriptSrc) return;

    // Crea y añade el nuevo script al DOM.
    const script = document.createElement('script');
    script.id = 'view-script'; // ID para poder encontrarlo y eliminarlo en la siguiente navegación.
    script.src = scriptSrc;
    
    // El script se ejecuta al cargarse. Su evento 'onload' llama a la función de inicialización correspondiente.
    script.onload = () => {
        // Se comprueba que la función de inicialización exista en el ámbito global antes de llamarla.
        if (templatePath.includes('register.html')) {
            if (typeof initRegisterForm === 'function') initRegisterForm();
        } else if (templatePath.includes('login.html')) {
            if (typeof initLoginForm === 'function') initLoginForm();
        } else if (templatePath.includes('profile.html')) {
            if (typeof initProfilePage === 'function') initProfilePage();
        }
    };
    
    document.body.appendChild(script);
}

/**
 * Obtiene el contenido de un archivo de plantilla HTML desde el servidor.
 * Si la plantilla no se encuentra, carga y devuelve una plantilla de error 404 como fallback.
 * @param {string} path - La ruta al archivo de plantilla (.html).
 * @returns {Promise<string>} El contenido HTML de la plantilla.
 */
async function fetchTemplate(path) {
    try {
        const response = await fetch(path);
        if (!response.ok) {
            throw new Error(`No se encontró el template en la ruta: ${path}`);
        }
        return await response.text();
    } catch (error) {
        console.error('Error al cargar el template:', error);
        // Fallback: Carga la página de error si la plantilla solicitada falla.
        const response = await fetch('/templates/error-404.html');
        return await response.text();
    }
}

/**
 * Renderiza una página en el contenedor #app-root basado en la ruta URL del navegador.
 * Gestiona la visibilidad del loader, obtiene la plantilla, actualiza el DOM, el título del documento y carga el script asociado.
 * @param {string} path - La ruta de la URL a renderizar (ej. '/', '/login').
 * @returns {Promise<void>}
 */
async function renderPage(path) {
    // Muestra el loader y oculta el contenido principal durante la carga para mejorar la UX.
    loaderContainer.classList.remove('hidden');
    appRoot.classList.add('hidden');

    let templatePath = '';
    
    // --- Lógica de Enrutamiento ---
    // Este bloque 'if-else if' actúa como un enrutador del lado del cliente.
    if (path === '/' || path === '/home') {
        appRoot.innerHTML = await fetchTemplate('./templates/home.html');
        document.title = 'Inicio';

        const messagesContainer = document.getElementById('messages-container');
        const loadMoreBtn = document.getElementById('load-more-btn');
        const feedLoader = document.getElementById('feed-loader');
        let currentPage = 1;
        let totalPages = 1;
        let pollInterval; // Variable para guardar la referencia al intervalo

        // Limpiar intervalo anterior si existe (al navegar de vuelta a home)
        if (window.pollInterval) {
            clearInterval(window.pollInterval);
        }

        const loadMessages = async () => {
            if (currentPage > totalPages) return;
            loadMoreBtn.classList.add('hidden');
            feedLoader.classList.remove('hidden');
            try {
                const response = await fetch(`/api/messages?page=${currentPage}`);
                if (!response.ok) throw new Error('Error al cargar los mensajes.');
                const data = await response.json();
                
                if (currentPage === 1 && data.messages.length === 0) {
                    messagesContainer.innerHTML = `<div class="empty-feed-message"><br><p>Aún no hay mensajes publicados. ¡Sé el primero en compartir tus ideas!</p><br></div>`;
                    feedLoader.classList.add('hidden');
                    return; 
                }

                data.messages.forEach(message => {
                    const messageCard = createMessageCard(message);
                    messagesContainer.appendChild(messageCard);
                });

                totalPages = data.totalPages;
                currentPage++;

                if (currentPage <= totalPages) {
                    loadMoreBtn.classList.remove('hidden');
                }

            } catch (error) {
                console.error(error);
                messagesContainer.innerHTML = '<p class="error-text">No se pudieron cargar los mensajes. Inténtalo de nuevo más tarde.</p>';
            } finally {
                feedLoader.classList.add('hidden');
            }
        };

        await loadMessages();
        loadMoreBtn.addEventListener('click', loadMessages);
        
        // --- LÓGICA DE LIKES ---
        const handleLikeClick = async (event) => {
            const likeButton = event.target.closest('.like-button');
            if (!likeButton) return; // Si no se hizo clic en el botón, no hacer nada

            const card = likeButton.closest('.message-card');
            const messageId = card.getAttribute('data-message-id');

            try {
                const response = await fetch(`/api/messages/${messageId}/like`, {
                    method: 'POST'
                });

                if (response.status === 401) {
                    // Usuario no logueado, se ignora la pulsación silenciosamente
                    console.log("Usuario no autenticado. El like fue ignorado.");
                    return;
                }
                if (!response.ok) {
                    throw new Error('Error del servidor al procesar el like.');
                }
                
                const data = await response.json();

                // Actualización optimista de la UI
                const likeCountSpan = card.querySelector('.like-count');
                likeCountSpan.textContent = data.likeCount;
                
                if (data.isLiked) {
                    likeButton.classList.add('liked');
                } else {
                    likeButton.classList.remove('liked');
                }

            } catch (error) {
                console.error(error.message);
            }
        };

        messagesContainer.addEventListener('click', handleLikeClick);
        
        // --- LÓGICA DE POLLING CADA 5 SEGUNDOS ---
        const updateAllLikeCounts = async () => {
            const cards = messagesContainer.querySelectorAll('.message-card');
            if (cards.length === 0) return;

            const messageIds = Array.from(cards).map(card => card.getAttribute('data-message-id'));
            
            try {
                const response = await fetch(`/api/messages/counts?ids=${messageIds.join(',')}`);
                if (!response.ok) return;

                const counts = await response.json();

                for (const messageId in counts) {
                    const card = messagesContainer.querySelector(`.message-card[data-message-id="${messageId}"]`);
                    if (card) {
                        const likeCountSpan = card.querySelector('.like-count');
                        if (likeCountSpan.textContent !== String(counts[messageId])) {
                            likeCountSpan.textContent = counts[messageId];
                        }
                    }
                }
            } catch (error) {
                console.error('Error durante el sondeo de likes:', error);
            }
        };

        // Iniciar el sondeo y guardarlo en una variable global para poder limpiarlo
        window.pollInterval = setInterval(updateAllLikeCounts, 5000);

        // --- LÓGICA PARA EL MODAL DE CREACIÓN DE MENSAJES ---
        const openModalBtn = document.getElementById('open-create-message-modal-btn');
        const modalOverlay = document.getElementById('create-message-modal');
        const closeModalBtn = document.getElementById('close-modal-btn');
        const messageForm = document.getElementById('create-message-form');
        const modalError = document.getElementById('modal-error-message');

        const showModal = () => modalOverlay.classList.remove('hidden');
        const hideModal = () => {
            modalOverlay.classList.add('hidden');
            modalError.classList.add('hidden');
            messageForm.reset();
        };
        
        openModalBtn.addEventListener('click', showModal);
        closeModalBtn.addEventListener('click', hideModal);
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                hideModal();
            }
        });

        messageForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            modalError.classList.add('hidden');
            
            const formData = new FormData(messageForm);
            const data = Object.fromEntries(formData.entries());

            try {
                const response = await fetch('/api/messages', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                const responseData = await response.json();
                if (!response.ok) {
                    throw new Error(responseData.message || 'Error desconocido al publicar.');
                }
                const newPost = responseData;
                const newCard = createMessageCard(newPost);
                
                const emptyMessage = messagesContainer.querySelector('.empty-feed-message');
                if (emptyMessage) {
                    messagesContainer.innerHTML = '';
                }
                messagesContainer.prepend(newCard); 
                hideModal();
            } catch (error) {
                modalError.textContent = error.message;
                modalError.classList.remove('hidden');
            }
        });

        templatePath = '';

    } else if (path === '/about' || path === '/about-AgoraDig' || path === '/about-us') {
        templatePath = './templates/about.html';
        document.title = 'Acerca de';
    } else if (path === '/contact' || path === '/contact-us') {
        templatePath = './templates/contact.html';
        document.title = 'Contacto';
    } else if (path === '/register') {
        templatePath = './templates/register.html';
        document.title = 'Crear Cuenta';
    } else if (path === '/register-success') {
        templatePath = './templates/register-success.html';
        document.title = 'Registro Exitoso';
    } else if (path === '/login') {
        templatePath = './templates/login.html';
        document.title = 'Iniciar Sesión';
    } else if (path.startsWith('/view-profile')) {

        try {
            // Se extrae el nombre de usuario de los parámetros de consulta de la URL.
            const params = new URLSearchParams(window.location.search);
            const username = params.get('username');

            if (!username) {
                throw new Error('Nombre de usuario no especificado en la URL.');
            }

            // 1. Obtener los datos públicos del usuario desde la API.
            const response = await fetch(`/api/users/username/${encodeURIComponent(username)}`);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'No se pudieron cargar los datos del perfil.');
            }
            const userData = await response.json();

            // 2. Obtener la plantilla HTML para el perfil.
            let profileHtml = await fetchTemplate('./templates/view-profile.html');

            // 3. Poblar la plantilla reemplazando los placeholders con los datos del usuario.
            const joinDate = new Date(userData.createdAt).toLocaleDateString('es-ES', {
                year: 'numeric', month: 'long', day: 'numeric'
            });

            profileHtml = profileHtml
                .replace(/{{profilePicturePath}}/g, userData.profilePicturePath || '../images/default-avatar.webp')
                .replace(/{{firstName}}/g, userData.firstName)
                .replace(/{{lastName}}/g, userData.lastName)
                .replace(/{{username}}/g, userData.username)
                .replace(/{{description}}/g, userData.description || 'Este usuario aún no ha añadido una descripción.')
                .replace(/{{createdAt}}/g, joinDate);

            // 4. Renderizar el HTML poblado y actualizar el título.
            appRoot.innerHTML = profileHtml;
            document.title = `Perfil de ${userData.username}`;
            templatePath = ''; // Se vacía para que no se renderice de nuevo más abajo.

        } catch (error) {
            console.error('Error al renderizar el perfil de usuario:', error);
            appRoot.innerHTML = await fetchTemplate('./templates/error-404.html');
            document.title = 'ERROR 404';
        }
    
    } else if (path.startsWith('/profile')) {
        // --- Lógica de renderizado para la vista de perfil del propio usuario (ruta privada) ---
        try {
            // Se solicita al servidor los datos del perfil del usuario autenticado.
            const response = await fetch('/api/profile');
            if (!response.ok) {
                // Si el usuario no está autenticado (401), se le redirige a la página de login.
                if (response.status === 401) {
                    window.history.pushState({}, '', '/login');
                    await renderPage('/login'); // Llama recursivamente a renderPage para mostrar la vista de login.
                    return; // Detiene la ejecución para evitar más renderizados.
                }
                throw new Error('Error al obtener los datos del perfil.');
            }

            const userData = await response.json();
            const profileHtml = await fetchTemplate('./templates/profile.html');
            
            appRoot.innerHTML = profileHtml;

            const joinDate = new Date(userData.createdAt).toLocaleDateString('es-ES', {
                year: 'numeric', month: 'long', day: 'numeric'
            });
            
            // Se utilizan selectores de clase y 'textContent' para poblar los datos de forma segura,
            // lo que previene vulnerabilidades de Cross-Site Scripting (XSS).
            const profilePicture = appRoot.querySelector('.profile-picture');
            if (profilePicture) {
                profilePicture.src = userData.profilePicturePath || '../images/default-avatar.webp';
                profilePicture.alt = `Foto de perfil de ${userData.username}`;
            }
            
            const fullName = appRoot.querySelector('.profile-fullname');
            if (fullName) fullName.textContent = `${userData.firstName} ${userData.lastName}`;

            const username = appRoot.querySelector('.profile-username');
            if (username) username.textContent = `@${userData.username}`;

            const description = appRoot.querySelector('.profile-description');
            if (description) description.textContent = userData.description || 'Este usuario aún no ha añadido una descripción.';

            const joinDateEl = appRoot.querySelector('.profile-meta span');
            if (joinDateEl) joinDateEl.textContent = `Miembro desde: ${joinDate}`;

            document.title = userData.username; // Actualiza el título de la página.
            
            templatePath = ''; // Se limpia la ruta para que no se procese de nuevo.
            await loadAndExecuteScript('./templates/profile.html'); // Se carga el script asociado a la vista de perfil.

        } catch (error) {
            console.error(error);
            appRoot.innerHTML = await fetchTemplate('./templates/error-404.html');
        }
    } else if (path === '/terms-and-conditions') {
        templatePath = './templates/terms-and-conditions.html';
        document.title = 'Términos y Condiciones';
    } else if (path === '/privacy-policy') {
        templatePath = './templates/privacy-policy.html';
        document.title = 'Política de Privacidad';
    } else {
        // Ruta por defecto si no coincide ninguna de las anteriores.
        templatePath = './templates/error-404.html';
        document.title = 'ERROR 404';
    }

    // Si se encontró una plantilla estática, se renderiza su contenido.
    if (templatePath) {
        appRoot.innerHTML = await fetchTemplate(templatePath);
    }
    
    // Lógica específica post-renderizado para la página de registro exitoso.
    if (path === '/register-success') {
        // Recupera el PIN desde sessionStorage para mostrarlo al usuario.
        const pin = sessionStorage.getItem('registrationPin');
        const pinDisplayElement = document.getElementById('recovery-pin-display');

        if (pin && pinDisplayElement) {
            pinDisplayElement.textContent = pin;
            // Limpia el PIN del sessionStorage por seguridad después de mostrarlo.
            sessionStorage.removeItem('registrationPin'); 
        }
    }

    // Carga el script asociado a la vista estática, si se definió una ruta de plantilla.
    if(templatePath) {
        await loadAndExecuteScript(templatePath);
    }

    // Oculta el loader y muestra el contenido ya renderizado.
    loaderContainer.classList.add('hidden'); 
    appRoot.classList.remove('hidden');
}

/**
 * Manejador centralizado para los eventos de clic de navegación.
 * Intercepta los clics en enlaces `<a>` para evitar la recarga completa de la página.
 * @param {MouseEvent} event - El objeto del evento de clic.
 */
async function handleNavClick(event) {
    // Busca el enlace `<a>` más cercano al elemento clickeado.
    const targetLink = event.target.closest('a');
    
    // Procesa el clic solo si es un enlace de navegación interna (sin target="_blank" y con href).
    if (targetLink && targetLink.hasAttribute('href') && !targetLink.target) {
        event.preventDefault(); // Previene la navegación por defecto del navegador.
        const path = targetLink.getAttribute('href');
        
        // Actualiza el estado del historial del navegador y renderiza la nueva página solo si la ruta es diferente.
        if (window.location.pathname !== path) {
            window.history.pushState({}, '', path); 
            await renderPage(path); 
        }
    }
}

// --- Inicialización de Event Listeners ---

// Listener para la navegación dentro de la SPA (delegación de eventos en 'document').
document.addEventListener('click', handleNavClick);
// Listener para los botones de "atrás" y "adelante" del navegador.
window.addEventListener('popstate', () => { renderPage(window.location.pathname); });
// Listener para la carga inicial de la página.
document.addEventListener('DOMContentLoaded', () => { renderPage(window.location.pathname); });