# Adlina Syahirah & Fareez Fahmi — Digital Photobooth

Standalone Vue 3, TypeScript and Vite application for 21 November 2026.

## Development

```sh
npm ci
npm run dev
```

Camera access requires localhost on the development computer or a trusted HTTPS URL on a phone. An HTTP LAN address such as `http://192.168.1.123:5173` cannot open the phone camera.

## Checks

```sh
npm run build
npm test
```

The build includes TypeScript checks. Tests cover crop calculations, mirrored JPEG capture, countdown cancellation, 1/2/3-photo sessions, individual/all retakes, permission failure and camera cleanup. Canvas drawing, media hardware and permission dialogs are mocked in automated tests; verify capture, rendering and saving on real phones. Pixel tests verify artwork outside the photo slots remains identical to the original PNGs.

## Current flow

Use Camera → choose a strip layout and design → Use this strip → Open Camera → allow access → Capture photos.

Each slot gets a 3-second countdown. After the final photo, the camera stops and the review screen automatically creates the finished strip. Download PNG saves the full artwork resolution; Share / Save appears on devices supporting native file sharing. The finished screen shows the completed strip without a separate per-photo review panel. Take new photos restarts capture; Choose another strip returns to the design picker. Both discard the current session, so download first. Retake replaces only the selected photo; Retake all clears the session and opens the camera for a fresh sequence. Cancelling a countdown retains completed photos, and Continue photos resumes unfilled slots. Leaving the camera screen or hiding the tab cancels capture and stops camera tracks.

Captures are mirrored to match the front camera viewfinder and cropped to its 4:3 aspect ratio. Photos are held in memory only and are discarded when leaving the camera screen or refreshing. They are not uploaded automatically. If Google Drive saving is configured, the finished strip is automatically saved to the couple’s album, with a notice shown before capture. Strip composition happens in a local canvas; downloaded PNGs use the original frame dimensions (1080×1350, 1080×1920 or 600×1800). Each capture is centre-cropped to its slot without adding a second mirror transform.

## Manual device checks

- Test 1, 2 and 3-photo strips; confirm each photo receives its own 3–2–1 countdown.
- Check that the captured crop and selfie orientation match the camera preview.
- Retake one photo; confirm the other photos remain unchanged.
- Cancel before and between shots, then resume capture.
- Leave during countdown or switch tabs; confirm the camera indicator turns off.
- Deny permission; confirm recovery instructions appear.
- Test all 9 theme/layout combinations; check slot order, decorative edges and the downloaded PNG.
- Retake one photo and verify the generated strip updates.
- Test Download PNG and Share / Save on iPhone Safari and Samsung Chrome through HTTPS.

## Scope

Welcome, strip selection, camera preview, capture, photo review, finished-strip composition and PNG download are implemented. Optional finished-strip saving to Google Drive is prepared and requires the account-owner setup in `google-drive/SETUP.md`. Local gallery-photo selection is implemented. Authentication, shared gallery, Supabase and Vercel deployment remain separate phases.

No deployment or commit is performed by the application setup.

## Frame artwork

`src/assets/Strips*.png` are the untouched original preview exports. Derived transparent overlays live in `src/assets/overlays/`. Slot dimensions are defined in `src/data/stripLayouts.json`. Regenerate overlays after replacing frame artwork with:

```sh
npm run prepare:frames
npm test
```

The preparation script uses the stock placeholder pixels shared across the three themes to remove only the photo windows. Changing the original artwork or slot geometry requires rechecking all nine overlays visually. `pngjs` is used only by development scripts/tests and is not shipped in the browser bundle.

## Google Drive album and leaving the result screen

See [Google Drive setup](google-drive/SETUP.md) for the one-time owner authorization and server environment variables. The account owner must authorize and deploy their Apps Script; copying a folder link does not grant API write access. Automatic saving starts only when server configuration is present and the finished strip is ready. It confirms success only after the script reports a completed save. A failed save exposes Retry saving; retries reuse the upload ID. Download and Share remain available. Real Google Drive uploads have not been verified during local implementation.

Take new photos and Choose another strip now open a reminder that the current photos will disappear. Go back & save preserves the session; Continue anyway performs the selected action. These actions are disabled while sending a strip to the couple.

## Upload Photos

Upload Photos → choose a strip → Use this strip → choose gallery photos → arrange or replace them → Create my strip. The same finished-strip preview, download/share, automatic private Drive saving and leave-page reminder are reused. The upload workflow never requests camera permission.

Guests may select all required photos together or fill each slot separately. The selection shows the centre crop used in the output. JPG, PNG and WebP are supported; HEIC/HEIF can be selected if the browser decodes them, otherwise an explanatory message requests JPG/PNG. Each source file is limited to 15 MiB. Decoding is sequential, temporary source URLs are released, and failed batches preserve previous selections. Images are cropped to the slot ratio and reduced to at most 1600 pixels wide without mirroring. Only the finished PNG is sent to Drive after Create my strip; original gallery files are not uploaded.

Device verification: test 1/2/3-photo layouts, portrait photos and text orientation, multi-select, replacing a photo, arrow reordering, unsupported files, downloads and Drive saving on both phones. Use Choose new photos to restart after the save reminder. Native gallery pickers, EXIF orientation and HEIC support still require real-device checks.
