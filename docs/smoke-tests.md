# OutdoorShare Smoke Tests

Run these after every preview deploy and every production deploy.

---

## 1. Image Upload / Crop Flow
**Regression for:** `ReferenceError: X is not defined` in ImageCropDialog (commit a755053)

### Steps
1. Navigate to `/demo-outdoorshare/admin` and log in as `demo@myoutdoorshare.com`
2. Go to **Listings → New Listing** (or edit any existing listing)
3. Scroll to the **Photos** section
4. Click the upload area and select any JPEG or PNG under 5 MB
5. Confirm the **crop dialog opens** — the image should be visible inside the crop frame
6. Drag the image to reposition it; use the slider to zoom
7. Click **"Use this crop"**
8. Confirm the photo appears in the listing form's photo grid
9. Save the listing and confirm the photo persists after reload

### What to verify
- [ ] Crop dialog opens without a full-page crash
- [ ] The **X (close)** button in the top-right of the dialog is visible and clickable
- [ ] Dragging and zooming works inside the crop frame
- [ ] Clicking "Use this crop" uploads the image and closes the dialog
- [ ] The uploaded photo appears in the listing photo grid
- [ ] No "Something went wrong" error boundary is triggered

### Oversized file validation
- [ ] Select a file larger than 5 MB — a **toast error** should appear, no crash

---

## 2. Admin Login
1. Go to `/demo-outdoorshare/admin`
2. Log in with `demo@myoutdoorshare.com` / `demo123`
3. Confirm redirect to the dashboard

---

## 3. Storefront Loads
1. Go to `/demo-outdoorshare`
2. Confirm listings render with photos
3. Confirm no console errors

---

## 4. Marketplace Loads
1. Go to `/marketplace`
2. Confirm listing cards appear
3. Check that filters work

---

## 5. Stripe Connect (Wilder Rentals)
1. Log in as `wilder-rentals` tenant admin
2. Go to **Settings → Payments**
3. Confirm Stripe Connect status shows connected or the onboarding button is visible
4. No JS errors in console

---

## Post-Deploy Checklist

After pushing to GitHub and Vercel finishes building:

```
[ ] Vercel build succeeded (no red X in Vercel dashboard)
[ ] Smoke test 1 (photo upload/crop) passes on b2b-beta-one.vercel.app
[ ] Smoke test 2 (admin login) passes
[ ] Smoke test 3 (storefront) passes
[ ] API at rental-dashboard-contactus35.replit.app/api/business returns 200
[ ] No new errors in Replit deployment logs
```

---

## Running Automated Tests

```bash
# From repo root
pnpm --filter @workspace/rental-platform run test

# Watch mode during development
pnpm --filter @workspace/rental-platform run test:watch
```

The automated test suite includes a regression test for the X icon import bug.
If `ImageCropDialog` ever crashes due to a missing import again, `image-crop-dialog.test.tsx` will fail before it ships.
