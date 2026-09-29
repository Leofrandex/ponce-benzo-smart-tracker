import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refresca la sesión (cookies) y devuelve { response, authed }.
// Patrón oficial de Supabase para Next.js App Router.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Carga completa de documento: getUser() valida el token contra Supabase Auth.
  // Navegación interna del panel (RSC / prefetch): getSession() lee la cookie
  // sin ir a la red (solo refresca si el token venció). Antes cada click pagaba
  // un round-trip a Supabase Auth antes de poder cambiar de sección.
  // Seguro porque el middleware es solo la puerta de UX: los datos los protege
  // RLS en Supabase con el JWT real, y toda carga completa sigue validando.
  const isClientNav = request.headers.get("rsc") === "1" || request.headers.has("next-router-prefetch");
  if (isClientNav) {
    // Solo se mira si hay sesión (no session.user: @supabase/ssr avisa en cada lectura).
    const { data: { session } } = await supabase.auth.getSession();
    return { response, authed: session !== null };
  }

  const { data: { user } } = await supabase.auth.getUser();
  return { response, authed: user !== null };
}
