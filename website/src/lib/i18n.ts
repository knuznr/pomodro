import type { Lang } from './types';

export const STRINGS = {
  tr: {
    status_work: 'Çalışma zamanı',
    status_short: 'Kısa mola zamanı',
    status_long: 'Uzun mola zamanı',
    session_counter: 'Oturum {n}/4',
    start: 'Başlat',
    pause: 'Duraklat',
    reset: 'Sıfırla',
    task_question: 'Şimdi neye odaklanıyorsun?',
    task_placeholder: "Yeni görev yaz ve Enter'a bas",
    tasks_list: 'Tamamlanmamış görevler',
    add: 'Ekle',
    add_error: 'Önce bir görev başlığı yaz',
    focus_none: 'Odaklanılacak görev seçilmedi',
    focus_active: 'Odak: {title}',
    complete: 'Tamamla',
    delete: 'Sil',
    undo: 'Geri al',
    queue: 'Sıraya al',
    next: 'Sıradaki',
    undo_toast_title: 'Görev silindi',
    storage_load_error_title: 'Kayıt okunamadı; varsayılan ayarlar açıldı.',
    storage_save_warning: 'Ayarlar kaydedilemedi. Tarayıcı depolamasını kontrol et.',
    settings_title: 'Seans süreleri · dakika',
    settings_work: 'Çalışma',
    settings_short: 'Kısa mola',
    settings_long: 'Uzun mola',
    stats: 'Bugün tamamlanan: {n}',
    toast_work_title: 'Çalışma tamamlandı',
    toast_work_description: 'Biraz dinlenme zamanı.',
    toast_break_title: 'Mola bitti',
    toast_break_description: 'Yeni seansa hazırsın.',
  },
  en: {
    status_work: 'Focus time',
    status_short: 'Short break time',
    status_long: 'Long break time',
    session_counter: 'Session {n}/4',
    start: 'Start',
    pause: 'Pause',
    reset: 'Reset',
    task_question: 'What are you focusing on now?',
    task_placeholder: 'Type a new task and press Enter',
    tasks_list: 'Pending tasks',
    add: 'Add',
    add_error: 'Write a task title first',
    focus_none: 'No task selected for focus',
    focus_active: 'Focus: {title}',
    complete: 'Complete',
    delete: 'Delete',
    undo: 'Undo',
    queue: 'Queue',
    next: 'Next',
    undo_toast_title: 'Task deleted',
    storage_load_error_title: "Saved state couldn't be read; defaults loaded.",
    storage_save_warning: "Settings couldn't be saved. Check browser storage.",
    settings_title: 'Session durations · minutes',
    settings_work: 'Work',
    settings_short: 'Short break',
    settings_long: 'Long break',
    stats: 'Completed today: {n}',
    toast_work_title: 'Work session complete',
    toast_work_description: 'Time for a short rest.',
    toast_break_title: 'Break finished',
    toast_break_description: 'Ready for a new session.',
  },
} as const;

export type StringKey = keyof typeof STRINGS.tr;

export function detectLang(language = typeof navigator === 'undefined' ? 'en' : navigator.language): Lang {
  return language.toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

export function translate(
  lang: Lang,
  key: StringKey,
  vars?: Record<string, string | number>,
): string {
  let text: string = STRINGS[lang][key];
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}
