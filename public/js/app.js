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
 * @function waitForImages
 * @description Espera a que todas las imágenes dentro de un contenedor especificado se carguen por completo.
 * Esto es crucial para evitar mostrar contenido antes de que los recursos visuales estén listos.
 * @param {HTMLElement} container - El elemento del DOM que contiene las imágenes a esperar.
 * @param {string} [selector='img'] - El selector CSS para encontrar las imágenes específicas a precargar.
 * @returns {Promise<void>} Una promesa que se resuelve cuando todas las imágenes encontradas han terminado de cargar.
 */
async function waitForImages(container, selector = 'img') {
    const images = Array.from(container.querySelectorAll(selector));
    if (images.length === 0) {
        return Promise.resolve(); // No hay imágenes, resolver inmediatamente.
    }

    const promises = images.map(img => {
        return new Promise((resolve, reject) => {
            // Si la imagen ya está cargada (ej. desde la caché del navegador), resolver de inmediato.
            if (img.complete) {
                resolve();
            } else {
                img.onload = resolve;
                img.onerror = resolve; // Resolvemos también en error para no bloquear la carga de la página.
            }
        });
    });

    await Promise.all(promises);
}

/**
 * @function loadViewCss
 * @description Carga dinámicamente una o más hojas de estilos para una vista específica.
 * Elimina los CSS de la vista anterior para evitar conflictos de estilos.
 * @param {string[]} cssPaths - Un array con las rutas a los archivos CSS a cargar.
 */
async function loadViewCss(cssPaths) {
    document.querySelectorAll('.view-specific-css').forEach(link => link.remove());

    if (cssPaths && cssPaths.length > 0) {
        const promises = cssPaths.map(path => {
            return new Promise((resolve) => {
                const link = document.createElement('link');
                link.className = 'view-specific-css';
                link.rel = 'stylesheet';
                link.href = path;
                link.onload = () => resolve();
                document.head.appendChild(link);
            });
        });
        await Promise.all(promises);
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
    const author = message.sender || { username: 'Usuario Eliminado', profilePicturePath: '/images/user_img/default-avatar.webp', _id: null };
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
        <svg class="like-button ${likedClass}" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
    `;
    cardActions.appendChild(likesInfo);
    
    const replyInfo = document.createElement('div');
    replyInfo.className = 'reply-info';
    replyInfo.innerHTML = `
        <span class="reply-count">${replyCount}</span>
        <svg class="reply-message-btn" title="Responder" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <g transform="translate(24, 2) scale(-1, 1)"> <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path> </g> </svg>
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
        
        replyToInfo.appendChild(document.createTextNode('Respuesta a: '));
        if (message.referencedMessage.messageStatus === 'active' && message.referencedMessage.title) {
            const link = document.createElement('a');
            link.href = `/messages/${message.referencedMessage._id}`;
            link.textContent = message.referencedMessage.title; // Usar textContent es seguro
            replyToInfo.appendChild(link);
        } else {
            const span = document.createElement('span');
            span.className = 'deleted-message-reference';
            span.textContent = 'Mensaje_Eliminado';
            replyToInfo.appendChild(span);
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
    
    if (message.hashtags && message.hashtags.length > 0) {
        message.hashtags.forEach((tag, index) => {
            const hashtagLink = document.createElement('a');
            hashtagLink.href = "#"; // El manejador de eventos se encargará de la navegación.
            hashtagLink.className = 'hashtag-link';
            hashtagLink.textContent = `#${tag}`; // Usar .textContent es seguro contra XSS.
            hashtagsSmall.appendChild(hashtagLink);

            if (index < message.hashtags.length - 1) {
                hashtagsSmall.appendChild(document.createTextNode(' '));
            }
        });
    }
    cardFooter.appendChild(hashtagsSmall);
    
    const footerActions = document.createElement('div');
    footerActions.className = 'footer-actions';
    
    const canReport = currentUser && message.sender && currentUser._id !== message.sender._id;
    if (canReport) {
        const reportButton = document.createElement('button');
        if (message.isReported) {
            reportButton.className = 'report-message-btn button--icon';
            reportButton.title = 'Ya has reportado este mensaje';
            reportButton.disabled = true;
            reportButton.innerHTML = 'Reportado';
        } else {
            reportButton.className = 'report-message-btn button--icon';
            reportButton.title = 'Reportar mensaje';
            reportButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-flag"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`;
        }
        footerActions.appendChild(reportButton);
    }

    const canDelete = currentUser && (
        currentUser.role === 'admin' ||
        currentUser.role === 'moderator' ||
        (message.sender && currentUser._id === message.sender._id)
    );

    if (canDelete) {
        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-message-btn';
        deleteButton.title = 'Eliminar mensaje';
        deleteButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-trash-2"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m-6 5v6m4-6v6"/></svg>`;
        footerActions.appendChild(deleteButton);
    }
    
    if (footerActions.hasChildNodes()) {
        cardFooter.appendChild(footerActions);
    }

    card.appendChild(cardFooter);

    return card;
}

/**
 * @function createUserCard
 * @description Crea y devuelve un elemento del DOM que representa una tarjeta de perfil de usuario simplificada para los resultados de búsqueda.
 * @param {object} user - El objeto del usuario que contiene los datos a mostrar.
 * @returns {HTMLElement} El elemento del DOM `article` con la clase 'user-card-small', listo para ser insertado.
 */
function createUserCard(user) {
    const card = document.createElement('article');
    card.className = 'user-card-small center center-text';

    const userLink = document.createElement('a');
    userLink.href = `/view-profile?username=${user.username}`;
    userLink.className = 'user-card-small-link';

    const userAvatar = document.createElement('img');
    userAvatar.src = user.profilePicturePath;
    userAvatar.alt = `Avatar de ${user.username}`;
    userAvatar.className = 'user-card-small-avatar';

    const userUsername = document.createElement('p');
    userUsername.className = 'user-card-small-username';
    userUsername.textContent = `@${user.username}`;
    
    userLink.appendChild(userAvatar);
    userLink.appendChild(userUsername);
    
    card.appendChild(userLink);
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
 * @function showReportConfirmationModal
 * @description Muestra un modal de confirmación para reportar un mensaje.
 * @param {string} messageId - El ID del mensaje a reportar.
 * @param {HTMLElement} reportButtonElement - El elemento del botón de reporte para deshabilitarlo al éxito.
 */
function showReportConfirmationModal(messageId, reportButtonElement) {
    if (document.querySelector('.delete-confirmation-overlay')) return;

    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'delete-confirmation-overlay visible';

    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    
    modalContent.innerHTML = `
        <h2 style="text-align: center;">Confirmar Reporte</h2>
        <p>¿Estás seguro de que quieres reportar este mensaje para que sea revisado por un moderador?</p>
        <div class="modal-error-message error-text hidden" style="text-align: center; margin-bottom: 1rem; font-weight: bold;"></div>
        <div class="modal-actions">
            <button class="button-secondary cancel-report-btn">Cancelar</button>
            <button class="button-danger confirm-report-btn">Reportar</button>
        </div>
    `;

    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);

    const closeModal = () => {
        if (modalOverlay) modalOverlay.remove();
    };

    const confirmBtn = modalContent.querySelector('.confirm-report-btn');
    const cancelBtn = modalContent.querySelector('.cancel-report-btn');
    const modalError = modalContent.querySelector('.modal-error-message');

    confirmBtn.addEventListener('click', async () => {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Reportando...';
        try {
            const response = await fetch(`/api/messages/${messageId}/report`, { method: 'POST' });
            const result = await response.json();

            if (response.ok && result.isReported) {
                closeModal();
                reportButtonElement.disabled = true;
                reportButtonElement.classList.add('reported');
                reportButtonElement.innerHTML = 'Reportado';
            } else {
                throw new Error(result.message || 'Error al reportar el mensaje.');
            }
        } catch (error) {
            modalError.textContent = error.message;
            modalError.classList.remove('hidden');
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Reportar';
        }
    });

    cancelBtn.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
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

/**
 * @function showPasswordResetModal
 * @description Muestra un modal para que el usuario pueda restablecer su contraseña
 * utilizando su email y su PIN de recuperación.
 */
function showPasswordResetModal() {
    // Previene la creación de múltiples modales.
    if (document.querySelector('.delete-confirmation-overlay')) return;

    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'delete-confirmation-overlay visible';

    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';

    modalContent.innerHTML = `
        <div class="modal-header">
            <h2>Restablecer Contraseña</h2>
            <button class="close-button" title="Cerrar">&times;</button>
        </div>
        <div class="modal-body">
            <form id="password-reset-form" class="form" novalidate>
                <div class="input-group" style="margin-bottom: 1rem;">
                    <input type="email" name="email" placeholder="Email de la cuenta" required>
                </div>
                <div class="input-group" style="margin-bottom: 1rem;">
                    <input type="text" name="recoveryPIN" placeholder="PIN de Recuperación" required>
                    <small>En caso de no tener el PIN, ponte en contacto con nosotros.</small>
                </div>
                <div class="input-group password-wrapper" style="margin-bottom: 1rem;">
                    <input type="password" name="newPassword" placeholder="Nueva Contraseña" required>
                    <span class="password-toggle-icon" data-for="newPassword" title="Mostrar/Ocultar contraseña"></span>
                </div>
                <div class="input-group password-wrapper" style="margin-bottom: 1rem;">
                    <input type="password" name="confirmPassword" placeholder="Confirmar Nueva Contraseña" required>
                    <span class="password-toggle-icon" data-for="confirmPassword" title="Mostrar/Ocultar contraseña"></span>
                </div>
                <div id="reset-modal-message" class="message-info hidden" style="text-align: center; margin-top: 1rem;"></div>
                <div class="modal-actions">
                    <button type="button" class="button-secondary cancel-reset-btn">Cancelar</button>
                    <button type="submit" class="button-primary confirm-reset-btn">Restablecer</button>
                </div>
            </form>
        </div>
    `;

    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);

    const closeModal = () => {
        if (modalOverlay) modalOverlay.remove();
    };

    // --- Lógica para mostrar/ocultar contraseñas ---
    const eyeIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8"/><circle cx="12" cy="12" r="3"/></svg>`;
    const eyeOffIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9 9 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22"/></svg>`;
    
    modalContent.querySelectorAll('.password-toggle-icon').forEach(toggleIcon => {
        toggleIcon.innerHTML = eyeIconSvg;
        const inputName = toggleIcon.dataset.for;
        const passwordInput = modalContent.querySelector(`input[name="${inputName}"]`);
        if (passwordInput) {
            toggleIcon.addEventListener('click', () => {
                if (passwordInput.type === 'password') {
                    passwordInput.type = 'text';
                    toggleIcon.innerHTML = eyeOffIconSvg;
                } else {
                    passwordInput.type = 'password';
                    toggleIcon.innerHTML = eyeIconSvg;
                }
            });
        }
    });

    const form = modalContent.querySelector('#password-reset-form');
    const messageEl = modalContent.querySelector('#reset-modal-message');
    const confirmBtn = modalContent.querySelector('.confirm-reset-btn');
    const cancelBtn = modalContent.querySelector('.cancel-reset-btn');
    const closeButton = modalContent.querySelector('.close-button');

    // Asignar eventos de cierre
    cancelBtn.addEventListener('click', closeModal);
    closeButton.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        // Validación de cliente
        messageEl.className = 'message-info hidden error-text';
        if (!data.email || !data.recoveryPIN || !data.newPassword || !data.confirmPassword) {
            messageEl.textContent = 'Todos los campos son obligatorios.';
            messageEl.classList.remove('hidden');
            return;
        }
        if (data.newPassword.length < 6) {
            messageEl.textContent = 'La nueva contraseña debe tener al menos 6 caracteres.';
            messageEl.classList.remove('hidden');
            return;
        }
        if (data.newPassword !== data.confirmPassword) {
            messageEl.textContent = 'Las contraseñas no coinciden.';
            messageEl.classList.remove('hidden');
            return;
        }
        
        if (!window.confirm('¿Estás seguro de que quieres cambiar tu contraseña? Esta acción no se puede deshacer.')) {
            return;
        }
        
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Procesando...';
        
        try {
            const response = await fetch('/api/users/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.message || 'Error desconocido.');
            }
            
            messageEl.className = 'message-info success-text';
            messageEl.textContent = result.message;
            messageEl.classList.remove('hidden');
            form.reset();
            setTimeout(closeModal, 2500);

        } catch (error) {
            messageEl.textContent = error.message;
            messageEl.classList.remove('hidden');
        } finally {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Restablecer';
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
            if (response.status === 404) {
                 const error404Response = await fetch('/templates/error-404.html');
                 await loadViewCss(['/css/error.css']);
                 return await error404Response.text();
            }
            throw new Error(`Error al cargar la plantilla: ${response.statusText}`);
        }
        return await response.text();
    } catch (error) {
        console.error('Error crítico al cargar plantilla:', error);
        // Fallback a un HTML de error genérico si todo lo demás falla
        return `<section class="center center-text"><h1>Error</h1><p>No se pudo cargar el contenido. Por favor, intenta de nuevo.</p></section>`;
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
    const pathname = path.split('?')[0].split('#')[0];

    loaderContainer.classList.remove('hidden');
    appRoot.classList.add('hidden');

    if (window.pollInterval) {
        clearInterval(window.pollInterval);
        window.pollInterval = null;
    }

    let templatePath = '';
    let cssPaths = [];

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
        cssPaths = ['/css/messages.css', '/css/search.css'];
        await loadViewCss(cssPaths);

        appRoot.innerHTML = await fetchTemplate('/templates/home.html');
        document.title = 'Inicio | Búsqueda';
        
        const urlParams = new URLSearchParams(window.location.search);
        const initialQuery = urlParams.get('q');
        const searchInput = document.getElementById('search-input');
        if (initialQuery) {
            searchInput.value = initialQuery;
        }

        const messagesContainer = document.getElementById('messages-container');
        const loadMoreBtn = document.getElementById('load-more-btn');
        const feedLoader = document.getElementById('feed-loader');
        const searchForm = document.getElementById('search-form');
        const toggleFiltersBtn = document.getElementById('toggle-filters-btn');
        const filtersContainer = document.getElementById('search-filters-container');
        
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

        const executeSearch = async (isNewSearch = false) => {
            if (isNewSearch) {
                currentPage = 1;
                totalPages = 1;
                messagesContainer.innerHTML = '';
            }
            
            const currentSearchInput = document.getElementById('search-input');
            const resultsHeader = document.querySelector('#home-feed h2');

            if (resultsHeader) {
                if (currentSearchInput.value.trim() === '') {
                    resultsHeader.textContent = 'Últimas tendencias:';
                } else {
                    resultsHeader.textContent = 'Resultados:';
                }
            }

            if (currentPage > totalPages) {
                loadMoreBtn.classList.add('hidden');
                return;
            }

            loadMoreBtn.classList.add('hidden');
            feedLoader.classList.remove('hidden');

            const formData = new FormData(searchForm);
            const params = new URLSearchParams(formData);
            params.append('page', currentPage);
            
            if (isNewSearch) {
                const searchOnlyParams = new URLSearchParams(formData);
                const newUrl = `/home?${searchOnlyParams.toString()}`;
                window.history.pushState({ path: newUrl }, '', newUrl);
            }

            try {
                const response = await fetch(`/api/search?${params.toString()}`);
                if (!response.ok) throw new Error('Error al realizar la búsqueda.');
                
                const data = await response.json();

                if (currentPage === 1 && (!data.messages || data.messages.length === 0) && (!data.users || data.users.length === 0)) {
                    messagesContainer.innerHTML = `<div class="empty-feed-message"><br><p>No se encontraron resultados. Prueba con otros términos de búsqueda o ajusta los filtros.</p><br></div>`;
                    feedLoader.classList.add('hidden');
                    return;
                }
                
                if (data.searchType === 'user') {
                    // Renderizar perfiles de usuario solo en la primera página de una nueva búsqueda.
                    if (isNewSearch && data.users && data.users.length > 0) {
                        const usersHeader = document.createElement('h3');
                        usersHeader.textContent = 'Perfiles coincidentes:';
                        usersHeader.style.width = '100%';
                        messagesContainer.appendChild(usersHeader);
                        data.users.forEach(user => {
                            const userCard = createUserCard(user);
                            messagesContainer.appendChild(userCard);
                        });
                    }

                    // Renderizar mensajes del usuario.
                    if (data.messages && data.messages.length > 0) {
                        // El encabezado de mensajes solo se muestra una vez, en la primera página que contenga mensajes.
                        if (!messagesContainer.querySelector('.user-messages-header')) {
                            const messagesHeader = document.createElement('h3');
                            messagesHeader.className = 'user-messages-header';
                            messagesHeader.textContent = `Mensajes de @${data.messages[0].sender.username}`;
                            messagesHeader.style.width = '100%';
                            messagesContainer.appendChild(messagesHeader);
                        }
                        
                        data.messages.forEach(message => {
                            const messageCard = createMessageCard(message, currentUser);
                            messagesContainer.appendChild(messageCard);
                        });
                    }
                } else if (data.messages && data.messages.length > 0) {
                    // Renderizado estándar para búsquedas de mensajes/hashtags.
                    data.messages.forEach(message => {
                        const messageCard = createMessageCard(message, currentUser);
                        messagesContainer.appendChild(messageCard);
                    });
                }

                totalPages = data.totalPages;
                currentPage++;

                if (currentPage <= totalPages) {
                    loadMoreBtn.classList.remove('hidden');
                } else {
                    loadMoreBtn.classList.add('hidden');
                }

            } catch (error) {
                console.error(error);
                messagesContainer.innerHTML = `<p class="error-text">No se pudieron cargar los resultados. Inténtalo de nuevo más tarde.</p>`;
            } finally {
                feedLoader.classList.add('hidden');
            }
        };

        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            executeSearch(true);
        });
        
        toggleFiltersBtn.addEventListener('click', () => {
            filtersContainer.classList.toggle('hidden');
        });

        document.getElementById('sort-select').addEventListener('change', () => executeSearch(true));
        document.getElementById('date-range-select').addEventListener('change', () => executeSearch(true));

        loadMoreBtn.addEventListener('click', () => executeSearch(false));
        
        await executeSearch(true);

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
                await executeSearch(true);
            } catch (error) {
                modalError.textContent = error.message;
                modalError.classList.remove('hidden');
            }
        });

        messagesContainer.addEventListener('click', async (event) => {
            const hashtagLink = event.target.closest('.hashtag-link');
            if (hashtagLink) {
                event.preventDefault();
                const searchInput = document.getElementById('search-input');
                searchInput.value = hashtagLink.textContent;
                await executeSearch(true);
                return;
            }

            const userCard = event.target.closest('.user-card-small');
            if (userCard) return;

            const likeButton = event.target.closest('.like-button');
            const replyButton = event.target.closest('.reply-message-btn');
            const deleteButton = event.target.closest('.delete-message-btn');
            const reportButton = event.target.closest('.report-message-btn');

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
            
            if (reportButton) {
                 const isAuthenticated = await checkAuth();
                 if(isAuthenticated){
                    const card = reportButton.closest('.message-card');
                    const messageId = card.getAttribute('data-message-id');
                    showReportConfirmationModal(messageId, reportButton);
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

            const isInteractiveClick = event.target.closest('a, button, .like-button, .reply-message-btn, .delete-message-btn, .report-message-btn');
            if (!isInteractiveClick) {
                const messageId = card.getAttribute('data-message-id');
                const detailUrl = `/messages/${messageId}`;
                window.history.pushState({}, '', detailUrl);
                await renderPage(detailUrl);
            }
        });

        templatePath = '';
        await waitForImages(messagesContainer, '#author-avatar, .user-card-small-avatar');

    } else if (pathname.startsWith('/messages/')) {
        cssPaths = ['/css/messages.css'];
        await loadViewCss(cssPaths);

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
                     const hashtagLink = event.target.closest('.hashtag-link');
                     if (hashtagLink) {
                         event.preventDefault();
                         const hashtag = hashtagLink.textContent;
                         const searchUrl = `/home?q=${encodeURIComponent(hashtag)}`;
                         window.history.pushState({}, '', searchUrl);
                         await renderPage(searchUrl);
                         return;
                     }

                     const likeButton = event.target.closest('.like-button');
                     const replyButton = event.target.closest('.reply-message-btn');
                     const deleteButton = event.target.closest('.delete-message-btn');
                     const reportButton = event.target.closest('.report-message-btn');
            
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
                     
                    if (reportButton) {
                        const isAuthenticated = await checkAuth();
                        if (isAuthenticated) {
                            const card = reportButton.closest('.message-card');
                            const messageId = card.getAttribute('data-message-id');
                            showReportConfirmationModal(messageId, reportButton);
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

                    const isInteractiveClick = event.target.closest('a, button, .like-button, .reply-message-btn, .delete-message-btn, .report-message-btn');
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

            await waitForImages(appRoot, '#author-avatar');

        } catch (error) {
            console.error('Error al renderizar el detalle del mensaje:', error);
            cssPaths = ['/css/error.css'];
            await loadViewCss(cssPaths);
            appRoot.innerHTML = await fetchTemplate('/templates/error-404.html');
            const errorElement = document.getElementById('error-message-content');
            if(errorElement) errorElement.textContent = error.message;
            document.title = 'ERROR 404';
        }
        templatePath = '';

    } else if (pathname === '/about' || pathname === '/about-AgoraDig' || pathname === '/about-us') {
        templatePath = '/templates/about.html';
        document.title = 'Acerca de';
        await loadViewCss([]);
    } else if (pathname === '/contact' || pathname === '/contact-us') {
        templatePath = '/templates/contact.html';
        document.title = 'Contacto';
        cssPaths = ['/css/forms.css'];
        await loadViewCss(cssPaths);
    } else if (pathname === '/register') {
        templatePath = '/templates/register.html';
        document.title = 'Crear Cuenta';
        cssPaths = ['/css/forms.css'];
        await loadViewCss(cssPaths);
    } else if (pathname === '/register-success') {
        templatePath = '/templates/register-success.html';
        document.title = 'Registro Exitoso';
        await loadViewCss([]);
    } else if (pathname === '/login') {
        templatePath = '/templates/login.html';
        document.title = 'Iniciar Sesión';
        cssPaths = ['/css/forms.css'];
        await loadViewCss(cssPaths);
    
    } else if (path.startsWith('/view-profile')) {
        cssPaths = ['/css/profile.css'];
        await loadViewCss(cssPaths);
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
                    cssPaths = ['/css/error.css'];
                    await loadViewCss(cssPaths);
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
            
            // Reemplazo de datos seguros (no controlados por el usuario, como la fecha).
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

            // Se inserta el HTML estructural en el DOM.
            appRoot.innerHTML = profileHtml;

            const moderationInfoContainer = appRoot.querySelector('#moderation-info-display');
            if (moderationInfoContainer) moderationInfoContainer.innerHTML = moderationInfoHtml;

            const adminControlsContainer = appRoot.querySelector('#admin-controls-display');
            if (adminControlsContainer) adminControlsContainer.innerHTML = adminControlsHtml;

            document.title = `Perfil de ${userData.username}`;
            
            const profilePic = appRoot.querySelector('.profile-picture');
            if (profilePic) {
                profilePic.src = userData.profilePicturePath || '../images/user_img/default-avatar.webp';
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
            await waitForImages(appRoot, '.profile-picture');

        } catch (error) {
            console.error('Error al renderizar el perfil de usuario:', error);
            cssPaths = ['/css/error.css'];
            await loadViewCss(cssPaths);
            appRoot.innerHTML = await fetchTemplate('/templates/error-404.html');
            document.title = 'ERROR 404';
        }
    
    } else if (path.startsWith('/profile')) {
        cssPaths = ['/css/profile.css'];
        await loadViewCss(cssPaths);
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
                profilePicture.src = userData.profilePicturePath || '../images/user_img/default-avatar.webp';
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
            
            await waitForImages(appRoot, '.profile-picture');
            await loadAndExecuteScript('/templates/profile.html');
    
        } catch (error) {
            console.error(error);
            cssPaths = ['/css/error.css'];
            await loadViewCss(cssPaths);
            appRoot.innerHTML = await fetchTemplate('/templates/error-404.html');
            document.title = 'ERROR 404';
        }

    } else if (pathname === '/admin/tickets' || pathname === '/moderation/reports') {
        try {
            const profileResponse = await fetch('/api/profile');
            if (!profileResponse.ok) {
                // Si no está autenticado, directamente a la página de error 403.
                throw new Error('403');
            }
            const user = await profileResponse.json();
            const isAdmin = user.role === 'admin';
            const isModerator = user.role === 'moderator';
            
            let hasAccess = false;
            if (pathname === '/admin/tickets' && isAdmin) {
                hasAccess = true;
                templatePath = '/templates/admin-tickets.html';
                document.title = 'Panel de Tickets';
                cssPaths = ['/css/admin.css'];
            } else if (pathname === '/moderation/reports' && (isAdmin || isModerator)) {
                hasAccess = true;
                templatePath = '/templates/moderation-reports.html';
                document.title = 'Panel de Reportes';
                cssPaths = ['/css/admin.css', '/css/messages.css'];
            }
            
            if (!hasAccess) {
                throw new Error('403');
            }
            
            await loadViewCss(cssPaths);

        } catch (error) {
            templatePath = '/templates/error-403.html';
            document.title = '403 Acceso Denegado';
            cssPaths = ['/css/error.css'];
            await loadViewCss(cssPaths);
        }
    } else if (pathname === '/terms-and-conditions') {
        templatePath = '/templates/terms-and-conditions.html';
        document.title = 'Términos y Condiciones';
        await loadViewCss([]);
    } else if (pathname === '/privacy-policy') {
        templatePath = '/templates/privacy-policy.html';
        document.title = 'Política de Privacidad';
        await loadViewCss([]);

    } else {
        templatePath = '/templates/error-404.html';
        document.title = 'ERROR 404';
        cssPaths = ['/css/error.css'];
        await loadViewCss(cssPaths);
    }

    if (templatePath) {
        appRoot.innerHTML = await fetchTemplate(templatePath);
        if(cssPaths.length > 0) await loadViewCss(cssPaths);
    }
    
    // Lógica post-renderizado para las nuevas páginas
    if (pathname === '/contact') {
        const contactForm = document.getElementById('contact-form');
        const messageEl = document.getElementById('contact-form-message');
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(contactForm);
            const data = Object.fromEntries(formData.entries());
            messageEl.classList.add('hidden');

            try {
                const response = await fetch('/api/contact', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.message);

                messageEl.textContent = result.message;
                messageEl.className = 'message-info success-text';
                messageEl.classList.remove('hidden');
                contactForm.reset();
            } catch (error) {
                messageEl.textContent = error.message;
                messageEl.className = 'message-info error-text';
                messageEl.classList.remove('hidden');
            }
        });
    }

    if (pathname === '/admin/tickets') {
        const ticketsList = document.getElementById('tickets-list');
        const loader = document.getElementById('tickets-loader');
        const emptyMsg = document.getElementById('tickets-empty-message');
        const filter = document.getElementById('ticket-status-filter');

        const loadTickets = async () => {
            loader.classList.remove('hidden');
            ticketsList.innerHTML = '';
            emptyMsg.classList.add('hidden');
            try {
                const status = filter.value;
                const response = await fetch(`/api/admin/tickets?status=${status}`);
                if (response.status === 403) {
                     appRoot.innerHTML = await fetchTemplate('/templates/error-403.html');
                     return;
                }
                if (!response.ok) throw new Error('No se pudieron cargar los tickets.');

                const tickets = await response.json();

                if (tickets.length === 0) {
                    emptyMsg.classList.remove('hidden');
                } else {
                    tickets.forEach(ticket => {
                        const ticketEl = document.createElement('div');
                        ticketEl.className = 'ticket-card';
                        ticketEl.dataset.id = ticket._id;
                        ticketEl.innerHTML = `
                            <div class="ticket-header">
                                <h3>${ticket.subject}</h3>
                                <span class="ticket-status status-${ticket.status}">${ticket.status}</span>
                            </div>
                            <div class="ticket-meta">
                                <span>De: ${ticket.name} (${ticket.email})</span>
                                <span>Usuario: ${ticket.username}</span>
                                <span>Fecha: ${new Date(ticket.createdAt).toLocaleString()}</span>
                            </div>
                            <p class="ticket-message">${ticket.message}</p>
                            ${ticket.status === 'pendiente' ? '<button class="button-primary complete-ticket-btn">Marcar como Completado</button>' : ''}
                        `;
                        ticketsList.appendChild(ticketEl);
                    });
                }
            } catch (error) {
                ticketsList.innerHTML = `<p class="error-text">${error.message}</p>`;
            } finally {
                loader.classList.add('hidden');
            }
        };

        filter.addEventListener('change', loadTickets);
        ticketsList.addEventListener('click', async (e) => {
            if (e.target.classList.contains('complete-ticket-btn')) {
                const card = e.target.closest('.ticket-card');
                const ticketId = card.dataset.id;
                e.target.disabled = true;
                e.target.textContent = 'Procesando...';
                try {
                    const response = await fetch(`/api/admin/tickets/${ticketId}/status`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'completado' })
                    });
                    if (!response.ok) throw new Error('Error al actualizar el ticket.');
                    await loadTickets();
                } catch (error) {
                    alert(error.message);
                    e.target.disabled = false;
                    e.target.textContent = 'Marcar como Completado';
                }
            }
        });

        await loadTickets();
    }

    if (pathname === '/moderation/reports') {
        const reportsList = document.getElementById('reports-list-container');
        const loader = document.getElementById('reports-loader');
        const emptyMsg = document.getElementById('reports-empty-message');
        const filterContainer = document.getElementById('report-filters-container');
        const filter = document.getElementById('report-status-filter');
        let currentUser = null;

        try {
            const profileResponse = await fetch('/api/profile');
            if (!profileResponse.ok) {
                throw new Error('No autenticado o sin permisos.');
            }
            currentUser = await profileResponse.json();
            if (currentUser.role === 'admin') {
                filterContainer.classList.remove('hidden');
            }
        } catch (e) {
            reportsList.innerHTML = `<p class="error-text">No tienes permisos para ver esta página.</p>`;
            loader.classList.add('hidden');
            return;
        }

        const loadReports = async () => {
            loader.classList.remove('hidden');
            reportsList.innerHTML = '';
            emptyMsg.classList.add('hidden');
            try {
                const status = filter.value;
                const response = await fetch(`/api/moderation/reports?status=${status}`);
                if (response.status === 403) {
                     appRoot.innerHTML = await fetchTemplate('/templates/error-403.html');
                     return;
                }
                if (!response.ok) throw new Error('Error al cargar los reportes.');

                const messages = await response.json();
                if (messages.length === 0) {
                    emptyMsg.classList.remove('hidden');
                } else {
                    messages.forEach(msg => {
                        const messageCard = createMessageCard(msg, currentUser);
                        const reportInfo = document.createElement('div');
                        reportInfo.className = 'report-info';
                        reportInfo.innerHTML = `
                            <p><strong>Reportado por:</strong> ${msg.reportedBy.map(u => `@${u.username}`).join(', ')}</p>
                            ${msg.reportStatus === 'pendiente' ? '<button class="button-primary review-report-btn">Marcar como Revisado</button>' : '<p><strong>Estado:</strong> Revisado</p>'}
                        `;
                        messageCard.appendChild(reportInfo);
                        reportsList.appendChild(messageCard);
                    });
                }
            } catch (error) {
                reportsList.innerHTML = `<p class="error-text">${error.message}</p>`;
            } finally {
                loader.classList.add('hidden');
            }
        };

        filter.addEventListener('change', loadReports);
        reportsList.addEventListener('click', async (e) => {
            if (e.target.classList.contains('review-report-btn')) {
                const card = e.target.closest('.message-card');
                const messageId = card.dataset.messageId;
                e.target.disabled = true;
                try {
                    const response = await fetch(`/api/moderation/reports/${messageId}/review`, { method: 'PATCH' });
                    if (!response.ok) throw new Error('Fallo al actualizar el estado del reporte.');
                    await loadReports();
                } catch (error) {
                    alert(error.message);
                    e.target.disabled = false;
                }
            }
        });

        await loadReports();
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

    if (!appRoot.classList.contains('hidden')) {
        // Si el appRoot ya es visible, no hacer nada.
    } else {
        loaderContainer.classList.add('hidden'); 
        appRoot.classList.remove('hidden');
    }
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