function initLoginForm() {
    const loginForm = document.getElementById('loginForm');

    if (!loginForm) return;
    const errorDivs = loginForm.querySelectorAll('.error-message');
    const generalMessageDiv = document.getElementById('message');
    const submitButton = loginForm.querySelector('button[type="submit"]');
    
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        submitButton.disabled = true;
        errorDivs.forEach(div => div.textContent = '');
        generalMessageDiv.textContent = '';
        generalMessageDiv.className = '';

        const formData = new FormData(loginForm);
        const data = Object.fromEntries(formData.entries());

        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            const result = await response.json();

            if (response.ok) {
                generalMessageDiv.className = 'message-success';
                generalMessageDiv.textContent = result.message + ' ¡Bienvenido!';
                setTimeout(() => {
                    window.history.pushState({}, '', '/home');
                    window.dispatchEvent(new PopStateEvent('popstate'));
                }, 1500);
            }
            else {
                if (result.errors) {
                    for (const field in result.errors) {
                        const input = loginForm.querySelector(`[name="${field}"]`);
                        if (input) {
                            const errorDiv = input.closest('.input-group').querySelector('.error-message');
                            if (errorDiv) {
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