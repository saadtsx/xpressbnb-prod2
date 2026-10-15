import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendWhatsAppText } from './whatsapp-meta';

function env(values: Record<string, string> = {}) {
  vi.stubGlobal('Deno', { env: { get: (key: string) => values[key] } });
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe('WhatsApp provider outcomes', () => {
  it('fails closed without credentials instead of simulating success', async () => {
    env(); const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    expect((await sendWhatsAppText('919876543210', 'Private message')).ok).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('explicit development mode sends nothing and logs no personal data', async () => {
    env({ WHATSAPP_DEV_MODE: 'true' }); const log = vi.spyOn(console, 'info'); const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    expect(await sendWhatsAppText('919876543210', 'Private message')).toMatchObject({ ok: true, mode: 'dev_logged' });
    expect(fetcher).not.toHaveBeenCalled(); expect(log).not.toHaveBeenCalled();
  });
  it('provider template rejection stays a failure', async () => {
    env({ WHATSAPP_TOKEN: 'test', WHATSAPP_PHONE_NUMBER_ID: 'test' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 132000, message: 'Template not approved' } }), { status: 400 })));
    expect(await sendWhatsAppText('919876543210', 'Test')).toMatchObject({ ok: false });
  });
  it('requires an actual provider message ID before reporting sent', async () => {
    env({ WHATSAPP_TOKEN: 'test', WHATSAPP_PHONE_NUMBER_ID: 'test' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('{}')).mockResolvedValueOnce(new Response(JSON.stringify({ messages: [{ id: 'real-provider-id' }] }))));
    expect((await sendWhatsAppText('919876543210', 'Test')).ok).toBe(false);
    expect(await sendWhatsAppText('919876543210', 'Test')).toEqual({ ok: true, mode: 'api', messageId: 'real-provider-id' });
  });
});
