export function xmlText(text: string) {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function xmlResponse(document: string) {
  return new Response(`<?xml version="1.0" encoding="utf-8"?>\n${document}\n`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
