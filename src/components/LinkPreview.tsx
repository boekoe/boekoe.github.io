import { ExternalLink, Link as LinkIcon } from 'lucide-react'
import type { Post } from '../types'
import { Avatar } from './ui'

const URL_PATTERN = /https?:\/\/[^\s<]+/gi

function cleanUrl(value: string) {
  return value.replace(/[),.!?;:'\"]+$/, '')
}

export function firstUrl(text: string) {
  const match = text.match(URL_PATTERN)?.[0]
  return match ? cleanUrl(match) : ''
}

export function LinkifiedText({ text }: { text: string }) {
  const parts: Array<string | { url: string }> = []
  let cursor = 0
  for (const match of text.matchAll(URL_PATTERN)) {
    const raw = match[0]
    const url = cleanUrl(raw)
    const index = match.index || 0
    if (index > cursor) parts.push(text.slice(cursor, index))
    parts.push({ url })
    if (url.length < raw.length) parts.push(raw.slice(url.length))
    cursor = index + raw.length
  }
  if (cursor < text.length) parts.push(text.slice(cursor))
  return <>{parts.map((part, index) => typeof part === 'string' ? part : <a className="inline-link" href={part.url} target="_blank" rel="noreferrer" key={`${part.url}-${index}`}>{part.url}</a>)}</>
}

function boekoePostId(url: URL) {
  const ownHost = url.origin === window.location.origin || url.hostname === 'boekoe.github.io'
  if (!ownHost) return ''
  const match = url.hash.match(/^#\/post\/([^/]+)/)
  if (!match) return ''
  try { return decodeURIComponent(match[1]) } catch { return match[1] }
}

function readablePath(path: string) {
  try { return decodeURIComponent(path).replace(/\/$/, '') } catch { return path.replace(/\/$/, '') }
}

export function LinkPreview({ text, posts, currentPostId }: { text: string; posts: Post[]; currentPostId?: string }) {
  const value = firstUrl(text)
  if (!value) return null
  let url: URL
  try { url = new URL(value) } catch { return null }

  const postId = boekoePostId(url)
  const linkedPost = postId && postId !== currentPostId ? posts.find((post) => post.id === postId) : undefined
  if (linkedPost) return <a className="link-preview internal-preview" href={`#/post/${encodeURIComponent(linkedPost.id)}/comments`}>
    <div className="preview-author"><Avatar profile={linkedPost.author} size={36} /><div><strong>{linkedPost.author.fullName}</strong><small>@{linkedPost.author.username} · Gedeeld bericht</small></div></div>
    {linkedPost.body && <p>{linkedPost.body}</p>}
    {linkedPost.imageUrl && <img src={linkedPost.imageUrl} alt={`Afbeelding van ${linkedPost.author.fullName}`} loading="lazy" />}
    <span className="preview-open"><LinkIcon /> Bekijk volledig bericht</span>
  </a>

  return <a className="link-preview external-preview" href={url.toString()} target="_blank" rel="noreferrer">
    <span className="external-preview-icon"><ExternalLink /></span>
    <div><strong>{url.hostname.replace(/^www\./, '')}</strong><span>{url.pathname === '/' ? 'Open deze link' : readablePath(url.pathname)}</span><small>{url.toString()}</small></div>
  </a>
}
