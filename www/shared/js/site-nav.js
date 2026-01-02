class SiteNav extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
        <nav>
            <header><h1>Lachlan's World</h1></header>
            <ul class="nav-links">
                <li><a href="/">[home]</a></li>
                <li><a href="/projects/">[projects]</a></li>
                <li><a href="/cyber/">[cyber]</a></li>
                <li><a href="/writing/">[writing]</a></li>
                <li><button id="theme-toggle" class="nav-button">[theme]</button></li>
            </ul>
        </nav>`;

        const btn = this.querySelector('#theme-toggle');

        // Helper to update button text
        const updateBtnText = (isDark) => {
            btn.textContent = isDark ? '[mode: dark]' : '[mode: light]';
        };

        btn.addEventListener('click', () => {
            document.body.classList.toggle('dark-theme');
            const isDark = document.body.classList.contains('dark-theme');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            updateBtnText(isDark);
        });

        // Set initial text on load
        updateBtnText(localStorage.getItem('theme') === 'dark');
    }
}
customElements.define('site-nav', SiteNav);