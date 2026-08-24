import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import { clientEnv } from "@/lib/env"

/**
 * Paths reachable without a session: login, Supabase auth callbacks, and the
 * patient-facing automation links. The latter are authorised by the capability
 * token in the URL (see features/automations/lib/tokens.ts) — patients never
 * get an account, so gating them behind the session would break every reminder.
 */
const PUBLIC_PATHS = ["/login", "/auth", "/book", "/r", "/q", "/api/automations"]

const isPublicPath = (path: string) =>
  PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`))

/**
 * Refresh the Supabase session on every request and gate protected routes.
 *
 * Mock mode: when Supabase env is absent the app has no auth wall and this is a
 * pass-through — the current mock/demo behaviour is untouched. The gate only
 * activates once NEXT_PUBLIC_SUPABASE_* are set.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const url = clientEnv.NEXT_PUBLIC_SUPABASE_URL
  const key = clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return NextResponse.next()

  let response = NextResponse.next({ request })

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
      },
    },
  })

  // Do not run other logic between creating the client and getUser() — the
  // Supabase SSR docs warn this can cause hard-to-debug session bugs.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  const redirectTo = (pathname: string, next?: string) => {
    const url = request.nextUrl.clone()
    url.pathname = pathname
    url.search = ""
    if (next && next.startsWith("/") && next !== pathname) url.searchParams.set("next", next)
    return NextResponse.redirect(url)
  }

  // No session on a protected route → send to login, remembering the target.
  // /mfa needs a session too, so it is NOT treated as public here.
  if (!user) {
    if (isPublicPath(path)) return response
    return redirectTo("/login", path)
  }

  // Signed in: enforce MFA step-up. Once the practitioner has a *verified*
  // factor, a password-only session is aal1 with nextLevel aal2 and must
  // complete a TOTP challenge before reaching any protected page.
  let mustStepUp = false
  try {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    mustStepUp = aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2"
  } catch {
    // If the AAL check fails, fail open to the app rather than lock the user out.
    mustStepUp = false
  }

  if (mustStepUp && path !== "/mfa") {
    return redirectTo("/mfa", path === "/login" ? undefined : path)
  }
  // Fully authenticated (or no MFA enrolled) but sitting on an auth page → app.
  if (!mustStepUp && (path === "/login" || path === "/mfa")) {
    return redirectTo("/dashboard")
  }

  return response
}
