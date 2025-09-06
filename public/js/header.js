/**
 * @file header.js
 * @description Gestiona la lógica del encabezado, incluyendo la visibilidad de enlaces
 * de navegación dinámicos basados en el rol del usuario y la interactividad del menú móvil.
 */

document.addEventListener('DOMContentLoaded', async () => {
    // Primero, gestiona la visibilidad de los enlaces dinámicos basados en el rol del usuario.
    try {
        const response = await fetch('/api/profile');
        // Si la respuesta no es OK (ej. 401 No Autorizado), el usuario no está logueado.
        // No se hace nada y los enlaces de admin/mod permanecerán ocultos.
        if (response.ok) {
            const user = await response.json();
            const ticketsLink = document.getElementById('nav-tickets-link');
            const reportsLink = document.getElementById('nav-reports-link');

            if (user && user.role) {
                // Si es admin, muestra ambos enlaces.
                if (user.role === 'admin') {
                    if (ticketsLink) ticketsLink.classList.remove('hidden');
                    if (reportsLink) reportsLink.classList.remove('hidden');
                } 
                // Si es moderador, muestra solo el enlace de reportes.
                else if (user.role === 'moderator') {
                    if (reportsLink) reportsLink.classList.remove('hidden');
                }
            }
        }
    } catch (error) {
        // En caso de un error de red, no se muestran los enlaces para mayor seguridad.
        console.error('Error al obtener el perfil para actualizar el header:', error);
    }

    // A continuación, se configura la interactividad del menú móvil.
    const menuToggle = document.getElementById('menu-toggle');
    const mainNav = document.getElementById('main-nav');

    // Asegura que los elementos existan antes de añadir listeners.
    if (menuToggle && mainNav) {
        /**
         * Alterna la visibilidad del menú de navegación al hacer clic en el botón.
         * Actualiza las clases y el atributo 'aria-label' para accesibilidad.
         */
        menuToggle.addEventListener('click', () => {
            mainNav.classList.toggle('is-active');
            menuToggle.classList.toggle('is-active');

            // Actualiza el 'aria-label' para reflejar el estado actual del menú (abierto/cerrado).
            if (mainNav.classList.contains('is-active')) {
                menuToggle.setAttribute('aria-label', 'Cerrar menú');
            } else {
                menuToggle.setAttribute('aria-label', 'Abrir menú');
            }
        });

        /**
         * Cierra el menú de navegación si se hace clic en uno de sus enlaces.
         * Esto mejora la experiencia de usuario en móviles en una SPA.
         * @param {MouseEvent} event - El objeto de evento de clic.
         */
        mainNav.addEventListener('click', (event) => {
            // Comprueba si el clic fue dentro de un enlace 'a'.
            if (event.target.closest('a')) {
                mainNav.classList.remove('is-active');
                menuToggle.classList.remove('is-active');
                menuToggle.setAttribute('aria-label', 'Abrir menú');
            }
        });
    }
});