export function formatDateTime(value?: string | null) {
  if (!value) {
    return 'Nunca';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatRelativeMinuteWindow(value?: string | null) {
  if (!value) {
    return 'sem sincronizacao';
  }

  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));

  if (diffMinutes < 1) {
    return 'agora';
  }

  if (diffMinutes === 1) {
    return 'ha 1 min';
  }

  return `ha ${diffMinutes} min`;
}

export function isoNow() {
  return new Date().toISOString();
}

export function getLocalTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function getLocalUtcOffsetMinutes(reference = new Date()) {
  return -reference.getTimezoneOffset();
}
