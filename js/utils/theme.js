export const applyTheme = (theme) => {
    const html = document.documentElement;
    const isDark = theme === 'dark';
    html.classList.toggle('dark', isDark);
    ['theme-icon-moon', 'theme-icon-moon-app'].forEach(id => document.getElementById(id)?.classList.toggle('hidden', isDark));
    ['theme-icon-sun', 'theme-icon-sun-app'].forEach(id => document.getElementById(id)?.classList.toggle('hidden', !isDark));
};

export const setupThemeToggle = (callback) => {
    const themeToggleHandler = () => {
        const newTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
        localStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
        if (callback) callback();
    };

    document.getElementById('theme-toggle').addEventListener('click', themeToggleHandler);
    document.getElementById('theme-toggle-app').addEventListener('click', themeToggleHandler);

    // Initial theme setup
    const theme = localStorage.getItem('theme') || 'dark';
    applyTheme(theme);
};