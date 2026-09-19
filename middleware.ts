import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const isAuthed = req.cookies.has("hb_session");
  const { pathname } = req.nextUrl;
  const isPublic = pathname.startsWith("/login") || pathname.startsWith("/welcome") ||
    pathname.startsWith("/manifest") || pathname.startsWith("/sw.js") ||
    pathname.startsWith("/icons") || pathname.startsWith("/_next");
  if (!isAuthed && !isPublic) {
    // Strangers landing on the root get the pitch; deeper pages go to sign-in.
    const dest = pathname === "/" ? "/welcome" : "/login";
    return NextResponse.redirect(new URL(dest, req.url));
  }
  return NextResponse.next();
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
