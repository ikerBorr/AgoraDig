// Select de DOM
const themeToggleButton = document.getElementById('theme-toggle');
const bodyElement = document.body;

// Save the theme
const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
    bodyElement.classList.add(savedTheme);
}

// Listen the button to change the theme
themeToggleButton.addEventListener('click', () => {
    bodyElement.classList.toggle('night-mode');

    if (bodyElement.classList.contains('night-mode')) {
        localStorage.setItem('theme', 'night-mode');
    } 
    else {
        localStorage.removeItem('theme');
    }
});