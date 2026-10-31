// Facebook login for the Meta campaign builder (/admin/campaigns). Setup: README.md → "Meta campaign builder".

// Permissions the Graph API token needs to read campaigns, upload videos and create ads.
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
export const facebookConfigId = ''
