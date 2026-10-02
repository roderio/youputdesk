import { describe, expect, it } from 'vitest'
import { isArtworkUrl, isSafeExternal } from '../src/main/navigation'

describe('isSafeExternal', () => {
  it('opens web pages', () => {
    expect(isSafeExternal('https://lrclib.net/')).toBe(true)
    expect(isSafeExternal('http://example.com/a?b=c')).toBe(true)
  })
  it('drops schemes that can launch programs or read files', () => {
    for (const url of [
      'file:///C:/Windows/System32/calc.exe',
      'ms-msdt:/id PCWDiagnostic',
      'search-ms:query=x&crumb=location:\\\\evil\\share',
      'javascript:alert(1)',
      'vbscript:msgbox',
      '\\\\host\\share\\run.exe',
      'mailto:a@b.c',
      'not a url',
      '',
    ]) expect(isSafeExternal(url), url).toBe(false)
  })
})

describe('isArtworkUrl', () => {
  it("accepts Google's image hosts over https", () => {
    expect(isArtworkUrl('https://i.ytimg.com/vi/abc/hqdefault.jpg')).toBe(true)
    expect(isArtworkUrl('https://lh3.googleusercontent.com/xyz=w544-h544')).toBe(true)
    expect(isArtworkUrl('https://yt3.ggpht.com/abc')).toBe(true)
  })
  it('rejects anything else', () => {
    expect(isArtworkUrl('http://i.ytimg.com/vi/abc/hqdefault.jpg')).toBe(false)
    expect(isArtworkUrl('https://ytimg.com.evil.example/x.jpg')).toBe(false)
    expect(isArtworkUrl('https://127.0.0.1/admin')).toBe(false)
    expect(isArtworkUrl('https://evil.example/?https://i.ytimg.com/')).toBe(false)
    expect(isArtworkUrl('file:///C:/secret.jpg')).toBe(false)
  })
})
