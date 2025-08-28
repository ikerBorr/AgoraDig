/**
 * @file profile.js
 * @description Gestiona toda la interactividad de la página de perfil de usuario, incluyendo la edición de datos, el cierre de sesión y la eliminación de la cuenta.
 */

/**
 * @function initProfilePage
 * @description Función principal que inicializa todos los manejadores de eventos y la lógica para la página de perfil.
 * Se encarga de vincular los botones de la UI con las funciones de logout, edición y eliminación.
 * Esta función debe ser llamada una vez que el DOM de la página de perfil se ha cargado.
 */
function initProfilePage() {
    // --- Lógica de Cierre de Sesión ---
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            const logoutMessage = document.getElementById('logout-message');
            try {
                logoutButton.disabled = true;
                if (logoutMessage) logoutMessage.textContent = 'Cerrando sesión...';

                // Realiza la petición al servidor para destruir la sesión.
                const response = await fetch('/logout', { method: 'POST' });
                if (response.ok) {
                    window.location.href = '/'; // Redirige al inicio si el cierre de sesión es exitoso.
                } else {
                    const result = await response.json();
                    if (logoutMessage) logoutMessage.textContent = result.message || 'Error al cerrar sesión.';
                    logoutButton.disabled = false;
                }
            } catch (error) {
                console.error('Error al intentar cerrar sesión:', error);
                if (logoutMessage) logoutMessage.textContent = 'Error de conexión.';
                logoutButton.disabled = false;
            }
        });
    }

    // --- Lógica de Edición de Perfil ---
    const editProfileButton = document.getElementById('edit-profile-button');
    const editModal = document.getElementById('edit-profile-modal');
    if (editProfileButton && editModal) {
        const closeEditModalButton = document.getElementById('close-edit-modal-btn');
        const editForm = document.getElementById('edit-profile-form');
        const modalEditError = document.getElementById('modal-edit-error');

        /**
         * @function openEditModal
         * @description Abre el modal de edición y precarga los datos actuales del perfil en el formulario.
         */
        const openEditModal = () => {
            // Obtiene los datos actuales del perfil visibles en la página.
            const currentUsername = document.querySelector('.profile-username').textContent.substring(1);
            const currentDescription = document.querySelector('.profile-description').textContent;
            
            // Rellena el formulario con los datos actuales.
            editForm.querySelector('#username-edit').value = currentUsername;
            editForm.querySelector('#description-edit').value = currentDescription;
            editForm.querySelector('#profilePicture-edit').value = ''; // Limpia el input de archivo.
            
            // Resetea los mensajes de error y muestra el modal.
            modalEditError.classList.add('hidden');
            modalEditError.textContent = '';
            editModal.classList.remove('hidden');
        };

        /**
         * @function closeEditModal
         * @description Cierra el modal de edición de perfil.
         */
        const closeEditModal = () => editModal.classList.add('hidden');

        // Asignación de eventos a los botones y al modal.
        editProfileButton.addEventListener('click', openEditModal);
        closeEditModalButton.addEventListener('click', closeEditModal);
        editModal.addEventListener('click', (event) => { if (event.target === editModal) closeEditModal(); });

        // Manejador del envío del formulario de edición.
        editForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const submitButton = editForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = 'Guardando...';
            
            // FormData es necesario para enviar archivos (multipart/form-data).
            const formData = new FormData(editForm);
            try {
                // Envía la petición PATCH con los datos actualizados.
                const response = await fetch('/api/profile', { method: 'PATCH', body: formData });
                const result = await response.json();
                
                if (response.ok) {
                    // Si la actualización es exitosa, actualiza la UI con los nuevos datos.
                    const user = result.user;
                    document.querySelector('.profile-username').textContent = `@${user.username}`;
                    document.querySelector('.profile-description').textContent = user.description;
                    document.title = user.username;
                    // Se añade un timestamp a la imagen para evitar problemas de caché del navegador.
                    const newImagePath = `${user.profilePicturePath}?t=${new Date().getTime()}`;
                    document.querySelector('.profile-picture').src = newImagePath;
                    closeEditModal();
                } else {
                    modalEditError.textContent = result.message || Object.values(result.errors).join(' ');
                    modalEditError.classList.remove('hidden');
                }
            } catch (error) {
                modalEditError.textContent = 'Error de conexión.';
                modalEditError.classList.remove('hidden');
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'Guardar Cambios';
            }
        });
    }

    // --- Lógica de Eliminación de Cuenta ---
    const deleteAccountButton = document.getElementById('delete-account-button');
    const deleteModal = document.getElementById('delete-confirm-modal');
    if (deleteAccountButton && deleteModal) {
        const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
        const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
        const modalDeleteError = document.getElementById('modal-delete-error');
        const pinInput = document.getElementById('recovery-pin-input');

        /**
         * @function openDeleteModal
         * @description Abre el modal de confirmación para eliminar la cuenta.
         */
        const openDeleteModal = () => {
            modalDeleteError.classList.add('hidden');
            modalDeleteError.textContent = '';
            pinInput.value = ''; // Limpia el campo del PIN cada vez que se abre.
            deleteModal.classList.remove('hidden');
        };
        
        /**
         * @function closeDeleteModal
         * @description Cierra el modal de confirmación de eliminación.
         */
        const closeDeleteModal = () => deleteModal.classList.add('hidden');

        // Asignación de eventos a los botones y al modal.
        deleteAccountButton.addEventListener('click', openDeleteModal);
        cancelDeleteBtn.addEventListener('click', closeDeleteModal);
        deleteModal.addEventListener('click', (event) => { if (event.target === deleteModal) closeDeleteModal(); });

        // Manejador del evento de confirmación de eliminación.
        confirmDeleteBtn.addEventListener('click', async () => {
            const recoveryPIN = pinInput.value.trim();
            if (!recoveryPIN) {
                modalDeleteError.textContent = 'Por favor, introduce tu PIN de recuperación.';
                modalDeleteError.classList.remove('hidden');
                return;
            }

            // Añade una alerta de confirmación antes de proceder.
            if (window.confirm('¿Estás absolutamente seguro de que quieres eliminar tu cuenta? Esta acción es irreversible y todos tus datos serán anonimizados.')) {
                confirmDeleteBtn.disabled = true;
                confirmDeleteBtn.textContent = 'Eliminando...';
                modalDeleteError.classList.add('hidden');

                try {
                    // Envía la petición DELETE con el PIN de recuperación para autorización.
                    const response = await fetch('/api/profile', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ recoveryPIN: recoveryPIN })
                    });

                    if (response.ok) {
                        window.location.href = '/'; // Redirige a la página de inicio.
                    } else {
                        const result = await response.json();
                        modalDeleteError.textContent = result.message || 'No se pudo eliminar la cuenta.';
                        modalDeleteError.classList.remove('hidden');
                    }
                } catch (error) {
                    modalDeleteError.textContent = 'Error de conexión.';
                    modalDeleteError.classList.remove('hidden');
                } finally {
                    confirmDeleteBtn.disabled = false;
                    confirmDeleteBtn.textContent = 'Sí, eliminar mi cuenta';
                }
            }
        });
    }
}