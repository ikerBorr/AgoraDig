/**
 * @file header.js
 * @description Gestiona la interactividad del menú de navegación,
 * especialmente el comportamiento del menú "sándwich" en vistas móviles.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Elementos del DOM para el menú de navegación.
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