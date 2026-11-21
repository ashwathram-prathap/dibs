import { PUBLIC_ORIGIN } from '../../shared/config';
interface Env {
  API: Fetcher;
}
export const onRequest: PagesFunction<Env> = async ({ request, env, params }) => {
  const url = new URL(request.url);
  const r = await env.API.fetch(
    new Request(url.origin + '/api/certificate/' + encodeURIComponent(String(params.id))),
  );
  if (!r.ok) return new Response('Dibs: this certificate is not on file.', { status: 404 });
  const { claim } = (await r.json()) as any;
  return Response.redirect(PUBLIC_ORIGIN + '/certificate/' + claim.id, 302);
};
