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
//  FUNCIONES DE AYUDA (HELPERS)
// ===================================

/**
 * Crea y devuelve el elemento HTML para una única tarjeta de mensaje.
 * @param {object} message - El objeto del mensaje con datos del sender populados.
 * @returns {HTMLElement} El elemento del DOM para la tarjeta del mensaje.
 */
function createMessageCard(message) {
    const card = document.createElement('div');
    card.className = 'message-card';

    // Utiliza textContent para prevenir inyección de HTML (XSS)
    const authorUsername = message.sender ? message.sender.username : 'Usuario Desconocido';
    const authorAvatar = message.sender ? message.sender.profilePicturePath : 'images/default-avatar.webp';

    // El virtual 'likeCount' que creamos en Mongoose está disponible aquí
    const likeCount = message.likeCount !== undefined ? message.likeCount : (message.likes ? message.likes.length : 0);

    card.innerHTML = `
        <div class="card-header">
            <div class="author-info">
                <img src="${authorAvatar}" alt="Avatar de ${authorUsername}" class="author-avatar">
                <span class="author-username">@${authorUsername}</span>
            </div>
            <div class="likes-info">
                <span>${likeCount}</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
            </div>
        </div>
        <div class="card-body">
            <h2 class="message-title">${message.title}</h2>
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
        if (templatePath.includes('register.html')) {
            // Llama a la función global para inicializar el formulario de registro.
            if (typeof initRegisterForm === 'function') initRegisterForm();
        } else if (templatePath.includes('login.html')) {
            // Llama a la función global para inicializar el formulario de login.
            if (typeof initLoginForm === 'function') initLoginForm();
        } else if (templatePath.includes('profile.html')) {
            // Llama a la función global para inicializar la página de perfil.
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
    // Muestra el loader y oculta el contenido principal durante la carga.
    loaderContainer.classList.remove('hidden');
    appRoot.classList.add('hidden');

    let templatePath = '';
    
    // --- Lógica de Enrutamiento ---
    if (path === '/' || path === '/home') {
        appRoot.innerHTML = await fetchTemplate('./templates/home.html');
        document.title = 'Inicio';

        const messagesContainer = document.getElementById('messages-container');
        const loadMoreBtn = document.getElementById('load-more-btn');
        const feedLoader = document.getElementById('feed-loader');
        let currentPage = 1;
        let totalPages = 1;

        const loadMessages = async () => {
            if (currentPage > totalPages) return; // No hacer nada si ya se cargaron todas las páginas

            loadMoreBtn.classList.add('hidden');
            feedLoader.classList.remove('hidden');

            try {
                const response = await fetch(`/api/messages?page=${currentPage}`);
                if (!response.ok) throw new Error('Error al cargar los mensajes.');

                const data = await response.json();
                
                // Si es la primera página y no vienen mensajes, muestra un mensaje especial.
                if (currentPage === 1 && data.messages.length === 0) {
                    messagesContainer.innerHTML = `
                        <div class="empty-feed-message">
                            <br>
                            <p>Aún no hay mensajes publicados. ¡Sé el primero en compartir tus ideas!</p>
                            <br>
                        </div>
                    `;
                    feedLoader.classList.add('hidden'); // Ocultar el loader ya que no hay nada más que cargar.
                    return; // Detener la ejecución de la función aquí.
                }

                data.messages.forEach(message => {
                    const messageCard = createMessageCard(message);
                    messagesContainer.appendChild(messageCard);
                });

                totalPages = data.totalPages;
                currentPage++;

                // Mostrar el botón "Cargar más" solo si hay más páginas por cargar
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

        // Cargar la primera página de mensajes al entrar en Home
        await loadMessages();

        // Añadir el listener al botón "Cargar más"
        loadMoreBtn.addEventListener('click', loadMessages);

        templatePath = '';
    } else if (path === '/about' || path === '/about-AgoraDig' || path === '/about-us') {
        templatePath = './templates/about.html';
        document.title = 'Acerca';
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
    } else if (path.startsWith('/profile')) {
        // --- Lógica de renderizado para la vista de perfil (ruta dinámica y privada) ---
        try {
            // Se solicita al servidor los datos del perfil del usuario autenticado.
            const response = await fetch('/api/profile');
            if (!response.ok) {
                // Si el usuario no está autenticado (401), se le redirige a la página de login.
                if (response.status === 401) {
                    window.history.pushState({}, '', '/login');
                    await renderPage('/login');
                    return; // Detiene la ejecución para evitar más renderizados.
                }
                throw new Error('Error al obtener los datos del perfil.');
            }

            const userData = await response.json();
            const profileHtml = await fetchTemplate('./templates/profile.html');
            
            // Inyecta el HTML de la plantilla en el contenedor principal antes de manipularlo.
            appRoot.innerHTML = profileHtml;

            // Formatea la fecha de creación del usuario para mostrarla en un formato legible.
            const joinDate = new Date(userData.createdAt).toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
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

            document.title = userData.username; // Actualiza el título de la página con el nombre de usuario.
            
            templatePath = ''; // Se limpia la ruta para que el renderizador principal no la procese de nuevo.
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
    
    // Procesa el clic solo si es un enlace de navegación interna (sin target="_blank").
    if (targetLink && !targetLink.target) {
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

// Listener para la navegación dentro de la SPA.
document.addEventListener('click', handleNavClick);
// Listener para los botones de "atrás" y "adelante" del navegador.
window.addEventListener('popstate', () => { renderPage(window.location.pathname); });
// Listener para la carga inicial de la página.
document.addEventListener('DOMContentLoaded', () => { renderPage(window.location.pathname); });