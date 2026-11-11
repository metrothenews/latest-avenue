// Read-only Meta Ads insights for /analytics: totals, a value per day, and per-campaign numbers.
// Reference: https://developers.facebook.com/docs/marketing-api/insights
import { graphGet } from './meta.js'

const FIELDS = 'spend,impressions,reach,inline_link_clicks'

// Meta's numbers in a common shape, plus the ratios worked out from them (null when undefined,
// e.g. cost per click with no clicks). Money is in the ad account's currency units.
function shape(row = {}) {
  const spend = Number(row.spend ?? 0)
  const impressions = Number(row.impressions ?? 0)
  const linkClicks = Number(row.inline_link_clicks ?? 0)
  return {
    spend,
    impressions,
    reach: Number(row.reach ?? 0),
    linkClicks,
    ctr: impressions ? (linkClicks / impressions) * 100 : null,
    cpc: linkClicks ? spend / linkClicks : null,
    cpm: impressions ? (spend / impressions) * 1000 : null,
  }
}

async function allPages(token, path, params) {
  const rows = []
  let page = await graphGet(token, path, { limit: 500, ...params })
  while (true) {
    rows.push(...(page.data ?? []))
    if (!page.paging?.cursors?.after || !page.paging?.next || rows.length >= 5000) return rows
    page = await graphGet(token, path, { limit: 500, ...params, after: page.paging.cursors.after })
  }
}

const day = (iso) => new Date(`${iso}T00:00:00`)
const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Every day from `since` to `until` (YYYY-MM-DD), so days with no delivery show as zero
// (Meta leaves them out).
function fillDays(rows, since, until) {
  const byDate = new Map(rows.map((r) => [r.date_start, r]))
  const days = []
  for (let d = day(since); d <= day(until); d.setDate(d.getDate() + 1)) {
    const date = isoDay(d)
    days.push({ date: day(date), ...shape(byDate.get(date)) })
  }
  return days
}

// Totals and one entry per day for an ad account (act_…) or a campaign, over `range` (a date preset).
// Totals come from Meta directly, because reach can't be added up across days.
export async function getOverview(token, objectId, range) {
  const [totalRows, dailyRows] = await Promise.all([
    allPages(token, `${objectId}/insights`, { date_preset: range, fields: `${FIELDS},date_start,date_stop` }),
    allPages(token, `${objectId}/insights`, { date_preset: range, time_increment: 1, fields: FIELDS }),
  ])
  const total = totalRows[0]
  // With no delivery at all Meta returns no rows, so the period's dates are unknown: no chart.
  const days = total ? fillDays(dailyRows, total.date_start, total.date_stop) : []
  return { totals: shape(total), days, since: total?.date_start ?? null, until: total?.date_stop ?? null }
}

// Every campaign in the ad account that delivered in `range`, with its numbers.
export async function getCampaignRows(token, accountId, range) {
  const rows = await allPages(token, `${accountId}/insights`, {
    level: 'campaign',
    date_preset: range,
    fields: `campaign_id,campaign_name,${FIELDS}`,
  })
  return rows.map((r) => ({ id: r.campaign_id, name: r.campaign_name, ...shape(r) }))
}

export const getCampaign = (token, campaignId) =>
  graphGet(token, campaignId, { fields: 'id,name,effective_status,objective' })
