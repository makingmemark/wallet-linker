// Edit links here. Available template values:
// {address}, {addressLower}, {chain}, {tokenId}, {openseaSlug}
window.LINK_TEMPLATES = [
  {
    label: 'Etherscan address',
    url: 'https://etherscan.io/address/{address}'
  },
  {
    label: 'EVM Now address',
    url: 'https://evm.now/address/{address}'
  },
  {
    label: 'OpenSea collection',
    url: 'https://opensea.io/collection/{openseaSlug}',
    requiresSlug: true
  },
  {
    label: 'OpenSea asset token',
    url: 'https://opensea.io/assets/{chain}/{address}/{tokenId}'
  },
  {
    label: 'OpenSea search',
    url: 'https://opensea.io/search?query={address}'
  },
  {
    label: 'OpenSea wallet/account',
    url: 'https://opensea.io/{address}'
  },
  {
    label: 'Onchain Checker collection token',
    url: 'https://onchainchecker.xyz/collection/{chain}/{address}/1'
  },
  {
    label: 'Onchain Checker collection token (chosen token ID)',
    url: 'https://onchainchecker.xyz/collection/{chain}/{address}/{tokenId}'
  }
];
