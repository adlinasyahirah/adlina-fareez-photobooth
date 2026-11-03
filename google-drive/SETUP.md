# Connect the couple's Google Drive album

Destination folder:
https://drive.google.com/drive/folders/1-6fIRYcKmRnlqRhqp4r7BK9tYCOOGDI3

The website automatically sends only the finished PNG after composition, once Drive saving is configured. Guests see a privacy notice before capture and on the result screen. Raw shots and discarded retakes are not uploaded. Original shots and discarded retakes are not sent. No folder contents or private file URLs are returned to guests. The script never changes Drive sharing permissions; check that the destination folder is restricted if you want a private album.

## One-time setup in the bride's Google account

1. Open https://script.google.com/ and create a new project named `Adlina Fareez Photobooth Album`.
2. Replace its `Code.gs` contents with the complete contents of this directory's `Code.gs`. Save.
3. Generate a random secret locally:

   ```sh
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

   Keep this secret private. Do not paste it into chat or any frontend source file.
4. In Apps Script, open **Project Settings → Script properties → Add script property**. Name it `UPLOAD_SECRET` and paste that secret as its value. Save.
5. Select and run `authorizeFolder` from the script editor. Authorize the script in the Google account that owns or can write to the destination folder. Check the execution log shows the intended folder name. You are authorizing your own script to create Drive files.
6. Choose **Deploy → New deployment → Web app**. Set **Execute as: Me**, **Who has access: Anyone**, then deploy. Copy the URL ending in `/exec`. The endpoint is reachable without guest Google login, but every upload still requires the secret checked by the script. Do not share the secret or put it in the URL.
7. In the photobooth project root, create or update `.env.local` without overwriting any other settings:

   ```dotenv
   GOOGLE_DRIVE_UPLOAD_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
   GOOGLE_DRIVE_UPLOAD_SECRET=THE_SAME_SECRET_FROM_STEP_3
   ```

   Do **not** prefix these names with `VITE_`. The file is gitignored.
8. Restart `npm run dev` and keep the existing HTTPS tunnel running. Capture a strip. The privacy notice and auto-save status will appear when the server configuration is present.
9. Wait for the automatic save success message, and check the folder from your own Google account. Retry the same strip after a network error if necessary: its upload ID is reused, so the script will not create a duplicate.

Neither the Apps Script deployment nor the account authorization can be completed by copying the folder link alone. They must be done by the Google account owner. No actual Drive upload has been verified until step 9 succeeds.

## Local development and future Vercel hosting

The Vite dev middleware and `/api/save-strip` Vercel function use the same server handler. `vite preview` is static and does not serve this API; use `npm run dev` for upload testing.

For a future approved Vercel deployment, add the same two server-only variables to that new photobooth project's environment settings. No deployment is performed by this setup.

Uploads are PNG-only, limited to 3 MiB and the three known artwork dimensions. The Apps Script validates the shared secret, has a 1,000-new-files/day cap and serializes writes. Its Drive and execution quotas still apply. Guests cannot list album files through this API. Availability only means configuration is present; a real upload is required to verify permissions and connectivity.

For a replacement `Code.gs`, update the Apps Script deployment to a new version. Keep the original `/exec` URL when editing the existing deployment.
