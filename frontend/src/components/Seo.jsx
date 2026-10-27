import { useEffect } from 'react'

const SITE = __SITE_URL__
const DEFAULT_TITLE = 'Ma’at – Online judge for C++ and Python'
const DEFAULT_DESCRIPTION =
  'Ma’at is an online judge. Solve programming problems in C++ and Python, get a verdict in seconds, and compete in timed contests with live standings.'

// Reuses the tag if index.html already has it, so a page never ends up with two descriptions
const setTag = (selector, create, value, attribute = 'content') => {
  let tag = document.head.querySelector(selector)
  if (!tag) {
    tag = create()
    document.head.appendChild(tag)
  }
  tag.setAttribute(attribute, value)
}

const meta = (key, value, by = 'name') =>
  setTag(
    `meta[${by}="${key}"]`,
    () => {
      const el = document.createElement('meta')
      el.setAttribute(by, key)
      return el
    },
    value,
  )

/**
 * Sets the title, description, canonical link and social preview for the current page.
 * `noindex` keeps private pages (account, admin) out of search results.
 */
export default function Seo({ title, description = DEFAULT_DESCRIPTION, path = '/', noindex = false }) {
  useEffect(() => {
    const fullTitle = title ? `${title} · Ma’at` : DEFAULT_TITLE
    const url = `${SITE}${path}`

    document.title = fullTitle
    meta('description', description)
    meta('robots', noindex ? 'noindex, nofollow' : 'index, follow')
    meta('og:title', fullTitle, 'property')
    meta('og:description', description, 'property')
    meta('og:url', url, 'property')
    meta('twitter:title', fullTitle)
    meta('twitter:description', description)
    setTag(
      'link[rel="canonical"]',
      () => {
        const el = document.createElement('link')
        el.setAttribute('rel', 'canonical')
        return el
      },
      url,
      'href',
    )
  }, [title, description, path, noindex])

  return null
}
