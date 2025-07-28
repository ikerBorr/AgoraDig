function initRegisterForm() {
    const registerForm = document.getElementById('registerForm');

    if (!registerForm) return;
    const errorDivs = registerForm.querySelectorAll('.error-message');
    const generalMessageDiv = document.getElementById('message');
    const submitButton = registerForm.querySelector('button[type="submit"]');

    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        submitButton.disabled = true;
        
        errorDivs.forEach(div => div.textContent = '');
        generalMessageDiv.textContent = '';
        generalMessageDiv.className = '';

        const formData = new FormData(registerForm);

        try {
            const response = await fetch('/register', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                sessionStorage.setItem('registrationPin', result.recoveryPIN);
                sessionStorage.setItem('registrationComplete', 'true');
                window.history.pushState({}, '', '/register-success');
                renderPage('/register-success');
            } 
            else {
                if (result.errors) {
                    // Si el servidor envía errores por campo
                    for (const field in result.errors) {
                        const input = registerForm.querySelector(`[name="${field}"]`);
                        if (input) {
                            const errorDiv = input.closest('.form-group, .input-group')?.querySelector('.error-message') || input.nextElementSibling;
                            if (errorDiv && errorDiv.classList.contains('error-message')) {
                                errorDiv.textContent = result.errors[field];
                            }
                        }
                    }
                }
                else if (result.message) {
                    generalMessageDiv.className = 'message-error';
                    generalMessageDiv.textContent = result.message;
                }
                submitButton.disabled = false;
            }
        }
        catch (error) {
            console.error('Error de fetch:', error);
            messageDiv.className = 'message-error';
            messageDiv.textContent = 'Error de conexión. Inténtalo de nuevo.';
            submitButton.disabled = false;
        }
    });
}