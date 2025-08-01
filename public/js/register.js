/**
 * @file register.js
 * @description Gestiona la lógica del formulario de registro.
 * Incluye la captura de datos, el envío asíncrono al servidor y
 * la gestión de respuestas (éxito y errores).
 */

/**
 * Inicializa el formulario de registro, añadiendo el listener para el evento 'submit'.
 */
function initRegisterForm() {
    const registerForm = document.getElementById('registerForm');

    // Si el formulario no existe en la página actual, no hace nada.
    if (!registerForm) return;

    // Obtención de elementos del DOM para mostrar mensajes.
    const errorDivs = registerForm.querySelectorAll('.error-message');
    const generalMessageDiv = document.getElementById('message');
    const submitButton = registerForm.querySelector('button[type="submit"]');

    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Previene el envío tradicional del formulario.

        // Deshabilita el botón para evitar envíos múltiples.
        submitButton.disabled = true;
        
        // Limpia los mensajes de error previos.
        errorDivs.forEach(div => div.textContent = '');
        if (generalMessageDiv) {
            generalMessageDiv.textContent = '';
            generalMessageDiv.className = '';
        }

        const formData = new FormData(registerForm);

        try {
            // Envío de datos del formulario al endpoint de registro.
            const response = await fetch('/register', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                // En caso de éxito, guarda datos en sessionStorage y redirige.
                sessionStorage.setItem('registrationPin', result.recoveryPIN);
                sessionStorage.setItem('registrationComplete', 'true');
                window.history.pushState({}, '', '/register-success');
                // Llama a renderPage para mostrar la página de éxito sin recargar.
                // Esta llamada asume que `renderPage` está disponible globalmente.
                if (typeof renderPage === 'function') {
                    renderPage('/register-success');
                }
            } else {
                // Manejo de errores de validación devueltos por el servidor.
                if (result.errors) {
                    for (const field in result.errors) {
                        const input = registerForm.querySelector(`[name="${field}"]`);
                        if (input) {
                            // Busca el contenedor de error más cercano al campo.
                            const errorDiv = input.closest('.form-group, .input-group')?.querySelector('.error-message') || input.nextElementSibling;
                            if (errorDiv && errorDiv.classList.contains('error-message')) {
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
            // Manejo de errores de red o de la petición fetch.
            console.error('Error de fetch:', error);
            if(generalMessageDiv) {
                generalMessageDiv.className = 'message-error';
                generalMessageDiv.textContent = 'Error de conexión. Inténtalo de nuevo.';
            }
            submitButton.disabled = false;
        }
    });
}