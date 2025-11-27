import { describe, it, expect } from 'vitest'
import { getIconForScript, formatContextForClipboard, cn } from './utils'

describe('Utils', () => {
  describe('cn', () => {
    it('merges classes correctly', () => {
      expect(cn('c1', 'c2')).toBe('c1 c2')
      expect(cn('c1', { c2: true, c3: false })).toBe('c1 c2')
    })
  })

  describe('getIconForScript', () => {
    it('returns Server for server scripts', () => {
      expect(getIconForScript('start-server')).toBe('Server')
    })

    it('returns Globe for web/dev scripts', () => {
      expect(getIconForScript('dev')).toBe('Globe')
      expect(getIconForScript('start-web')).toBe('Globe')
    })

    it('returns Package for build scripts', () => {
      expect(getIconForScript('build')).toBe('Package')
    })

    it('returns Terminal for unknown scripts', () => {
      expect(getIconForScript('something-random')).toBe('Terminal')
    })
  })

  describe('formatContextForClipboard', () => {
    it('formats context correctly', () => {
      const projectName = 'TestProject'
      const rootDir = '/root'
      const files = [
        { path: '/root/src/index.ts', content: 'console.log("hello")' }
      ]
      
      const expected = `Context for Project: TestProject\n\nFile: src/index.ts\n\`ts\nconsole.log("hello")\n\`\`\n\n`
      
      expect(formatContextForClipboard(projectName, files, rootDir)).toBe(expected)
    })
  })
})
