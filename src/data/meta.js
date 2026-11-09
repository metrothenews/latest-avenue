// Facebook login for the Meta campaign builder (/admin/campaigns). Setup: README.md → "Meta campaign builder".

// The Meta app the login goes through (App settings → Basic → App ID). Not secret.
export const facebookAppId = '1761272091762214'

// Permissions the Graph API token needs to read campaigns, upload videos and create ads.
// With a configuration ID (below) the configuration's own list is used instead.
export const metaPermissions = [
  'ads_management',
  'ads_read',
  'business_management',
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_ads',
]

// Only for "Facebook Login for Business": the Configuration ID listing the permissions above.
// Leave empty if the Meta app uses classic "Facebook Login" (permissions are requested directly).
export const facebookConfigId = '1821308708887958'

// Pixel events always offered in the conversion event dropdown, even if the pixel hasn't fired them
// in the 30 days before its event list was fetched. These are the custom events Feature.fm sends
// to a Meta pixel: https://help.feature.fm/articles/360042872852
export const knownPixelEvents = [
  'FeatureFM',
  'FeatureFM_pageview',
  'FeatureFM_click',
  'FeatureFM_preview',
  'FeatureFM_pre_save',
  'FeatureFM_save',
  'FeatureFM_follow',
  'FeatureFM_postaction',
]
