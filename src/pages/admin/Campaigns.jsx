import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Button from '../../components/ui/Button.jsx'
import Notice from '../../components/ui/Notice.jsx'
import MetaConnect from '../../components/meta/MetaConnect.jsx'
import FolderPicker from '../../components/meta/FolderPicker.jsx'
import RunPanel from '../../components/meta/RunPanel.jsx'
import { fieldClass } from '../../components/ui/fieldStyles.js'
import { useAuth } from '../../components/auth/AuthProvider.jsx'
import { clearDriveToken, connectDrive, getDriveToken } from '../../lib/driveAuth.js'
import { fileSize, getFile, listVideos, shortDate } from '../../lib/drive.js'
import { clearMetaToken, getMetaToken } from '../../lib/metaAuth.js'
import { getCampaignTemplate, getMe, listAdAccounts, listCampaigns, templateLink, templateProblem } from '../../lib/meta.js'
import { runProgress } from '../../lib/campaignCopy.js'
import { listRuns, newRunId, saveRun } from '../../lib/campaignRuns.js'

const ACCOUNT_KEY = 'meta-account'

function Step({ n, title, done, children }) {
  return (
    <section className="glass mt-6 p-6 md:p-8">
      <h2 className="flex items-center gap-3 text-lg font-semibold">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm ${done ? 'border-white/30 bg-white/15' : 'border-white/15 text-white/60'}`}>
          {done ? '✓' : n}
        </span>
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  )
}

const statusLabel = (s) => s?.toLowerCase().replace(/_/g, ' ')
const money = (cents, currency) => (cents ? `${(Number(cents) / 100).toLocaleString()} ${currency ?? ''}`.trim() : null)

// Owner-only: copy an existing Meta campaign into a new paused one, with one ad per video
// in a Google Drive folder. Every setting comes from the template; only the video changes.
// Each copy is a saved run (Firestore) that uploads first and creates the ads later; see RunPanel.
export default function Campaigns() {
  const { user } = useAuth()
  const [params] = useSearchParams()

  // Meta connection
  const [metaToken, setMetaTokenState] = useState(getMetaToken)
  const [me, setMe] = useState(null)
  const [metaExpired, setMetaExpired] = useState(false)
  const [accounts, setAccounts] = useState([])
  const [accountId, setAccountId] = useState(() => {
    try {
      return localStorage.getItem(ACCOUNT_KEY) ?? ''
    } catch {
      return ''
    }
  })

  // Template
  const [campaigns, setCampaigns] = useState([])
  const [campaignFilter, setCampaignFilter] = useState('')
  const [campaign, setCampaign] = useState(null)
  const [template, setTemplate] = useState(null) // { adsets, ads }
  const [templateAdId, setTemplateAdId] = useState('')

  // Drive
  const [driveToken, setDriveToken] = useState(getDriveToken)
  const [folder, setFolder] = useState(null)
  const [videos, setVideos] = useState([])
  const [selected, setSelected] = useState(new Set())

  // Runs
  const [name, setName] = useState('')
  const [nameEdited, setNameEdited] = useState(false)
  const [running, setRunning] = useState(false) // saving a new run
  const [runs, setRuns] = useState(null)
  const [runsError, setRunsError] = useState('')
  const [activeRun, setActiveRun] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState('')

  const account = accounts.find((a) => a.id === accountId)
  const templateAd = template?.ads.find((a) => a.id === templateAdId)
  const problem = templateAd && templateProblem(templateAd.creative)
  const chosenVideos = videos.filter((v) => selected.has(v.id))

  function metaFailed(err) {
    if (err.kind === 'auth') {
      clearMetaToken()
      setMetaTokenState(null)
      setMetaExpired(true)
    } else setError(err.message)
  }
  function driveFailed(err) {
    if (err.kind === 'auth') {
      clearDriveToken()
      setDriveToken(null)
    } else setError(err.message)
  }

  // Saved runs.
  useEffect(() => {
    listRuns()
      .then(setRuns)
      .catch((err) => setRunsError(`Saved runs aren't available, so new runs can't start: ${err.message} First-time setup: README → Meta campaign builder → Firestore.`))
  }, [])

  // Validate a remembered token and load ad accounts.
  useEffect(() => {
    if (!metaToken) return
    let stop = false
    setLoading('accounts')
    Promise.all([me ? me : getMe(metaToken), listAdAccounts(metaToken)])
      .then(([m, list]) => {
        if (stop) return
        setMe(m)
        setAccounts(list)
        if (!list.some((a) => a.id === accountId) && list.length === 1) setAccountId(list[0].id)
      })
      .catch((err) => !stop && metaFailed(err))
      .finally(() => !stop && setLoading(''))
    return () => {
      stop = true
    }
  }, [metaToken]) // eslint-disable-line react-hooks/exhaustive-deps

  // Campaigns for the chosen account.
  useEffect(() => {
    setCampaigns([])
    setCampaign(null)
    if (!metaToken || !accountId) return
    try {
      localStorage.setItem(ACCOUNT_KEY, accountId)
    } catch {
      // ignore
    }
    let stop = false
    setLoading('campaigns')
    listCampaigns(metaToken, accountId)
      .then((list) => !stop && setCampaigns(list))
      .catch((err) => !stop && metaFailed(err))
      .finally(() => !stop && setLoading(''))
    return () => {
      stop = true
    }
  }, [metaToken, accountId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Ad sets and ads of the chosen template campaign.
  useEffect(() => {
    setTemplate(null)
    setTemplateAdId('')
    if (!campaign) return
    let stop = false
    setLoading('template')
    getCampaignTemplate(metaToken, campaign.id)
      .then((t) => {
        if (stop) return
        setTemplate(t)
        const usable = t.ads.find((a) => !templateProblem(a.creative))
        setTemplateAdId(usable?.id ?? t.ads[0]?.id ?? '')
      })
      .catch((err) => !stop && metaFailed(err))
      .finally(() => !stop && setLoading(''))
    return () => {
      stop = true
    }
  }, [campaign]) // eslint-disable-line react-hooks/exhaustive-deps

  // Folder passed from the Drive page (?folder=ID).
  useEffect(() => {
    const id = params.get('folder')
    if (!id || !driveToken || folder) return
    getFile(driveToken, id).then(setFolder).catch(driveFailed)
  }, [driveToken]) // eslint-disable-line react-hooks/exhaustive-deps

  // Videos in the chosen folder.
  useEffect(() => {
    setVideos([])
    setSelected(new Set())
    if (!folder || !driveToken) return
    let stop = false
    setLoading('videos')
    listVideos(driveToken, folder.id)
      .then((list) => {
        if (stop) return
        setVideos(list)
        setSelected(new Set(list.map((v) => v.id)))
      })
      .catch((err) => !stop && driveFailed(err))
      .finally(() => !stop && setLoading(''))
    return () => {
      stop = true
    }
  }, [folder, driveToken]) // eslint-disable-line react-hooks/exhaustive-deps

  // Default name: "<template campaign> — <folder>", until the user edits it.
  useEffect(() => {
    if (!nameEdited && campaign && folder) setName(`${campaign.name} — ${folder.name}`)
  }, [campaign, folder, nameEdited])

  const filteredCampaigns = useMemo(() => {
    const q = campaignFilter.trim().toLowerCase()
    return q ? campaigns.filter((c) => c.name.toLowerCase().includes(q)) : campaigns
  }, [campaigns, campaignFilter])

  async function handleConnectDrive() {
    setError('')
    try {
      setDriveToken(await connectDrive())
    } catch (err) {
      if (!['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(err.code)) {
        setError(err.code === 'auth/user-mismatch' ? `Pick ${user.email} in the Google popup.` : `Couldn't connect to Drive (${err.code ?? err.message}).`)
      }
    }
  }

  function toggleVideo(id) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const ready = metaToken && account && campaign && template?.adsets.length && templateAd && !problem && folder && chosenVideos.length && name.trim()
  const adCount = (template?.adsets.length ?? 0) * chosenVideos.length

  // Saves the choices as a new run and opens it, ready to upload.
  async function handleCreate() {
    setError('')
    setRunning(true)
    const run = {
      id: newRunId(),
      createdAt: new Date().toISOString(),
      name: name.trim(),
      accountId,
      accountName: account.name,
      campaign: { id: campaign.id, name: campaign.name },
      adsets: template.adsets.map((a) => ({ id: a.id, name: a.name })),
      templateAdJson: JSON.stringify(templateAd),
      folder: { id: folder.id, name: folder.name },
      videos: chosenVideos.map((v) => ({ driveId: v.id, name: v.name, size: v.size ?? null, md5: v.md5Checksum ?? null, adIds: {} })),
    }
    try {
      await saveRun(run)
      setRuns((list) => [run, ...(list ?? [])])
      setActiveRun(run)
      setCampaign(null)
      setFolder(null)
      setNameEdited(false)
    } catch (err) {
      setError(`Couldn't save the run: ${err.message}`)
    } finally {
      setRunning(false)
    }
  }

  const updateRun = (run) => setRuns((list) => list?.map((r) => (r.id === run.id ? JSON.parse(JSON.stringify(run)) : r)))

  return (
    <div className="max-w-4xl">
      <h1 className="text-4xl font-extrabold tracking-tight">New Meta campaign</h1>
      <p className="mt-3 text-white/60">
        Copy an existing campaign with identical settings and add one ad per video from a Drive folder. Everything is created <b className="text-white">paused</b>.
      </p>

      <Step n={1} title="Connect Meta" done={Boolean(metaToken && me)}>
        {metaToken ? (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="text-white/70">{me ? <>Connected as <span className="text-white">{me.name}</span></> : 'Checking…'}</span>
            <Button variant="secondary" onClick={() => { clearMetaToken(); setMetaTokenState(null); setMe(null); setAccounts([]) }} disabled={running}>Disconnect</Button>
          </div>
        ) : (
          <MetaConnect expired={metaExpired} onConnect={({ token, me: m }) => { setMe(m); setMetaExpired(false); setMetaTokenState(token) }} />
        )}
        {metaToken && me && (
          <div className="mt-5">
            <label htmlFor="ad-account" className="mb-1.5 block text-sm text-white/70">Ad account</label>
            <select id="ad-account" value={accountId} onChange={(e) => setAccountId(e.target.value)} className={fieldClass()} disabled={running}>
              <option value="" className="bg-neutral-900">Choose an ad account…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id} className="bg-neutral-900">{a.name} ({a.account_id}, {a.currency})</option>
              ))}
            </select>
            {loading === 'accounts' && <p className="mt-2 text-sm text-white/40">Loading ad accounts…</p>}
          </div>
        )}
      </Step>

      {runsError && <Notice>{runsError}</Notice>}

      {activeRun ? (
        <>
          <button type="button" onClick={() => setActiveRun(null)} className="mt-6 text-sm text-white/50 hover:text-white">← All runs and new campaign</button>
          <RunPanel
            key={activeRun.id}
            run={activeRun}
            metaToken={metaToken}
            driveToken={driveToken}
            onConnectDrive={handleConnectDrive}
            onChange={updateRun}
            onDeleted={(id) => { setRuns((list) => list.filter((r) => r.id !== id)); setActiveRun(null) }}
            onAuthError={metaFailed}
          />
        </>
      ) : (
      <>
      {runs?.length > 0 && (
        <section className="glass mt-6 p-6 md:p-8">
          <h2 className="text-lg font-semibold">Saved runs</h2>
          <ul className="mt-4 divide-y divide-white/5 rounded-xl border border-white/10">
            {runs.map((r) => {
              const p = runProgress(r)
              return (
                <li key={r.id}>
                  <button type="button" onClick={() => setActiveRun(r)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-white/[0.05]">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{r.name}</span>
                      <span className="block text-white/40">{r.accountName} · {shortDate(r.updatedAt)}</span>
                    </span>
                    <span className="shrink-0 text-white/60">
                      {p.complete ? 'Done' : p.toUpload ? `${p.uploaded} of ${r.videos.length} uploaded` : `${p.adsMade} of ${p.adsTotal} ads`}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {account && (
        <Step n={2} title="Template campaign" done={Boolean(campaign)}>
          {campaign ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">{campaign.name}</p>
                <p className="text-sm text-white/50">{statusLabel(campaign.objective)} · {statusLabel(campaign.effective_status)}</p>
              </div>
              <Button variant="secondary" onClick={() => setCampaign(null)} disabled={running}>Change</Button>
            </div>
          ) : (
            <>
              <label htmlFor="campaign-filter" className="sr-only">Filter campaigns</label>
              <input id="campaign-filter" type="search" value={campaignFilter} onChange={(e) => setCampaignFilter(e.target.value)} placeholder="Filter campaigns…" autoComplete="off" className={fieldClass()} />
              <ul className="mt-3 max-h-80 overflow-y-auto rounded-xl border border-white/10">
                {filteredCampaigns.map((c) => (
                  <li key={c.id} className="border-b border-white/5 last:border-0">
                    <button type="button" onClick={() => setCampaign(c)} className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-white/[0.05]">
                      <span className="truncate">{c.name}</span>
                      <span className="shrink-0 text-xs text-white/40">{statusLabel(c.effective_status)}</span>
                    </button>
                  </li>
                ))}
                {loading === 'campaigns' && <li className="px-4 py-6 text-center text-sm text-white/40">Loading campaigns…</li>}
                {loading !== 'campaigns' && !filteredCampaigns.length && <li className="px-4 py-6 text-center text-sm text-white/40">No campaigns found.</li>}
              </ul>
            </>
          )}

          {campaign && loading === 'template' && <p className="mt-4 text-sm text-white/40">Loading ad sets and ads…</p>}
          {template && (
            <div className="mt-6 space-y-6">
              <div>
                <p className="text-sm font-semibold">Ad sets to copy ({template.adsets.length})</p>
                {template.adsets.length ? (
                  <ul className="mt-2 space-y-1 text-sm text-white/60">
                    {template.adsets.map((a) => (
                      <li key={a.id}>
                        {a.name}
                        <span className="text-white/40">
                          {' · '}{statusLabel(a.status)}
                          {money(a.daily_budget, account.currency) && ` · ${money(a.daily_budget, account.currency)}/day`}
                          {money(a.lifetime_budget, account.currency) && ` · ${money(a.lifetime_budget, account.currency)} lifetime`}
                          {a.end_time && new Date(a.end_time) < new Date() && ' · ends in the past: copy may fail, edit its end date in Ads Manager first'}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : <Notice>This campaign has no ad sets to copy.</Notice>}
              </div>
              <fieldset>
                <legend className="text-sm font-semibold">Template ad: text, headline, link and call to action to reuse</legend>
                <div className="mt-2 grid gap-2">
                  {template.ads.map((a) => {
                    const why = templateProblem(a.creative)
                    return (
                      <label key={a.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${templateAdId === a.id ? 'border-white/30 bg-white/[0.06]' : 'border-white/10 hover:border-white/20'}`}>
                        <input type="radio" name="template-ad" value={a.id} checked={templateAdId === a.id} onChange={() => setTemplateAdId(a.id)} className="mt-1" disabled={running} />
                        {a.creative?.thumbnail_url && <img src={a.creative.thumbnail_url} alt="" referrerPolicy="no-referrer" className="h-12 w-12 shrink-0 rounded-lg object-cover" />}
                        <span className="min-w-0 text-sm">
                          <span className="block truncate font-medium">{a.name}</span>
                          <span className="block truncate text-white/50">{a.creative?.body || a.creative?.title || a.creative?.name}</span>
                          {why && <span className="block text-amber-200/80">{why}</span>}
                          {!why && a.creative && (templateLink(a.creative)
                            ? <span className="block truncate text-white/40">Link: {templateLink(a.creative)}</span>
                            : <span className="block text-amber-200/80">No destination link found in this ad. If Meta asks for one, pick another ad or send the details below.</span>)}
                        </span>
                      </label>
                    )
                  })}
                  {!template.ads.length && <Notice>This campaign has no ads to use as a template.</Notice>}
                </div>
              </fieldset>
              {templateAd && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-white/50 hover:text-white">Show template ad details (for troubleshooting)</summary>
                  <div className="mt-2 flex justify-end">
                    <button type="button" className="text-xs text-white/50 hover:text-white" onClick={() => navigator.clipboard?.writeText(JSON.stringify(templateAd, null, 2))}>Copy</button>
                  </div>
                  <pre className="mt-1 max-h-80 overflow-auto rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-white/70">{JSON.stringify(templateAd, null, 2)}</pre>
                </details>
              )}
            </div>
          )}
        </Step>
      )}

      {templateAd && (
        <Step n={3} title="Videos from Google Drive" done={Boolean(folder && chosenVideos.length)}>
          {!driveToken ? (
            <div>
              <p className="text-sm text-white/60">Connect {user.email}'s Drive to pick a folder of videos.</p>
              <Button className="mt-4" onClick={handleConnectDrive} disabled={running}>Connect Drive</Button>
            </div>
          ) : !folder ? (
            <FolderPicker token={driveToken} onPick={setFolder} onError={driveFailed} />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-medium">📁 {folder.name}</p>
                <Button variant="secondary" onClick={() => setFolder(null)} disabled={running}>Change folder</Button>
              </div>
              {loading === 'videos' && <p className="mt-4 text-sm text-white/40">Loading videos…</p>}
              {loading !== 'videos' && !videos.length && <Notice>No videos directly inside this folder.</Notice>}
              {videos.length > 0 && (
                <>
                  <div className="mt-4 flex items-center justify-between text-sm text-white/50">
                    <span>{chosenVideos.length} of {videos.length} videos selected</span>
                    <button type="button" className="hover:text-white" disabled={running} onClick={() => setSelected(selected.size === videos.length ? new Set() : new Set(videos.map((v) => v.id)))}>
                      {selected.size === videos.length ? 'Select none' : 'Select all'}
                    </button>
                  </div>
                  <ul className="mt-2 max-h-80 overflow-y-auto rounded-xl border border-white/10">
                    {videos.map((v) => (
                      <li key={v.id} className="border-b border-white/5 last:border-0">
                        <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm hover:bg-white/[0.04]">
                          <input type="checkbox" checked={selected.has(v.id)} onChange={() => toggleVideo(v.id)} disabled={running} />
                          <span className="min-w-0 flex-1 truncate">{v.name}</span>
                          <span className="shrink-0 text-white/40">{fileSize(v.size)}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </Step>
      )}

      {templateAd && folder && chosenVideos.length > 0 && (
        <Step n={4} title="Review and start">
          <label htmlFor="campaign-name" className="mb-1.5 block text-sm text-white/70">New campaign name</label>
          <input id="campaign-name" value={name} onChange={(e) => { setName(e.target.value); setNameEdited(true) }} className={fieldClass()} disabled={running} />
          <ul className="mt-5 space-y-1 text-sm text-white/70">
            <li>1 campaign copied from “{campaign.name}”, paused</li>
            <li>{template.adsets.length} ad set{template.adsets.length === 1 ? '' : 's'} copied with identical targeting, budget and schedule, paused</li>
            <li>{chosenVideos.length} video{chosenVideos.length === 1 ? '' : 's'} uploaded to {account.name}</li>
            <li>{adCount} ad{adCount === 1 ? '' : 's'} named after each video, copying “{templateAd.name}” except the video, paused</li>
          </ul>
          <p className="mt-5 text-sm text-white/50">
            Next you upload the videos (videos already in this ad account are reused). Once they're uploaded you can close this page:
            Meta processes them on its own, and you create the campaign and ads later from Saved runs, on any device.
          </p>
          {problem && <Notice>{problem}</Notice>}
          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={handleCreate} disabled={!ready || running || Boolean(runsError)}>{running ? 'Saving…' : 'Save run and continue'}</Button>
          </div>
        </Step>
      )}
      </>
      )}

      <Notice>{error}</Notice>
    </div>
  )
}
