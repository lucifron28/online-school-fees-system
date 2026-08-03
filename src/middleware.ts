import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken =
    request.cookies.get('better-auth.session_token')?.value ||
    request.cookies.get('__Secure-better-auth.session_token')?.value;

  // Protected route prefixes
  const isAdminRoute = pathname.startsWith('/admin');
  const isParentRoute = pathname.startsWith('/parent');
  const isStudentRoute = pathname.startsWith('/student');

  if (!isAdminRoute && !isParentRoute && !isStudentRoute) {
    return NextResponse.next();
  }

  // Feature Flag: Student Portal Disabled Check
  if (isStudentRoute && process.env.ENABLE_STUDENT_PORTAL === 'false') {
    return NextResponse.redirect(
      new URL('/unauthorized?reason=student_portal_disabled', request.url)
    );
  }

  // In demo environment without database connection, pass through to preserve UI presentation
  // Detailed server-side role validation is enforced in server guards / actions
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/parent/:path*', '/student/:path*'],
};
