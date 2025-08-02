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
 * Elimina el script anterior para evitar conflictos.
 * @param {string} templatePath - La ruta de la plantilla que se ha cargado.
 * @returns {Promise<void>}
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

    // Si no hay un script específico para esta ruta, no hace nada.
    if (!scriptSrc) return;

    // Crea y añade el nuevo script al DOM.
    const script = document.createElement('script');
    script.id = 'view-script'; // ID para poder encontrarlo y eliminarlo después.
    script.src = scriptSrc;
    
    // El script se ejecuta al cargarse, llamando a su función de inicialización.
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
 * Si no se encuentra, muestra una plantilla de error 404.
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
 * Renderiza una página en el contenedor #app-root basado en la ruta URL.
 * Gestiona la visibilidad del loader, obtiene la plantilla, actualiza el DOM y el título del documento.
 * @param {string} path - La ruta de la URL a renderizar (ej. '/', '/login').
 * @returns {Promise<void>}
 */
async function renderPage(path) {
    // Muestra el loader y oculta el contenido principal durante la carga.
    loaderContainer.classList.remove('hidden');
    appRoot.classList.add('hidden');

    let templatePath = '';
    
    // --- Lógica de Enrutamiento ---
    // Determina qué plantilla cargar según la ruta.
    // Sugerencia: Esto podría refactorizarse a un objeto de configuración de rutas para mayor escalabilidad.
    if (path === '/' || path === '/home') {
        templatePath = './templates/home.html';
        document.title = 'Inicio';
    } else if (path === '/about-me' || path === '/about') {
        templatePath = './templates/about.html';
        document.title = 'Sobre mí';
    } else if (path === '/contact') {
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
        // --- Ruta especial para el perfil de usuario ---
        // Esta ruta requiere una llamada a la API para obtener datos dinámicos.
        try {
            const response = await fetch('/api/profile');
            if (!response.ok) {
                // Si el usuario no está autenticado, redirige a la página de login.
                if (response.status === 401) {
                    window.history.pushState({}, '', '/login');
                    await renderPage('/login');
                    return;
                }
                throw new Error('Error al obtener los datos del perfil.');
            }

            const userData = await response.json();
            let profileHtml = await fetchTemplate('./templates/profile.html');

            // Formatea la fecha de creación del usuario.
            const joinDate = new Date(userData.createdAt).toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            // Reemplaza los placeholders en la plantilla con los datos del usuario.
            profileHtml = profileHtml
                .replace(/{{profilePicturePath}}/g, userData.profilePicturePath || '../images/default-avatar.png')
                .replace(/{{firstName}}/g, userData.firstName)
                .replace(/{{lastName}}/g, userData.lastName)
                .replace(/{{username}}/g, userData.username)
                .replace(/{{description}}/g, userData.description || 'Este usuario aún no ha añadido una descripción.')
                .replace(/{{createdAt}}/g, joinDate);

            document.title = `${userData.username}`;
            appRoot.innerHTML = profileHtml;
            await loadAndExecuteScript('../templates/profile.html');

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
        // Ruta por defecto si no coincide ninguna anterior.
        templatePath = './templates/error-404.html';
        document.title = 'ERROR 404';
    }

    // Si se encontró una plantilla estática, la renderiza.
    if (templatePath) {
        appRoot.innerHTML = await fetchTemplate(templatePath);
    }
    
    // Lógica específica post-renderizado para la página de registro exitoso.
    if (path === '/register-success') {
        const pin = sessionStorage.getItem('registrationPin');
        const pinDisplayElement = document.getElementById('recovery-pin-display');

        if (pin && pinDisplayElement) {
            pinDisplayElement.textContent = pin;
            // Limpia el PIN del sessionStorage por seguridad después de mostrarlo.
            sessionStorage.removeItem('registrationPin'); 
        }
    }

    // Carga el script asociado a la vista, si existe.
    await loadAndExecuteScript(templatePath);

    // Oculta el loader y muestra el contenido ya renderizado.
    loaderContainer.classList.add('hidden'); 
    appRoot.classList.remove('hidden');
}

/**
 * Manejador de eventos para los clics de navegación.
 * Intercepta los clics en enlaces, previene la recarga de la página y
 * utiliza la API de History para una navegación fluida.
 * @param {MouseEvent} event - El objeto de evento de clic.
 */
async function handleNavClick(event) {
    const targetLink = event.target.closest('a');
    
    // Actúa solo si se hizo clic en un enlace y no es un enlace externo.
    if (targetLink && !targetLink.target) {
        event.preventDefault(); // Previene la navegación tradicional.
        const path = targetLink.getAttribute('href');
        
        // Evita recargar la misma página.
        if (window.location.pathname !== path) {
            window.history.pushState({}, '', path); // Actualiza la URL en la barra de direcciones.
            await renderPage(path); // Renderiza la nueva página.
        }
    }
}

// --- Inicialización de Event Listeners ---
// Escucha clics en todo el documento para la navegación.
document.addEventListener('click', handleNavClick);
// Escucha los eventos de navegación del navegador (botones atrás/adelante).
window.addEventListener('popstate', () => { renderPage(window.location.pathname); });
// Renderiza la página inicial cuando el DOM está completamente cargado.
document.addEventListener('DOMContentLoaded', () => { renderPage(window.location.pathname); });