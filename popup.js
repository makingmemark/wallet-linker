document.querySelector('#open-empty').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('results.html') });
});
