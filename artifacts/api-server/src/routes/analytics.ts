import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { bookingsTable, listingsTable, customersTable } from "@workspace/db/schema";
import { count, sum, eq, and, gte, sql, isNotNull } from "drizzle-orm";

const router: IRouter = Router();

router.get("/analytics/summary", async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];

    const [allStats] = await db
      .select({ totalBookings: count(), totalRevenue: sum(bookingsTable.totalPrice) })
      .from(bookingsTable)
      .where(sql`${bookingsTable.status} != 'cancelled'`);

    const [activeStats] = await db
      .select({ count: count() })
      .from(bookingsTable)
      .where(eq(bookingsTable.status, "active"));

    const [pendingStats] = await db
      .select({ count: count() })
      .from(bookingsTable)
      .where(eq(bookingsTable.status, "pending"));

    const [thisMonthStats] = await db
      .select({ revenue: sum(bookingsTable.totalPrice), bookings: count() })
      .from(bookingsTable)
      .where(and(
        gte(bookingsTable.startDate, startOfMonth),
        sql`${bookingsTable.status} != 'cancelled'`
      ));

    const [lastMonthStats] = await db
      .select({ revenue: sum(bookingsTable.totalPrice), bookings: count() })
      .from(bookingsTable)
      .where(and(
        gte(bookingsTable.startDate, startOfLastMonth),
        sql`${bookingsTable.startDate} <= ${endOfLastMonth}`,
        sql`${bookingsTable.status} != 'cancelled'`
      ));

    const [listingStats] = await db
      .select({ total: count() })
      .from(listingsTable);

    const [activeListingStats] = await db
      .select({ count: count() })
      .from(listingsTable)
      .where(eq(listingsTable.status, "active"));

    const totalBookings = Number(allStats?.totalBookings ?? 0);
    const totalRevenue = parseFloat(allStats?.totalRevenue ?? "0");
    const revenueThisMonth = parseFloat(thisMonthStats?.revenue ?? "0");
    const revenueLastMonth = parseFloat(lastMonthStats?.revenue ?? "0");

    res.json({
      totalRevenue,
      totalBookings,
      activeBookings: Number(activeStats?.count ?? 0),
      totalListings: Number(listingStats?.total ?? 0),
      activeListings: Number(activeListingStats?.count ?? 0),
      pendingBookings: Number(pendingStats?.count ?? 0),
      revenueThisMonth,
      revenueLastMonth,
      bookingsThisMonth: Number(thisMonthStats?.bookings ?? 0),
      bookingsLastMonth: Number(lastMonthStats?.bookings ?? 0),
      averageBookingValue: totalBookings > 0 ? totalRevenue / totalBookings : 0,
      utilization: Number(activeListingStats?.count ?? 0) > 0 ? (Number(activeStats?.count ?? 0) / Number(activeListingStats?.count ?? 1)) * 100 : 0,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch analytics summary" });
  }
});

router.get("/analytics/revenue", async (req, res) => {
  try {
    const period = (req.query.period as string) ?? "30d";
    
    let daysBack = 30;
    if (period === "7d") daysBack = 7;
    else if (period === "90d") daysBack = 90;
    else if (period === "12m") daysBack = 365;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysBack);

    const bookings = await db
      .select({
        startDate: bookingsTable.startDate,
        totalPrice: bookingsTable.totalPrice,
      })
      .from(bookingsTable)
      .where(and(
        gte(bookingsTable.startDate, cutoff.toISOString().split("T")[0]),
        sql`${bookingsTable.status} != 'cancelled'`
      ));

    // Group by date
    const grouped: Record<string, { revenue: number; bookings: number }> = {};
    
    for (let i = daysBack >= 365 ? 11 : daysBack - 1; i >= 0; i--) {
      const d = new Date();
      if (daysBack >= 365) {
        d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        grouped[key] = { revenue: 0, bookings: 0 };
      } else {
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split("T")[0];
        grouped[key] = { revenue: 0, bookings: 0 };
      }
    }

    for (const b of bookings) {
      let key = b.startDate;
      if (daysBack >= 365) {
        key = b.startDate.substring(0, 7);
      }
      if (grouped[key]) {
        grouped[key].revenue += parseFloat(b.totalPrice ?? "0");
        grouped[key].bookings += 1;
      }
    }

    const result = Object.entries(grouped).map(([date, data]) => ({
      date,
      revenue: data.revenue,
      bookings: data.bookings,
    }));

    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch revenue analytics" });
  }
});

router.get("/analytics/top-listings", async (req, res) => {
  try {
    const bookingStats = await db
      .select({
        listingId: bookingsTable.listingId,
        totalBookings: count(),
        totalRevenue: sum(bookingsTable.totalPrice),
      })
      .from(bookingsTable)
      .where(sql`${bookingsTable.status} != 'cancelled'`)
      .groupBy(bookingsTable.listingId)
      .orderBy(sql`sum(${bookingsTable.totalPrice}) desc`)
      .limit(10);

    const result = await Promise.all(bookingStats.map(async (s) => {
      const [listing] = await db
        .select({ title: listingsTable.title, pricePerDay: listingsTable.pricePerDay })
        .from(listingsTable)
        .where(eq(listingsTable.id, s.listingId));
      return {
        id: s.listingId,
        title: listing?.title ?? "Unknown",
        totalRevenue: parseFloat(s.totalRevenue ?? "0"),
        totalBookings: Number(s.totalBookings),
        pricePerDay: parseFloat(listing?.pricePerDay ?? "0"),
      };
    }));

    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch top listings" });
  }
});

router.get("/analytics/booking-status", async (req, res) => {
  try {
    const stats = await db
      .select({
        status: bookingsTable.status,
        count: count(),
      })
      .from(bookingsTable)
      .groupBy(bookingsTable.status);

    const total = stats.reduce((s, r) => s + Number(r.count), 0);

    const result = stats.map(s => ({
      status: s.status,
      count: Number(s.count),
      percentage: total > 0 ? Math.round((Number(s.count) / total) * 100) : 0,
    }));

    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch booking status breakdown" });
  }
});

// Booking volume grouped by period (reuses same logic as revenue but returns count-focused data)
router.get("/analytics/booking-volume", async (req, res) => {
  try {
    const period = (req.query.period as string) ?? "30d";

    let daysBack = 30;
    if (period === "7d") daysBack = 7;
    else if (period === "90d") daysBack = 90;
    else if (period === "12m") daysBack = 365;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysBack);

    const bookings = await db
      .select({ startDate: bookingsTable.startDate })
      .from(bookingsTable)
      .where(and(
        gte(bookingsTable.startDate, cutoff.toISOString().split("T")[0]),
        sql`${bookingsTable.status} != 'cancelled'`
      ));

    const grouped: Record<string, number> = {};

    for (let i = daysBack >= 365 ? 11 : daysBack - 1; i >= 0; i--) {
      const d = new Date();
      if (daysBack >= 365) {
        d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        grouped[key] = 0;
      } else {
        d.setDate(d.getDate() - i);
        grouped[d.toISOString().split("T")[0]] = 0;
      }
    }

    for (const b of bookings) {
      const key = daysBack >= 365 ? b.startDate.substring(0, 7) : b.startDate;
      if (grouped[key] !== undefined) grouped[key] += 1;
    }

    res.json(Object.entries(grouped).map(([date, bookings]) => ({ date, bookings })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch booking volume" });
  }
});

// Renter locations — joins bookings with customer billing state/city
router.get("/analytics/renter-locations", async (req, res) => {
  try {
    // Group by state first for the top-level breakdown
    const byState = await db
      .select({
        state: customersTable.billingState,
        count: count(),
      })
      .from(bookingsTable)
      .innerJoin(customersTable, eq(bookingsTable.customerEmail, customersTable.email))
      .where(and(
        isNotNull(customersTable.billingState),
        sql`${customersTable.billingState} != ''`,
        sql`${bookingsTable.status} != 'cancelled'`
      ))
      .groupBy(customersTable.billingState)
      .orderBy(sql`count(*) desc`)
      .limit(15);

    // Group by city+state for a more granular breakdown
    const byCity = await db
      .select({
        city: customersTable.billingCity,
        state: customersTable.billingState,
        count: count(),
      })
      .from(bookingsTable)
      .innerJoin(customersTable, eq(bookingsTable.customerEmail, customersTable.email))
      .where(and(
        isNotNull(customersTable.billingCity),
        sql`${customersTable.billingCity} != ''`,
        sql`${bookingsTable.status} != 'cancelled'`
      ))
      .groupBy(customersTable.billingCity, customersTable.billingState)
      .orderBy(sql`count(*) desc`)
      .limit(15);

    res.json({
      byState: byState.map(r => ({ location: r.state ?? "Unknown", count: Number(r.count) })),
      byCity: byCity.map(r => ({
        location: r.city && r.state ? `${r.city}, ${r.state}` : r.city ?? r.state ?? "Unknown",
        count: Number(r.count),
      })),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch renter locations" });
  }
});

export default router;
