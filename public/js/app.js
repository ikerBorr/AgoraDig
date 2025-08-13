/**
 * @file app.js
 * @description Orquestador principal de la Single Page Application (SPA).
 * Gestiona el enrutamiento del lado del cliente, la carga de plantillas HTML
 * desde el directorio `/templates`, y la ejecución de los scripts de lógica asociados a cada vista.
 */

// ===================================
//  ELEMENTOS PRINCIPALES DEL DOM
// ===================================

/** @type {HTMLElement} Raíz de la aplicación donde se renderizan las vistas. */
const appRoot = document.getElementById('app-root');
/** @type {HTMLElement} Contenedor del indicador de carga, mostrado durante la navegación. */
const loaderContainer = document.getElementById('loader-container');


// ===================================
//  FUNCIONES DE AYUDA (HELPERS)
// ===================================

/**
 * @function createMessageCard
 * @description Crea y devuelve un elemento del DOM que representa una tarjeta de mensaje.
 * Esta función desacopla la lógica de creación de la tarjeta del renderizado principal del feed.
 * @param {object} message - El objeto del mensaje que contiene los datos a mostrar (título, contenido, autor, etc.).
 * @returns {HTMLDivElement} El elemento del DOM `div` con la clase 'message-card', listo para ser insertado en el DOM.
 */
function createMessageCard(message) {
    const card = document.createElement('div');
    card.className = 'message-card';
    card.setAttribute('data-message-id', message._id);

    // Se gestiona el caso de que el autor del mensaje haya sido eliminado.
    const author = message.sender || { username: 'Usuario Eliminado', profilePicturePath: '../images/default-avatar.webp', _id: null };
    const { _id: authorId, username: authorUsername, profilePicturePath: authorAvatar } = author;

    // Se calcula el número de 'likes' y se prepara la clase CSS si el usuario actual ha dado 'like'.
    const likeCount = message.likeCount !== undefined ? message.likeCount : (message.likes ? message.likes.length : 0);
    const likedClass = message.isLiked ? 'liked' : '';
    const formattedHashtags = message.hashtags && message.hashtags.length > 0 ? message.hashtags.map(tag => `<a href="#" class="hashtag-link">#${tag}</a>`).join(' ') : '';

    // --- Construcción del Encabezado de la Tarjeta ---
    const cardHeader = document.createElement('div');
    cardHeader.className = 'card-header';

    const authorInfo = document.createElement('div');
    authorInfo.className = 'author-info';

    const authorImg = document.createElement('img');
    authorImg.src = authorAvatar;
    authorImg.alt = `Avatar de ${authorUsername}`;
    authorImg.id = 'author-avatar';
    authorInfo.appendChild(authorImg);

    // Si el usuario fue eliminado o no tiene ID, se muestra como texto plano. Si no, como un enlace a su perfil.
    if (authorUsername === 'Usuario Eliminado' || !authorId) {
        const authorSpan = document.createElement('span');
        authorSpan.className = 'author-username';
        authorSpan.textContent = `@${authorUsername}`;
        authorInfo.appendChild(authorSpan);
    } else {
        const authorLink = document.createElement('a');
        authorLink.href = `/view-profile?username=${authorUsername}`;
        authorLink.className = 'author-username';
        authorLink.textContent = `@${authorUsername}`;
        authorInfo.appendChild(authorLink);
    }
    cardHeader.appendChild(authorInfo);

    const likesInfo = document.createElement('div');
    likesInfo.className = 'likes-info';
    likesInfo.innerHTML = `
        <span class="like-count">${likeCount}</span>
        <svg class="like-button ${likedClass}" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
        </svg>
    `;
    cardHeader.appendChild(likesInfo);
    card.appendChild(cardHeader);

    // --- Construcción del Cuerpo de la Tarjeta ---
    const cardBody = document.createElement('div');
    cardBody.className = 'card-body';

    const title = document.createElement('h4');
    title.className = 'message-title';
    title.textContent = message.title;
    cardBody.appendChild(title);

    const content = document.createElement('p');
    content.className = 'message-content';
    content.textContent = message.content;
    cardBody.appendChild(content);

    const hashtagsSmall = document.createElement('small');
    hashtagsSmall.className = 'message-hashtags';
    hashtagsSmall.innerHTML = formattedHashtags;
    cardBody.appendChild(hashtagsSmall);
    
    card.appendChild(cardBody);

    return card;
}


/**
 * @function scrollToElement
 * @description Desplaza suavemente la vista hasta un elemento del DOM especificado por un selector CSS.
 * Útil para navegar a anclas de sección (ej. `#contacto`) dentro de una misma vista de la SPA.
 * @param {string} selector - Un selector CSS válido para el elemento de destino.
 */
function scrollToElement(selector) {
    const element = document.querySelector(selector);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}


// ===================================
//  LÓGICA DE CARGA DE VISTAS
// ===================================

/**
 * @function loadAndExecuteScript
 * @description Carga y ejecuta dinámicamente un script asociado a una plantilla de vista.
 * Elimina el script de la vista anterior antes de añadir el nuevo para evitar conflictos de listeners
 * o ejecución de código no deseado en la nueva vista.
 * @param {string} templatePath - La ruta de la plantilla HTML que se ha cargado (ej. './templates/profile.html').
 * @returns {Promise<void>} Una promesa que se resuelve cuando el script ha sido cargado y su función de inicialización ejecutada.
 */
async function loadAndExecuteScript(templatePath) {
    const oldScript = document.getElementById('view-script');
    if (oldScript) {
        oldScript.remove();
    }
    
    // Mapeo centralizado de plantillas a sus scripts e inicializadores.
    const scriptMap = {
        './templates/register.html': './js/register.js',
        './templates/login.html': './js/login.js',
        './templates/profile.html': './js/profile.js',
    };
    const initFunctionMap = {
        './templates/register.html': () => { if (typeof initRegisterForm === 'function') initRegisterForm(); },
        './templates/login.html': () => { if (typeof initLoginForm === 'function') initLoginForm(); },
        './templates/profile.html': () => { if (typeof initProfilePage === 'function') initProfilePage(); },
    };

    const scriptSrc = scriptMap[templatePath];
    if (!scriptSrc) return; // No hay script asociado a esta plantilla.

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
 * @function fetchTemplate
 * @description Realiza una petición `fetch` para obtener el contenido de un archivo de plantilla HTML.
 * Si la plantilla no se encuentra (error 404), carga una plantilla de error `error-404.html` por defecto
 * para informar al usuario de manera controlada sin romper la aplicación.
 * @param {string} path - La ruta al archivo de plantilla (ej. './templates/home.html').
 * @returns {Promise<string>} Una promesa que se resuelve con el contenido de la plantilla como una cadena de texto.
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
        // Carga la página de error como fallback.
        const response = await fetch('/templates/error-404.html');
        return await response.text();
    }
}

/**
 * @function startLikePolling
 * @description Inicia un intervalo de sondeo (polling) para actualizar los contadores de 'likes' de los mensajes visibles en el feed.
 * Limpia cualquier intervalo anterior para evitar múltiples ejecuciones simultáneas, lo cual es crítico en una SPA
 * donde el usuario puede navegar entre vistas sin recargar la página.
 * @param {HTMLElement} messagesContainer - El contenedor del DOM donde se encuentran las tarjetas de mensajes.
 */
function startLikePolling(messagesContainer) {
    // Si ya existe un intervalo, se limpia para evitar duplicados.
    if (window.pollInterval) clearInterval(window.pollInterval);

    window.pollInterval = setInterval(async () => {
        const cards = messagesContainer.querySelectorAll('.message-card');
        if (cards.length === 0) return;

        const messageIds = Array.from(cards).map(card => card.getAttribute('data-message-id'));

        try {
            const response = await fetch(`/api/messages/counts?ids=${messageIds.join(',')}`);
            if (!response.ok) return; // Falla silenciosamente para no interrumpir al usuario.
            
            const counts = await response.json();
            for (const messageId in counts) {
                const card = messagesContainer.querySelector(`.message-card[data-message-id="${messageId}"]`);
                if (card) {
                    const likeCountSpan = card.querySelector('.like-count');
                    // Solo actualiza el DOM si el contador ha cambiado para optimizar el rendimiento.
                    if (likeCountSpan && likeCountSpan.textContent !== String(counts[messageId])) {
                        likeCountSpan.textContent = counts[messageId];
                    }
                }
            }
        } catch (error) {
            // El error se silencia intencionadamente para que fallos de red en el polling
            // no generen alertas visuales o errores en la consola que molesten al usuario.
        }
    }, 10000); // Se actualiza cada 10 segundos.
}


// ===================================
//  ENRUTADOR Y RENDERIZADOR PRINCIPAL
// ===================================

/**
 * @function renderPage
 * @description Renderiza el contenido de una página basándose en la ruta URL proporcionada. Es el corazón del enrutador de la SPA.
 * Gestiona la obtención de plantillas, la lógica de negocio específica de cada vista (como obtener datos de la API)
 * y la inicialización de los scripts correspondientes.
 * @param {string} path - La ruta de la URL a renderizar (ej. '/home', '/profile', '/login?redirect=true').
 * @returns {Promise<void>} Una promesa que se resuelve cuando la página ha sido completamente renderizada en el `appRoot`.
 */
async function renderPage(path) {
    // Extrae la ruta base sin anclas (#).
    const pathname = path.split('#')[0];

    // Muestra el loader y oculta el contenido principal durante la carga.
    loaderContainer.classList.remove('hidden');
    appRoot.classList.add('hidden');

    // Detiene cualquier sondeo de 'likes' de la vista anterior.
    if (window.pollInterval) {
        clearInterval(window.pollInterval);
        window.pollInterval = null;
    }

    let templatePath = '';
    
    // --- Lógica para la ruta '/home' o la raíz '/' ---
    if (pathname === '/' || pathname === '/home') {
        appRoot.innerHTML = await fetchTemplate('./templates/home.html');
        document.title = 'Inicio';
        
        // --- Inicialización de la lógica del feed de mensajes ---
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

                // Si es la primera página y no hay mensajes, muestra un mensaje de bienvenida.
                if (currentPage === 1 && data.messages.length === 0) {
                    messagesContainer.innerHTML = `
                        <div class="empty-feed-message">
                            <br>
                            <p>Aún no hay mensajes publicados. ¡Sé el primero en compartir tus ideas!</p>
                            <br>
                        </div>
                    `;
                    feedLoader.classList.add('hidden');
                    return;
                }

                data.messages.forEach(message => {
                    const messageCard = createMessageCard(message);
                    messagesContainer.appendChild(messageCard);
                });

                totalPages = data.totalPages;
                currentPage++;

                // Muestra el botón 'Cargar más' solo si hay más páginas.
                if (currentPage <= totalPages) {
                    loadMoreBtn.classList.remove('hidden');
                } else {
                    loadMoreBtn.classList.add('hidden');
                }
            } catch (error) {
                console.error(error);
                messagesContainer.innerHTML = `
                    <p class="error-text">
                        No se pudieron cargar los mensajes. Inténtalo de nuevo más tarde.
                    </p>
                `;
            } finally {
                feedLoader.classList.add('hidden');
            }
        };

        loadMoreBtn.addEventListener('click', loadMessages);
        await loadMessages(); // Carga inicial de mensajes.
        startLikePolling(messagesContainer); // Inicia el sondeo de 'likes'.

        // --- Lógica para el modal de creación de mensajes ---
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

        openModalBtn.addEventListener('click', async () => {
            try {
                // Se realiza una petición a /api/profile para comprobar el estado de la sesión.
                const response = await fetch('/api/profile');

                if (response.ok) {
                    // Si la respuesta es exitosa, el usuario está logueado. Se muestra el modal.
                    showModal();
                } else if (response.status === 401) {
                    // Si la respuesta es 401, el usuario no está logueado. Se le redirige al login.
                    window.history.pushState({}, '', '/login');
                    await renderPage('/login');
                } else {
                    // Manejo de otros posibles errores del servidor.
                    throw new Error('No se pudo verificar el estado de la sesión. Inténtalo de nuevo.');
                }
            } catch (error) {
                console.error('Error al verificar la autenticación:', error);
                alert(error.message || 'Error de red. Por favor, comprueba tu conexión.');
            }
        });
        
        closeModalBtn.addEventListener('click', hideModal);
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) hideModal(); // Cierra el modal si se hace clic fuera del contenido.
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

        // --- Lógica para manejar clics en botones de 'like' ---
        messagesContainer.addEventListener('click', async (event) => {
            const likeButton = event.target.closest('.like-button');
            if (!likeButton) return;

            const card = likeButton.closest('.message-card');
            const messageId = card.getAttribute('data-message-id');

            try {
                const response = await fetch(`/api/messages/${messageId}/like`, { method: 'POST' });
                if (response.status === 401) return; // Si no está autenticado, no hace nada.
                if (!response.ok) throw new Error('Error del servidor al procesar el like.');
                
                const data = await response.json();
                const likeCountSpan = card.querySelector('.like-count');
                if (likeCountSpan) likeCountSpan.textContent = data.likeCount;
                likeButton.classList.toggle('liked', data.isLiked);
            } catch (error) {
                console.error(error.message);
            }
        });

        templatePath = ''; // Indica que el contenido ya fue renderizado dinámicamente.

    // --- Lógica para rutas estáticas o semi-estáticas ---
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
    
    // --- Lógica para la vista de perfil de otros usuarios ---
    } else if (path.startsWith('/view-profile')) {
        try {
            const params = new URLSearchParams(window.location.search);
            const username = params.get('username');
            if (!username) throw new Error('Nombre de usuario no especificado en la URL.');

            // Intenta determinar el rol del usuario que está viendo el perfil para solicitar datos de moderación si tiene permisos.
            let viewerRole = null;
            try {
                const selfProfileResponse = await fetch('/api/profile');
                if (selfProfileResponse.ok) {
                    const viewerData = await selfProfileResponse.json();
                    viewerRole = viewerData.role;
                }
            } catch (e) { /* El usuario no está logueado, se ignora el error. */ }

            let apiUrl = `/api/users/username/${encodeURIComponent(username)}`;
            if (viewerRole === 'admin' || viewerRole === 'moderator') {
                apiUrl += '?include_moderation=true';
            }

            const userResponse = await fetch(apiUrl);
            if (!userResponse.ok) {
                const errorData = await userResponse.json();
                // Si el usuario fue ELIMINADO (410 Gone), muestra un mensaje específico.
                if (userResponse.status === 410) {
                    // Carga la plantilla de error 410
                    appRoot.innerHTML = await fetchTemplate('../templates/error-410.html');
                    document.title = 'ERROR 410';
                    templatePath = ''; // Evita que se siga procesando.
                    // Oculta el loader y muestra el contenido antes de salir.
                    loaderContainer.classList.add('hidden');
                    appRoot.classList.remove('hidden');
                    return; // Termina la ejecución para esta ruta.
                }
                // Para cualquier otro error (ej. 404), lanza la excepción para el catch general.
                throw new Error(errorData.message || 'No se pudieron cargar los datos del perfil.');
            }
            

            const userData = await userResponse.json();
            let profileHtml = await fetchTemplate('./templates/view-profile.html');
            const joinDate = new Date(userData.createdAt).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
            
            profileHtml = profileHtml.replace(/{{createdAt}}/g, joinDate);
            
            // --- Lógica para mostrar controles de administrador/moderador ---
            let adminControlsHtml = '';
            let moderationInfoHtml = `
                <div class="moderation-details">
                    <span class="role-badge">ROL: ${userData.role || 'user'}</span>
                    <span class="status-badge status-${userData.userStatus || 'active'}">ESTADO: ${userData.userStatus || 'active'}</span>
                </div><br>`;
            
            if ((viewerRole === 'admin' || viewerRole === 'moderator') && userData.strikes !== undefined) {
                moderationInfoHtml = `
                    <div class="moderation-details">
                        <span class="role-badge">ROL: ${userData.role || 'user'}</span>
                        <span class="status-badge status-${userData.userStatus || 'active'}">ESTADO: ${userData.userStatus || 'active'}</span>
                        <span class="strikes-badge">STRIKES: ${userData.strikes}</span>
                    </div><br>`;
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
                    </div>
                `;
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
                    </div>
                 `;
            }

            // Inyección de los datos en la plantilla.
            profileHtml = profileHtml
                .replace('{{moderationInfo}}', moderationInfoHtml)
                .replace('{{adminControls}}', adminControlsHtml);
                
            appRoot.innerHTML = profileHtml;
            document.title = `Perfil de ${userData.username}`;
            
            const profilePic = appRoot.querySelector('.profile-picture');
            if (profilePic) {
                profilePic.src = userData.profilePicturePath || '../images/default-avatar.webp';
                profilePic.alt = `Foto de perfil de ${userData.username}`;
            }
            appRoot.querySelector('.profile-fullname').textContent = `${userData.firstName} ${userData.lastName}`;
            appRoot.querySelector('.profile-username').textContent = `@${userData.username}`;
            appRoot.querySelector('.profile-description').textContent = userData.description || 'Este usuario aún no ha añadido una descripción.';

            // Listener para el formulario de administración.
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
                            const response = await fetch(`/api/users/${username}/admin-update`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
                            const result = await response.json();
                            if (!response.ok) throw new Error(result.message || 'Error al actualizar.');
                            messageEl.textContent = result.message;
                            messageEl.classList.remove('error-text'); messageEl.classList.add('success-text'); messageEl.classList.remove('hidden');
                            
                            // Actualiza la UI con los nuevos datos de moderación sin recargar.
                            const modInfoContainer = document.querySelector('#moderation-info-display');
                            if (modInfoContainer) {
                                 modInfoContainer.innerHTML = `<br><div class="moderation-details"><span class="role-badge">ROL: ${result.user.role}</span><span class="status-badge status-${result.user.userStatus}">ESTADO: ${result.user.userStatus}</span><span class="strikes-badge">STRIKES: ${result.user.strikes}</span></div>`;
                            }
                        } catch (error) {
                            messageEl.textContent = error.message;
                            messageEl.classList.remove('success-text'); messageEl.classList.add('error-text'); messageEl.classList.remove('hidden');
                        }
                    });
                }
            }
            templatePath = ''; // Renderizado dinámico completado.

        } catch (error) {
            console.error('Error al renderizar el perfil de usuario:', error);
            appRoot.innerHTML = await fetchTemplate('./templates/error-404.html');
            document.title = 'ERROR 404';
        }
    
    // --- Lógica para la vista del perfil del propio usuario ---
    } else if (path.startsWith('/profile')) {
        try {
            const response = await fetch('/api/profile');
            if (!response.ok) {
                // Si no está autorizado (no logueado), se redirige al login.
                if (response.status === 401) {
                    window.history.pushState({}, '', '/login');
                    await renderPage('/login');
                    return; 
                }
                throw new Error('Error al obtener los datos del perfil.');
            }
    
            const userData = await response.json();
            let profileHtml = await fetchTemplate('./templates/profile.html');
            const joinDate = new Date(userData.createdAt).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
            
            profileHtml = profileHtml.replace('{{createdAt}}', joinDate);
            appRoot.innerHTML = profileHtml;
            
            // Rellena los datos del perfil.
            const profilePicture = appRoot.querySelector('.profile-picture');
            if (profilePicture) {
                profilePicture.src = userData.profilePicturePath || '../images/default-avatar.webp';
                profilePicture.alt = `Foto de perfil de ${userData.username}`;
            }
            appRoot.querySelector('.profile-fullname').textContent = `${userData.firstName} ${userData.lastName}`;
            appRoot.querySelector('.profile-username').textContent = `@${userData.username}`;
            appRoot.querySelector('.profile-description').textContent = userData.description || 'Este usuario aún no ha añadido una descripción.';
            
            const moderationContainer = appRoot.querySelector('#moderation-info-display');
            if (moderationContainer) {
                moderationContainer.innerHTML = `
                    <div class="moderation-details">
                        <span class="role-badge">ROL: ${userData.role || 'user'}</span>
                        <span class="status-badge status-${userData.userStatus || 'active'}">ESTADO: ${userData.userStatus || 'active'}</span>
                    </div>
                    <br>
                `;
            }

            document.title = userData.username;
            templatePath = ''; // Contenido dinámico renderizado.
            // Carga el script específico para la página de perfil (para el modal de edición, etc.).
            await loadAndExecuteScript('./templates/profile.html');
    
        } catch (error) {
            console.error(error);
            appRoot.innerHTML = await fetchTemplate('./templates/error-404.html');
            document.title = 'ERROR 404';
        }

    // --- Lógica para otras rutas estáticas ---
    } else if (pathname === '/terms-and-conditions') {
        templatePath = './templates/terms-and-conditions.html';
        document.title = 'Términos y Condiciones';
    } else if (pathname === '/privacy-policy') {
        templatePath = './templates/privacy-policy.html';
        document.title = 'Política de Privacidad';

    // --- Ruta por defecto para cualquier otra URL no reconocida ---
    } else {
        templatePath = './templates/error-404.html';
        document.title = 'ERROR 404';
    }

    // Si `templatePath` tiene un valor, significa que es una página estática que necesita ser cargada.
    if (templatePath) {
        appRoot.innerHTML = await fetchTemplate(templatePath);
    }
    
    // Lógica específica post-renderizado para la página de éxito de registro.
    if (pathname === '/register-success') {
        const pin = sessionStorage.getItem('registrationPin');
        const pinDisplayElement = document.getElementById('recovery-pin-display');
        if (pin && pinDisplayElement) {
            pinDisplayElement.textContent = pin;
            sessionStorage.removeItem('registrationPin'); // El PIN se muestra una sola vez.
        }
    }

    // Carga el script asociado si la plantilla no fue renderizada dinámicamente.
    if(templatePath) {
        await loadAndExecuteScript(templatePath);
    }

    // Oculta el loader y muestra el contenido de la aplicación.
    loaderContainer.classList.add('hidden'); 
    appRoot.classList.remove('hidden');
}

/**
 * @function handleNavClick
 * @description Maneja los clics en los enlaces de navegación de la aplicación (`<a>`).
 * Intercepta el comportamiento de navegación por defecto para implementar la lógica de la SPA
 * utilizando la History API (`window.history.pushState`), evitando así recargas completas de la página.
 * @param {MouseEvent} event - El objeto del evento de clic.
 */
async function handleNavClick(event) {
    const targetLink = event.target.closest('a');
    // Ignora clics que no son en enlaces, enlaces sin href, enlaces que abren en nueva pestaña o enlaces de email.
    if (!targetLink || !targetLink.hasAttribute('href') || targetLink.target || targetLink.href.includes('mailto:')) {
        return;
    }

    event.preventDefault(); // Previene la recarga de la página.

    const targetUrl = new URL(targetLink.href);
    const newRelativePath = targetUrl.pathname + targetUrl.search;
    const currentRelativePath = window.location.pathname + window.location.search;
    const targetHash = targetUrl.hash;

    // Solo renderiza la nueva página si la ruta ha cambiado.
    if (currentRelativePath !== newRelativePath) {
        window.history.pushState({}, '', newRelativePath);
        await renderPage(newRelativePath);
        // Si hay un ancla, desplaza la vista hacia ella después de renderizar.
        if (targetHash) {
            setTimeout(() => scrollToElement(targetHash), 100);
        }
    } else if (targetHash) {
        // Si la ruta es la misma pero hay un ancla, solo desplaza la vista.
        scrollToElement(targetHash);
    }
}

// ===================================
//  INICIALIZACIÓN DE LA APLICACIÓN
// ===================================

/** @description Manejador de eventos global para los clics en enlaces, permitiendo la navegación SPA. */
document.addEventListener('click', handleNavClick);
/** @description Maneja los eventos de navegación del historial del navegador (botones de atrás/adelante). */
window.addEventListener('popstate', () => { renderPage(window.location.pathname + window.location.search); });
/** @description Renderiza la página inicial correspondiente a la URL actual cuando el DOM está completamente cargado. */
document.addEventListener('DOMContentLoaded', () => { renderPage(window.location.pathname + window.location.search); });