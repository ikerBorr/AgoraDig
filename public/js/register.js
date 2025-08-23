/**
 * @file register.js
 * @description Gestiona la lógica del formulario de registro, incluyendo la validación visual,
 * la subida de archivos y la comunicación con el endpoint de registro del servidor.
 */

/**
 * @function initRegisterForm
 * @description Inicializa todos los componentes interactivos del formulario de registro.
 * Se invoca cuando la vista de registro se carga en la aplicación.
 */
function initRegisterForm() {
    const registerForm = document.getElementById('registerForm');
    // Si el formulario no existe en el DOM, la función termina para evitar errores.
    if (!registerForm) return;

    // Selección de elementos clave de la interfaz.
    const errorDivs = registerForm.querySelectorAll('.error-message');
    const generalMessageDiv = document.getElementById('message');
    const submitButton = registerForm.querySelector('button[type="submit"]');

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

    // Itera sobre todos los iconos de visibilidad de contraseña en el formulario.
    registerForm.querySelectorAll('.password-toggle-icon').forEach(toggleIcon => {
        toggleIcon.innerHTML = eyeIconSvg; // Estado inicial del icono.
        const inputName = toggleIcon.dataset.for; // Obtiene el 'name' del input asociado desde el atributo data-for.
        const passwordInput = registerForm.querySelector(`input[name="${inputName}"]`);

        if (passwordInput) {
            toggleIcon.addEventListener('click', () => {
                // Alterna el tipo de input entre 'password' y 'text' y actualiza el icono.
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

    // Manejador del evento de envío del formulario.
    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Evita el comportamiento por defecto del formulario.

        // Resetea el estado de la UI antes de la nueva petición.
        submitButton.disabled = true;
        errorDivs.forEach(div => div.textContent = '');
        if (generalMessageDiv) {
            generalMessageDiv.textContent = '';
            generalMessageDiv.className = '';
        }

        // FormData es ideal para formularios que incluyen subida de archivos (multipart/form-data).
        const formData = new FormData(registerForm);

        try {
            // Envía los datos del formulario al endpoint de registro.
            const response = await fetch('/register', {
                method: 'POST',
                body: formData // No se necesita 'Content-Type' header, el navegador lo establece automáticamente con FormData.
            });

            const result = await response.json();

            // Si el registro fue exitoso (status 2xx).
            if (response.ok) {
                // Almacena el PIN y una bandera de éxito en sessionStorage para usarlos en la página de éxito.
                sessionStorage.setItem('registrationPin', result.recoveryPIN);
                sessionStorage.setItem('registrationComplete', 'true');
                // Navega a la página de éxito sin recargar.
                window.history.pushState({}, '', '/register-success');
                if (typeof renderPage === 'function') {
                    renderPage('/register-success');
                }
            } else {
                // Si la respuesta del servidor contiene errores de validación.
                if (result.errors) {
                    for (const field in result.errors) {
                        const input = registerForm.querySelector(`[name="${field}"]`);
                        if (input) {
                            // Busca el contenedor de error más cercano al campo y muestra el mensaje.
                            const errorDiv = input.closest('.form-group, .input-group')?.querySelector('.error-message');
                            if (errorDiv) errorDiv.textContent = result.errors[field];
                        } else if (field === 'general') {
                            // Muestra errores que no están asociados a un campo específico.
                            generalMessageDiv.className = 'message-error';
                            generalMessageDiv.textContent = result.errors.general;
                        }
                    }
                } else if (result.message) {
                    // Muestra un mensaje de error general si no hay errores por campo.
                    generalMessageDiv.className = 'message-error';
                    generalMessageDiv.textContent = result.message;
                }

                // Resetea el widget de Turnstile para obtener un nuevo token en el próximo intento.
                const turnstileWidget = registerForm.querySelector('.cf-turnstile');
                if (turnstileWidget && typeof turnstile !== 'undefined') {
                    turnstile.reset(turnstileWidget);
                }

                submitButton.disabled = false; // Habilita el botón para un nuevo intento.
            }
        } catch (error) {
            // Captura errores de red o conexión.
            console.error('Error de fetch:', error);
            if(generalMessageDiv) {
                generalMessageDiv.className = 'message-error';
                generalMessageDiv.textContent = 'Error de conexión. Inténtalo de nuevo.';
            }
            
            // Resetea el widget de Turnstile también en caso de error de red.
            const turnstileWidget = registerForm.querySelector('.cf-turnstile');
            if (turnstileWidget && typeof turnstile !== 'undefined') {
                turnstile.reset(turnstileWidget);
            }

            submitButton.disabled = false;
        }
    });
}