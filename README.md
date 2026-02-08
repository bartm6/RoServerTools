# RoServerTools

**RoServerTools** is a Chrome extension for Roblox that lets you browse public servers, estimate server regions, see friends’ servers, and manually join specific servers directly from a game page.

## Features
- View **public server lists** for any Roblox game
- **Estimate server region** using connection data
- **Manually join specific servers**
- See **friends currently in servers**
- **Local server history** (stored only in your browser)

## Permissions
RoServerTools only injects UI on Roblox game pages (`https://www.roblox.com/games/*` and localized variants).

RoServerTools follows the principle of least privilege and only requests permissions needed for the features described in this README.

### Required permissions
- **`storage`** – saves local preferences and local server history.
- **`scripting`** – used by the background service worker to call Roblox’s in-page launcher APIs when you click “Join”.
- **`declarativeNetRequest`** – required for the *Compatibility Join* workflow used to fetch join-info for server region estimation and “join specific server”. RoServerTools temporarily applies a narrowly-scoped network rule only for the Roblox join-info endpoint, and removes it immediately after the request completes.

### Host access
The extension needs access to Roblox-owned endpoints to load servers, friends/presence, thumbnails, and join-info:
- `https://www.roblox.com/*` (game pages / UI injection)
- `https://games.roblox.com/*` (server lists)
- `https://users.roblox.com/*`, `https://friends.roblox.com/*`, `https://presence.roblox.com/*` (friends & presence)
- `https://thumbnails.roblox.com/*` (icons/thumbnails)
- `https://gamejoin.roblox.com/*` (join-info used for region estimation)

### Privacy
- No external analytics
- No third-party servers
- Settings and history are stored locally in your browser

## Installation
### Chrome (unpacked)
1. Download the extension files
2. Go to `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked** and select the extension folder

## Notes
- This extension is not affiliated with or endorsed by Roblox.
- Server region estimation is best-effort and may not always be accurate.

## File glossary

This project is a Chrome Extension (Manifest V3). Below is a quick map of what the main files/folders do.

### Top-level
- `manifest.json` — Chrome extension manifest (MV3). Declares permissions, scripts, and the pages the extension runs on.
- `README.md` — Project overview, features, permissions, install notes, and this glossary.
- `icon.png` — Extension icon.

### `src/`
- `background/service_worker.js` — Background service worker. Handles Roblox requests (including CSRF) and join/queue logic.
- `content/` — Content-script code injected into Roblox game pages.
- `content/main.js` — Entry point for page injection; wires panels and shared utilities.

### `src/content/*_panel/`
UI modules injected into the Roblox game page:
- `serverlist_panel/` — Public server list UI + pagination/refresh.
- `region_panel/` — Server region estimation UI/logic.
- `friends_serverlist_panel/` — Friends-in-servers UI/logic.
- `history_panel/` — Local history UI/logic (stores data in browser storage).

### `assets/`
- `assets/data/regionList.json` — Region mapping dataset used for server region estimation.

### `_locales/`
- `_locales/en/messages.json` — Localization strings (extension name/description and UI strings).
