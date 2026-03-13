import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const AUTH_COOKIE = "auth";

/* =========================
   API ROLE ACCESS
========================= */

const roleAccess: Record<string, Record<string, string[]>> = {
  USER: {
    GET: [
      "/api/categories",
      "/api/services",
      "/api/reviews",
      "/api/appointments",
      "/api/profiles",
      "/api/employees",
      "/api/availabilities",
    ],
    POST: ["/api/appointments", "/api/reviews", "/api/bookings"],
    PUT: [],
    DELETE: [],
  },
  FREELANCER: {
    GET: [
      "/api/categories",
      "/api/services",
      "/api/reviews",
      "/api/appointments",
      "/api/profiles",
      "/api/availabilities",
      "/api/employees",
      "/api/bookings/me",
    ],
    POST: ["/api/services", "/api/availabilities"],
    PUT: ["/api/services", "/api/availabilities"],
    DELETE: ["/api/services", "/api/availabilities"],
    PATCH: ["/api/bookings"],
  },
  COMPANY: {
    GET: [
      "/api/categories",
      "/api/services",
      "/api/employees",
      "/api/profiles",
      "/api/reviews",
      "/api/appointments",
      "/api/availabilities",
      "/api/bookings/me",
    ],
    POST: ["/api/employees", "/api/profiles", "/api/services"],
    PUT: ["/api/employees", "/api/profiles"],
    DELETE: ["/api/employees", "/api/profiles", "/api/services"],
    PATCH: ["/api/bookings"],
  },
};

/* =========================
   PUBLIC API RUTE
========================= */

const publicApiRoutes = [
  "/api/categories",
  "/api/services",
  "/api/profiles",
  "/api/reviews",
  "/api/swagger",
];

/* =========================
   PUBLIC STRANICE
========================= */

const publicPages = [
  "/",
  "/about",
  "/register",
  "/services",
  "/profiles",
];

/* =========================
   DOZVOLJENE STRANICE
   ZA FREELANCER
========================= */

const freelancerAllowedPages = [
  "/dashboard",
  "/reservations",
  "/service-create",
  "/services",
];

/* =========================
   DOZVOLJENE STRANICE
   ZA COMPANY
========================= */

const companyAllowedPages = [
  "/dashboard",
  "/reservations",
  "/service-create",
  "/employees",
  "/services",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

   /* =========================
     SWAGGER DOCS (PUBLIC)
  ========================== */

  if (pathname.startsWith("/api-docs")) { 
    return NextResponse.next();
  }

  /* =========================
     AUTH RUTE
  ========================== */

  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  /* =========================
     PUBLIC API (GET)
  ========================== */

  if (
    req.method === "GET" &&
    publicApiRoutes.some((route) => pathname.startsWith(route))
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(AUTH_COOKIE)?.value;

  /* =========================
     NEULOGOVANI
  ========================== */

  if (!token) {
    const isPublic = publicPages.some(
      (route) =>
        pathname === route || pathname.startsWith(route + "/")
    );

    if (isPublic) {
      return NextResponse.next();
    }

    return NextResponse.redirect(new URL("/", req.url));
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });

    const role = payload.role as string;

    /* =========================
       API PROVERA
    ========================== */

    if (pathname.startsWith("/api")) {
      const method = req.method;
      const allowedRoutes = roleAccess[role]?.[method] || [];

      const hasAccess = allowedRoutes.some(
        (route) =>
          pathname === route || pathname.startsWith(route + "/")
      );

      if (!hasAccess) {
        return NextResponse.json(
          { error: "Forbidden" },
          { status: 403 }
        );
      }

      return NextResponse.next();
    }

    /* =========================
       FRONTEND PROVERA
    ========================== */

    // if (role === "USER") {
    //   return NextResponse.next();
    // }
    if (role === "USER") {
      const isAllowed = publicPages.some(
        (route) =>
          pathname === route || pathname.startsWith(route + "/")
      );

      if (!isAllowed) {
        return NextResponse.redirect(
          new URL("/", req.url)
        );
      }
    }

    if (role === "FREELANCER") {
      const isAllowed = freelancerAllowedPages.some(
        (route) =>
          pathname === route || pathname.startsWith(route + "/")
      );

      if (!isAllowed) {
        return NextResponse.redirect(
          new URL("/dashboard", req.url)
        );
      }
    }

    if (role === "COMPANY") {
      const isAllowed = companyAllowedPages.some(
        (route) =>
          pathname === route || pathname.startsWith(route + "/")
      );

      if (!isAllowed) {
        return NextResponse.redirect(
          new URL("/dashboard", req.url)
        );
      }
    }

    return NextResponse.next();
  } catch (err) {
    console.error("JWT verification failed:", err);
    return NextResponse.redirect(new URL("/", req.url));
  }
}

/* =========================
   MATCHER
========================= */

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|.*\\.(?:svg|png|jpg|jpeg|gif|webp)).*)",
  ],
};


