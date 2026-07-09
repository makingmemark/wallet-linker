# Wallet Linker Chrome Extension

Current version: `0.3.1`.

Paste a bare EVM wallet/contract address into Chrome's address bar and press Enter.

Example:

```text
0x931f6a2c2FD174115c93247c63D47E85cF319b35
```

Chrome will briefly turn that into a normal search URL. Wallet Linker watches supported search-engine URLs, detects when the search query starts with a valid `0x` EVM address, and redirects the tab to a local results page.

Optional token ID:

```text
0x931f6a2c2FD174115c93247c63D47E85cF319b35 123
```

The original omnibox shortcut still works too:

```text
wa 0x931f6a2c2FD174115c93247c63D47E85cF319b35
```

## Supported bare-address search redirects

- Google: `google.com`, `google.com.au`, `google.co.nz`, `google.co.uk`
- DuckDuckGo
- Bing
- Brave Search
- Yahoo Search
- Ecosia
- Startpage
- Kagi

If you use a different search engine, add its host permission in `manifest.json`, then add its hostname/path/query parameter in `SEARCH_ENGINES` inside `background.js`.

The extension only redirects when the search query starts with a valid EVM address: `0x` followed by 40 hex characters.

## Links generated

The results page includes links for:

- Etherscan
- EVM Now
- OpenSea collection, resolved dynamically through OpenSea's API when available
- OpenSea asset token
- OpenSea wallet/account
- Onchain Checker

## Install locally

1. Download .zip folder from Releases in sidebar and unzip (or download repo)
2. Open `chrome://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select the unzipped folder: `wallet-linker-extension`.
6. Paste a bare `0x...` address into the address bar and press Enter.

## Permissions

The extension uses:

- `storage` to store the temporary OpenSea API key locally.
- `webNavigation` so it can detect supported search URLs and redirect exact wallet-address searches.
- Search-engine host permissions for the supported search URLs listed above.
- `https://api.opensea.io/*` for the OpenSea contract lookup.

## OpenSea API behaviour

Manual mapping has been removed.

The extension calls:

```text
POST https://api.opensea.io/api/v2/auth/keys
```

on first use to create a free-tier OpenSea API key, then stores that key locally in Chrome extension storage.

It then calls:

```text
GET https://api.opensea.io/api/v2/chain/{chain}/contract/{address}
```

with the `x-api-key` header, and tries to extract the OpenSea collection slug from the response.

If OpenSea does not return a collection slug, or the API lookup fails/rate-limits, the extension still shows the non-slug links such as OpenSea asset, OpenSea wallet/account, Etherscan, EVM Now, and Onchain Checker.

The extension deliberately does **not** generate an `opensea.io/search?query=...` link, because OpenSea search URLs can redirect to an unintended collection instead of showing a neutral search result page.

Free-tier OpenSea keys expire, so the extension automatically requests a fresh key if the stored one is expired or rejected.

## Adding more links

Edit `window.LINK_TEMPLATES` in `config.js`. Available placeholders:

- `{address}`
- `{addressLower}`
- `{chain}`
- `{tokenId}`
- `{openseaSlug}`
