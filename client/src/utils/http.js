// Safe response handling: the server returns JSON errors, but a proxy in front of it
// (or a crash) can return HTML. Never let that surface as "Unexpected token <".

const STATUS_MESSAGES = {
  400: 'The request was not valid. Check your details and try again.',
  401: 'Your session has expired or the details are wrong. Sign in again.',
  403: 'You do not have permission to do that.',
  413: 'The server rejected the upload as too large. Try a smaller photo.',
  429: 'Too many attempts. Wait a few minutes and try again.',
};

export function messageForStatus(status) {
  if (STATUS_MESSAGES[status]) return STATUS_MESSAGES[status];
  if (status >= 500) return 'The server had a problem. Try again in a moment.';
  return 'Something went wrong. Try again.';
}

// Message to show for a failed response: the server's own JSON error if present, else a status message.
export async function readError(res) {
  try {
    const data = await res.json();
    if (data && typeof data.error === 'string' && data.error) return data.error;
  } catch { /* body was not JSON */ }
  return messageForStatus(res.status);
}
