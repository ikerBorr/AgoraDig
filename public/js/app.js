/**
 * @file app.js
 * @description Orquestador principal de la Single Page Application (SPA).
 * Gestiona el enrutamiento del lado del cliente, la carga de plantillas HTML
 * y la ejecución de los scripts asociados a cada vista.
 */

// Elementos principales del DOM para la renderización de vistas.
const appRoot = document.getElementById('app-root');
const loaderContainer = document.getElementById('loader-container');

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
        templatePath = './templates/home.html';
        document.title = 'Inicio';
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