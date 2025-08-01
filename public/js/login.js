/**
 * @file login.js
 * @description Gestiona la lógica del formulario de inicio de sesión.
 * Incluye la captura de datos, el envío asíncrono al servidor y
 * la gestión de respuestas (éxito y errores).
 */

/**
 * Inicializa el formulario de inicio de sesión, añadiendo el listener para 'submit'.
 */
function initLoginForm() {
    const loginForm = document.getElementById('loginForm');

    // Si el formulario no existe en la página actual, no hace nada.
    if (!loginForm) return;

    // Obtención de elementos del DOM.
    const errorDivs = loginForm.querySelectorAll('.error-message');
    const generalMessageDiv = document.getElementById('message');
    const submitButton = loginForm.querySelector('button[type="submit"]');
    
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Previene el envío tradicional del formulario.

        // Deshabilita el botón y limpia mensajes previos.
        submitButton.disabled = true;
        errorDivs.forEach(div => div.textContent = '');
        if (generalMessageDiv) {
            generalMessageDiv.textContent = '';
            generalMessageDiv.className = '';
        }

        // Prepara los datos para ser enviados como JSON.
        const formData = new FormData(loginForm);
        const data = Object.fromEntries(formData.entries());

        try {
            // Envío de datos al endpoint de login.
            const response = await fetch('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            const result = await response.json();

            if (response.ok) {
                // En caso de éxito, muestra un mensaje y redirige al perfil tras una pausa.
                generalMessageDiv.className = 'message-success';
                generalMessageDiv.textContent = result.message + ' ¡Bienvenido!';
                setTimeout(() => {
                    window.history.pushState({}, '', '/profile');
                    // Despacha un evento 'popstate' para que el router de app.js se active.
                    window.dispatchEvent(new PopStateEvent('popstate'));
                }, 1500);
            } else {
                // Manejo de errores de validación.
                if (result.errors) {
                    for (const field in result.errors) {
                        const input = loginForm.querySelector(`[name="${field}"]`);
                        if (input) {
                            const errorDiv = input.closest('.input-group')?.querySelector('.error-message');
                            if (errorDiv) {
                                errorDiv.textContent = result.errors[field];
                            }
                        }
                    }
                } else if (result.message) {
                    // Muestra un mensaje de error general.
                    generalMessageDiv.className = 'message-error';
                    generalMessageDiv.textContent = result.message;
                }
                submitButton.disabled = false; // Rehabilita el botón si hubo un error.
            }
        } catch (error) {
            // Manejo de errores de red.
            console.error('Error de fetch:', error);
            if (generalMessageDiv) {
                generalMessageDiv.className = 'message-error';
                generalMessageDiv.textContent = 'Error de conexión. Inténtalo de nuevo.';
            }
            submitButton.disabled = false;
        }
    });
}