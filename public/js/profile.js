/**
 * @file profile.js
 * @description Gestiona la interactividad de la página de perfil, incluyendo edición, cierre de sesión y eliminación de la cuenta.
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
                const response = await fetch('/logout', { method: 'POST' });
                if (response.ok) {
                    window.location.href = '/';
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

        const openEditModal = () => {
            const currentUsername = document.querySelector('.profile-username').textContent.substring(1);
            const currentDescription = document.querySelector('.profile-description').textContent;
            editForm.querySelector('#username-edit').value = currentUsername;
            editForm.querySelector('#description-edit').value = currentDescription;
            editForm.querySelector('#profilePicture-edit').value = '';
            modalEditError.classList.add('hidden');
            modalEditError.textContent = '';
            editModal.classList.remove('hidden');
        };
        const closeEditModal = () => editModal.classList.add('hidden');

        editProfileButton.addEventListener('click', openEditModal);
        closeEditModalButton.addEventListener('click', closeEditModal);
        editModal.addEventListener('click', (event) => { if (event.target === editModal) closeEditModal(); });

        editForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const submitButton = editForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = 'Guardando...';
            const formData = new FormData(editForm);
            try {
                const response = await fetch('/api/profile', { method: 'PATCH', body: formData });
                const result = await response.json();
                if (response.ok) {
                    const user = result.user;
                    document.querySelector('.profile-username').textContent = `@${user.username}`;
                    document.querySelector('.profile-description').textContent = user.description;
                    document.title = user.username;
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

        const openDeleteModal = () => {
            modalDeleteError.classList.add('hidden');
            modalDeleteError.textContent = '';
            pinInput.value = ''; // Limpia el campo del PIN cada vez que se abre
            deleteModal.classList.remove('hidden');
        };
        const closeDeleteModal = () => deleteModal.classList.add('hidden');

        deleteAccountButton.addEventListener('click', openDeleteModal);
        cancelDeleteBtn.addEventListener('click', closeDeleteModal);
        deleteModal.addEventListener('click', (event) => { if (event.target === deleteModal) closeDeleteModal(); });

        confirmDeleteBtn.addEventListener('click', async () => {
            const recoveryPIN = pinInput.value.trim();
            if (!recoveryPIN) {
                modalDeleteError.textContent = 'Por favor, introduce tu PIN de recuperación.';
                modalDeleteError.classList.remove('hidden');
                return;
            }

            confirmDeleteBtn.disabled = true;
            confirmDeleteBtn.textContent = 'Eliminando...';
            modalDeleteError.classList.add('hidden');

            try {
                const response = await fetch('/api/profile', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ recoveryPIN: recoveryPIN })
                });

                if (response.ok) {
                    window.location.href = '/'; // Redirige a la página de inicio
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
        });
    }
}