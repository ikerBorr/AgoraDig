/**
 * @file app.js
 * @description Orquestador principal de la Single Page Application (SPA).
 * Gestiona el enrutamiento del lado del cliente, la carga de plantillas HTML
 * y la ejecución de los scripts asociados a cada vista.
 */

// ===================================
//  ELEMENTOS PRINCIPALES DEL DOM
// ===================================

/** @type {HTMLElement} Contenedor principal donde se renderizan las vistas de la aplicación. */
const appRoot = document.getElementById('app-root');

/** @type {HTMLElement} Contenedor del indicador de carga, mostrado durante la navegación. */
const loaderContainer = document.getElementById('loader-container');


// ===================================
//  FUNCIONES DE AYUDA
// ===================================

/**
 * Crea y devuelve el elemento HTML para una única tarjeta de mensaje.
 * Esta función es un componente reutilizable para renderizar el feed.
 * @param {object} message - El objeto del mensaje.
 * @param {string} message._id - El ID único del mensaje.
 * @param {string} message.title - El título del mensaje.
 * @param {string} message.content - El contenido del mensaje.
 * @param {Array<string>} message.hashtags - Array con los hashtags del mensaje.
 * @param {number} message.likeCount - El número de 'likes' del mensaje.
 * @param {boolean} message.isLiked - Indica si el usuario actual ha dado 'like' a este mensaje.
 * @param {object} message.sender - El objeto del autor del mensaje.
 * @param {string} [message.sender._id] - El ID del autor.
 * @param {string} message.sender.username - El nombre de usuario del autor.
 * @param {string} message.sender.profilePicturePath - La ruta a la imagen de perfil del autor.
 * @returns {HTMLElement} El elemento del DOM (`div.message-card`) completamente construido.
 */
function createMessageCard(message) {
    const card = document.createElement('div');
    card.className = 'message-card';
    card.setAttribute('data-message-id', message._id);

    // Proporciona un autor por defecto si el sender fue eliminado o es nulo.
    const author = message.sender || { username: 'Usuario Eliminado', profilePicturePath: '../images/default-avatar.webp', _id: null };
    const { _id: authorId, username: authorUsername, profilePicturePath: authorAvatar } = author;
    
    // Calcula el número de likes, asegurando que siempre sea un número.
    const likeCount = message.likeCount !== undefined ? message.likeCount : (message.likes ? message.likes.length : 0);
    const likedClass = message.isLiked ? 'liked' : '';

    // Formatea los hashtags para que sean enlaces.
    const formattedHashtags = message.hashtags && message.hashtags.length > 0 ? message.hashtags.map(tag => `<a href="#" class="hashtag-link">#${tag}</a>`).join(' ') : '';

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
            <small class="message-hashtags">${formattedHashtags}</small>
        </div>
    `;
    
    return card;
}

/**
 * Se desplaza suavemente hasta un elemento del DOM basado en su selector.
 * Útil para navegar a anclas internas (ej. #home-feed).
 * @param {string} selector - Un selector CSS válido (ej. '#mi-id', '.mi-clase').
 */
function scrollToElement(selector) {
    const element = document.querySelector(selector);
    if (element) {
        element.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}


// ===================================
//  LÓGICA DE CARGA DE VISTAS
// ===================================

/**
 * Carga y ejecuta dinámicamente un script asociado a una plantilla.
 * Reemplaza el script de la vista anterior para evitar conflictos de listeners o estado.
 * @async
 * @param {string} templatePath - La ruta de la plantilla que se ha cargado (ej. './templates/register.html').
 * @returns {Promise<void>} Una promesa que se resuelve cuando el script ha sido añadido y cargado.
 */
async function loadAndExecuteScript(templatePath) {
    const oldScript = document.getElementById('view-script');
    if (oldScript) {
        oldScript.remove();
    }

    // Mapeo de plantillas a sus scripts correspondientes.
    const scriptMap = {
        './templates/register.html': './js/register.js',
        './templates/login.html': './js/login.js',
        './templates/profile.html': './js/profile.js',
    };

    // Mapeo de plantillas a sus funciones de inicialización.
    const initFunctionMap = {
        './templates/register.html': () => { if (typeof initRegisterForm === 'function') initRegisterForm(); },
        './templates/login.html': () => { if (typeof initLoginForm === 'function') initLoginForm(); },
        './templates/profile.html': () => { if (typeof initProfilePage === 'function') initProfilePage(); },
    };

    const scriptSrc = scriptMap[templatePath];
    if (!scriptSrc) return;

    const script = document.createElement('script');
    script.id = 'view-script';
    script.src = scriptSrc;
    
    script.onload = () => {
        const initFunction = initFunctionMap[templatePath];
        if (initFunction) {
            initFunction();
        }
    };
    
    document.body.appendChild(script);
}

/**
 * Obtiene el contenido de un archivo de plantilla HTML desde el servidor.
 * Si la plantilla no se encuentra (error 404), carga una plantilla de error como fallback.
 * @async
 * @param {string} path - La ruta al archivo de plantilla (.html).
 * @returns {Promise<string>} El contenido HTML de la plantilla.
 */
async function fetchTemplate(path) {
    try {
        const response = await fetch(path);
        if (!response.ok) {
            throw new Error(`Plantilla no encontrada en la ruta: ${path}`);
        }
        return await response.text();
    } catch (error) {
        console.error('Error al cargar la plantilla:', error);
        // Fallback: Carga la página de error si la plantilla solicitada falla.
        const response = await fetch('/templates/error-404.html');
        return await response.text();
    }
}

/**
 * Inicia un sondeo periódico (polling) para actualizar los contadores de likes en tiempo real.
 * Esto mantiene la UI actualizada sin necesidad de que el usuario recargue la página.
 * @param {HTMLElement} messagesContainer - El contenedor de los mensajes donde buscar las tarjetas.
 */
function startLikePolling(messagesContainer) {
    // Limpia cualquier intervalo de sondeo anterior para evitar duplicados.
    if (window.pollInterval) clearInterval(window.pollInterval);

    window.pollInterval = setInterval(async () => {
        const cards = messagesContainer.querySelectorAll('.message-card');
        if (cards.length === 0) return; // No hacer nada si no hay mensajes en la vista.

        const messageIds = Array.from(cards).map(card => card.getAttribute('data-message-id'));
        
        try {
            const response = await fetch(`/api/messages/counts?ids=${messageIds.join(',')}`);
            if (!response.ok) return; // Salir silenciosamente si la API falla.

            const counts = await response.json();

            // Actualiza el contador de likes en cada tarjeta si ha cambiado.
            for (const messageId in counts) {
                const card = messagesContainer.querySelector(`.message-card[data-message-id="${messageId}"]`);
                if (card) {
                    const likeCountSpan = card.querySelector('.like-count');
                    if (likeCountSpan && likeCountSpan.textContent !== String(counts[messageId])) {
                        likeCountSpan.textContent = counts[messageId];
                    }
                }
            }
        } catch (error) {
            // El error se silencia intencionadamente para no interrumpir al usuario
            // con fallos de una tarea de fondo no crítica.
        }
    }, 10000); // El sondeo se ejecuta cada 10 segundos.
}


// ===================================
//  ENRUTADOR Y RENDERIZADOR PRINCIPAL
// ===================================

/**
 * Renderiza una página en el contenedor #app-root basado en la ruta URL.
 * Es el núcleo de la SPA. Gestiona la visibilidad del loader, obtiene la plantilla,
 * actualiza el DOM, el título del documento y carga el script asociado.
 * @async
 * @param {string} path - La ruta de la URL a renderizar (ej. '/', '/login').
 * @returns {Promise<void>}
 */
async function renderPage(path) {
    // Ignora el ancla (hash) para la lógica de enrutamiento, se usa solo para scroll.
    const pathname = path.split('#')[0];

    loaderContainer.classList.remove('hidden');
    appRoot.classList.add('hidden');

    // Detiene cualquier proceso de sondeo de la vista anterior para evitar consumo innecesario de recursos.
    if (window.pollInterval) {
        clearInterval(window.pollInterval);
        window.pollInterval = null;
    }

    let templatePath = '';
    
    // --- Lógica de Enrutamiento ---
    if (pathname === '/' || pathname === '/home') {
        appRoot.innerHTML = await fetchTemplate('./templates/home.html');
        document.title = 'Inicio';

        // --- Lógica de la página de Inicio (Feed) ---
        const messagesContainer = document.getElementById('messages-container');
        const loadMoreBtn = document.getElementById('load-more-btn');
        const feedLoader = document.getElementById('feed-loader');

        let currentPage = 1;
        let totalPages = 1;

        const loadMessages = async () => {
            if (currentPage > totalPages) {
                loadMoreBtn.classList.add('hidden');
                return;
            }
            
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
                } else {
                    loadMoreBtn.classList.add('hidden');
                }

            } catch (error) {
                console.error(error);
                messagesContainer.innerHTML = '<p class="error-text">No se pudieron cargar los mensajes. Inténtalo de nuevo más tarde.</p>';
            } finally {
                feedLoader.classList.add('hidden');
            }
        };

        loadMoreBtn.addEventListener('click', loadMessages);
        await loadMessages(); // Carga inicial
        startLikePolling(messagesContainer); // Inicia el sondeo de likes

        // --- Lógica del Modal de Creación de Mensajes ---
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
            if (e.target === modalOverlay) hideModal();
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
                
                hideModal();
                // Refresca el feed para mostrar el nuevo mensaje.
                currentPage = 1;
                totalPages = 1;
                messagesContainer.innerHTML = '';
                await loadMessages();
                
            } catch (error) {
                modalError.textContent = error.message;
                modalError.classList.remove('hidden');
            }
        });

        // Lógica de 'likes' con delegación de eventos para optimizar rendimiento.
        messagesContainer.addEventListener('click', async (event) => {
            const likeButton = event.target.closest('.like-button');
            if (!likeButton) return;

            const card = likeButton.closest('.message-card');
            const messageId = card.getAttribute('data-message-id');

            try {
                const response = await fetch(`/api/messages/${messageId}/like`, { method: 'POST' });
                if (response.status === 401) return; // El usuario no está logueado.
                if (!response.ok) throw new Error('Error del servidor al procesar el like.');
                
                const data = await response.json();

                // Actualiza la UI de la tarjeta de forma optimista.
                const likeCountSpan = card.querySelector('.like-count');
                if (likeCountSpan) likeCountSpan.textContent = data.likeCount;
                likeButton.classList.toggle('liked', data.isLiked);

            } catch (error) {
                console.error(error.message);
            }
        });
        
        // No se requiere cargar plantilla adicional, la lógica está contenida aquí.
        templatePath = '';

    } else if (pathname === '/about' || pathname === '/about-AgoraDig' || pathname === '/about-us') {
        templatePath = './templates/about.html';
        document.title = 'Acerca de';
    } else if (pathname === '/contact' || pathname === '/contact-us') {
        templatePath = './templates/contact.html';
        document.title = 'Contacto';
    } else if (pathname === '/register') {
        templatePath = './templates/register.html';
        document.title = 'Crear Cuenta';
    } else if (pathname === '/register-success') {
        templatePath = './templates/register-success.html';
        document.title = 'Registro Exitoso';
    } else if (pathname === '/login') {
        templatePath = './templates/login.html';
        document.title = 'Iniciar Sesión';
    } else if (path.startsWith('/view-profile')) {
    try {
        const params = new URLSearchParams(window.location.search);
        const username = params.get('username');
        if (!username) throw new Error('Nombre de usuario no especificado en la URL.');

        // --- 1. Comprobar el rol del visitante (quien está viendo el perfil) ---
        let viewerRole = null;
        try {
            const selfProfileResponse = await fetch('/api/profile');
            if (selfProfileResponse.ok) {
                const viewerData = await selfProfileResponse.json();
                viewerRole = viewerData.role;
            }
        } catch (e) { /* El visitante no está logueado, viewerRole permanece null */ }

        // --- 2. Construir la URL de la API dinámicamente ---
        let apiUrl = `/api/users/username/${encodeURIComponent(username)}`;
        // Si el visitante es mod o admin, solicitamos los datos de moderación
        if (viewerRole === 'admin' || viewerRole === 'moderator') {
            apiUrl += '?include_moderation=true';
        }

        // --- 3. Realizar una ÚNICA llamada a la API para obtener los datos del perfil ---
        const userResponse = await fetch(apiUrl);
        if (!userResponse.ok) {
            const errorData = await userResponse.json();
            throw new Error(errorData.message || 'No se pudieron cargar los datos del perfil.');
        }
        const userData = await userResponse.json();

        // --- 4. Renderizar la plantilla con los datos correctos ---
        let profileHtml = await fetchTemplate('./templates/view-profile.html');
        const joinDate = new Date(userData.createdAt).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
        
        profileHtml = profileHtml
            .replace(/{{profilePicturePath}}/g, userData.profilePicturePath || '../images/default-avatar.webp')
            .replace(/{{firstName}}/g, userData.firstName)
            .replace(/{{lastName}}/g, userData.lastName)
            .replace(/{{username}}/g, userData.username)
            .replace(/{{description}}/g, userData.description || 'Este usuario aún no ha añadido una descripción.')
            .replace(/{{createdAt}}/g, joinDate);

        let adminControlsHtml = '';
        let moderationInfoHtml = '';
        
        if (viewerRole === 'admin' || viewerRole === 'moderator') {
            moderationInfoHtml = `
                <br>
                <div class="moderation-details">
                    <span class="role-badge">ROL: ${userData.role || 'user'}</span>
                    <span class="status-badge status-${userData.userStatus || 'active'}">ESTADO: ${userData.userStatus || 'active'}</span>
                    <span class="strikes-badge">STRIKES: ${userData.strikes !== undefined ? userData.strikes : 0}</span>
                </div>
            `;
        }

        if (viewerRole === 'admin') {
            adminControlsHtml = `
                <div class="admin-form-wrapper">
                    <h3>Panel de Administrador</h3>
                    <form id="admin-edit-form">
                         <div class="form-group-inline">
                            <label for="role-select">Rol:</label>
                            <select id="role-select" name="role">
                                <option value="user" ${userData.role === 'user' ? 'selected' : ''}>Usuario</option>
                                <option value="moderator" ${userData.role === 'moderator' ? 'selected' : ''}>Moderador</option>
                                <option value="admin" ${userData.role === 'admin' ? 'selected' : ''}>Admin</option>
                            </select>
                        </div>
                        <div class="form-group-inline">
                            <label for="status-select">Estado:</label>
                            <select id="status-select" name="userStatus">
                                <option value="active" ${userData.userStatus === 'active' || !userData.userStatus ? 'selected' : ''}>Activo</option>
                                <option value="banned" ${userData.userStatus === 'banned' ? 'selected' : ''}>Baneado</option>
                            </select>
                        </div>
                        <div class="form-group-inline">
                            <label for="strikes-input">Strikes:</label>
                            <input type="number" id="strikes-input" name="strikes" value="${userData.strikes !== undefined ? userData.strikes : 0}" min="0">
                        </div>
                        <p id="admin-form-message" class="message-info hidden"></p>
                        <button type="submit" class="button-primary">Guardar Cambios Admin</button>
                    </form>
                </div>`;
        } else if (viewerRole === 'moderator') {
             adminControlsHtml = `
                <div class="admin-form-wrapper">
                    <h3>Panel de Moderador</h3>
                    <form id="admin-edit-form">
                        <div class="form-group-inline">
                            <label for="strikes-input">Strikes:</label>
                            <input type="number" id="strikes-input" name="strikes" value="${userData.strikes !== undefined ? userData.strikes : 0}" min="0">
                        </div>
                        <p id="admin-form-message" class="message-info hidden"></p>
                        <button type="submit" class="button-primary">Actualizar Strikes</button>
                    </form>
                </div>`;
        }

        profileHtml = profileHtml
            .replace('{{moderationInfo}}', moderationInfoHtml)
            .replace('{{adminControls}}', adminControlsHtml);

        appRoot.innerHTML = profileHtml;
        document.title = `Perfil de ${userData.username}`;
        
        if (viewerRole === 'admin' || viewerRole === 'moderator') {
            const adminForm = document.getElementById('admin-edit-form');
            if (adminForm) {
                adminForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const messageEl = document.getElementById('admin-form-message');
                    messageEl.classList.add('hidden');
                    
                    const formData = new FormData(adminForm);
                    const data = Object.fromEntries(formData.entries());

                    try {
                        const response = await fetch(`/api/users/${username}/admin-update`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(data)
                        });
                        const result = await response.json();
                        if (!response.ok) {
                            throw new Error(result.message || 'Error al actualizar.');
                        }

                        messageEl.textContent = result.message;
                        messageEl.classList.remove('error-text');
                        messageEl.classList.add('success-text');
                        messageEl.classList.remove('hidden');

                        const modInfoContainer = document.getElementById('moderation-info-display');
                        if (modInfoContainer) {
                             modInfoContainer.innerHTML = `
                                <br>
                                <div class="moderation-details">
                                    <span class="role-badge">ROL: ${result.user.role}</span>
                                    <span class="status-badge status-${result.user.userStatus}">ESTADO: ${result.user.userStatus}</span>
                                    <span class="strikes-badge">STRIKES: ${result.user.strikes}</span>
                                </div>`;
                        }
                    } catch (error) {
                        messageEl.textContent = error.message;
                        messageEl.classList.remove('success-text');
                        messageEl.classList.add('error-text');
                        messageEl.classList.remove('hidden');
                    }
                });
            }
        }
        
        templatePath = '';

        } catch (error) {
            console.error('Error al renderizar el perfil de usuario:', error);
            appRoot.innerHTML = await fetchTemplate('./templates/error-404.html');
            document.title = 'ERROR 404';
        }
    } else if (path.startsWith('/profile')) {
        try {
            const response = await fetch('/api/profile');
            if (!response.ok) {
                if (response.status === 401) {
                    window.history.pushState({}, '', '/login');
                    await renderPage('/login');
                    return; // Detiene la ejecución para evitar más renderizados.
                }
                throw new Error('Error al obtener los datos del perfil.');
            }

            const userData = await response.json();
            const profileHtml = await fetchTemplate('./templates/profile.html');
            appRoot.innerHTML = profileHtml;
            const joinDate = new Date(userData.createdAt).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
            
            // Rellena la plantilla con los datos del perfil del usuario.
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

            document.title = userData.username;
            templatePath = ''; // Se resetea para indicar que el script se cargará manualmente.
            await loadAndExecuteScript('./templates/profile.html');

        } catch (error) {
            console.error(error);
            appRoot.innerHTML = await fetchTemplate('./templates/error-404.html');
        }
    } else if (pathname === '/terms-and-conditions') {
        templatePath = './templates/terms-and-conditions.html';
        document.title = 'Términos y Condiciones';
    } else if (pathname === '/privacy-policy') {
        templatePath = './templates/privacy-policy.html';
        document.title = 'Política de Privacidad';
    } else {
        templatePath = './templates/error-404.html';
        document.title = 'ERROR 404';
    }

    // Carga la plantilla si se ha definido una en el enrutador.
    if (templatePath) {
        appRoot.innerHTML = await fetchTemplate(templatePath);
    }
    
    // Lógica especial para la página de registro exitoso.
    if (pathname === '/register-success') {
        const pin = sessionStorage.getItem('registrationPin');
        const pinDisplayElement = document.getElementById('recovery-pin-display');

        if (pin && pinDisplayElement) {
            pinDisplayElement.textContent = pin;
            sessionStorage.removeItem('registrationPin'); // El PIN se muestra una sola vez.
        }
    }

    // Carga el script asociado a la plantilla si corresponde.
    if(templatePath) {
        await loadAndExecuteScript(templatePath);
    }

    loaderContainer.classList.add('hidden'); 
    appRoot.classList.remove('hidden');
}

/**
 * Manejador centralizado para los eventos de clic en enlaces de navegación.
 * Intercepta los clics en `<a>` para implementar la navegación de la SPA
 * sin recargar la página completa, utilizando la History API.
 * @async
 * @param {MouseEvent} event - El objeto del evento de clic.
 */
async function handleNavClick(event) {
    const targetLink = event.target.closest('a');
    
    // Ignorar clics que no son para la navegación de la SPA.
    if (!targetLink || !targetLink.hasAttribute('href') || targetLink.target || targetLink.href.includes('mailto:')) {
        return;
    }

    event.preventDefault(); // Prevenir la navegación tradicional del navegador.

    const targetUrl = new URL(targetLink.href);
    
    // Construye la ruta relativa que incluye los parámetros de búsqueda (ej. /view-profile?username=test)
    const newRelativePath = targetUrl.pathname + targetUrl.search;
    const currentRelativePath = window.location.pathname + window.location.search;
    
    // El ancla se gestiona por separado
    const targetHash = targetUrl.hash;

    // Solo se navega si la ruta (path + search) es diferente, para permitir cambiar entre perfiles.
    if (currentRelativePath !== newRelativePath) {
        // Actualiza el historial del navegador con la ruta limpia (con parámetros pero sin ancla).
        window.history.pushState({}, '', newRelativePath);
        // Llama a renderizar la página con la nueva ruta.
        await renderPage(newRelativePath);

        // Si la URL de destino tiene un ancla, desplazarse a ella después de renderizar.
        if (targetHash) {
            setTimeout(() => scrollToElement(targetHash), 100);
        }
    } else if (targetHash) {
        // Si es la misma página, solo nos desplazamos al ancla.
        scrollToElement(targetHash);
    }
}

// ===================================
//  INICIALIZACIÓN DE LA APLICACIÓN
// ===================================

// Listener para manejar toda la navegación por clics.
document.addEventListener('click', handleNavClick);

// Listener para manejar los botones de 'atrás' y 'adelante' del navegador.
window.addEventListener('popstate', () => { renderPage(window.location.pathname); });

// Listener para renderizar la página inicial cuando el DOM esté listo.
document.addEventListener('DOMContentLoaded', () => { renderPage(window.location.pathname); });