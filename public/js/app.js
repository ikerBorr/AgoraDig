const appRoot = document.getElementById('app-root');

// Register and Login scripts
async function loadAndExecuteScript(templatePath) {
    const oldScript = document.getElementById('view-script');
    if (oldScript) {
        oldScript.remove();
    }

    let scriptSrc;
    let initFunction;
    
    if (templatePath.includes('register.html')) {
        scriptSrc = './js/register.js';
        initFunction = window.initRegisterForm;
    }
    else if (templatePath.includes('login.html')) {
        scriptSrc = './js/login.js';
        initFunction = window.initLoginForm;
    }

    if (!scriptSrc) return;

    const script = document.createElement('script');
    script.id = 'view-script';
    script.src = scriptSrc;
    
    script.onload = () => {
        if (templatePath.includes('register.html')) {
            initRegisterForm();
        }
        else if (templatePath.includes('login.html')) {
            initLoginForm();
        }
    };
    
    document.body.appendChild(script);
}

async function fetchTemplate(path) {
    try {
        const response = await fetch(path);
        if (!response.ok) {
            throw new Error(`No se encontró el template en la ruta: ${path}`);
        }
        return await response.text();
    }
    catch (error) {
        console.error('Error al cargar el template:', error);
        const response = await fetch('/templates/error-404.html');
        return await response.text();
    }
}

async function renderPage(path) {
    let templatePath = '';
    
    if (path === '/' || path === '/home') {
        templatePath = './templates/home.html';
        document.title = 'Inicio';
    }
    else if (path === '/about-us' || path === '/about') {
        templatePath = './templates/about-us.html';
        document.title = 'Sobre nosotros';
    }
    else if (path === '/contact') {
        templatePath = './templates/contact.html';
        document.title = 'Contacto';
    }
    else if (path === '/register') {
        templatePath = './templates/register.html';
        document.title = 'Crear Cuenta';
    }
    else if (path === '/register-success') {
        templatePath = './templates/register-success.html';
        document.title = 'Registro Exitoso';
    }
    else if (path === '/login') {
        templatePath = './templates/login.html';
        document.title = 'Iniciar Sesión';
    }
    else if (path === '/terms-and-conditions') {
        templatePath = './templates/terms-and-conditions.html';
        document.title = 'Términos y Condiciones';
    }
    else if (path === '/privacy-policy') {
        templatePath = './templates/privacy-policy.html';
        document.title = 'Política de Privacidad';
    }
    else {
        templatePath = './templates/error-404.html';
        document.title = 'ERROR 404';
    }

    appRoot.innerHTML = await fetchTemplate(templatePath);
    
    if (path === '/register-success') {
        const pin = sessionStorage.getItem('registrationPin');
        const pinDisplayElement = document.getElementById('recovery-pin-display');

        if (pin && pinDisplayElement) {
            pinDisplayElement.textContent = pin;

            sessionStorage.removeItem('registrationPin'); // Clear the session storage
        }
    }
    await loadAndExecuteScript(templatePath);
}

async function handleNavClick(event) {
    const targetLink = event.target.closest('a');
    
    if (targetLink) {
        event.preventDefault();
        const path = targetLink.getAttribute('href');
        
        if (window.location.pathname !== path) {
            window.history.pushState({}, '', path); 
            await renderPage(path);
        }
    }
}

document.addEventListener('click', handleNavClick);
window.addEventListener('popstate', () => { renderPage(window.location.pathname); });
document.addEventListener('DOMContentLoaded', () => { renderPage(window.location.pathname); });