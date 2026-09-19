import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const isAuthed = req.cookies.has("khata_session");
  const { pathname } = req.nextUrl;
  const isPublic = pathname.startsWith("/login") || pathname.startsWith("/manifest") ||
    pathname.startsWith("/sw.js") || pathname.startsWith("/icons") || pathname.startsWith("/_next");
  if (!isAuthed && !isPublic) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
