import { SETTINGS_STORAGE_KEY } from '@/lib/settings';

const themeBootstrapScript = `
(() => {
  try {
    const raw = window.localStorage.getItem('${SETTINGS_STORAGE_KEY}');
    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw);
    const settings = parsed && typeof parsed === 'object' && 'settings' in parsed ? parsed.settings : parsed;
    const themePreference = settings?.appearance?.theme === 'light' || settings?.appearance?.theme === 'system'
      ? settings.appearance.theme
      : 'dark';
    const resolvedTheme = themePreference === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : themePreference;
    const language = settings?.language === 'hi' ? 'hi' : 'en';

    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.dataset.themePreference = themePreference;
    document.documentElement.lang = language;
    document.documentElement.style.colorScheme = resolvedTheme;
  } catch {
    // Ignore bootstrap parsing issues and let React hydrate the defaults.
  }
})();
`;

export default function SettingsThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />;
}
