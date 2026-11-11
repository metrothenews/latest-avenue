// Copy and settings for /analytics (owner only): Meta Ads numbers at a glance.

export const analytics = {
  title: 'Analytics',
  intro: 'Your Meta Ads numbers at a glance.',
  connectTitle: 'Connect Meta',
  accountLabel: 'Ad account',
  rangeLabel: 'Date range',
  metricLabel: 'Chart',
  topTitle: 'Top campaigns',
  topNote: 'Campaigns that ran in this period, sorted by',
  noCampaigns: 'No campaign delivered any ads in this period.',
  noData: 'No delivery in this period.',
  noAccounts: "This Facebook account doesn't manage any ad accounts.",
  back: 'Back to all campaigns',
  openInAdsManager: 'Open in Ads Manager',
  tableToggle: 'Show as a table',
  loadFailed: "Couldn't load Meta data",
  updating: 'Updating…',
}

// Meta's own date presets (whole days, in the ad account's time zone; today is not included).
export const ranges = [
  { id: 'last_7d', label: 'Past 7 days' },
  { id: 'last_14d', label: 'Past 14 days' },
  { id: 'last_28d', label: 'Past 28 days' },
  { id: 'last_90d', label: 'Past 90 days' },
]
export const defaultRange = 'last_28d'

// What the charts and totals can show. `format`: money (ad account currency), count or percent.
// `better`: which direction is good, used only to sort Top campaigns sensibly.
export const metrics = [
  { key: 'spend', label: 'Amount spent', format: 'money', better: 'high' },
  { key: 'impressions', label: 'Impressions', format: 'count', better: 'high' },
  { key: 'reach', label: 'Reach', format: 'count', better: 'high' },
  { key: 'linkClicks', label: 'Link clicks', format: 'count', better: 'high' },
  { key: 'ctr', label: 'Link click-through rate', short: 'CTR', format: 'percent', better: 'high' },
  { key: 'cpc', label: 'Cost per link click', short: 'CPC', format: 'money', better: 'low' },
  { key: 'cpm', label: 'Cost per 1,000 impressions', short: 'CPM', format: 'money', better: 'low' },
]
export const defaultMetric = 'spend'
