export function applyTheme(theme) {
    const isDark = theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    ['theme-icon-moon', 'theme-icon-moon-app'].forEach(id => document.getElementById(id)?.classList.toggle('hidden', isDark));
    ['theme-icon-sun', 'theme-icon-sun-app'].forEach(id => document.getElementById(id)?.classList.toggle('hidden', !isDark));
}

export function setupThemeToggle() {
    const themeToggleHandler = () => {
        const newTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
        localStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
    };
    document.getElementById('theme-toggle').addEventListener('click', themeToggleHandler);
    document.getElementById('theme-toggle-app').addEventListener('click', themeToggleHandler);
}