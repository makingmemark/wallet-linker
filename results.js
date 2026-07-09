const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const OPENSEA_KEY_STORAGE = 'walletLinkerOpenSeaApiKey';
const OPENSEA_KEY_REFRESH_BUFFER_MS = 24 * 60 * 60 * 1000;

const addressInput = document.querySelector('#address');
const tokenInput = document.querySelector('#token-id');
const chainInput = document.querySelector('#chain');
const statusEl = document.querySelector('#status');
const linksEl = document.querySelector('#links');
const template = document.querySelector('#link-row-template');
const refreshButton = document.querySelector('#refresh');
const copyAllButton = document.querySelector('#copy-all');

function getParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    address: params.get('address') || '',
    tokenId: params.get('tokenId') || '1',
    chain: params.get('chain') || 'ethereum'
  };
}

function normalizeAddress(value) {
  const match = String(value || '').match(/0x[a-fA-F0-9]{40}/);
  return match ? match[0] : '';
}

function buildUrl(templateUrl, values) {
  return templateUrl
    .replaceAll('{address}', values.address)
    .replaceAll('{addressLower}', values.addressLower)
    .replaceAll('{chain}', values.chain)
    .replaceAll('{tokenId}', values.tokenId)
    .replaceAll('{openseaSlug}', values.openseaSlug || '');
}

function getGeneratedLinks(address, tokenId, chain, openseaSlug = '') {
  const addressLower = address.toLowerCase();
  const values = { address, addressLower, chain, tokenId, openseaSlug };

  return (window.LINK_TEMPLATES || [])
    .filter((item) => !item.requiresSlug || openseaSlug)
    .map((item) => ({
      label: item.label,
      url: buildUrl(item.url, values)
    }));
}

function renderLinks(links) {
  linksEl.textContent = '';

  links.forEach(({ label, url }) => {
    const row = template.content.cloneNode(true);
    const h3 = row.querySelector('h3');
    const a = row.querySelector('a');
    const button = row.querySelector('button');

    h3.textContent = label;
    a.href = url;
    a.textContent = url;
    button.addEventListener('click', () => copyText(url, button));
    linksEl.appendChild(row);
  });
}

async function chromeStorageGet(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => resolve(result[key]));
  });
}

async function chromeStorageSet(value) {
  return new Promise((resolve) => {
    chrome.storage.local.set(value, resolve);
  });
}

function storedKeyIsValid(record) {
  if (!record?.apiKey) return false;
  if (!record.expiresAt) return true;

  const expiresAt = new Date(record.expiresAt).getTime();
  if (Number.isNaN(expiresAt)) return true;

  return Date.now() < expiresAt - OPENSEA_KEY_REFRESH_BUFFER_MS;
}

async function createOpenSeaApiKey() {
  const response = await fetch('https://api.opensea.io/api/v2/auth/keys', {
    method: 'POST',
    headers: { accept: 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`OpenSea key request failed: ${response.status}`);
  }

  const data = await response.json();
  if (!data.api_key) {
    throw new Error('OpenSea did not return an API key.');
  }

  const record = {
    apiKey: data.api_key,
    expiresAt: data.expires_at || null,
    createdAt: new Date().toISOString()
  };

  await chromeStorageSet({ [OPENSEA_KEY_STORAGE]: record });
  return record.apiKey;
}

async function getOpenSeaApiKey({ forceRefresh = false } = {}) {
  if (!forceRefresh) {
    const stored = await chromeStorageGet(OPENSEA_KEY_STORAGE);
    if (storedKeyIsValid(stored)) return stored.apiKey;
  }

  return createOpenSeaApiKey();
}

function findOpenSeaSlug(value, depth = 0, seen = new Set()) {
  if (!value || depth > 6) return '';
  if (seen.has(value)) return '';

  if (typeof value !== 'object') return '';
  seen.add(value);

  const directKeys = ['slug', 'collection_slug', 'collectionSlug'];
  for (const key of directKeys) {
    if (typeof value[key] === 'string' && value[key].trim()) return value[key].trim();
  }

  if (typeof value.collection === 'string' && value.collection.trim()) {
    return value.collection.trim();
  }

  const preferredObjects = ['collection', 'primary_collection', 'primaryCollection', 'contract', 'nft'];
  for (const key of preferredObjects) {
    const slug = findOpenSeaSlug(value[key], depth + 1, seen);
    if (slug) return slug;
  }

  for (const child of Object.values(value)) {
    const slug = findOpenSeaSlug(child, depth + 1, seen);
    if (slug) return slug;
  }

  return '';
}

async function resolveOpenSeaSlug(address, chain) {
  const apiKey = await getOpenSeaApiKey();
  const url = `https://api.opensea.io/api/v2/chain/${encodeURIComponent(chain)}/contract/${encodeURIComponent(address)}`;

  let response = await fetch(url, {
    headers: {
      accept: 'application/json',
      'x-api-key': apiKey
    }
  });

  if (response.status === 401 || response.status === 403) {
    const refreshedKey = await getOpenSeaApiKey({ forceRefresh: true });
    response = await fetch(url, {
      headers: {
        accept: 'application/json',
        'x-api-key': refreshedKey
      }
    });
  }

  if (response.status === 404) return '';

  if (!response.ok) {
    throw new Error(`OpenSea contract lookup failed: ${response.status}`);
  }

  const data = await response.json();
  return findOpenSeaSlug(data);
}

async function copyText(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    if (button) {
      const original = button.textContent;
      button.textContent = 'Copied';
      setTimeout(() => { button.textContent = original; }, 900);
    }
  } catch (err) {
    statusEl.textContent = 'Could not copy to clipboard. You may need to copy manually.';
  }
}

async function render() {
  const address = normalizeAddress(addressInput.value);
  const tokenId = String(tokenInput.value || '1').trim() || '1';
  const chain = chainInput.value || 'ethereum';
  linksEl.textContent = '';

  if (!EVM_ADDRESS_RE.test(address)) {
    statusEl.textContent = 'Paste a valid EVM address: 0x followed by 40 hex characters.';
    return;
  }

  addressInput.value = address;
  tokenInput.value = tokenId;
  statusEl.textContent = `Generated base links for ${address}. Resolving OpenSea collection…`;
  renderLinks(getGeneratedLinks(address, tokenId, chain));

  try {
    const slug = await resolveOpenSeaSlug(address, chain);
    renderLinks(getGeneratedLinks(address, tokenId, chain, slug));

    if (slug) {
      statusEl.textContent = `Generated links for ${address}. OpenSea collection resolved: ${slug}`;
    } else {
      statusEl.textContent = `Generated links for ${address}. OpenSea did not return a collection slug for this contract.`;
    }
  } catch (err) {
    console.warn(err);
    statusEl.textContent = `Generated links for ${address}. OpenSea API lookup failed, so collection slug link was skipped.`;
  }
}

function init() {
  const { address, tokenId, chain } = getParams();
  addressInput.value = address;
  tokenInput.value = tokenId;
  if ([...chainInput.options].some((option) => option.value === chain)) {
    chainInput.value = chain;
  }

  refreshButton.addEventListener('click', render);
  addressInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') render();
  });
  tokenInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') render();
  });
  chainInput.addEventListener('change', render);
  copyAllButton.addEventListener('click', () => {
    const links = Array.from(linksEl.querySelectorAll('a')).map((a) => a.href);
    copyText(links.join('\n'), copyAllButton);
  });
  render();
}

init();
