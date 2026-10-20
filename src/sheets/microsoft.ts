// Microsoft sign-in and the Microsoft Graph calls for a live Excel workbook in OneDrive/SharePoint.
// The workbook is edited cell by cell through Excel's own API, so formatting, formulas and other
// sheets are left alone.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AuthSession from 'expo-auth-session';
import * as FileSystem from 'expo-file-system/legacy';
import * as WebBrowser from 'expo-web-browser';
import { MS_CLIENT_ID } from '../config';
import { Book, colLetter, Grid, parseAddressStart, Writeback } from './core';
import { lastRow, XLSX_MIME } from './files';

WebBrowser.maybeCompleteAuthSession();

export const MS_REDIRECT = 'serviceceo://auth';
const SCOPES = ['openid', 'profile', 'offline_access', 'User.Read', 'Files.ReadWrite.All'];
const discovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
};
const GRAPH = 'https://graph.microsoft.com/v1.0';

type Tokens = { accessToken: string; refreshToken?: string; expiresAt: number; account?: string; clientId: string };
let tokens: Tokens | null = null;
let storeKey = '';
let clientIdOverride = '';

export const msClientId = () => (clientIdOverride || MS_CLIENT_ID).trim();

/** Called once per signed-in app user; loads the saved Microsoft sign-in. */
export async function initMicrosoft(userId: string, clientId?: string) {
  storeKey = `service-ceo:ms:${userId}`;
  clientIdOverride = clientId ?? '';
  try {
    const raw = await AsyncStorage.getItem(storeKey);
    tokens = raw ? (JSON.parse(raw) as Tokens) : null;
  } catch {
    tokens = null;
  }
  return tokens?.account;
}

async function save(t: Tokens | null) {
  tokens = t;
  if (!storeKey) return;
  if (t) await AsyncStorage.setItem(storeKey, JSON.stringify(t)).catch(() => {});
  else await AsyncStorage.removeItem(storeKey).catch(() => {});
}

export const msAccount = () => tokens?.account;

/** Opens the Microsoft sign-in page. Returns the account name. */
export async function signInMicrosoft(): Promise<string> {
  const clientId = msClientId();
  if (!clientId) throw new Error('Microsoft sign-in is not set up yet. Add the Microsoft app (client) ID first — see the setup roadmap.');
  const request = new AuthSession.AuthRequest({
    clientId,
    scopes: SCOPES,
    redirectUri: MS_REDIRECT,
    usePKCE: true,
    prompt: AuthSession.Prompt.SelectAccount,
  });
  const result = await request.promptAsync(discovery);
  if (result.type !== 'success') {
    if (result.type === 'error') throw new Error(result.params?.error_description ?? result.error?.message ?? 'Microsoft sign-in failed.');
    throw new Error('Sign-in was cancelled.');
  }
  const t = await AuthSession.exchangeCodeAsync(
    { clientId, code: result.params.code, redirectUri: MS_REDIRECT, extraParams: { code_verifier: request.codeVerifier ?? '' } },
    discovery,
  );
  await save({ accessToken: t.accessToken, refreshToken: t.refreshToken, expiresAt: Date.now() + (t.expiresIn ?? 3600) * 1000, clientId });
  const me = (await graph('/me?$select=displayName,userPrincipalName,mail')) as { displayName?: string; userPrincipalName?: string; mail?: string };
  const account = me.mail || me.userPrincipalName || me.displayName || 'Microsoft account';
  await save({ ...tokens!, account });
  return account;
}

export async function signOutMicrosoft() {
  await save(null);
}

async function accessToken(): Promise<string> {
  if (!tokens) throw new Error('Sign in to Microsoft first (Settings › Excel spreadsheet).');
  if (Date.now() < tokens.expiresAt - 120000) return tokens.accessToken;
  if (!tokens.refreshToken) throw new Error('Microsoft sign-in expired. Sign in again.');
  try {
    const t = await AuthSession.refreshAsync({ clientId: tokens.clientId, refreshToken: tokens.refreshToken, scopes: SCOPES }, discovery);
    await save({ ...tokens, accessToken: t.accessToken, refreshToken: t.refreshToken ?? tokens.refreshToken, expiresAt: Date.now() + (t.expiresIn ?? 3600) * 1000 });
    return tokens!.accessToken;
  } catch {
    throw new Error('Microsoft sign-in expired. Open Settings › Excel spreadsheet and sign in again.');
  }
}

async function graph(path: string, init?: { method?: string; body?: unknown }, attempt = 0): Promise<unknown> {
  const token = await accessToken();
  const res = await fetch(path.startsWith('http') ? path : GRAPH + path, {
    method: init?.method ?? 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if ((res.status === 429 || res.status === 503 || res.status === 504) && attempt < 3) {
    const wait = Number(res.headers.get('Retry-After') ?? '2') * 1000;
    await new Promise((r) => setTimeout(r, Math.min(wait, 10000)));
    return graph(path, init, attempt + 1);
  }
  if (!res.ok) {
    let msg = `Microsoft error ${res.status}`;
    try {
      const j = await res.json();
      msg = j?.error?.message ?? msg;
    } catch {
      // keep default
    }
    if (res.status === 401) msg = 'Microsoft sign-in expired. Sign in again.';
    if (res.status === 423) msg = 'The workbook is locked (someone may have it open in the Excel desktop app with an old version). Try again shortly.';
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export type DriveFile = { id: string; driveId: string; name: string; webUrl?: string; modified?: string };

type RawItem = {
  id: string;
  name: string;
  webUrl?: string;
  lastModifiedDateTime?: string;
  parentReference?: { driveId?: string };
  remoteItem?: RawItem;
  file?: unknown;
};

const toFile = (x: RawItem): DriveFile | null => {
  const it = x.remoteItem ?? x;
  if (!/\.xlsx?m?$/i.test(it.name ?? '') || !it.parentReference?.driveId) return null;
  return { id: it.id, driveId: it.parentReference.driveId, name: it.name, webUrl: it.webUrl, modified: it.lastModifiedDateTime };
};

/** Excel files in the person's OneDrive (recent and shared), or matching a search. */
export async function listWorkbooks(query?: string): Promise<DriveFile[]> {
  const sel = '$select=id,name,webUrl,lastModifiedDateTime,parentReference,remoteItem,file';
  const lists: RawItem[][] = [];
  if (query?.trim()) {
    const q = query.trim().replace(/'/g, "''");
    const r = (await graph(`/me/drive/root/search(q='${encodeURIComponent(q)}')?$top=50&${sel}`)) as { value: RawItem[] };
    lists.push(r.value ?? []);
  } else {
    for (const p of [`/me/drive/recent?$top=50`, `/me/drive/sharedWithMe?$top=50`, `/me/drive/root/search(q='.xlsx')?$top=50&${sel}`]) {
      try {
        const r = (await graph(p)) as { value: RawItem[] };
        lists.push(r.value ?? []);
      } catch {
        // some account types don't support every list
      }
    }
  }
  const seen = new Set<string>();
  const out: DriveFile[] = [];
  lists.flat().forEach((x) => {
    const f = toFile(x);
    if (f && !seen.has(f.id)) {
      seen.add(f.id);
      out.push(f);
    }
  });
  return out.sort((a, b) => (b.modified ?? '').localeCompare(a.modified ?? ''));
}

const wbPath = (f: { driveId: string; itemId: string }) => `/drives/${f.driveId}/items/${f.itemId}/workbook`;

/** Read every visible sheet as text, keeping real cell positions. */
export async function loadGraphBook(f: { driveId: string; itemId: string; fileName: string }): Promise<Book> {
  const base = wbPath(f);
  const list = (await graph(`${base}/worksheets?$select=id,name,visibility`)) as { value: { id: string; name: string; visibility: string }[] };
  const sheets: Grid[] = [];
  for (const ws of list.value ?? []) {
    if (ws.visibility && ws.visibility !== 'Visible') continue;
    const id = encodeURIComponent(ws.id);
    const ur = (await graph(`${base}/worksheets/${id}/usedRange(valuesOnly=true)?$select=address,text`)) as { address: string; text: string[][] };
    const start = parseAddressStart(ur.address ?? 'A1');
    const rows: string[][] = Array.from({ length: start.row }, () => []);
    (ur.text ?? []).forEach((r) => rows.push([...Array(start.col).fill(''), ...r.map((v) => String(v ?? ''))]));
    let tables: Grid['tables'] = [];
    try {
      const t = (await graph(`${base}/worksheets/${id}/tables?$select=id,name,showHeaders`)) as { value: { id: string }[] };
      for (const tb of t.value ?? []) {
        const hr = (await graph(`${base}/tables/${encodeURIComponent(tb.id)}/headerRowRange?$select=address,columnCount`)) as { address: string; columnCount: number };
        const s = parseAddressStart(hr.address);
        tables.push({ id: tb.id, headerRow: s.row, firstCol: s.col, lastCol: s.col + (hr.columnCount ?? 1) - 1 });
      }
    } catch {
      tables = [];
    }
    sheets.push({ name: ws.name, id: ws.id, rows, tables });
  }
  return { fileName: f.fileName, sheets };
}

/** Write the app's changes into the live workbook. */
export async function applyGraphWriteback(f: { driveId: string; itemId: string }, book: Book, w: Writeback) {
  const base = wbPath(f);
  const sheetId = (name: string) => encodeURIComponent(book.sheets.find((g) => g.name === name)?.id ?? name);
  for (const e of w.edits) {
    await graph(`${base}/worksheets/${sheetId(e.sheet)}/range(address='${colLetter(e.col)}${e.row + 1}')`, {
      method: 'PATCH',
      body: { values: [[e.value]] },
    });
  }
  // New rows, grouped per sheet so each sheet is one write.
  const groups = new Map<string, { headerRow: number; rows: string[][] }>();
  w.appends.forEach((a) => {
    const g = groups.get(a.sheet) ?? { headerRow: a.headerRow, rows: [] };
    g.rows.push(a.values);
    groups.set(a.sheet, g);
  });
  for (const [sheet, g] of groups) {
    const grid = book.sheets.find((x) => x.name === sheet);
    const width = Math.max(...g.rows.map((r) => r.length));
    const rows = g.rows.map((r) => [...r, ...Array(width - r.length).fill('')]);
    const table = grid?.tables?.find((t) => t.headerRow === g.headerRow);
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      if (table) {
        // Inside an Excel table: add rows to the table so it grows with them.
        const cols = table.lastCol - table.firstCol + 1;
        const values = chunk.map((r) => Array.from({ length: cols }, (_, k) => r[table.firstCol + k] ?? ''));
        await graph(`${base}/tables/${encodeURIComponent(table.id)}/rows/add`, { method: 'POST', body: { index: null, values } });
      } else {
        const start = lastRow(grid) + 2 + i; // Excel row number of the first empty row
        const address = `A${start}:${colLetter(width - 1)}${start + chunk.length - 1}`;
        await graph(`${base}/worksheets/${sheetId(sheet)}/range(address='${address}')`, { method: 'PATCH', body: { values: chunk } });
      }
    }
  }
}

/** Upload a new workbook to the root of the person's OneDrive. */
export async function uploadNewWorkbook(localPath: string, fileName: string): Promise<DriveFile> {
  const token = await accessToken();
  const url = `${GRAPH}/me/drive/root:/${encodeURIComponent(fileName)}:/content?@microsoft.graph.conflictBehavior=rename`;
  const res = await FileSystem.uploadAsync(url, localPath, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': XLSX_MIME },
  });
  if (res.status >= 300) throw new Error(`Upload to OneDrive failed (${res.status}).`);
  const item = JSON.parse(res.body) as RawItem;
  const f = toFile(item);
  if (!f) throw new Error('Upload finished but the file could not be opened.');
  return f;
}
