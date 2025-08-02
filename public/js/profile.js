/**
 * @file profile.js
 * @description Gestiona la interactividad de la página de perfil, incluyendo el cierre de sesión.
 */

/**
 * Inicializa los listeners de eventos para la página de perfil.
 */
function initProfilePage() {
    const logoutButton = document.getElementById('logout-button');
    const logoutMessage = document.getElementById('logout-message');

    if (!logoutButton) return;

    logoutButton.addEventListener('click', async () => {
        try {
            logoutButton.disabled = true;
            if(logoutMessage) logoutMessage.textContent = 'Cerrando sesión...';

            const response = await fetch('/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const result = await response.json();

            if (response.ok) {
                // Redirigir al login tras un cierre de sesión exitoso.
                window.history.pushState({}, '', '/login'); 
                window.dispatchEvent(new PopStateEvent('popstate'));
            } else {
                // Si falla, mostrar un mensaje y reactivar el botón.
                if(logoutMessage) logoutMessage.textContent = result.message || 'Error al cerrar sesión.';
                logoutButton.disabled = false;
            }

        } catch (error) {
            console.error('Error al intentar cerrar sesión:', error);
            if(logoutMessage) logoutMessage.textContent = 'Error de conexión. Inténtalo de nuevo.';
            logoutButton.disabled = false;
        }
    });
}