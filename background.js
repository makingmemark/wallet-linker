const EVM_ADDRESS_RE = /0x[a-fA-F0-9]{40}/;
const EVM_ADDRESS_AT_START_RE = /^\s*(0x[a-fA-F0-9]{40})\b/;

const SEARCH_QUERY_PARAM_CANDIDATES = ['q', 'query', 'p'];

const SEARCH_ENGINES = [
  {
    name: 'Google',
    hostnames: ['www.google.com', 'www.google.com.au', 'www.google.co.nz', 'www.google.co.uk'],
    paths: ['/search'],
    params: ['q']
  },
  {
    name: 'DuckDuckGo',
    hostnames: ['duckduckgo.com'],
    paths: ['/'],
    params: ['q']
  },
  {
    name: 'Bing',
    hostnames: ['www.bing.com'],
    paths: ['/search'],
    params: ['q']
  },
  {
    name: 'Brave Search',
    hostnames: ['search.brave.com'],
    paths: ['/search'],
    params: ['q']
  },
  {
    name: 'Yahoo',
    hostnames: ['search.yahoo.com'],
    paths: ['/search'],
    params: ['p']
  },
  {
    name: 'Ecosia',
    hostnames: ['www.ecosia.org'],
    paths: ['/search'],
    params: ['q']
  },
  {
    name: 'Startpage',
    hostnames: ['www.startpage.com'],
    paths: ['/sp/search', '/do/search', '/search'],
    params: ['query', 'q']
  },
  {
    name: 'Kagi',
    hostnames: ['kagi.com'],
    paths: ['/search'],
    params: ['q']
  }
];

function extractWalletInput(text = '') {
  const addressMatch = text.match(EVM_ADDRESS_RE);
  const address = addressMatch ? addressMatch[0] : '';

  // Optional token id support: `wa 0xabc... 123` or search `0xabc... 123`.
  // Defaults to 1 because some NFT tools need a token ID in the URL.
  const afterAddress = address ? text.slice(text.indexOf(address) + address.length) : text;
  const tokenMatch = afterAddress.match(/(?:^|\s|\/)(\d+)(?:\s|$)/);
  const tokenId = tokenMatch ? tokenMatch[1] : '1';

  return { address, tokenId };
}

function buildResultsUrl(text) {
  const { address, tokenId } = extractWalletInput(text);
  return chrome.runtime.getURL(
    `results.html?address=${encodeURIComponent(address)}&tokenId=${encodeURIComponent(tokenId)}`
  );
}

function openResultsPage(text) {
  chrome.tabs.create({ url: buildResultsUrl(text) });
}

function pathMatches(pathname, allowedPaths) {
  return allowedPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function getSearchQueryFromUrl(url) {
  let parsed;

  try {
    parsed = new URL(url);
  } catch (err) {
    return '';
  }

  const engine = SEARCH_ENGINES.find((candidate) => (
    candidate.hostnames.includes(parsed.hostname) && pathMatches(parsed.pathname, candidate.paths)
  ));

  if (!engine) return '';

  const params = engine.params || SEARCH_QUERY_PARAM_CANDIDATES;
  for (const param of params) {
    const value = parsed.searchParams.get(param);
    if (value) return value;
  }

  return '';
}

function getWalletQueryFromSearchUrl(url) {
  const query = getSearchQueryFromUrl(url);
  if (!query) return '';

  const addressMatch = query.match(EVM_ADDRESS_AT_START_RE);
  if (!addressMatch) return '';

  return query;
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.omnibox.setDefaultSuggestion({
    description: 'Paste an EVM wallet/contract address, e.g. 0x931f6a2c2FD174115c93247c63D47E85cF319b35'
  });
});

chrome.omnibox.onInputChanged.addListener((text, suggest) => {
  const { address, tokenId } = extractWalletInput(text);

  if (!address) {
    suggest([
      {
        content: text,
        description: 'Paste a valid EVM address: 0x followed by 40 hex characters'
      }
    ]);
    return;
  }

  suggest([
    {
      content: `${address} ${tokenId}`,
      description: `Open Wallet Linker for ${address} · token ${tokenId}`
    },
    {
      content: address,
      description: `Open Wallet Linker for ${address} · default token 1`
    }
  ]);
});

chrome.omnibox.onInputEntered.addListener((text) => {
  openResultsPage(text);
});

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId !== 0 || details.tabId < 0) return;

  const walletQuery = getWalletQueryFromSearchUrl(details.url);
  if (!walletQuery) return;

  chrome.tabs.update(details.tabId, { url: buildResultsUrl(walletQuery) });
});
