import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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

  // Authentication and role checks run in the server layouts. This middleware only
  // handles the feature flag because it is safe to evaluate at the edge.
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/parent/:path*', '/student/:path*'],
};
