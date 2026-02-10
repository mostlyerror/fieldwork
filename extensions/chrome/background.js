const PICKLERADAR_URL = "https://pickleradar.app";

function openSubmit(url) {
  const submitUrl = `${PICKLERADAR_URL}/submit?url=${encodeURIComponent(url)}`;
  chrome.tabs.create({ url: submitUrl });
}

// Click the extension icon → share current tab
chrome.action.onClicked.addListener((tab) => {
  if (tab.url) openSubmit(tab.url);
});

// Right-click context menu
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "share-to-pickleradar",
    title: "Share to PickleRadar",
    contexts: ["page", "link"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "share-to-pickleradar") {
    // If right-clicked a link, use that URL; otherwise use the page URL
    const url = info.linkUrl || info.pageUrl || tab?.url;
    if (url) openSubmit(url);
  }
});
