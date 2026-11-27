export const DEFAULT_PREFERENCES = Object.freeze({
  theme: 'system', accent: '#a78bfa', typography: 'system', density: 'comfortable', surface: 'standard',
  textScale: 100, radius: 16, contrast: false, reducedMotion: false, simplified: false
});

export const TYPOGRAPHIES = Object.freeze({
  system: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  humanist: '"Trebuchet MS", "Segoe UI", sans-serif',
  editorial: 'Georgia, "Times New Roman", serif',
  mono: '"SFMono-Regular", Consolas, "Liberation Mono", monospace'
});

export const ACCENT_PRESETS = Object.freeze([
  { name: 'Íris', color: '#a78bfa' }, { name: 'Menta', color: '#75dbc2' },
  { name: 'Azul', color: '#7eb8ff' }, { name: 'Coral', color: '#ff967f' },
  { name: 'Âmbar', color: '#f5c76a' }
]);

export function normalizePreferences(value = {}) {
  const merged = { ...DEFAULT_PREFERENCES, ...value };
  if (!['system', 'light', 'dark'].includes(merged.theme)) merged.theme = DEFAULT_PREFERENCES.theme;
  if (!Object.hasOwn(TYPOGRAPHIES, merged.typography)) merged.typography = 'system';
  if (!/^#[0-9a-fA-F]{6}$/.test(merged.accent)) merged.accent = DEFAULT_PREFERENCES.accent;
  if (!['comfortable', 'compact', 'spacious'].includes(merged.density)) merged.density = DEFAULT_PREFERENCES.density;
  if (!['standard', 'soft'].includes(merged.surface)) merged.surface = DEFAULT_PREFERENCES.surface;
  merged.textScale = Math.min(200, Math.max(90, Number(merged.textScale) || 100));
  merged.radius = Math.min(24, Math.max(8, Number(merged.radius) || 16));
  merged.contrast = Boolean(merged.contrast);
  merged.reducedMotion = Boolean(merged.reducedMotion);
  merged.simplified = Boolean(merged.simplified);
  return merged;
}

function colorChannels(hex) {
  const value = hex.slice(1);
  return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16));
}

export function applyPreferences(input, root = document.documentElement) {
  const preferences = normalizePreferences(input);
  const dark = preferences.theme === 'dark' || (preferences.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  const [red, green, blue] = colorChannels(preferences.accent);
  root.dataset.theme = dark ? 'dark' : 'light';
  root.dataset.density = preferences.density;
  root.dataset.surface = preferences.surface;
  root.dataset.contrast = preferences.contrast ? 'high' : 'normal';
  root.dataset.motion = preferences.reducedMotion ? 'reduced' : 'full';
  root.dataset.simplified = preferences.simplified ? 'true' : 'false';
  root.style.setProperty('--accent', preferences.accent);
  root.style.setProperty('--accent-rgb', `${red} ${green} ${blue}`);
  root.style.setProperty('--font-family', TYPOGRAPHIES[preferences.typography]);
  root.style.setProperty('--text-scale', `${preferences.textScale}%`);
  root.style.setProperty('--text-scale-factor', String(preferences.textScale / 100));
  root.style.setProperty('--radius', `${preferences.radius}px`);
}
