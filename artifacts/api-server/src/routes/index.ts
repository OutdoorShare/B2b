import { Router, type IRouter } from "express";
import healthRouter from "./health";
import businessRouter from "./business";
import categoriesRouter from "./categories";
import listingsRouter from "./listings";
import bookingsRouter from "./bookings";
import quotesRouter from "./quotes";
import analyticsRouter from "./analytics";
import customersRouter from "./customers";
import addonsRouter from "./addons";
import claimsRouter from "./claims";

const router: IRouter = Router();

router.use(healthRouter);
router.use(businessRouter);
router.use(categoriesRouter);
router.use(listingsRouter);
router.use(bookingsRouter);
router.use(quotesRouter);
router.use(analyticsRouter);
router.use(customersRouter);
router.use(addonsRouter);
router.use(claimsRouter);

export default router;
