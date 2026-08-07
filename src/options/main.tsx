import { createRoot } from 'react-dom/client';
import '@styles/global.css';
import { App } from './App';
import { settingsService } from '@services/SettingsService';
import { themeController } from '@utils/theme';
import { eventBus } from '@utils/eventBus';

void settingsService.load().then((s) => {
  themeController.setTheme(s.theme);
});
eventBus.on('settings:changed', (partial) => {
  if (partial && 'theme' in partial && partial.theme !== undefined) {
    themeController.setTheme(partial.theme);
  }
});

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<App />);
}
