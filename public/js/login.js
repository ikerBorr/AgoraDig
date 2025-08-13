/**
 * @file login.js
 * @description Gestiona la lógica del formulario de inicio de sesión, incluyendo la interacción del usuario,
 * la comunicación con el servidor y la actualización de la interfaz de usuario.
 */

/**
 * @function initLoginForm
 * @description Inicializa los manejadores de eventos y la funcionalidad del formulario de inicio de sesión.
 * Se ejecuta cuando la vista de login es renderizada.
 */
function initLoginForm() {
    const loginForm = document.getElementById('loginForm');
    // Si el formulario no existe en el DOM, la función termina para evitar errores.
    if (!loginForm) return;

    // Selección de elementos del DOM para manipular la UI.
    const errorDivs = loginForm.querySelectorAll('.error-message');
    const generalMessageDiv = document.getElementById('message');
    const submitButton = loginForm.querySelector('button[type="submit"]');

    const passwordInput = loginForm.querySelector('input[name="password"]');
    const toggleIcon = loginForm.querySelector('.password-toggle-icon');
    
    // SVG de los iconos para mostrar/ocultar contraseña.
    const eyeIconSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
        </svg>`;
    const eyeOffIconSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>`;

    // Configuración del botón para alternar la visibilidad de la contraseña.
    if (passwordInput && toggleIcon) {
        toggleIcon.innerHTML = eyeIconSvg; // Inicia con el icono de "ojo visible".
        toggleIcon.addEventListener('click', () => {
            // Cambia el tipo de input y el icono correspondiente.
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                toggleIcon.innerHTML = eyeOffIconSvg;
            } else {
                passwordInput.type = 'password';
                toggleIcon.innerHTML = eyeIconSvg;
            }
        });
    }

    // Manejador del evento de envío del formulario.
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Evita la recarga de la página.

        // Reinicia el estado de la UI antes de la petición.
        submitButton.disabled = true;
        errorDivs.forEach(div => div.textContent = '');
        if (generalMessageDiv) {
            generalMessageDiv.textContent = '';
            generalMessageDiv.className = '';
        }

        // Recolecta los datos del formulario.
        const formData = new FormData(loginForm);
        const data = Object.fromEntries(formData.entries());

        try {
            // Envía los datos de login al servidor.
            const response = await fetch('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            const result = await response.json();

            // Si la respuesta es exitosa (status 2xx).
            if (response.ok) {
                generalMessageDiv.className = 'message-success';
                generalMessageDiv.textContent = result.message + ' ¡Bienvenido!';
                // Redirige al perfil del usuario después de un breve instante.
                setTimeout(() => {
                    window.history.pushState({}, '', '/home');
                    window.dispatchEvent(new PopStateEvent('popstate'));
                }, 1500);
            } else {
                // Si la respuesta indica un error del cliente (status 4xx).
                if (result.errors) {
                    // Muestra errores específicos para cada campo.
                    for (const field in result.errors) {
                        const input = loginForm.querySelector(`[name="${field}"]`);
                        const errorDiv = input ? input.closest('.input-group')?.querySelector('.error-message') : generalMessageDiv;
                        if (errorDiv) {
                            errorDiv.textContent = result.errors[field];
                        }
                    }
                } else if (result.message) {
                    // Muestra un mensaje de error general.
                    generalMessageDiv.className = 'message-error';
                    generalMessageDiv.textContent = result.message;
                }
                submitButton.disabled = false; // Reactiva el botón para un nuevo intento.
            }
        } catch (error) {
            // Manejo de errores de red o de conexión.
            console.error('Error de fetch:', error);
            if (generalMessageDiv) {
                generalMessageDiv.className = 'message-error';
                generalMessageDiv.textContent = 'Error de conexión. Inténtalo de nuevo.';
            }
            submitButton.disabled = false;
        }
    });
}