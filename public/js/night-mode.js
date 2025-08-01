/**
 * @file night-mode.js
 * @description Gestiona la funcionalidad de cambio de tema (modo día/noche).
 * Persiste la preferencia del usuario en localStorage.
 */

// Selección de elementos del DOM.
const themeToggleButton = document.getElementById('theme-toggle');
const bodyElement = document.body;

// Al cargar la página, comprueba si hay un tema guardado en localStorage.
const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
    // Aplica el tema guardado si existe.
    bodyElement.classList.add(savedTheme);
}

// Añade el listener al botón de cambio de tema.
themeToggleButton.addEventListener('click', () => {
    // Alterna la clase 'night-mode' en el body.
    bodyElement.classList.toggle('night-mode');

    // Guarda o elimina la preferencia del tema en localStorage.
    if (bodyElement.classList.contains('night-mode')) {
        localStorage.setItem('theme', 'night-mode');
    } else {
        localStorage.removeItem('theme');
    }
});