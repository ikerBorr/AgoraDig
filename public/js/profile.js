/**
 * @file profile.js
 * @description Gestiona la interactividad de la página de perfil, incluyendo el cierre de sesión y la edición de datos mediante un modal.
 */

/**
 * Inicializa los listeners de eventos para la página de perfil.
 */
function initProfilePage() {
    // --- Lógica de Cierre de Sesión (sin cambios) ---
    const logoutButton = document.getElementById('logout-button');
    const logoutMessage = document.getElementById('logout-message');

    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            try {
                logoutButton.disabled = true;
                if(logoutMessage) logoutMessage.textContent = 'Cerrando sesión...';
                const response = await fetch('/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
                if (response.ok) {
                    window.history.pushState({}, '', '/login'); 
                    window.dispatchEvent(new PopStateEvent('popstate'));
                } else {
                    const result = await response.json();
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

    // --- Lógica de Edición de Perfil con Modal ---
    const editProfileButton = document.getElementById('edit-profile-button');
    const modal = document.getElementById('edit-profile-modal');
    
    // Salir si los elementos del modal no existen en la página
    if (!editProfileButton || !modal) return;

    const closeModalButton = document.getElementById('close-edit-modal-btn');
    const editForm = document.getElementById('edit-profile-form');
    const usernameInput = document.getElementById('username-edit');
    const descriptionInput = document.getElementById('description-edit');
    const modalError = document.getElementById('modal-edit-error');

    const openModal = () => {
        // Rellenar el formulario con los datos actuales antes de mostrarlo
        const currentUsername = document.querySelector('.profile-username').textContent.substring(1); // Quita el '@'
        const currentDescription = document.querySelector('.profile-description').textContent;
        usernameInput.value = currentUsername;
        descriptionInput.value = currentDescription;

        // Limpiar errores previos y mostrar modal
        modalError.classList.add('hidden');
        modalError.textContent = '';
        modal.classList.remove('hidden');
    };

    const closeModal = () => {
        modal.classList.add('hidden');
    };

    // Eventos para abrir y cerrar el modal
    editProfileButton.addEventListener('click', openModal);
    closeModalButton.addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => {
        // Si se hace clic en el overlay (fondo), se cierra el modal
        if (event.target === modal) {
            closeModal();
        }
    });

    // Evento para manejar el envío del formulario de edición
    editForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        modalError.classList.add('hidden');
        modalError.textContent = '';

        const submitButton = editForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Guardando...';

        try {
            const response = await fetch('/api/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: usernameInput.value,
                    description: descriptionInput.value
                })
            });

            const result = await response.json();

            if (response.ok) {
                // Actualizar la UI de la página principal con los nuevos datos
                document.querySelector('.profile-username').textContent = `@${result.user.username}`;
                document.querySelector('.profile-description').textContent = result.user.description;
                document.title = result.user.username; // Actualizar título de la página

                // Cerrar el modal tras el éxito
                closeModal();
            } else {
                // Mostrar el error dentro del modal
                modalError.textContent = result.errors ? (result.errors.username || result.errors.description) : result.message;
                modalError.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Error al guardar el perfil:', error);
            modalError.textContent = 'Error de conexión. Inténtalo de nuevo.';
            modalError.classList.remove('hidden');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Guardar Cambios';
        }
    });
}