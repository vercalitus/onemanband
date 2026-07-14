import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import { clientEnv } from "@/lib/env"

/** Paths reachable without a session (login + Supabase auth callbacks). */
const PUBLIC_PATHS = ["/login", "/auth"]

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

  // No session on a protected route → send to login, remembering the target.
  if (!user && !isPublicPath(path)) {
    const redirect = request.nextUrl.clone()
    redirect.pathname = "/login"
    redirect.search = ""
    redirect.searchParams.set("next", path)
    return NextResponse.redirect(redirect)
  }

  // Already signed in but sitting on /login → bounce to the dashboard.
  if (user && path === "/login") {
    const redirect = request.nextUrl.clone()
    redirect.pathname = "/dashboard"
    redirect.search = ""
    return NextResponse.redirect(redirect)
  }

  return response
}
