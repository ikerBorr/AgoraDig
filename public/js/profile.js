/**
 * @file profile.js
 * @description Gestiona la interactividad de la página de perfil, incluyendo el cierre de sesión y la edición de datos mediante un modal.
 */

function initProfilePage() {
    // --- Lógica de Cierre de Sesión ---
    const logoutButton = document.getElementById('logout-button');
    const logoutMessage = document.getElementById('logout-message');

    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            try {
                logoutButton.disabled = true;
                if (logoutMessage) logoutMessage.textContent = 'Cerrando sesión...';
                const response = await fetch('/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
                if (response.ok) {
                    window.location.href = '/'; // Redirección más robusta que la manipulación del historial.
                } else {
                    const result = await response.json();
                    if (logoutMessage) logoutMessage.textContent = result.message || 'Error al cerrar sesión.';
                    logoutButton.disabled = false;
                }
            } catch (error) {
                console.error('Error al intentar cerrar sesión:', error);
                if (logoutMessage) logoutMessage.textContent = 'Error de conexión. Inténtalo de nuevo.';
                logoutButton.disabled = false;
            }
        });
    }

    // --- Lógica de Edición de Perfil con Modal ---
    const editProfileButton = document.getElementById('edit-profile-button');
    const modal = document.getElementById('edit-profile-modal');

    if (!editProfileButton || !modal) return;

    const closeModalButton = document.getElementById('close-edit-modal-btn');
    const editForm = document.getElementById('edit-profile-form');
    const modalError = document.getElementById('modal-edit-error');

    const openModal = () => {
        const currentUsername = document.querySelector('.profile-username').textContent.substring(1);
        const currentDescription = document.querySelector('.profile-description').textContent;
        editForm.querySelector('#username-edit').value = currentUsername;
        editForm.querySelector('#description-edit').value = currentDescription;

        // Limpia el input de archivo y los errores
        editForm.querySelector('#profilePicture-edit').value = '';
        modalError.classList.add('hidden');
        modalError.textContent = '';
        modal.classList.remove('hidden');
    };

    const closeModal = () => {
        modal.classList.add('hidden');
    };

    editProfileButton.addEventListener('click', openModal);
    closeModalButton.addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });

    // --- MANEJADOR DEL FORMULARIO DE EDICIÓN ---
    editForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        modalError.classList.add('hidden');
        modalError.textContent = '';

        const submitButton = editForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Guardando...';

        // Usar FormData para poder enviar archivos y texto juntos
        const formData = new FormData(editForm);

        try {
            // Se elimina la cabecera 'Content-Type'. El navegador la pondrá automáticamente
            // como 'multipart/form-data' cuando se usa FormData.
            const response = await fetch('/api/profile', {
                method: 'PATCH',
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                const updatedUser = result.user;
                // Actualizar la UI con los nuevos datos
                document.querySelector('.profile-username').textContent = `@${updatedUser.username}`;
                document.querySelector('.profile-description').textContent = updatedUser.description;
                document.title = updatedUser.username;

                // Actualizar la imagen de perfil, añadiendo un timestamp para evitar problemas de caché
                const newImagePath = `${updatedUser.profilePicturePath}?t=${new Date().getTime()}`;
                document.querySelector('.profile-picture').src = newImagePath;

                // Cerrar el modal tras el éxito
                closeModal();
            } else {
                // Mostrar el error dentro del modal
                modalError.textContent = result.message || 'Ocurrió un error.';
                if (result.errors) {
                    const errorValues = Object.values(result.errors).join(' ');
                    modalError.textContent = errorValues;
                }
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