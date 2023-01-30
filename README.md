[![GitHub release (latest by date)](https://img.shields.io/github/v/release/mgziminsky/FacebookTrackingRemoval?logo=github)](https://github.com/mgziminsky/FacebookTrackingRemoval/releases/latest)
[![GitHub release (latest by date)](https://img.shields.io/github/downloads/mgziminsky/FacebookTrackingRemoval/latest/total)](https://github.com/mgziminsky/FacebookTrackingRemoval/releases/latest)
[![GitHub release (total)](https://img.shields.io/github/downloads/mgziminsky/FacebookTrackingRemoval/total)](https://github.com/mgziminsky/FacebookTrackingRemoval/releases)

[![Mozilla Add-on](https://img.shields.io/amo/v/facebook-tracking-removal.svg?logo=firefoxbrowser)](https://addons.mozilla.org/addon/facebook-tracking-removal?src=external-github)
[![Mozilla Add-on](https://img.shields.io/amo/d/facebook-tracking-removal.svg)](https://addons.mozilla.org/addon/facebook-tracking-removal?src=external-github)
[![Mozilla Add-on](https://img.shields.io/amo/users/facebook-tracking-removal.svg)](https://addons.mozilla.org/addon/facebook-tracking-removal?src=external-github)
[![Mozilla Add-on](https://img.shields.io/amo/stars/facebook-tracking-removal.svg)](https://addons.mozilla.org/addon/facebook-tracking-removal/reviews?src=external-github)

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/ldeofbdmhnnocclkaddcnamhbhanaiaj.svg?logo=googlechrome)](https://chrome.google.com/webstore/detail/facebook-tracking-ad-remo/ldeofbdmhnnocclkaddcnamhbhanaiaj)
[![Chrome Web Store](https://img.shields.io/chrome-web-store/users/ldeofbdmhnnocclkaddcnamhbhanaiaj.svg)](https://chrome.google.com/webstore/detail/facebook-tracking-ad-remo/ldeofbdmhnnocclkaddcnamhbhanaiaj)
[![Chrome Web Store](https://img.shields.io/chrome-web-store/rating-count/ldeofbdmhnnocclkaddcnamhbhanaiaj.svg)](https://chrome.google.com/webstore/detail/facebook-tracking-ad-remo/ldeofbdmhnnocclkaddcnamhbhanaiaj)
[![Chrome Web Store](https://img.shields.io/chrome-web-store/stars/ldeofbdmhnnocclkaddcnamhbhanaiaj.svg)](https://chrome.google.com/webstore/detail/facebook-tracking-ad-remo/ldeofbdmhnnocclkaddcnamhbhanaiaj)


# Facebook™ Tracking & Ad Removal
Removes Ads and the user interaction tracking from content on Facebook™.
Modified elements can optionally have a custom CSS style applied to them so that cleaned items can be more easily identified.

For links, the event listeners on the link and its parents are removed and/or disabled and a proper href is set on the link.

For videos on mobile, all Facebook™ event-listeners and custom controls are removed, and the video is simplified into just the bare HTML5 video tag.

## Explanation of permissions: ![GitHub manifest.json dynamic](https://img.shields.io/github/manifest-json/permissions/mgziminsky/FacebookTrackingRemoval?label=Permissions)
- Access to facebook.com, messenger.com, and facebookwkhpilnemxj7asaniu7vnjjbiltxjqhye3mhbshg7kx5tfyd.onion is needed for main functionality, in order to work on those pages.
- Access to mgziminsky.gitlab.io, more specifically https://mgziminsky.gitlab.io/FacebookTrackingRemoval/*, is used to download blocking rules only
- `webNavigation`: Needed to handle cleaning FB interactions that use the browser history API instead of doing a normal page navigation
  - Firefox: "Access browser activity during navigation"
  - Chrome: "Read your browsing history"
    - This is misleading. See [here](https://github.com/mgziminsky/FacebookTrackingRemoval/issues/67#issuecomment-1346953059)

## Privacy Policy
I don't, and never will, collect or send any data to myself or any third parties
