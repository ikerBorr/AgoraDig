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
 * @function loadViewCss
 * @description Carga dinámicamente una hoja de estilos para una vista específica.
 * Elimina el CSS de la vista anterior para evitar conflictos de estilos.
 * @param {string|null} cssPath - La ruta al archivo CSS a cargar, o null para no cargar ninguno.
 */
async function loadViewCss(cssPath) {
    // Elimina la hoja de estilos de la vista anterior, si existe.
    const oldLink = document.getElementById('view-specific-css');
    if (oldLink) {
        oldLink.remove();
    }

    // Si se proporciona una nueva ruta de CSS, crea y añade la nueva etiqueta <link>.
    if (cssPath) {
        return new Promise((resolve) => {
            const link = document.createElement('link');
            link.id = 'view-specific-css';
            link.rel = 'stylesheet';
            link.href = cssPath;
            link.onload = () => resolve(); // Resuelve la promesa cuando el CSS ha cargado.
            document.head.appendChild(link);
        });
    }
}


/**
 * @function createMessageCard
 * @description Crea y devuelve un elemento del DOM que representa una tarjeta de mensaje.
 * Esta función desacopla la lógica de creación de la tarjeta del renderizado principal del feed.
 * Ahora incluye un botón de eliminar condicional basado en los permisos del usuario actual.
 * @param {object} message - El objeto del mensaje que contiene los datos a mostrar.
 * @param {object|null} currentUser - El objeto del usuario logueado o null si no hay sesión. Contiene _id y role.
 * @returns {HTMLDivElement} El elemento del DOM `div` con la clase 'message-card', listo para ser insertado en el DOM.
 */
function createMessageCard(message, currentUser) {
    const card = document.createElement('article');
    card.className = 'message-card';
    card.setAttribute('data-message-id', message._id);
    card.id = `message-${message._id}`;

    // Se gestiona el caso de que el autor del mensaje haya sido eliminado.
    const author = message.sender || { username: 'Usuario Eliminado', profilePicturePath: '/images/default-avatar.webp', _id: null };
    const { _id: authorId, username: authorUsername, profilePicturePath: authorAvatar } = author;

    // Se preparan los contadores y clases CSS.
    const replyCount = message.replyCount !== undefined ? message.replyCount : (message.replies ? message.replies.length : 0);
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

    const cardActions = document.createElement('div');
    cardActions.className = 'card-actions';

    const likesInfo = document.createElement('div');
    likesInfo.className = 'likes-info';
    likesInfo.innerHTML = `
        <span class="like-count">${likeCount}</span>
        <svg class="like-button ${likedClass}" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
        </svg>
    `;
    cardActions.appendChild(likesInfo);
    
    const replyInfo = document.createElement('div');
    replyInfo.className = 'reply-info';
    replyInfo.innerHTML = `
        <span class="reply-count">${replyCount}</span>
        <svg class="reply-message-btn" title="Responder" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 17 4 12 9 7"></polyline>
            <path d="M20 18v-2a4 4 0 0 0-4-4H4"></path>
        </svg>
    `;
    cardActions.appendChild(replyInfo);

    cardHeader.appendChild(cardActions);
    card.appendChild(cardHeader);

    // --- Construcción del Cuerpo de la Tarjeta ---
    const cardBody = document.createElement('div');
    cardBody.className = 'card-body';

    if (message.referencedMessage) {
        const replyToInfo = document.createElement('div');
        replyToInfo.className = 'reply-to-info';
        
        if (message.referencedMessage.messageStatus === 'active' && message.referencedMessage.title) {
            replyToInfo.innerHTML = `Respuesta a: <a href="/messages/${message.referencedMessage._id}">${message.referencedMessage.title}</a>`;
        } else {
            replyToInfo.innerHTML = `Respuesta a: <span class="deleted-message-reference">Mensaje_Eliminado</span>`;
        }
        cardBody.appendChild(replyToInfo);
    }

    const title = document.createElement('h4');
    title.className = 'message-title';
    title.textContent = message.title;
    cardBody.appendChild(title);

    const content = document.createElement('p');
    content.className = 'message-content';
    content.textContent = message.content;
    cardBody.appendChild(content);

    card.appendChild(cardBody);
    
    // --- Construcción del Pie de la Tarjeta ---
    const cardFooter = document.createElement('div');
    cardFooter.className = 'card-footer';

    const hashtagsSmall = document.createElement('small');
    hashtagsSmall.className = 'message-hashtags';
    hashtagsSmall.innerHTML = formattedHashtags;
    cardFooter.appendChild(hashtagsSmall);
    
    const canDelete = currentUser && (
        currentUser.role === 'admin' ||
        currentUser.role === 'moderator' ||
        (message.sender && currentUser._id === message.sender._id)
    );

    if (canDelete) {
        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-message-btn';
        deleteButton.title = 'Eliminar mensaje';
        deleteButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-trash-2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
        cardFooter.appendChild(deleteButton);
    }

    card.appendChild(cardFooter);

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

/**
 * @function showDeleteConfirmationModal
 * @description Muestra un modal de confirmación para eliminar un mensaje.
 * La apariencia está definida en `messages.css`. Esta función solo gestiona la creación del DOM
 * y la lógica de los eventos, alternando la clase `.visible` para mostrar/ocultar el modal.
 * @param {string} messageId - El ID del mensaje a eliminar.
 * @param {HTMLElement} cardElement - El elemento de la tarjeta del mensaje a eliminar del DOM.
 */
function showDeleteConfirmationModal(messageId, cardElement) {
    // Previene la creación de múltiples modales.
    if (document.querySelector('.delete-confirmation-overlay')) return;

    // Crea el overlay del modal y le asigna sus clases para que aparezca visible directamente.
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'delete-confirmation-overlay visible';

    // Crea el contenido del modal y le asigna la clase genérica .modal-content.
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    
    // Define el HTML interno del modal.
    modalContent.innerHTML = `
        <h2 style="text-align: center;">Confirmar Eliminación</h2>
        <p>¿Estás seguro de que quieres eliminar este mensaje? Esta acción es irreversible.</p>
        <div class="modal-error-message error-text hidden" style="text-align: center; margin-bottom: 1rem; font-weight: bold;"></div>
        <div class="modal-actions">
            <button class="button-secondary cancel-delete-btn">Cancelar</button>
            <button class="button-danger confirm-delete-btn">Eliminar</button>
        </div>
    `;

    // Añade el contenido al overlay y el overlay al body.
    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);

    // Función para cerrar el modal de forma instantánea.
    const closeModal = () => {
        if (modalOverlay) {
            modalOverlay.remove();
        }
    };

    const confirmBtn = modalContent.querySelector('.confirm-delete-btn');
    const cancelBtn = modalContent.querySelector('.cancel-delete-btn');
    const modalError = modalContent.querySelector('.modal-error-message');

    // Evento para el botón de confirmar eliminación.
    confirmBtn.addEventListener('click', async () => {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Eliminando...';
        try {
            const response = await fetch(`/api/messages/${messageId}`, { method: 'DELETE' });
            if (response.ok) {
                closeModal();
                cardElement.style.transition = 'opacity 0.5s ease';
                cardElement.style.opacity = '0';
                setTimeout(() => cardElement.remove(), 500);
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Error al eliminar el mensaje.');
            }
        } catch (error) {
            modalError.textContent = error.message;
            modalError.classList.remove('hidden');
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Eliminar';
        }
    });

    // Evento para el botón de cancelar.
    cancelBtn.addEventListener('click', closeModal);

    // Evento para cerrar el modal si se hace clic fuera del contenido.
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            closeModal();
        }
    });
}

/**
 * @function showReplyModal
 * @description Crea y muestra dinámicamente un modal para responder a un mensaje.
 * Esta función es autocontenida y no depende de HTML preexistente en la plantilla.
 * @param {string} parentId - El ID del mensaje al que se está respondiendo.
 */
function showReplyModal(parentId) {
    if (document.getElementById('dynamic-reply-modal-overlay')) return;

    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    modalOverlay.id = 'dynamic-reply-modal-overlay';

    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    modalContent.innerHTML = `
        <div class="modal-header">
            <h2 id="modal-title">Responder al Mensaje</h2>
            <button id="close-modal-btn" class="close-button" title="Cerrar">&times;</button>
        </div>
        <div class="modal-body">
            <form id="create-message-form" novalidate>
                <div class="form-group">
                    <label for="message-title">Título</label>
                    <input type="text" id="message-title" name="title" required minlength="3" maxlength="100">
                </div>
                <div class="form-group">
                    <label for="message-content">Contenido</label>
                    <textarea id="message-content" name="content" rows="6" required minlength="10" maxlength="1500"></textarea>
                </div>
                <div class="form-group">
                    <label for="message-hashtags">Hashtags</label>
                    <input type="text" id="message-hashtags" name="hashtags" placeholder="Ej: #tecnologia #debate">
                    <small>Escribe hashtags separados por espacios.</small>
                </div>
                <div id="modal-error-message" class="error-text hidden"></div>
                <button type="submit" class="button-primary">Publicar</button>
            </form>
        </div>
    `;

    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);

    requestAnimationFrame(() => {
        modalOverlay.classList.add('visible');
    });

    const closeModal = () => {
        modalOverlay.classList.remove('visible');
        setTimeout(() => modalOverlay.remove(), 300);
    };

    modalContent.querySelector('#close-modal-btn').addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            closeModal();
        }
    });

    const form = modalContent.querySelector('form');
    const errorEl = modalContent.querySelector('#modal-error-message');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorEl.classList.add('hidden');

        const titleInput = form.querySelector('#message-title');
        const contentInput = form.querySelector('#message-content');

        // Validación de cliente
        if (titleInput.value.trim().length < 3 || titleInput.value.trim().length > 100) {
            errorEl.textContent = 'El título debe tener entre 3 y 100 caracteres.';
            errorEl.classList.remove('hidden');
            return;
        }
        if (contentInput.value.trim().length < 10 || contentInput.value.trim().length > 1500) {
            errorEl.textContent = 'El contenido debe tener entre 10 y 1500 caracteres.';
            errorEl.classList.remove('hidden');
            return;
        }

        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        const url = `/api/messages/${parentId}/reply`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const responseData = await response.json();
            if (!response.ok) {
                throw new Error(responseData.message || 'Error desconocido al publicar la respuesta.');
            }
            closeModal();
            await renderPage(window.location.pathname);
        } catch (error) {
            errorEl.textContent = error.message;
            errorEl.classList.remove('hidden');
        }
    });
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
    
    const scriptMap = {
        '/templates/register.html': './js/register.js',
        '/templates/login.html': './js/login.js',
        '/templates/profile.html': './js/profile.js',
    };
    const initFunctionMap = {
        '/templates/register.html': () => { if (typeof initRegisterForm === 'function') initRegisterForm(); },
        '/templates/login.html': () => { if (typeof initLoginForm === 'function') initLoginForm(); },
        '/templates/profile.html': () => { if (typeof initProfilePage === 'function') initProfilePage(); },
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
 * @function fetchTemplate
 * @description Realiza una petición `fetch` para obtener el contenido de un archivo de plantilla HTML.
 * Si la plantilla no se encuentra (error 404), carga una plantilla de error `error-404.html` por defecto
 * para informar al usuario de manera controlada sin romper la aplicación.
 * @param {string} path - La ruta al archivo de plantilla (ej. '/templates/home.html').
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
        const response = await fetch('/templates/error-404.html');
        await loadViewCss('/css/error.css'); // Cargar CSS de error si la plantilla principal falla
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
    if (window.pollInterval) clearInterval(window.pollInterval);

    window.pollInterval = setInterval(async () => {
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
                    if (likeCountSpan && likeCountSpan.textContent !== String(counts[messageId])) {
                        likeCountSpan.textContent = counts[messageId];
                    }
                }
            }
        } catch (error) {
            // No se muestra error para no molestar al usuario con fallos de red intermitentes.
        }
    }, 10000);
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
    const pathname = path.split('#')[0];

    loaderContainer.classList.remove('hidden');
    appRoot.classList.add('hidden');

    if (window.pollInterval) {
        clearInterval(window.pollInterval);
        window.pollInterval = null;
    }

    let templatePath = '';
    let cssPath = null; // Variable para almacenar la ruta del CSS específico de la vista.

    // Función de ayuda para verificar la autenticación, ahora en un ámbito superior para ser reutilizable.
    async function checkAuth() {
        try {
            const response = await fetch('/api/profile');
            if (response.ok) return true;

            if (response.status === 401) {
                if (confirm('Debes iniciar sesión para realizar esta acción. ¿Quieres ir a la página de login?')) {
                    window.history.pushState({}, '', '/login');
                    await renderPage('/login');
                }
                return false;
            }
            const errorData = await response.json();
            throw new Error(errorData.message || 'No se pudo verificar el estado de la sesión.');
        } catch (error) {
            console.error('Error al verificar la autenticación:', error);
            alert(error.message || 'Error de red. Por favor, comprueba tu conexión.');
            return false;
        }
    }
    
    if (pathname === '/' || pathname === '/home') {
        cssPath = '/css/messages.css';
        await loadViewCss(cssPath);

        appRoot.innerHTML = await fetchTemplate('/templates/home.html');
        document.title = 'Inicio';
        
        const messagesContainer = document.getElementById('messages-container');
        const loadMoreBtn = document.getElementById('load-more-btn');
        const feedLoader = document.getElementById('feed-loader');
        let currentPage = 1;
        let totalPages = 1;

        let currentUser = null;
        try {
            const profileResponse = await fetch('/api/profile');
            if (profileResponse.ok) {
                currentUser = await profileResponse.json();
            }
        } catch (error) {
            console.warn('No se pudo obtener el perfil del usuario (puede que no esté logueado).');
        }

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
                    const messageCard = createMessageCard(message, currentUser);
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
                messagesContainer.innerHTML = `<p class="error-text">No se pudieron cargar los mensajes. Inténtalo de nuevo más tarde.</p>`;
            } finally {
                feedLoader.classList.add('hidden');
            }
        };

        loadMoreBtn.addEventListener('click', loadMessages);
        await loadMessages();
        startLikePolling(messagesContainer);

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
        
        const checkAuthAndShowModal = async () => {
            const isAuthenticated = await checkAuth();
            if (isAuthenticated) {
                showModal();
            }
        };
        
        openModalBtn.addEventListener('click', checkAuthAndShowModal);

        closeModalBtn.addEventListener('click', hideModal);
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) hideModal();
        });

        messageForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            modalError.classList.add('hidden');
            const formData = new FormData(messageForm);
            const data = Object.fromEntries(formData.entries());
            
            const url = '/api/messages';

            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                const responseData = await response.json();
                if (!response.ok) {
                    throw new Error(responseData.message || 'Error desconocido al publicar.');
                }
                hideModal();
                currentPage = 1;
                totalPages = 1;
                messagesContainer.innerHTML = '';
                await loadMessages();
            } catch (error) {
                modalError.textContent = error.message;
                modalError.classList.remove('hidden');
            }
        });

        messagesContainer.addEventListener('click', async (event) => {
            const likeButton = event.target.closest('.like-button');
            const replyButton = event.target.closest('.reply-message-btn');
            const deleteButton = event.target.closest('.delete-message-btn');

            if (replyButton) {
                const isAuthenticated = await checkAuth();
                if (isAuthenticated) {
                    const card = replyButton.closest('.message-card');
                    const messageId = card.getAttribute('data-message-id');
                    showReplyModal(messageId);
                }
                return;
            }
            
            if (likeButton) {
                const isAuthenticated = await checkAuth();
                if (isAuthenticated) {
                    const card = likeButton.closest('.message-card');
                    const messageId = card.getAttribute('data-message-id');
                    try {
                        const response = await fetch(`/api/messages/${messageId}/like`, { method: 'POST' });
                        if (!response.ok) throw new Error('Error del servidor al procesar el like.');
                        
                        const data = await response.json();
                        const likeCountSpan = card.querySelector('.like-count');
                        if (likeCountSpan) likeCountSpan.textContent = data.likeCount;
                        likeButton.classList.toggle('liked', data.isLiked);
                    } catch (error) {
                        console.error(error.message);
                    }
                }
                return;
            }

            if (deleteButton) {
                const card = deleteButton.closest('.message-card');
                const messageId = card.getAttribute('data-message-id');
                showDeleteConfirmationModal(messageId, card);
                return;
            }
            
            const card = event.target.closest('.message-card');
            if (!card) return;

            const isInteractiveClick = event.target.closest('a, button, .like-button, .reply-message-btn, .delete-message-btn');
            if (!isInteractiveClick) {
                const messageId = card.getAttribute('data-message-id');
                const detailUrl = `/messages/${messageId}`;
                window.history.pushState({}, '', detailUrl);
                await renderPage(detailUrl);
            }
        });

        templatePath = '';

    } else if (pathname.startsWith('/messages/')) {
        cssPath = '/css/messages.css';
        await loadViewCss(cssPath);

        try {
            const messageId = pathname.split('/')[2];
            if (!messageId) throw new Error('ID de mensaje no válido.');
            
            appRoot.innerHTML = await fetchTemplate('/templates/message-detail.html');
            
            const mainMessageContainer = document.getElementById('main-message-container');
            const repliesContainer = document.getElementById('replies-container');
            const repliesHeader = document.getElementById('replies-header');

            const [messageResponse, repliesResponse] = await Promise.all([
                fetch(`/api/messages/${messageId}`),
                fetch(`/api/messages/${messageId}/replies?page=1`)
            ]);

            if (!messageResponse.ok) {
                const errorData = await messageResponse.json();
                throw new Error(errorData.message || 'Mensaje no encontrado o ha sido eliminado.');
            }

            const messageData = await messageResponse.json();
            const repliesData = repliesResponse.ok ? await repliesResponse.json() : { docs: [], totalPages: 0 };
            
            let currentUser = null;
            try {
                const profileResponse = await fetch('/api/profile');
                if (profileResponse.ok) currentUser = await profileResponse.json();
            } catch (error) { /* Usuario no logueado, se ignora */ }

            document.title = messageData.title;

            const mainCard = createMessageCard(messageData, currentUser);
            mainMessageContainer.appendChild(mainCard);
            
            let currentReplyPage = 1;
            let totalReplyPages = repliesData.totalPages;
            
            const loadMoreReplies = async () => {
                const loadMoreBtn = document.getElementById('load-more-replies-btn');
                const repliesLoader = document.getElementById('replies-loader');
                
                if (loadMoreBtn) loadMoreBtn.classList.add('hidden');
                if (repliesLoader) repliesLoader.classList.remove('hidden');

                try {
                    const res = await fetch(`/api/messages/${messageId}/replies?page=${currentReplyPage}`);
                    const data = await res.json();
                    
                    data.docs.forEach(reply => {
                        const replyCard = createMessageCard(reply, currentUser);
                        const replyWrapper = document.createElement('div');
                        replyWrapper.className = 'reply-wrapper';
                        replyWrapper.appendChild(replyCard);
                        
                        const lineBreak = document.createElement('br');
                        
                        const loadMoreContainer = document.querySelector('.load-more-container');
                        if (loadMoreContainer) {
                            repliesContainer.insertBefore(replyWrapper, loadMoreContainer);
                            repliesContainer.insertBefore(lineBreak, loadMoreContainer);
                        } else {
                            repliesContainer.appendChild(replyWrapper);
                            repliesContainer.appendChild(lineBreak);
                        }
                    });

                    if (currentReplyPage >= totalReplyPages) {
                        document.querySelector('.load-more-container')?.remove();
                    } else {
                        if (loadMoreBtn) loadMoreBtn.classList.remove('hidden');
                    }
                } catch (error) {
                    console.error("Error al cargar más respuestas:", error);
                } finally {
                    if (repliesLoader) repliesLoader.classList.add('hidden');
                }
            };
            
            if (repliesData.docs.length > 0) {
                repliesHeader.classList.remove('hidden');
                repliesData.docs.forEach(reply => {
                    const replyCard = createMessageCard(reply, currentUser);
                    const replyWrapper = document.createElement('div');
                    replyWrapper.className = 'reply-wrapper';
                    replyWrapper.appendChild(replyCard);
                    repliesContainer.appendChild(replyWrapper);
                    
                    const lineBreak = document.createElement('br');
                    repliesContainer.appendChild(lineBreak);
                });
            }
            
            if (totalReplyPages > 1) {
                const loadMoreContainer = document.createElement('div');
                loadMoreContainer.className = 'load-more-container';

                const repliesLoader = document.createElement('div');
                repliesLoader.id = 'replies-loader';
                repliesLoader.className = 'loader hidden';
                loadMoreContainer.appendChild(repliesLoader);

                const loadMoreBtn = document.createElement('button');
                loadMoreBtn.id = 'load-more-replies-btn';
                loadMoreBtn.className = 'button-primary';
                loadMoreBtn.textContent = 'Cargar más';
                loadMoreBtn.addEventListener('click', () => {
                    currentReplyPage++;
                    loadMoreReplies();
                });
                loadMoreContainer.appendChild(loadMoreBtn);
                repliesContainer.appendChild(loadMoreContainer);
            }

            const detailViewContainer = document.getElementById('message-detail-view');
            if (detailViewContainer) {
                detailViewContainer.addEventListener('click', async (event) => {
                     const likeButton = event.target.closest('.like-button');
                     const replyButton = event.target.closest('.reply-message-btn');
                     const deleteButton = event.target.closest('.delete-message-btn');
            
                     if (likeButton) {
                         const isAuthenticated = await checkAuth();
                         if (isAuthenticated) {
                             const card = likeButton.closest('.message-card');
                             const msgId = card.getAttribute('data-message-id');
                             try {
                                 const response = await fetch(`/api/messages/${msgId}/like`, { method: 'POST' });
                                 if (!response.ok) throw new Error('Error del servidor al procesar el like.');
                                 
                                 const data = await response.json();
                                 const likeCountSpan = card.querySelector('.like-count');
                                 if (likeCountSpan) likeCountSpan.textContent = data.likeCount;
                                 likeButton.classList.toggle('liked', data.isLiked);
                             } catch (error) {
                                 console.error(error.message);
                             }
                         }
                         return;
                     }

                     if (deleteButton) {
                         const card = deleteButton.closest('.message-card');
                         const msgId = card.getAttribute('data-message-id');
                         showDeleteConfirmationModal(msgId, card);
                         return;
                     }

                     if (replyButton) {
                        const isAuthenticated = await checkAuth();
                        if (isAuthenticated) {
                            const card = replyButton.closest('.message-card');
                            const parentId = card.getAttribute('data-message-id');
                            showReplyModal(parentId);
                        }
                        return;
                     }
                     
                    const card = event.target.closest('.message-card');
                    if (!card) return;

                    const isInteractiveClick = event.target.closest('a, button, .like-button, .reply-message-btn, .delete-message-btn');
                    if (!isInteractiveClick) {
                        const messageIdToNav = card.getAttribute('data-message-id');
                        const currentMessageId = pathname.split('/')[2];
                        
                        if (messageIdToNav !== currentMessageId) {
                            const detailUrl = `/messages/${messageIdToNav}`;
                            window.history.pushState({}, '', detailUrl);
                            await renderPage(detailUrl);
                        }
                    }
                });
            }

        } catch (error) {
            console.error('Error al renderizar el detalle del mensaje:', error);
            cssPath = '/css/error.css';
            await loadViewCss(cssPath);
            appRoot.innerHTML = await fetchTemplate('/templates/error-404.html');
            const errorElement = document.getElementById('error-message-content');
            if(errorElement) errorElement.textContent = error.message;
            document.title = 'ERROR 404';
        }
        templatePath = '';

    } else if (pathname === '/about' || pathname === '/about-AgoraDig' || pathname === '/about-us') {
        templatePath = '/templates/about.html';
        document.title = 'Acerca de';
        await loadViewCss(null);
    } else if (pathname === '/contact' || pathname === '/contact-us') {
        templatePath = '/templates/contact.html';
        document.title = 'Contacto';
        await loadViewCss(null);
    } else if (pathname === '/register') {
        templatePath = '/templates/register.html';
        document.title = 'Crear Cuenta';
        cssPath = '/css/forms.css';
        await loadViewCss(cssPath);
    } else if (pathname === '/register-success') {
        templatePath = '/templates/register-success.html';
        document.title = 'Registro Exitoso';
        await loadViewCss(null);
    } else if (pathname === '/login') {
        templatePath = '/templates/login.html';
        document.title = 'Iniciar Sesión';
        cssPath = '/css/forms.css';
        await loadViewCss(cssPath);
    
    } else if (path.startsWith('/view-profile')) {
        cssPath = '/css/profile.css';
        await loadViewCss(cssPath);
        try {
            const params = new URLSearchParams(window.location.search);
            const username = params.get('username');
            if (!username) throw new Error('Nombre de usuario no especificado en la URL.');

            let viewerRole = null;
            try {
                const selfProfileResponse = await fetch('/api/profile');
                if (selfProfileResponse.ok) {
                    const viewerData = await selfProfileResponse.json();
                    viewerRole = viewerData.role;
                }
            } catch (e) { /* El usuario no está logueado, se ignora. */ }

            let apiUrl = `/api/users/username/${encodeURIComponent(username)}`;
            if (viewerRole === 'admin' || viewerRole === 'moderator') {
                apiUrl += '?include_moderation=true';
            }

            const userResponse = await fetch(apiUrl);
            if (!userResponse.ok) {
                const errorData = await userResponse.json();
                if (userResponse.status === 410) {
                    await loadViewCss('/css/error.css');
                    appRoot.innerHTML = await fetchTemplate('/templates/error-410.html');
                    document.title = 'ERROR 410';
                    templatePath = '';
                    loaderContainer.classList.add('hidden');
                    appRoot.classList.remove('hidden');
                    return;
                }
                throw new Error(errorData.message || 'No se pudieron cargar los datos del perfil.');
            }
            
            const userData = await userResponse.json();
            let profileHtml = await fetchTemplate('/templates/view-profile.html');
            const joinDate = new Date(userData.createdAt).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
            
            profileHtml = profileHtml.replace(/{{createdAt}}/g, joinDate);
            
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
            templatePath = '';

        } catch (error) {
            console.error('Error al renderizar el perfil de usuario:', error);
            await loadViewCss('/css/error.css');
            appRoot.innerHTML = await fetchTemplate('/templates/error-404.html');
            document.title = 'ERROR 404';
        }
    
    } else if (path.startsWith('/profile')) {
        cssPath = '/css/profile.css';
        await loadViewCss(cssPath);
        try {
            const response = await fetch('/api/profile');
            if (!response.ok) {
                if (response.status === 401) {
                    window.history.pushState({}, '', '/login');
                    await renderPage('/login');
                    return; 
                }
                throw new Error('Error al obtener los datos del perfil.');
            }
    
            const userData = await response.json();
            let profileHtml = await fetchTemplate('/templates/profile.html');
            const joinDate = new Date(userData.createdAt).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
            
            profileHtml = profileHtml.replace('{{createdAt}}', joinDate);
            appRoot.innerHTML = profileHtml;
            
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
            templatePath = '';
            await loadAndExecuteScript('/templates/profile.html');
    
        } catch (error) {
            console.error(error);
            await loadViewCss('/css/error.css');
            appRoot.innerHTML = await fetchTemplate('/templates/error-404.html');
            document.title = 'ERROR 404';
        }

    } else if (pathname === '/terms-and-conditions') {
        templatePath = '/templates/terms-and-conditions.html';
        document.title = 'Términos y Condiciones';
        await loadViewCss(null);
    } else if (pathname === '/privacy-policy') {
        templatePath = '/templates/privacy-policy.html';
        document.title = 'Política de Privacidad';
        await loadViewCss(null);

    } else {
        templatePath = '/templates/error-404.html';
        document.title = 'ERROR 404';
        cssPath = '/css/error.css';
        await loadViewCss(cssPath);
    }

    if (templatePath) {
        appRoot.innerHTML = await fetchTemplate(templatePath);
    }
    
    if (pathname === '/register-success') {
        const pin = sessionStorage.getItem('registrationPin');
        const pinDisplayElement = document.getElementById('recovery-pin-display');
        if (pin && pinDisplayElement) {
            pinDisplayElement.textContent = pin;
            sessionStorage.removeItem('registrationPin');
        }
    }
    
    // Renderizado explícito de Turnstile para SPAs
    if (pathname === '/login' || pathname === '/register') {
        const widgetElement = appRoot.querySelector('.cf-turnstile');
        if (widgetElement && typeof turnstile !== 'undefined') {
            turnstile.render(widgetElement);
        }
    }

    if(templatePath) {
        await loadAndExecuteScript(templatePath);
    }

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
    if (!targetLink || !targetLink.hasAttribute('href') || targetLink.target || targetLink.href.includes('mailto:')) {
        return;
    }

    event.preventDefault();

    const targetUrl = new URL(targetLink.href);
    const newRelativePath = targetUrl.pathname + targetUrl.search;
    const currentRelativePath = window.location.pathname + window.location.search;
    const targetHash = targetUrl.hash;

    if (currentRelativePath !== newRelativePath) {
        window.history.pushState({}, '', newRelativePath);
        await renderPage(newRelativePath);
        if (targetHash) {
            setTimeout(() => scrollToElement(targetHash), 100);
        }
    } else if (targetHash) {
        scrollToElement(targetHash);
    }
}

// ===================================
//  INICIALIZACIÓN DE LA APLICACIÓN
// ===================================

document.addEventListener('click', handleNavClick);
window.addEventListener('popstate', () => { renderPage(window.location.pathname + window.location.search); });
document.addEventListener('DOMContentLoaded', () => { renderPage(window.location.pathname + window.location.search); });