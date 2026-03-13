import { NextResponse } from "next/server";
import { db } from "@/db";
import { services, categories, profiles } from "@/db/schema"; 
import { eq, ilike, and, or } from "drizzle-orm";
import { cookies } from "next/headers";
import { AUTH_COOKIE, verifyAuthToken } from "@/lib/auth";
import { appointments } from "@/db/schema";
import {  availabilities as availabilitiesTable } from "@/db/schema";



export async function GET() {
  try {
    const data = await db
      .select({
        id: services.id,
        title: services.title,
        description: services.description,
        price: services.price,
        createdAt: services.createdAt,
        image: services.image,

        category: {
          id: categories.id,
          name: categories.name,
        },

        profile: {
          id: profiles.id,
          city: profiles.city,
        },
      })
      .from(services)
      .leftJoin(categories, eq(services.categoryId, categories.id))
      .leftJoin(profiles, eq(services.profileId, profiles.id));

    return NextResponse.json(data);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Neuspesno pronalazenje usluga" },
      { status: 500 }
    );
  }
}



export async function POST(req: Request) {
  try {
    const token = (await cookies()).get(AUTH_COOKIE)?.value;

    if (!token) {
      return NextResponse.json(
        { error: "Korisnik nije prijavljen" },
        { status: 401 }
      );
    }

    const user = verifyAuthToken(token);

    const body = await req.json();

    const {
      title,
      description,
      price,
      categoryId,
      image,
      appointments: appointmentList,
      availabilities, 
    } = body;

    
    const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, Number(user.sub)));

    if (!profile) {
      return NextResponse.json(
        { error: "Profil nije pronađen" },
        { status: 404 }
      );
    }

    const [newService] = await db
      .insert(services)
      .values({
        title,
        description,
        price,
        categoryId,
        image: image ?? null,
        userId: Number(user.sub),
        profileId: profile.id,
      })
      .returning();

    let insertedAppointments: any[] = [];

    if (appointmentList?.length > 0) {
      insertedAppointments = await db
        .insert(appointments)
        .values(
          appointmentList.map((a: any) => ({
            date: a.date,
            time: a.time ?? null,
            isBooked: false,
            serviceId: newService.id,
          }))
        )
        .returning();
    }

    if (availabilities?.length > 0) { 
      await db.insert(availabilitiesTable).values(
        availabilities.map((a: any) => ({
          employeeId: a.employeeId,
          appointmentId:
            insertedAppointments[a.appointmentIndex].id,
        }))
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Greška na serveru" },
      { status: 500 }
    );
  }
}




/**
 * @swagger
 * /api/services:
 *   get:
 *     summary: Vraća listu svih usluga
 *     description: Preuzima sve usluge zajedno sa kategorijom kojoj pripada i gradom pruzaoca (podatak sa profila)
 *     tags:
 *       - Usluge
 *     responses:
 *       200:
 *         description: Uspešno vraćena lista usluga
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     example: 10
 *                   title:
 *                     type: string
 *                     example: "Muško šišanje"
 *                   description:
 *                     type: string
 *                     example: "Šišanje mašinicom i makazama"
 *                   price:
 *                     type: number
 *                     example: 1200
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                     example: "2026-02-01T09:00:00Z"
 *                   image:
 *                     type: string
 *                     example: "https://example.com/service.jpg"
 *                   category:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 2
 *                       name:
 *                         type: string
 *                         example: "Frizerske usluge"
 *                   profile:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 3
 *                       city:
 *                         type: string
 *                         example: "Beograd"
 *       500:
 *         description: Neuspešno pronalaženje usluga
 */




/**
 * @swagger
 * /api/services:
 *   post:
 *     summary: Kreira novu uslugu
 *     tags:
 *       - Usluge
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - price
 *               - categoryId
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Muško šišanje"
 *               description:
 *                 type: string
 *                 example: "Šišanje mašinicom i makazama"
 *               price:
 *                 type: number
 *                 example: 1200
 *               categoryId:
 *                 type: integer
 *                 example: 2
 *               image:
 *                 type: string
 *                 nullable: true
 *                 example: "https://example.com/service.jpg"
 *               appointments:
 *                 type: array
 *                 nullable: true
 *                 items:
 *                   type: object
 *                   properties:
 *                     date:
 *                       type: string
 *                       example: "2026-03-15"
 *                     time:
 *                       type: string
 *                       example: "09:00"
 *               availabilities:
 *                 type: array
 *                 nullable: true
 *                 items:
 *                   type: object
 *                   properties:
 *                     employeeId:
 *                       type: integer
 *                       example: 1
 *                     appointmentIndex:
 *                       type: integer
 *                       example: 0
 *     responses:
 *       200:
 *         description: Uspesno kreirana usluga
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       401:
 *         description: Korisnik nije prijavljen
 *       404:
 *         description: Profil nije pronađen
 *       500:
 *         description: Greška na serveru
 */
