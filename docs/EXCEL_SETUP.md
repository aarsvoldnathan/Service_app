# Excel spreadsheet link: setup roadmap

Service Ceo can work with Excel in three ways. Pick the level you need.

| Level | What it does | Setup |
|---|---|---|
| 1. Import a file | AI reads any .xlsx/.csv, you review, machines + hours + service history are added | None |
| 2. Updated copy | Download your spreadsheet with the app's new services and hours added | None |
| 3. Live link (OneDrive/SharePoint) | Sheet and app update each other on their own | One-time Microsoft app registration (owner, ~15 min) |

---

## Everyone: get the app update

1. Android: open the app and tap **Update available**, or download the newest `.apk` from https://github.com/aarsvoldnathan/Service_app/releases/latest
2. iPhone: open **TestFlight** and tap **Update** on Service Ceo.

## Optional apps for viewing the spreadsheet on a phone (free)

- Microsoft Excel: iPhone https://apps.apple.com/app/microsoft-excel/id586683407 · Android https://play.google.com/store/apps/details?id=com.microsoft.office.excel
- OneDrive: iPhone https://apps.apple.com/app/microsoft-onedrive/id477537958 · Android https://play.google.com/store/apps/details?id=com.microsoft.skydrive
- On a PC: Excel on the web at https://www.office.com (free with a Microsoft account)

---

## Level 1 and 2: import a spreadsheet (no setup)

1. Put the spreadsheet somewhere the phone can reach: email it to yourself, or save it to Files/iCloud, OneDrive or Google Drive.
2. In Service Ceo: **⚙ Settings › Excel spreadsheet › Import Excel or CSV file**, and choose the file.
3. The AI reads the sheet (it needs the Claude API key to be set; if it isn't, columns are matched automatically).
4. Check the **Columns** list. Tap any line to change which column it comes from.
5. Check **What will change**: new machines, updates to existing machines (blank details filled, hours only go up), and service records. Records already in the app are skipped.
6. Leave **Keep this spreadsheet linked** on, then tap **Import**.
7. Later, **Settings › Excel spreadsheet › Download updated copy** makes a copy of your file with the new services added as rows and the hours updated. Save it over your old file or email it.

Tips for best results:
- One header row (column names) above the data, e.g. `Unit #, Make, Model, Serial, Hours` and `Date, Unit, Hours, Work performed, Tech, Parts`.
- Old `.xls` files: open in Excel and **File › Save As › Excel Workbook (.xlsx)**.
- The downloaded copy may lose cell colors. Use the live link (Level 3) to keep formatting.

---

## Level 3: live link to OneDrive / SharePoint

### A. One-time: register Service Ceo with Microsoft (fleet owner, on a PC)

You need a Microsoft "directory" (tenant) to register the app.
- If your company has **Microsoft 365 Business**, you already have one. Sign in with your work account.
- If you only have a personal account (Outlook/Hotmail), create a free Azure account first: https://azure.microsoft.com/free. It asks for a phone number and card to verify identity. Registering an app is free.

1. Go to https://entra.microsoft.com and sign in.
2. Left menu: **Applications › App registrations › + New registration**. (Older menus: **Identity › Applications**.)
3. **Name:** `Service Ceo`
4. **Supported account types:** choose **Accounts in any organizational directory and personal Microsoft accounts**.
5. **Redirect URI:** platform **Public client/native (mobile & desktop)**, value `serviceceo://auth`.
6. Click **Register**.
7. On the app's **Overview** page, copy **Application (client) ID**. It looks like `1a2b3c4d-1234-5678-9abc-def012345678`.
8. Left menu **API permissions › + Add a permission › Microsoft Graph › Delegated permissions**. Tick `Files.ReadWrite.All`, `User.Read` and `offline_access`, then **Add permissions**.
   - Work accounts: if the status says "admin consent required", click **Grant admin consent** (or ask your Microsoft 365 admin).
9. No client secret is needed. The app uses secure sign-in (PKCE).

### B. Put the spreadsheet in OneDrive

1. Go to https://onedrive.live.com (personal) or your company OneDrive/SharePoint.
2. **+ Add new › Files upload** and choose the spreadsheet. It must be `.xlsx`.
   - Or skip this: the app can create a new linked workbook for you (step C5).

### C. Link it in the app (owner or manager phone)

1. **⚙ Settings › Excel spreadsheet**.
2. Under **Live link**, paste the **Application (client) ID** and tap **Save**.
3. Tap **Sign in with Microsoft** and sign in with the account that owns the spreadsheet. Accept the permissions.
4. Tap **Find my Excel workbooks** (or type part of the name), then tap your workbook. The review screen opens: check the columns and changes, leave **Write the app's services and hours into the workbook** on, and tap **Import**.
5. No spreadsheet yet? Tap **Create a new Service Ceo workbook in OneDrive**. It makes `<Fleet> - Service Ceo.xlsx` with Machines, Service Log, Schedule, Parts and Specs sheets.

### How the live link works

- **App → sheet:** each service logged in the app (by anyone on the crew) becomes a new row on the service sheet. Higher hours update the machine's row. New machines are added to the machine list.
- **Sheet → app:** rows typed into the sheet (new services, new machines, higher hours) are brought into the app.
- Nothing is deleted on either side, and existing cells aren't overwritten (except hours going up). Formatting and formulas stay. Rows inside an Excel table are added to the table.
- It runs on the phone that made the link: when the app opens, every 3 minutes while it's open, and a few seconds after a change. Services logged by technicians reach the sheet the next time that phone opens the app. **Sync now** forces it.
- Only one phone per fleet should hold the link.

### Troubleshooting

| Message | Fix |
|---|---|
| "Microsoft sign-in is not set up yet" | Paste the client ID (C2). |
| AADSTS50011 redirect URI mismatch | In the app registration, the redirect URI must be exactly `serviceceo://auth` under **Public client/native**. |
| AADSTS65001 / needs admin approval | Work account: an admin must **Grant admin consent** (A8). |
| "Microsoft sign-in expired" | Settings › Excel spreadsheet › Sign in with Microsoft again. |
| Workbook not in the list | Search by name, make sure it's `.xlsx` and in the signed-in account's OneDrive (or shared with it). |
| "Workbook is locked" | Close it in the Excel desktop app or wait a minute, then **Sync now**. |
